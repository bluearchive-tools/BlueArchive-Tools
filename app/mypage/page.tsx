// app/mypage/page.tsx
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { redirect } from 'next/navigation'

export default async function MyPage() {
  // クッキー情報をもとにサーバー側でセッション取得
  const supabase = createServerComponentClient(
        { cookies },
        {
          // サーバーサイドでは絶対URL／キーを使う
          supabaseUrl: process.env.SUPABASE_URL!,
          supabaseKey:  process.env.SUPABASE_ANON_KEY!,
        }
      )
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    // ログインしていなければトップへリダイレクト
    redirect('/')
  }

  return (
    <main>
      <h2>マイページ</h2>
      <p>メールアドレス: {session.user.email}</p>
    </main>
  )
}
