'use client'

import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useEffect } from 'react'

export default function Home() {
  const session  = useSession()
  const supabase = useSupabaseClient()

  const signIn = () => {
    window.location.href = '/api/auth/login'
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
    <button onClick={signIn}>Google でログイン</button>
  )
}
