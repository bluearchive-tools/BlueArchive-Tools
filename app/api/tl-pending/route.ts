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

export async function GET() {
  const { error, auth } = await ensureAdmin()
  if (error) return error

  const { data, error: listError } = await auth
    .from('tl_pending_videos')
    .select('*')
    .order('updated_at', { ascending: false })

  if (listError) {
    return NextResponse.json({ error: 'failed_to_load' }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}
