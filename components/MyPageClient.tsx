'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import type { UserIdentity } from '@supabase/supabase-js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDiscord, faGoogle } from '@fortawesome/free-brands-svg-icons'
import { faEye, faEyeSlash, faLink, faUnlink, faUserCircle } from '@fortawesome/free-solid-svg-icons'
import students from '../data/students.json'
import FriendCodeCopy from './FriendCodeCopy'
import DecorationInfoButton from './DecorationInfoButton'
import { colord } from 'colord'

interface Props {
  initialUsername: string | null
  initialNickname: string | null
  initialEmail: string | null
  initialLevel: number | null
  initialBio: string | null
  initialIconStudentId: string | null
  initialFriendCode: string | null
  initialFriendCodePublic: boolean | null
  initialSocialLinks: string | null
  initialDecorationIds: string[]
  initialDecorationInventory: string[]
  initialDecorations: {
    id: string
    name: string
    emoji: string
    description?: string
    price?: number
    style?: string
    genre?: string
    tags?: string[]
    background_color?: string | null
    text_color?: string | null
    font_family?: string | null
  }[]
}


type SocialService = 'x' | 'youtube' | 'other'
type SocialLink = { service: SocialService; label: string; value: string }

const detectSocialService = (label: string): SocialService => {
  const s = label.trim().toLowerCase()
  if (!s) return 'other'
  if (s === 'x' || s.includes('twitter')) return 'x'
  if (s.includes('youtube')) return 'youtube'
  return 'other'
}

const socialLabel = (service: SocialService, customLabel: string) => {
  if (service === 'x') return 'X'
  if (service === 'youtube') return 'YouTube'
  return customLabel.trim() || 'その他'
}

const socialPlaceholder = (service: SocialService) => {
  if (service === 'x') return '例: @username / https://x.com/...'
  if (service === 'youtube') return '例: https://www.youtube.com/@...'
  return 'リンクやID'
}


