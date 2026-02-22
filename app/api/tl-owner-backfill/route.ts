import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { createSupabaseRouteClient } from '@/lib/supabase-server'

type Season = { number: string }

type SocialLink = {
  service?: string
  verified?: boolean
  channelId?: string | null
  biliUid?: string | null
}

const getYouTubeApiKeys = () => {
  const keys =
    process.env.YOUTUBE_API_KEYS?.split(',').map((k) => k.trim()).filter(Boolean) || []
  if (process.env.YOUTUBE_API_KEY && !keys.includes(process.env.YOUTUBE_API_KEY)) {
    keys.push(process.env.YOUTUBE_API_KEY)
  }
  return keys
}

const parseSocialLinks = (raw: unknown): SocialLink[] => {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as SocialLink[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as SocialLink[]) : []
    } catch {
      return []
    }
  }
  return []
}

const toStoredVideoId = (platform: 'youtube' | 'bilibili', id: string) =>
  platform === 'bilibili' ? `bili:${id}` : id

async function fetchYouTubeChannelMap(videoIds: string[]) {
  const out = new Map<string, string>()
  const apiKeys = getYouTubeApiKeys()
  if (apiKeys.length === 0 || videoIds.length === 0) return out
  const base = 'https://www.googleapis.com/youtube/v3/videos?part=snippet&maxResults=50'

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50)
    for (const key of apiKeys) {
      const res = await fetch(`${base}&id=${chunk.join(',')}&key=${key}`)
      if (!res.ok) continue
      const json = (await res.json()) as {
        items?: Array<{ id?: string; snippet?: { channelId?: string } }>
      }
      for (const item of json.items ?? []) {
        if (item?.id && item.snippet?.channelId) {
          out.set(toStoredVideoId('youtube', item.id), item.snippet.channelId)
        }
      }
      break
    }
  }
  return out
}

async function fetchBilibiliMidMap(videoIds: string[]) {
  const out = new Map<string, string>()
  for (const videoid of videoIds) {
    const bvid = videoid.replace(/^bili:/, '')
    try {
      const res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`)
      if (!res.ok) continue
      const json = (await res.json()) as { data?: { owner?: { mid?: string | number } } }
      const mid = json.data?.owner?.mid
      if (mid != null) out.set(videoid, String(mid))
    } catch {
      // ignore
    }
  }
  return out
}

export async function POST() {
  const supabase = createSupabaseRouteClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('admin')
    .eq('id', user.id)
    .single()
  if (!profile?.admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const raidPath = path.join(process.cwd(), 'data', 'raid.json')
    const raid = JSON.parse(await fs.readFile(raidPath, 'utf-8')) as { seasons: Season[] }
    const tableNames = [...raid.seasons.map((s) => `tl_${s.number.toLowerCase()}`), 'tl_unknown']

    const allVideoIds = new Set<string>()
    for (const table of tableNames) {
      const { data } = await supabase.from(table).select('videoid')
      for (const row of (data ?? []) as Array<{ videoid?: string }>) {
        if (row.videoid) allVideoIds.add(row.videoid)
      }
    }

    const videoIds = Array.from(allVideoIds)
    const youtubeIds = videoIds.filter((id) => !id.startsWith('bili:'))
    const bilibiliIds = videoIds.filter((id) => id.startsWith('bili:'))

    const [ytMap, biliMap, profilesRes, settingsRes] = await Promise.all([
      fetchYouTubeChannelMap(youtubeIds),
      fetchBilibiliMidMap(bilibiliIds),
      supabase.from('profiles').select('id, social_links'),
      supabase.from('tl_video_settings').select('videoid, owner_user_id').in('videoid', videoIds),
    ])

    const youtubeOwnerIndex = new Map<string, string>()
    const bilibiliOwnerIndex = new Map<string, string>()
    for (const row of (profilesRes.data ?? []) as Array<{ id: string; social_links?: unknown }>) {
      for (const link of parseSocialLinks(row.social_links)) {
        if (link?.verified !== true) continue
        if (link.service === 'youtube' && typeof link.channelId === 'string' && link.channelId) {
          youtubeOwnerIndex.set(link.channelId, row.id)
        }
        if (link.service === 'bilibili' && typeof link.biliUid === 'string' && link.biliUid) {
          bilibiliOwnerIndex.set(link.biliUid, row.id)
        }
      }
    }

    const existingOwnerMap = new Map<string, string | null>()
    for (const row of (settingsRes.data ?? []) as Array<{ videoid: string; owner_user_id?: string | null }>) {
      existingOwnerMap.set(row.videoid, row.owner_user_id ?? null)
    }

    let updated = 0
    let resolved = 0
    for (const videoid of videoIds) {
      let ownerId: string | undefined
      if (videoid.startsWith('bili:')) {
        const mid = biliMap.get(videoid)
        ownerId = mid ? bilibiliOwnerIndex.get(mid) : undefined
      } else {
        const channelId = ytMap.get(videoid)
        ownerId = channelId ? youtubeOwnerIndex.get(channelId) : undefined
      }
      if (!ownerId) continue
      resolved += 1
      if (existingOwnerMap.get(videoid)) continue
      const { error } = await supabase
        .from('tl_video_settings')
        .upsert({ videoid, owner_user_id: ownerId }, { onConflict: 'videoid' })
      if (!error) updated += 1
    }

    return NextResponse.json({
      success: true,
      scanned: videoIds.length,
      resolved,
      updated,
      unresolved: videoIds.length - resolved,
    })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
