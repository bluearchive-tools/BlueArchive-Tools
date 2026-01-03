import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)

  const code = requestUrl.searchParams.get('code')
  const nextParam = requestUrl.searchParams.get('next') ?? '/'
  const ytVerify = requestUrl.searchParams.get('yt_verify')

  // open redirect 対策：アプリ内パスのみ許可
  const safeNext = nextParam.startsWith('/') ? nextParam : '/'

  const supabase = createRouteHandlerClient(
    { cookies },
    {
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_ANON_KEY!,
    }
  )

  if (code) {
    // PKCE の code を session に交換
    await supabase.auth.exchangeCodeForSession(code)
  }

  // 既存ロジック（profile/setup 判定）を維持
  let redirectTo = safeNext
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle()

    if (!data) {
      redirectTo = '/profile/setup'
    }
  }

  const outUrl = new URL(redirectTo, requestUrl)

  // YouTube 検証フローの戻りだけパラメータを引き継ぐ（/mypage へ戻す想定）
  if (ytVerify && redirectTo === safeNext) {
    outUrl.searchParams.set('yt_verify', ytVerify)
  }

  return NextResponse.redirect(outUrl)
}
