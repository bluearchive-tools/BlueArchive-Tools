// app/mypage/page.tsx
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { redirect } from 'next/navigation'
import PageHelpButton from '../../components/PageHelpButton'
import MyPageClient from '../../components/MyPageClient'

export default async function MyPage() {
  const supabase = createServerComponentClient(
    { cookies },
    {
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_ANON_KEY!,
    }
  )
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, level, bio, icon_student_id')
    .eq('id', session.user.id)
    .maybeSingle()

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">マイページ</h2>
          <PageHelpButton pageKey="mypage" />
        </div>
      </div>
      <MyPageClient
        initialUsername={profile?.username ?? null}
        initialEmail={session.user.email ?? null}
        initialLevel={profile?.level ?? null}
        initialBio={profile?.bio ?? null}
        initialIconStudentId={profile?.icon_student_id ?? null}
      />
    </main>
  )
}
