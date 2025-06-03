'use client'

import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useEffect } from 'react'

export default function Home() {
  const session = useSession()
  const supabase = useSupabaseClient()

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://blue-archive-tools.vercel.app/auth/callback',
      },
    })
    if (error) console.error(error.message)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

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
    <button onClick={signIn}>Googleでログイン</button>
  )
}
