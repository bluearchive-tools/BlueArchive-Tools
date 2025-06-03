// app/api/auth/[...supabase]/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // cookies() は ReadonlyRequestCookies を返す関数なので、型が一致します
  const supabase = createRouteHandlerClient({ cookies })

  // たとえば現在のセッション情報を返す例
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }
  return NextResponse.json({ session })
}

export async function POST(request: NextRequest) {
  // POST の場合も同様に cookies() を使う
  const supabase = createRouteHandlerClient({ cookies })

  // クライアントから送られてきたボディを Supabase に渡す例
  const body = await request.json().catch(() => ({}))
  const { data, error } = await supabase.auth.exchangeCodeForSession(body)
  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }
  return NextResponse.json(data)
}
