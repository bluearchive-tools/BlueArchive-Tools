// app/users/[username]/page.tsx
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { colord, extend } from 'colord'
import a11yPlugin from 'colord/plugins/a11y'
import students from '../../../data/students.json'
import FriendCodeCopy from '../../../components/FriendCodeCopy'
import DecorationInfoButton from '../../../components/DecorationInfoButton'

extend([a11yPlugin])

type Params = {
  params: Promise<{
    username: string
  }>
}

type Decoration = {
  id: string
  name: string
  emoji: string
  description?: string | null
  style?: string | null
  background_color?: string | null
  text_color?: string | null
  font_family?: string | null
}

const computeReadableTextColor = (backgroundColor?: string | null, preferred?: string | null) => {
  if (preferred) return preferred
  if (!backgroundColor) return undefined
  const parsed = colord(backgroundColor)
  if (!parsed.isValid()) return undefined
  const luminance = parsed.luminance()
  return luminance > 0.5 ? '#111827' : '#F9FAFB'
}

export default async function UserPage({ params }: Params) {
  const { username } = await params

  const supabase = createServerComponentClient(
    { cookies },
    {
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_ANON_KEY!,
    }
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'username, nickname, level, bio, icon_student_id, friend_code, friend_code_public, social_links, decoration_id, decoration_ids'
    )
    .eq('username', username)
    .maybeSingle()

  const appliedDecorationIds =
    (profile?.decoration_ids as string[] | null) ??
    (profile?.decoration_id ? [profile.decoration_id as string] : []) ??
    []

  const { data: decorationData } =
    appliedDecorationIds.length > 0
      ? await supabase
          .from('decorations')
          .select('id, name, emoji, description, style, background_color, text_color, font_family')
          .in('id', appliedDecorationIds)
      : { data: [] as Decoration[] }

  const parsedSocial = (() => {
    try {
      const value = profile?.social_links ? JSON.parse(profile.social_links as unknown as string) : []
      if (Array.isArray(value)) {
        return value
          .map((item) => ({
            label: typeof item?.label === 'string' ? item.label : '',
            value: typeof item?.value === 'string' ? item.value : '',
          }))
          .filter((item) => item.label.trim() || item.value.trim())
      }
    } catch {
      /* ignore */
    }
    return [] as { label: string; value: string }[]
  })()

  const student = students.find((s) => s.id === profile?.icon_student_id)
  const appliedDecorations = ((decorationData ?? []) as Decoration[]).filter(Boolean)
  const isRedFrame = appliedDecorations.some((d) => d.style === 'red-gradient')
  const backgroundDecoration = appliedDecorations.find((d) => d.background_color)
  const textColor = computeReadableTextColor(backgroundDecoration?.background_color, backgroundDecoration?.text_color)
  const fontDecoration = appliedDecorations.find((d) => d.font_family)

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {!profile ? (
        <p className="text-gray-600">ユーザーが見つかりませんでした。</p>
      ) : (
        <div className={isRedFrame ? 'rounded-xl bg-gradient-to-r from-rose-500 via-red-500 to-orange-400 p-[2px]' : ''}>
            <div
              className="relative rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4 dark:border-gray-700 dark:bg-gray-900"
              style={{
              background: backgroundDecoration?.background_color ?? undefined,
              color: textColor ?? undefined,
              fontFamily: fontDecoration?.font_family ?? undefined,
              }}
            >
            <div className="flex items-center gap-4">
              {student ? (
                <img
                  src={student.image}
                  alt={student.name}
                  className="h-16 w-16 rounded-xl object-cover border border-gray-200"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-gray-200 border border-gray-200" />
              )}
              <div>
                <p className="text-sm text-gray-500">Tools ID: {profile.username}</p>
                <h2 className="text-xl font-semibold">{profile.nickname || profile.username}</h2>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <span>Lv {profile.level ?? '—'} / フレンドコード:</span>
                  <FriendCodeCopy code={profile.friend_code} disabled={!profile.friend_code_public} />
                </p>
              </div>
            </div>
            <DecorationInfoButton decorations={appliedDecorations} />
            <div className="space-y-2">
              <p className="text-sm text-gray-600">自己紹介</p>
              <p className="rounded border border-gray-200 bg-gray-50 p-3 text-sm whitespace-pre-wrap">
                {profile.bio || '自己紹介はまだ入力されていません。'}
              </p>
            </div>
            {parsedSocial.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">ソーシャル</p>
                {parsedSocial.map((link, idx) => (
                  <p key={idx} className="rounded border border-gray-200 bg-gray-50 p-2 text-sm">
                    {link.label && <span className="font-semibold mr-1">{link.label}:</span>}
                    <span>{link.value || '未入力'}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
