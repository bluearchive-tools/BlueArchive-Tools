import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseRouteClient } from '@/lib/supabase-server'

type OwnerProfile = {
  id: string
  username: string | null
  nickname: string | null
  icon_student_id: string | null
}

type VideoOwner = {
  videoid: string
  owner_user_id: string | null
}

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { videoIds?: string[] }
    const videoIds = Array.from(new Set((body.videoIds ?? []).filter(Boolean))).slice(0, 500)
    if (videoIds.length === 0) {
      return NextResponse.json({ ownerByVideo: {}, profiles: {} })
    }

    const adminClient =
      supabaseUrl && serviceRoleKey
        ? createClient(supabaseUrl, serviceRoleKey)
        : createSupabaseRouteClient()

    const { data: settings } = await adminClient
      .from('tl_video_settings')
      .select('videoid, owner_user_id')
      .in('videoid', videoIds)

    const ownerByVideo: Record<string, string> = {}
    const ownerIds = new Set<string>()
    for (const row of (settings ?? []) as VideoOwner[]) {
      if (row.videoid && row.owner_user_id) {
        ownerByVideo[row.videoid] = row.owner_user_id
        ownerIds.add(row.owner_user_id)
      }
    }

    const profiles: Record<string, OwnerProfile> = {}
    if (ownerIds.size > 0) {
      const { data: profileRows } = await adminClient
        .from('profiles')
        .select('id, username, nickname, icon_student_id')
        .in('id', Array.from(ownerIds))

      for (const row of (profileRows ?? []) as OwnerProfile[]) {
        profiles[row.id] = row
      }
    }

    return NextResponse.json({ ownerByVideo, profiles })
  } catch {
    return NextResponse.json({ ownerByVideo: {}, profiles: {} }, { status: 500 })
  }
}
