'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'

export default function Callback() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const supabase = createPagesBrowserClient()

    const handleAuth = async () => {
      const params = new URLSearchParams(searchParams.toString()) // クエリをコピー
      const { error } = await supabase.auth.exchangeCodeForSession(params)
      if (error) {
        console.error('セッション交換失敗:', error.message)
      }
      router.replace('/')
    }

    handleAuth()
  }, [router, searchParams])

  return <p>ログイン処理中です...</p>
}
