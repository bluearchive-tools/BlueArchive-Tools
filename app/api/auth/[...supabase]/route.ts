// app/api/auth/[...supabase]/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest, NextResponse } from 'next/server'

/**
 * このファイルが担う役割︓
 * 1) クライアントから来る /api/auth/v1/authorize や /api/auth/v1/token などのリクエストを
 *    Supabase Auth サーバーにプロキシする
 * 2) クッキーの取り扱い（アクセストークンの保存・更新）を補助する
 */

export async function GET(request: NextRequest) {
  // createRouteHandlerClient は cookies を自動で参照してくれる
  const supabase = createRouteHandlerClient({ cookies: request.cookies })
  // GET メソッドのリクエストを Supabase 側に転送
  const { data, error } = await supabase.auth.api.getUserByCookie()
  // 必要に応じてここでエラーハンドリングを入れてもよい
  return NextResponse.json(data ?? { error })
}

export async function POST(request: NextRequest) {
  // POST リクエストはリクエストボディやクエリパラメータをそのまま Supabase に渡す
  const supabase = createRouteHandlerClient({ cookies: request.cookies })
  // たとえば OAuth 認可コードの交換など
  const body = await request.json().catch(() => ({}))
  const { data, error } = await supabase.auth.api.exchangeCodeForSession(body)
  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }
  return NextResponse.json(data)
}
