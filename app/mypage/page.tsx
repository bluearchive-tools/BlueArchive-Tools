// app/mypage/page.tsx
import { cookies } from 'next/headers'
import { createServerComponentSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { redirect } from 'next/navigation'

export default async function MyPage() {
  // クッキー情報をもとにサーバー側でセッション取得
  const supabase = createServerComponentSupabaseClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    // ログインしていなければトップへリダイレクト
    redirect('/')
  }

  return (
    <main>
      <h1>マイページ</h1>
      <p>メールアドレス: {session.user.email}</p>
    </main>
  )
}
