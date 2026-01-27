import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
import { Timeline } from '../../../types/timeline'
import { upsertTimelines } from '../../../lib/tl-fetch'
import { isValidSeasonNumber } from '@/lib/raid-data'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)
const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : null

interface Season {
  number: string
  startDate: string
  endDate: string
  boss?: string
  terrain?: string
  defenseArmors?: string[]
}

async function ensureTables(client: SupabaseClient, seasons: Season[]) {
  // テーブルは事前に手動で作成する想定
  // 存在しない場合はエラーとせずスキップ
  for (const s of seasons) {
    const table = `tl_${s.number.toLowerCase()}`
    const { error } = await client.from(table).select('id').limit(1)
    if (error) continue
  }
  await client.from('tl_unknown').select('id').limit(1)
}

export async function GET(request: Request) {
  try {
    const reqUrl = new URL(request.url)
    const selectedRaw = reqUrl.searchParams.getAll('season')
    const selected = selectedRaw
      .map((season) => season.trim().toUpperCase())
      .filter((season) => season.length > 0)
    const raidPath = path.join(process.cwd(), 'data', 'raid.json')
    const raid = JSON.parse(await fs.readFile(raidPath, 'utf-8'))
    const seasons: Season[] = raid.seasons
    const targets =
      selected.length > 0
        ? seasons.filter((s) => selected.includes(s.number.toUpperCase()))
        : seasons

    await ensureTables(supabase, targets)
    const timelines: Record<string, unknown>[] = []

    for (const s of targets) {
      const table = `tl_${s.number.toLowerCase()}`
      const { data, error } = await supabase.from(table).select('*')
      if (error) continue
      if (data) {
        timelines.push(
          ...(data as Record<string, unknown>[]).map((d) => ({
            ...(d as Record<string, unknown>),
            season: s.number,
          }))
        )
      }
    }
    if (selected.length === 0) {
      const { data: unknown } = await supabase
        .from('tl_unknown')
        .select('*')
      if (unknown)
        timelines.push(
          ...(unknown as Record<string, unknown>[]).map((d) => ({
            ...(d as Record<string, unknown>),
            season: '',
          }))
        )
    }

    const normalized: Timeline[] = timelines.map((t) => {
      const raw = t as {
        id: number
        armor?: string
        difficulty?: string
        videoid: string
        score?: string
        formation?: string
        guide?: boolean
        formation_status?: string
        title?: string
        description?: string
        publishedAt?: string
        season?: string
        thumbnail?: string | null
      }
      const formationVal = raw.formation || '[]'
      const isBilibili = raw.videoid.startsWith('bili:')
      return {
        id: raw.id,
        armor: raw.armor || '',
        difficulty: raw.difficulty || '',
        videoid: raw.videoid,
        platform: isBilibili ? 'bilibili' : 'youtube',
        score: raw.score || '',
        formation: formationVal,
        guide: Boolean(raw.guide),
        formationStatus:
          raw.formation_status ||
          (formationVal && formationVal !== '[]' ? 'auto' : 'none'),
        title: raw.title || '',
        description: raw.description || '',
        publishedAt: raw.publishedAt,
        season: raw.season,
        thumbnail: raw.thumbnail || undefined,
      }
    })

    normalized.sort((a, b) => {
      if (a.armor === '不明' && b.armor !== '不明') return 1
      if (a.armor !== '不明' && b.armor === '不明') return -1
      return parseInt(b.score || '0') - parseInt(a.score || '0')
    })

    return NextResponse.json(normalized)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = createSupabaseRouteClient()

  const { data: { user } } = await auth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: profile, error: pErr } = await auth
    .from('profiles')
    .select('admin')
    .eq('id', user.id)
    .single()

  if (pErr || !profile?.admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const shouldStream = url.searchParams.get('stream') === '1'
    const { season, platform } = await request.json()
    const normalizedPlatform =
      platform === 'youtube' || platform === 'bilibili'
        ? platform
        : platform === 'all' || platform == null
          ? null
          : 'invalid'
    if (normalizedPlatform === 'invalid') {
      return NextResponse.json({ error: 'invalid_platform' }, { status: 400 })
    }
    const normalizedSeason = season ? season.trim().toUpperCase() : null
    if (normalizedSeason && !(await isValidSeasonNumber(normalizedSeason))) {
      return NextResponse.json({ error: 'invalid_season' }, { status: 400 })
    }
    const raidPath = path.join(process.cwd(), 'data', 'raid.json')
    const raid = JSON.parse(await fs.readFile(raidPath, 'utf-8'))
    const seasons: Season[] = raid.seasons

    const writer = supabaseAdmin ?? auth
    await ensureTables(writer, seasons)

    if (shouldStream) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          const push = (payload: unknown) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
          }
          try {
            const result = await upsertTimelines({
              supabase: writer,
              seasons,
              season: normalizedSeason,
              log: (message) => push({ type: 'log', message }),
              platform: normalizedPlatform,
            })
            push({ type: 'done', success: true, debug: result })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'unknown'
            push({ type: 'done', success: false, error: message })
          } finally {
            controller.close()
          }
        },
      })
      return new Response(stream, {
        headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
      })
    }

    const logs: string[] = []
    const result = await upsertTimelines({
      supabase: writer,
      seasons,
      season: normalizedSeason,
      log: (message) => logs.push(message),
      platform: normalizedPlatform,
    })

    return NextResponse.json({ success: true, debug: result, logs })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
