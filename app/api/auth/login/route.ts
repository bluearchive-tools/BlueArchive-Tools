// app/api/auth/login/route.ts
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://blue-archive-tools.vercel.app/auth/callback',
    },
  })
  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }
  return NextResponse.redirect(data.url)
}
