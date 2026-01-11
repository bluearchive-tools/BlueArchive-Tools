import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabase-server'

const ensureAdmin = async () => {
  const auth = createSupabaseRouteClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const { data: profile, error } = await auth
    .from('profiles')
    .select('admin')
    .eq('id', user.id)
    .single()

  if (error || !profile?.admin) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }
  return { auth }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error, auth } = await ensureAdmin()
  if (error) return error

  const { id } = await context.params
  const body = (await request.json()) as {
    action: 'update' | 'approve' | 'delete'
    data?: Record<string, unknown>
    seasonTarget?: string
  }

  if (body.action === 'delete') {
    const { error: delError } = await auth
      .from('tl_pending_videos')
      .delete()
      .eq('id', Number(id))
    if (delError) return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.action === 'update') {
    const payload = {
      ...(body.data ?? {}),
      updated_at: new Date().toISOString(),
    }
    const { error: updateError } = await auth
      .from('tl_pending_videos')
      .update(payload)
      .eq('id', Number(id))
    if (updateError) return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.action === 'approve') {
    const { data: pending, error: pendingError } = await auth
      .from('tl_pending_videos')
      .select('*')
      .eq('id', Number(id))
      .maybeSingle()

    if (pendingError || !pending) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const targetSeason = body.seasonTarget ?? pending.season_target ?? pending.season_guess ?? ''
    const table = targetSeason ? `tl_${targetSeason.toLowerCase()}` : 'tl_unknown'

    const entry = {
      armor: pending.armor ?? '',
      difficulty: pending.difficulty ?? '',
      videoid: pending.videoid,
      score: pending.score ?? '',
      formation: pending.formation ?? '[]',
      guide: pending.guide ?? false,
      formation_status: pending.formation_status ?? 'none',
      title: pending.title ?? '',
      description: pending.description ?? '',
      publishedAt: pending.published_at ?? null,
    }

    const { data: exist, error: existError } = await auth
      .from(table)
      .select('id')
      .eq('videoid', pending.videoid)
      .maybeSingle()

    if (existError) {
      return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
    }

    if (exist?.id) {
      const { error: updateError } = await auth
        .from(table)
        .update(entry)
        .eq('id', exist.id)
      if (updateError) return NextResponse.json({ error: 'approve_update_failed' }, { status: 500 })
    } else {
      const { error: insertError } = await auth
        .from(table)
        .insert(entry)
      if (insertError) return NextResponse.json({ error: 'approve_insert_failed' }, { status: 500 })
    }

    const { error: markError } = await auth
      .from('tl_pending_videos')
      .update({
        status: 'approved',
        season_target: targetSeason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', Number(id))
    if (markError) return NextResponse.json({ error: 'approve_mark_failed' }, { status: 500 })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
}
