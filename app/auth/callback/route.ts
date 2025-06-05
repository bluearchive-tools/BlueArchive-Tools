import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  const supabase = createRouteHandlerClient(
    { cookies },
    {
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_ANON_KEY!,
    }
  )

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  let redirectTo = '/'
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

  return NextResponse.redirect(new URL(redirectTo, requestUrl))
}
