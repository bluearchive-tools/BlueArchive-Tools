// app/users/[username]/page.tsx
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { colord } from 'colord'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUserCheck } from '@fortawesome/free-solid-svg-icons'
import students from '../../../data/students.json'
import FriendCodeCopy from '../../../components/FriendCodeCopy'
import DecorationInfoButton from '../../../components/DecorationInfoButton'

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
  genre?: string | null
  background_color?: string | null
  text_color?: string | null
  font_family?: string | null
}

type ParsedSocialLink = {
  label: string
  value: string
  service: string
  verified?: boolean
}

const computeReadableTextColor = (backgroundColor?: string | null, preferred?: string | null) => {
  if (preferred) return preferred
  if (!backgroundColor) return undefined
  const parsed = colord(backgroundColor)
  if (!parsed.isValid()) return undefined
  return parsed.isLight() ? '#111827' : '#F9FAFB'
}

const normalizeUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`
  return null
}

const socialValueToUrl = (service: string, value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const direct = normalizeUrl(trimmed)
  if (direct) return direct
  if (service === 'youtube') {
    const handle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
    if (/^UC[A-Za-z0-9_-]{16,}$/.test(trimmed)) {
      return `https://www.youtube.com/channel/${trimmed}`
    }
    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
      return `https://${trimmed}`
    }
    return `https://www.youtube.com/@${handle}`
  }
  if (service === 'x' || service === 'twitter') {
    const handle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
    return `https://x.com/${handle}`
  }
  if (/\.[a-z]{2,}/i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return null
}

const renderVerifiedBadge = () => (
  <span className="relative inline-flex items-center group">
    <FontAwesomeIcon icon={faUserCheck} className="text-green-600" />
    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-max -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition group-hover:opacity-100">
      本人認証済み
      <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-gray-900" />
    </span>
  </span>
)

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
          .select('id, name, emoji, description, style, genre, background_color, text_color, font_family')
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
            service: typeof item?.service === 'string' ? item.service : 'other',
            verified: typeof item?.verified === 'boolean' ? item.verified : false,
          }))
          .filter((item) => item.label.trim() || item.value.trim())
      }
    } catch {
      /* ignore */
    }
    return [] as ParsedSocialLink[]
  })()

  const student = students.find((s) => s.id === profile?.icon_student_id)
  const appliedDecorations = (() => {
    const map = new Map<string, Decoration>()
    ;((decorationData ?? []) as Decoration[]).forEach((d) => {
      const key = d.genre ?? d.id
      if (!map.has(key)) map.set(key, d)
    })
    return Array.from(map.values())
  })()
  const frameDecoration = appliedDecorations.find((d) => d.genre === 'フレーム' || d.style === 'red-gradient' || d.style === 'aurora-frame' || d.style === 'sunset-frame')
  const backgroundDecoration = appliedDecorations.find(
    (d) => d.genre === '背景' || d.background_color || d.style === 'aurora-gradient' || d.style === 'sunset-gradient'
  )
  const textColor =
    backgroundDecoration?.style === 'aurora-gradient' || backgroundDecoration?.style === 'sunset-gradient'
      ? backgroundDecoration.text_color ?? '#F8FAFC'
      : computeReadableTextColor(backgroundDecoration?.background_color, backgroundDecoration?.text_color)
  const fontDecoration = appliedDecorations.find((d) => d.font_family)
  const surfaceStyle =
    backgroundDecoration?.style === 'aurora-gradient'
      ? {
          backgroundImage: 'linear-gradient(120deg, #0ea5e9, #8b5cf6, #22d3ee)',
          backgroundSize: '200% 200%',
          animation: 'ba-aurora 12s ease infinite',
        }
      : backgroundDecoration?.style === 'sunset-gradient'
        ? {
            backgroundImage: 'linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)',
            backgroundSize: '200% 200%',
            animation: 'ba-sunset 10s ease infinite',
          }
        : backgroundDecoration?.background_color
          ? { background: backgroundDecoration.background_color }
          : {}
  const fieldStyle = {
    background: backgroundDecoration?.background_color ?? surfaceStyle.background ?? undefined,
    backgroundImage: surfaceStyle.backgroundImage,
    backgroundSize: surfaceStyle.backgroundSize,
    animation: surfaceStyle.animation,
    color: textColor ?? undefined,
    borderColor: textColor ? 'rgba(255,255,255,0.35)' : undefined,
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {!profile ? (
        <p className="text-gray-600">ユーザーが見つかりませんでした。</p>
      ) : (
        <div
          className={`relative ${frameDecoration?.style === 'aurora-frame'
            ? 'rounded-xl p-[2px] ba-aurora-frame'
            : frameDecoration?.style === 'sunset-frame'
              ? 'rounded-xl p-[2px] ba-sunset-frame'
              : frameDecoration?.style === 'red-gradient'
                ? 'rounded-xl bg-gradient-to-r from-rose-500 via-red-500 to-orange-400 p-[2px]'
                : ''
            }`}
        >
          <div
            className="relative rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4 dark:border-gray-700 dark:bg-gray-900"
            style={{
              background: backgroundDecoration?.background_color ?? surfaceStyle.background ?? undefined,
              backgroundImage: surfaceStyle.backgroundImage,
              backgroundSize: surfaceStyle.backgroundSize,
              animation: surfaceStyle.animation,
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
              <div className="flex-1">
                <p className="text-sm text-gray-500">Tools ID: {profile.username || '—'}</p>
                <h4 className="text-xl font-bold">{profile.nickname || profile.username || 'ユーザー名未設定'}</h4>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <span>Lv {profile.level ?? '—'} / フレンドコード:</span>
                  <FriendCodeCopy code={profile.friend_code} disabled={!profile.friend_code_public} />
                </p>
              </div>
              <DecorationInfoButton decorations={appliedDecorations} />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">自己紹介</p>
              <p className="rounded border p-3 text-sm whitespace-pre-wrap" style={fieldStyle}>
                {profile.bio || '自己紹介はまだ入力されていません。'}
              </p>
            </div>
            {parsedSocial.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm text-gray-600">ソーシャル</p>
                {parsedSocial.map((link, idx) => {
                  const href = socialValueToUrl(link.service, link.value)
                  return (
                    <p key={idx} className="rounded border p-2 text-sm" style={fieldStyle}>
                      {link.label && <span className="font-semibold mr-1">{link.label}:</span>}
                      {link.service === 'youtube' && link.verified && (
                        <span className="mr-1 text-xs">{renderVerifiedBadge()}</span>
                      )}
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-2"
                        >
                          {link.value || '未入力'}
                        </a>
                      ) : (
                        <span>{link.value || '未入力'}</span>
                      )}
                    </p>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes ba-aurora {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            @keyframes ba-sunset {
              0% { background-position: 0% 0%; }
              50% { background-position: 100% 100%; }
              100% { background-position: 0% 0%; }
            }
            .ba-aurora-frame {
              background-image: linear-gradient(120deg, #0ea5e9, #8b5cf6, #22d3ee);
              background-size: 200% 200%;
              animation: ba-aurora 12s ease infinite;
            }
            .ba-sunset-frame {
              background-image: linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6);
              background-size: 200% 200%;
              animation: ba-sunset 10s ease infinite;
            }
          `,
        }}
      />
    </main>
  )
}
