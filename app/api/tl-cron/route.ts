import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
import { upsertTimelines } from '../../../lib/tl-fetch'

interface Season {
  number: string
  startDate: string
  endDate: string
  type: string
  boss?: string
  terrain?: string
  defenseArmors?: string[]
  maxDifficulty?: string
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null
async function ensureTables(seasons: Season[]) {
  for (const s of seasons) {
    const table = `tl_${s.number.toLowerCase()}`
    const { error } = await supabase.from(table).select('id').limit(1)
    if (error) continue
  }
  await supabase.from('tl_unknown').select('id').limit(1)
}

export async function GET(request: Request) {
  try {
    // cronシークレットによる認証チェック
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = request.headers.get('authorization')
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      }
    }
    const raidPath = path.join(process.cwd(), 'data', 'raid.json')
    const raid = JSON.parse(await fs.readFile(raidPath, 'utf-8'))
    const seasons: Season[] = raid.seasons
    const targets = seasons.filter(
      (s) => s.type === '総力戦' || s.type === '大決戦'
    )
    if (!targets.length) return NextResponse.json({ updated: 0 })
    targets.sort(
      (a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    )
    const latest = targets[0]
    if (!supabaseAdmin) {
      return NextResponse.json({ updated: 0, error: 'missing_service_role_key' }, { status: 500 })
    }
    await ensureTables(seasons)
    const result = await upsertTimelines({
      supabase: supabaseAdmin,
      seasons,
      season: latest.number,
    })

    return NextResponse.json({ season: latest.number, updated: result.updated })
  } catch {
    return NextResponse.json({ updated: 0 }, { status: 500 })
  }
}