export default function MyPageClient({
  initialUsername,
  initialNickname,
  initialEmail,
  initialLevel,
  initialBio,
  initialIconStudentId,
  initialFriendCode,
  initialFriendCodePublic,
  initialSocialLinks,
  initialDecorationIds,
  initialDecorationInventory,
  initialDecorations
}: Props) {
  const supabase = useSupabaseClient()
  const session = useSession()
  const [username, setUsername] = useState(initialUsername ?? '')
  const [nickname, setNickname] = useState(initialNickname ?? '')
  const email = initialEmail ?? ''
  const [level, setLevel] = useState<number | ''>(initialLevel ?? '')
  const [bio, setBio] = useState(initialBio ?? '')
  const [iconStudentId, setIconStudentId] = useState(initialIconStudentId ?? '')
  const [friendCode, setFriendCode] = useState(initialFriendCode ?? '')
  const [friendCodePublic, setFriendCodePublic] = useState<boolean>(initialFriendCodePublic ?? false)
  const [decorationIds, setDecorationIds] = useState<string[]>(initialDecorationIds ?? [])
  const [decorationInventory] = useState<string[]>(initialDecorationInventory ?? [])
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(
    (() => {
      try {
        const parsed = initialSocialLinks ? JSON.parse(initialSocialLinks) : []
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item) => ({
              label: typeof item?.label === 'string' ? item.label : '',
              value: typeof item?.value === 'string' ? item.value : '',
            }))
            .map((item) => {
              const service = detectSocialService(item.label)
              return {
                service,
                label: service === 'other' ? item.label : '',
                value: item.value,
              } satisfies SocialLink
            })
            .filter((item) =>
              item.service === 'other' ? item.label.trim() || item.value.trim() : item.value.trim()
            )
          if (normalized.length > 0) return normalized
        }
      } catch {
        /* ignore */
      }
      return [{ service: 'other', label: '', value: '' }]
    })()
  )

  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [busy, setBusy] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [showUserId, setShowUserId] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [showUnowned, setShowUnowned] = useState(false)
  const profileRef = useRef<HTMLElement | null>(null)
  const accountRef = useRef<HTMLElement | null>(null)
  const linksRef = useRef<HTMLElement | null>(null)

  const fetchIdentities = async () => {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      console.error(error.message)
      return
    }
    setIdentities((data?.user?.identities as UserIdentity[]) ?? [])
  }

  useEffect(() => {
    fetchIdentities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLink = async (provider: 'google' | 'discord') => {
    setBusy(true)
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined
    const { data, error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo }
    })
    setBusy(false)
    if (error) {
      console.error(error.message)
      return
    }
    if (data?.url) {
      window.location.assign(data.url)
    }
  }

  const handleUnlink = async (identity: UserIdentity) => {
    setBusy(true)
    const { error } = await supabase.auth.unlinkIdentity(identity)
    setBusy(false)
    if (error) {
      console.error(error.message)
      return
    }
    fetchIdentities()
  }

  const providerIcon = useMemo(
    () => ({
      google: faGoogle,
      discord: faDiscord
    }),
    []
  )

  const identityEmail = (identity: UserIdentity) => {
    const raw = (identity.identity_data as Record<string, unknown> | undefined)?.email
    return typeof raw === 'string' ? raw : null
  }

  const linkedProviders = new Set(identities.map((id) => id.provider))

  const selectedStudent = useMemo(() => students.find((s) => s.id === iconStudentId), [iconStudentId])
  const selectedDecorations = useMemo(() => {
    const byGenre = new Map<string, (typeof initialDecorations)[number]>()
    initialDecorations.forEach((d) => {
      if (!decorationIds.includes(d.id)) return
      const key = d.genre ?? d.id
      if (!byGenre.has(key)) byGenre.set(key, d)
    })
    return Array.from(byGenre.values())
  }, [decorationIds, initialDecorations])
  const hasRedFrame = useMemo(
    () => selectedDecorations.some((d) => d.style === 'red-gradient'),
    [selectedDecorations]
  )
  const backgroundDecoration = useMemo(
    () =>
      selectedDecorations.find(
        (d) => d.background_color || d.style === 'aurora-gradient' || d.style === 'sunset-gradient' || d.genre === '背景'
      ),
    [selectedDecorations]
  )
  const fontDecoration = useMemo(() => selectedDecorations.find((d) => d.font_family), [selectedDecorations])
  const textColor =
    backgroundDecoration?.style === 'aurora-gradient' || backgroundDecoration?.style === 'sunset-gradient'
      ? backgroundDecoration.text_color ?? '#F8FAFC'
      : backgroundDecoration?.background_color
        ? (() => {
            const parsed = colord(backgroundDecoration.background_color)
            return parsed.isValid() ? (parsed.isLight() ? '#111827' : '#F9FAFB') : undefined
          })()
        : undefined
  const previewStyle =
    backgroundDecoration?.style === 'aurora-gradient'
      ? { backgroundImage: 'linear-gradient(120deg, #0ea5e9, #8b5cf6, #22d3ee)', backgroundSize: '200% 200%', animation: 'ba-aurora 12s ease infinite' }
      : backgroundDecoration?.style === 'sunset-gradient'
        ? { backgroundImage: 'linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)', backgroundSize: '200% 200%', animation: 'ba-sunset 10s ease infinite' }
        : backgroundDecoration?.background_color
          ? { background: backgroundDecoration.background_color }
          : {}
  const fieldStyle = {
    background: backgroundDecoration?.background_color ?? previewStyle.background ?? undefined,
    backgroundImage: previewStyle.backgroundImage,
    backgroundSize: previewStyle.backgroundSize,
    animation: previewStyle.animation,
    color: textColor ?? undefined,
    borderColor: textColor ? 'rgba(255,255,255,0.35)' : undefined,
  }
  const frameDecoration = useMemo(
    () =>
      selectedDecorations.find(
        (d) => d.genre === 'フレーム' || d.style === 'red-gradient' || d.style === 'aurora-frame' || d.style === 'sunset-frame'
      ),
    [selectedDecorations]
  )

  const decorationsByGenre = useMemo(() => {
    const map = new Map<string, (typeof initialDecorations)[number][]>()
    initialDecorations.forEach((d) => {
      if (!showUnowned && !decorationInventory.includes(d.id)) return
      const genre = d.genre ?? 'その他'
      if (!map.has(genre)) map.set(genre, [])
      map.get(genre)!.push(d)
    })
    return Array.from(map.entries())
  }, [initialDecorations, decorationInventory, showUnowned])

  const toggleDecoration = (itemId: string) => {
    const item = initialDecorations.find((d) => d.id === itemId)
    if (!item) return
    if (!decorationInventory.includes(itemId)) return
    const key = item.genre ?? item.id
    setDecorationIds((prev) => {
      const filtered = prev.filter((id) => {
        const current = initialDecorations.find((d) => d.id === id)
        const currentKey = current?.genre ?? current?.id
        return currentKey !== key
      })
      const alreadySelected = prev.includes(itemId)
      return alreadySelected ? filtered : [...filtered, itemId]
    })
  }

  const copyUserId = async () => {
    if (!session?.user.id) return
    try {
      await navigator.clipboard.writeText(session.user.id)
      setMessage('User ID をコピーしました')
    } catch (err) {
      console.error(err)
      setMessage('コピーに失敗しました')
    }
  }

  

  const normalizedSocialLinks = useMemo(() => {
    return socialLinks
      .map((link) => {
        const trimmedLabel = link.label.trim()
        const trimmedValue = link.value.trim()
        const keep = link.service === 'other' ? trimmedLabel || trimmedValue : trimmedValue
        return {
          keep,
          label: socialLabel(link.service, trimmedLabel),
          value: link.value,
        }
      })
      .filter((x) => x.keep)
      .map(({ label, value }) => ({ label, value }))
  }, [socialLinks])
