// app/mypage/page.tsx
import { cookies } from 'next/headers'
import Link from 'next/link'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { redirect } from 'next/navigation'
import PageHelpButton from '../../components/PageHelpButton'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', session.user.id)
    .maybeSingle()

  return (
    <main>
      <div className="flex items-center gap-2 mb-2">
        <h2>マイページ</h2>
        <PageHelpButton pageKey="mypage" />
      </div>
      {profile?.username && (
        <p>
          ユーザー名: {profile.username}{' '}
          <Link href="/profile/setup" className="text-blue-500 underline">
            変更
          </Link>
        </p>
      )}
      <p>メールアドレス: {session.user.email}</p>
    </main>
  )
}
