// app/page.tsx
'use client'

import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'

export default function Home() {
  const session  = useSession()
  const supabase = useSupabaseClient()

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
      }
    })
    if (error) console.error(error.message)
  }
  const signOut = async () => {
    await supabase.auth.signOut()
  }

  // （次のステップで使うので、このまま残しておきます）
  useEffect(() => {
    if (session) {
      console.log('ログイン済み:', session.user.email)
    }
  }, [session])

  return session ? (
    <div>
      <p>こんにちは、{session.user.email} さん</p>
      <button onClick={signOut}>サインアウト</button>
    </div>
  ) : (
    <button onClick={signIn}>Google でログイン</button>
  )
}
