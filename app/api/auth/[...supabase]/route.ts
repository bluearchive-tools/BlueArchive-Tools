// app/api/auth/[...supabase]/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }
  return NextResponse.json({ session })
}

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  const body = await request.json().catch(() => ({}))
  const { data, error } = await supabase.auth.exchangeCodeForSession(body)
  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }
  return NextResponse.json(data)
}
