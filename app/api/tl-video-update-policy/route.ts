import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const auth = createSupabaseRouteClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await auth
    .from('profiles')
    .select('admin')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    videoid?: string
    skipUpdate?: boolean
  }
  if (!body.videoid) {
    return NextResponse.json({ error: 'invalid_videoid' }, { status: 400 })
  }

  if (body.skipUpdate) {
    const { error } = await auth
      .from('tl_video_update_policy')
      .upsert(
        { videoid: body.videoid, skip_update: true, updated_at: new Date().toISOString() },
        { onConflict: 'videoid' }
      )
    if (error) {
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }
  } else {
    const { error } = await auth
      .from('tl_video_update_policy')
      .delete()
      .eq('videoid', body.videoid)
    if (error) {
      return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
