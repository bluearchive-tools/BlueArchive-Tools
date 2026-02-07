import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabase-server'

const API_KEYS =
  process.env.YOUTUBE_API_KEYS?.split(',')
    .map((k) => k.trim())
    .filter(Boolean) || []

if (process.env.YOUTUBE_API_KEY && !API_KEYS.includes(process.env.YOUTUBE_API_KEY)) {
  API_KEYS.push(process.env.YOUTUBE_API_KEY)
}

export async function GET(request: Request) {
  // 認証チェック: ログインユーザーのみ利用可能
  const auth = createSupabaseRouteClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const url = new URL(request.url)
  const videoid = url.searchParams.get('videoid')
  if (!videoid) {
    return NextResponse.json({ error: 'missing videoid' }, { status: 400 })
  }
  if (API_KEYS.length === 0) {
    return NextResponse.json({ error: 'missing api key' }, { status: 503 })
  }

  const endpoint =
    'https://www.googleapis.com/youtube/v3/videos?part=snippet&maxResults=1&id=' +
    encodeURIComponent(videoid)

  for (const key of API_KEYS) {
    const res = await fetch(`${endpoint}&key=${key}`)
    if (!res.ok) continue
    const json = (await res.json()) as {
      items?: Array<{ snippet?: { channelId?: string } }>
    }
    const channelId = json.items?.[0]?.snippet?.channelId
    if (channelId) {
      return NextResponse.json({ channelId })
    }
    return NextResponse.json({ channelId: null })
  }

  return NextResponse.json({ error: 'failed to fetch' }, { status: 502 })
}
