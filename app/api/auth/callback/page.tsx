// app/auth/callback/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'

export default function Callback() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createPagesBrowserClient()

    const handleAuth = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession()
      if (error) {
        console.error('セッション交換失敗:', error.message)
      }
      // ログイン完了後にトップページへ
      router.replace('/')
    }

    handleAuth()
  }, [router])

  return <p>ログイン処理中です...</p>
}
