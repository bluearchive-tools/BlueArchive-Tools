'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Suspense } from 'react'

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const supabase = createPagesBrowserClient()
    const exchange = async () => {
      const queryString = searchParams.toString()
      const { error } = await supabase.auth.exchangeCodeForSession(queryString)
      if (error) {
        console.error('セッション交換失敗:', error.message)
      }
      router.replace('/')
    }
    exchange()
  }, [router, searchParams])

  return <p>ログイン処理中です...</p>
}

export default function Callback() {
  return (
    <Suspense fallback={<p>読み込み中...</p>}>
      <CallbackInner />
    </Suspense>
  )
}
