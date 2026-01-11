import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const indexParam = requestUrl.searchParams.get('index')
  const origin = requestUrl.origin

  const baseUrl = process.env.BILI_AUTH_BASE_URL
  const clientId = process.env.BILI_AUTH_CLIENT_ID

  if (!baseUrl || !clientId) {
    const redirect = new URL('/mypage', origin)
    redirect.searchParams.set('message', encodeURIComponent('Bilibili 認証の設定が不足しています。管理者に確認してください。'))
    return NextResponse.redirect(redirect)
  }

  const redirectUri = new URL('/auth/bilibili/callback', origin).toString()
  const authUrl = new URL('/oauth/authorize', baseUrl)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)

  const res = NextResponse.redirect(authUrl)
  if (indexParam) {
    res.cookies.set('ba_bili_verify', encodeURIComponent(JSON.stringify({ index: indexParam })), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
  }
  return res
}