const saveProfile = async () => {
    if (!session?.user) return
    setSavingProfile(true)
    setMessage(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        username,
        nickname,
        level: level === '' ? null : level,
        bio,
        icon_student_id: iconStudentId || null,
        friend_code: friendCode || null,
        friend_code_public: friendCodePublic,
        decoration_ids: decorationIds,
        decoration_inventory: decorationInventory,
        social_links: JSON.stringify(normalizedSocialLinks),
      })
      .eq('id', session.user.id)
    setSavingProfile(false)
    if (error) {
      setMessage(`プロフィールの更新に失敗しました: ${error.message}`)
      return
    }
    setMessage('プロフィールを更新しました')
  }

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  useEffect(() => {
    if (previewOpen) {
      const id = setTimeout(() => setPreviewVisible(true), 10)
      return () => clearTimeout(id)
    }
    setPreviewVisible(false)
  }, [previewOpen])

  return (
    <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
      <aside className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <nav className="space-y-2">
          <button
            className="w-full text-left rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={() => scrollTo(profileRef)}
          >
            プロフィール設定
          </button>
          <button
            className="w-full text-left rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={() => scrollTo(accountRef)}
          >
            アカウント設定
          </button>
          <button
            className="w-full text-left rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={() => scrollTo(linksRef)}
          >
            連携サービス
          </button>
        </nav>
      </aside>

      <div className="space-y-6">
        {message && <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>}

        <section
          ref={profileRef as unknown as React.RefObject<HTMLElement>}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex items-center gap-3 mb-4">
            <FontAwesomeIcon icon={faUserCircle} className="text-3xl text-gray-500" />
            <div>
              <h2 className="text-xl font-semibold">プロフィール設定</h2>
              <p className="text-sm text-gray-500">ユーザー名やプロフィール情報を編集できます</p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="block text-sm text-gray-600">
              ニックネーム（表示名、12文字まで）
              <input
                value={nickname}
                maxLength={12}
                onChange={(e) => setNickname(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 先生"
              />
            </label>

            <label className="block text-sm text-gray-600">
              ユーザー名
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ユーザー名"
              />
            </label>

            <label className="block text-sm text-gray-600">
              ブルアカ レベル
              <input
                value={level}
                onChange={(e) => setLevel(e.target.value === '' ? '' : Number(e.target.value))}
                type="number"
                min={1}
                max={999}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 85"
              />
            </label>

            <label className="block text-sm text-gray-600">
              自己紹介
              <textarea
                value={bio}
                maxLength={100}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ひとこと自己紹介を書いてください"
              />
            </label>

            <label className="block text-sm text-gray-600">
              お気に入りの生徒アイコン
              <div className="mt-1 flex items-center gap-3">
                {selectedStudent ? (
                  <img
                    src={selectedStudent.image}
                    alt={selectedStudent.name}
                    className="h-12 w-12 rounded-xl object-cover border border-gray-200"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-gray-200 border border-gray-200" />
                )}
                <select
                  value={iconStudentId}
                  onChange={(e) => setIconStudentId(e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">選択してください</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <div className="space-y-2">
              <p className="text-sm text-gray-600">ソーシャルアカウント</p>
              {socialLinks.map((link, idx) => (
                <div key={idx} className="flex flex-col gap-2 rounded border border-gray-200 p-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={link.service}
                      onChange={(e) => {
                        const service = e.target.value as SocialService
                        const next = [...socialLinks]
                        next[idx] = { ...next[idx], service }
                        setSocialLinks(next)
                      }}
                      className="rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-40"
                    >
                      <option value="x">X</option>
                      <option value="youtube">YouTube</option>
                      <option value="other">その他</option>
                    </select>

                    {link.service === 'other' ? (
                      <input
                        value={link.label}
                        onChange={(e) => {
                          const next = [...socialLinks]
                          next[idx] = { ...next[idx], label: e.target.value }
                          setSocialLinks(next)
                        }}
                        className="flex-1 rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="サービス名 (例: Discord)"
                      />
                    ) : (
                      <input
                        value={socialLabel(link.service, link.label)}
                        disabled
                        className="flex-1 rounded border border-gray-300 bg-gray-100 px-3 py-2 text-base text-gray-500"
                      />
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={link.value}
                      onChange={(e) => {
                        const next = [...socialLinks]
                        next[idx] = { ...next[idx], value: e.target.value }
                        setSocialLinks(next)
                      }}
                      className="flex-1 rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={socialPlaceholder(link.service)}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSocialLinks((prev) =>
                          prev.length === 1
                            ? [{ service: 'other', label: '', value: '' }]
                            : prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="rounded border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setSocialLinks((prev) => [...prev, { service: 'other', label: '', value: '' }])
                }
                className="inline-flex items-center justify-center rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
              >
                ＋ 追加
              </button>
            </div>

            <label className="block text-sm text-gray-600">
              フレンドコード
              <input
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="フレンドコードを入力"
              />
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={friendCodePublic}
                  onChange={(e) => setFriendCodePublic(e.target.checked)}
                />
                公開する
              </label>
            </label>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">デコレーション</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUnowned((v) => !v)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50"
                  >
                    {showUnowned ? '未購入を隠す' : '未購入を表示'}
                  </button>
                  <a href="/decorations" className="text-sm text-blue-600 hover:underline">
                    デコレーションショップへ
                  </a>
                </div>
              </div>
              <p className="text-sm text-gray-600">カテゴリごとに1つ選択できます。</p>
              <div className="space-y-3">
                {decorationsByGenre.map(([genre, items]) => (
                  <div key={genre} className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700">{genre}</p>
                    <div className="grid gap-2">
                      {items.map((item) => {
                        const owned = decorationInventory.includes(item.id)
                        const checked = decorationIds.includes(item.id)
                        return (
                          <label
                            key={item.id}
                            className={`flex items-start gap-3 rounded border p-3 text-sm ${
                              checked ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'
                            } dark:border-gray-700 dark:bg-gray-800`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!owned}
                              onChange={() => toggleDecoration(item.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-lg" aria-hidden>
                                  {item.emoji}
                                </span>
                                <p className="font-semibold">{item.name}</p>
                                {!owned && <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">未購入</span>}
                              </div>
                              <p className="text-gray-600">{item.description}</p>
                              {item.style === 'red-gradient' && <p className="text-xs text-rose-600">効果: 赤グラデーション枠</p>}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {savingProfile ? '保存中...' : '保存'}
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                プレビュー
              </button>
            </div>
          </div>
        </section>

        <section
          ref={accountRef as unknown as React.RefObject<HTMLElement>}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">アカウント設定</h3>
              <p className="text-sm text-gray-500">ログインメールと User ID</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">メールアドレス</p>
              <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-base">{email || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Supabase User ID</p>
              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-100 px-2 py-1 text-xs break-all">
                  {showUserId ? session?.user.id : '●●●●●●●●●●●●●●●●●●●'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowUserId((v) => !v)}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                >
                  <FontAwesomeIcon icon={showUserId ? faEyeSlash : faEye} />
                  {showUserId ? '隠す' : '表示'}
                </button>
                <button
                  type="button"
                  onClick={copyUserId}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                >
                  コピー
                </button>
              </div>
            </div>
          </div>
        </section>

        <section
          ref={linksRef as unknown as React.RefObject<HTMLElement>}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">連携サービス</h3>
              <p className="text-sm text-gray-500">Google / Discord との紐付け管理</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleLink('google')}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              >
                <FontAwesomeIcon icon={faGoogle} />
                {linkedProviders.has('google') ? '再連携' : 'Google を連携'}
              </button>
              <button
                onClick={() => handleLink('discord')}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              >
                <FontAwesomeIcon icon={faDiscord} />
                {linkedProviders.has('discord') ? '再連携' : 'Discord を連携'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {identities.length === 0 && <p className="text-sm text-gray-500">まだ外部サービスは連携されていません。</p>}
            {identities.map((identity) => (
              <div
                key={identity.identity_id}
                className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <FontAwesomeIcon icon={providerIcon[identity.provider as 'google' | 'discord'] ?? faLink} />
                  <div>
                    <p className="font-medium capitalize">{identity.provider}</p>
                    {identityEmail(identity) && <p className="text-sm text-gray-500">{identityEmail(identity)}</p>}
                    {identity.last_sign_in_at && (
                      <p className="text-xs text-gray-400">最終サインイン: {new Date(identity.last_sign_in_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleUnlink(identity)}
                  disabled={busy || identities.length <= 1}
                  className="inline-flex items-center gap-2 rounded border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  <FontAwesomeIcon icon={faUnlink} /> 解除
                </button>
              </div>
            ))}
            {identities.length > 0 && identities.length <= 1 && (
              <p className="text-xs text-gray-400">
                すべて解除することはできません。別の連携を追加してから解除してください。
              </p>
            )}
          </div>
        </section>
      </div>

      {previewOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
            previewVisible ? 'opacity-100' : 'opacity-0'
          }`}
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewVisible(false)
              setTimeout(() => setPreviewOpen(false), 200)
            }
          }}
        >
          <div
            className={`relative w-full max-w-3xl rounded-xl bg-white p-6 shadow-2xl transform transition-all duration-200 ${
              previewVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            } dark:bg-gray-900`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute right-3 top-3 text-sm text-gray-500 hover:text-gray-800"
              onClick={() => {
                setPreviewVisible(false)
                setTimeout(() => setPreviewOpen(false), 200)
              }}
              aria-label="閉じる"
            >
              ×
            </button>
            <div
              className={`relative ${
                frameDecoration?.style === 'aurora-frame'
                  ? 'rounded-xl p-[2px] ba-aurora-frame'
                  : frameDecoration?.style === 'sunset-frame'
                    ? 'rounded-xl p-[2px] ba-sunset-frame'
                    : hasRedFrame
                      ? 'rounded-xl bg-gradient-to-r from-rose-500 via-red-500 to-orange-400 p-[2px]'
                      : ''
              }`}
            >
              <div
                className="relative rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4 dark:border-gray-700 dark:bg-gray-900"
                style={{
                  background: backgroundDecoration?.background_color ?? previewStyle.background ?? undefined,
                  backgroundImage: previewStyle.backgroundImage,
                  backgroundSize: previewStyle.backgroundSize,
                  animation: previewStyle.animation,
                  color: textColor ?? undefined,
                  fontFamily: fontDecoration?.font_family ?? undefined,
                }}
              >
                <div className="flex items-center gap-4">
                  {selectedStudent ? (
                    <img
                      src={selectedStudent.image}
                      alt={selectedStudent.name}
                      className="h-16 w-16 rounded-xl object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-gray-200 border border-gray-200" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Tools ID: {username || '—'}</p>
                    <h4 className="text-xl font-bold">{nickname || username || 'ユーザー名未設定'}</h4>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <span>Lv {level || '—'} / フレンドコード:</span>{' '}
                      <FriendCodeCopy code={friendCode} disabled={!friendCodePublic} />
                    </p>
                  </div>
                  <DecorationInfoButton decorations={selectedDecorations} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">自己紹介</p>
                  <p className="rounded border p-3 text-sm whitespace-pre-wrap" style={fieldStyle}>
                    {bio || '自己紹介はまだ入力されていません。'}
                  </p>
                  {normalizedSocialLinks.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">ソーシャル</p>
                      {normalizedSocialLinks.map((link, idx) => (
                        <p key={idx} className="rounded border p-2 text-sm" style={fieldStyle}>
                          {link.label && <span className="font-semibold mr-1">{link.label}:</span>}
                          <span>{link.value || '未入力'}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
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
    </div>
  )
}
