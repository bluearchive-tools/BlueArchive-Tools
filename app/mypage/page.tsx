// app/mypage/page.tsx
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import PageHelpButton from '../../components/PageHelpButton'
import MyPageClient from '../../components/MyPageClient'

export default async function MyPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient(
    { cookies: () => cookieStore } as any,
    {
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_ANON_KEY!,
    }
  )
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { data: profile } = session
    ? await supabase
        .from('profiles')
        .select(
          'username, nickname, level, bio, icon_student_id, friend_code, friend_code_public, social_links, tl_default_settings, decoration_id, decoration_ids, decoration_inventory, credit'
        )
        .eq('id', session.user.id)
        .maybeSingle()
    : { data: null }

  const { data: decorations } = await supabase
    .from('decorations')
    .select('id, name, emoji, description, price, style, genre, tags, background_color, text_color, font_family, bonus_credit, is_active')
    .eq('is_active', true)

  return (
    <main className="max-w-none mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">設定</h2>
          <PageHelpButton pageKey="mypage" />
        </div>
      </div>
      <MyPageClient
        initialUsername={profile?.username ?? null}
        initialNickname={profile?.nickname ?? null}
        initialEmail={session?.user.email ?? null}
        initialLevel={profile?.level ?? null}
        initialBio={profile?.bio ?? null}
        initialIconStudentId={profile?.icon_student_id ?? null}
        initialFriendCode={profile?.friend_code ?? null}
        initialFriendCodePublic={profile?.friend_code_public ?? null}
        initialSocialLinks={profile?.social_links ?? null}
        initialTlDefaults={profile?.tl_default_settings ?? null}
        initialDecorationIds={
          (profile?.decoration_ids as string[] | null) ??
          (profile?.decoration_id ? [profile.decoration_id as string] : []) ??
          []
        }
        initialDecorationInventory={(profile?.decoration_inventory as string[] | null) ?? []}
        initialDecorations={decorations ?? []}
      />
    </main>
  )
}
