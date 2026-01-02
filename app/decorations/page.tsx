'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faShop, faSpinner } from '@fortawesome/free-solid-svg-icons'
import FriendCodeCopy from '../../components/FriendCodeCopy'
import DecorationInfoButton from '../../components/DecorationInfoButton'
import students from '../../data/students.json'
import { colord } from 'colord'

type Decoration = {
  id: string
  name: string
  emoji: string
  description?: string | null
  price: number
  style?: string | null
  genre?: string | null
  tags?: string[] | null
  background_color?: string | null
  text_color?: string | null
  font_family?: string | null
  bonus_credit?: number | null
  is_active?: boolean
}

const computeReadableTextColor = (backgroundColor?: string | null, preferred?: string | null) => {
  if (preferred) return preferred
  if (!backgroundColor) return undefined
  const parsed = colord(backgroundColor)
  if (!parsed.isValid()) return undefined
  return parsed.isLight() ? '#111827' : '#F9FAFB'
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

type ProfileState = {
  credit: number
  decoration_ids: string[]
  decoration_inventory: string[]
  daily_credit_claimed_at: string | null
  username: string | null
  nickname: string | null
  friend_code: string | null
  friend_code_public: boolean | null
  icon_student_id: string | null
  level: number | null
  bio: string | null
  admin: boolean | null
}

export default function DecorationsPage() {
  const supabase = useSupabaseClient()
  const session = useSession()
  const [profile, setProfile] = useState<ProfileState | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [equipPromptId, setEquipPromptId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [equipLoading, setEquipLoading] = useState(false)
  const [decorations, setDecorations] = useState<Decoration[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [newItem, setNewItem] = useState<Partial<Decoration>>({
    price: 0,
    genre: 'フレーム',
  })
  const [adding, setAdding] = useState(false)
  const [recentPurchaseId, setRecentPurchaseId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchProfile = useMemo(
    () => async () => {
      if (!session?.user) return
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'credit, decoration_ids, decoration_inventory, daily_credit_claimed_at, username, nickname, friend_code, friend_code_public, icon_student_id, level, bio, admin'
        )
        .eq('id', session.user.id)
        .maybeSingle()
      if (error) {
        setMessage(`プロフィール取得に失敗しました: ${error.message}`)
        return
      }
      if (data) {
        setProfile({
          credit: data.credit ?? 0,
          decoration_ids: (data.decoration_ids as string[]) ?? [],
          decoration_inventory: (data.decoration_inventory as string[]) ?? [],
          daily_credit_claimed_at: (data.daily_credit_claimed_at as string) ?? null,
          username: (data.username as string) ?? null,
          nickname: (data.nickname as string) ?? null,
          friend_code: (data.friend_code as string) ?? null,
          friend_code_public: (data.friend_code_public as boolean) ?? null,
          icon_student_id: (data.icon_student_id as string) ?? null,
          level: (data.level as number) ?? null,
          bio: (data.bio as string) ?? null,
          admin: (data.admin as boolean) ?? null,
        })
      }
    },
    [session?.user, supabase]
  )

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  useEffect(() => {
    const fetchDecorations = async () => {
      const { data, error } = await supabase
        .from('decorations')
        .select('id, name, emoji, description, price, style, genre, tags, background_color, text_color, font_family, bonus_credit, is_active')
        .eq('is_active', true)
      if (error) {
        setMessage(`商品取得に失敗しました: ${error.message}`)
        return
      }
      setDecorations(data ?? [])
    }
    fetchDecorations()
  }, [supabase])

  const handlePurchase = async (decorationId: string, price: number, bonusCredit?: number, genre?: string) => {
    if (!session?.user) {
      setMessage('購入にはログインが必要です。')
      return
    }
    if (!profile) {
      setMessage('プロフィール情報を読み込み中です。')
      return
    }
    const target = decorations.find((d) => d.id === decorationId)
    const targetGenre = target?.genre ?? null
    if (genre !== 'クレジット' && profile.decoration_inventory?.includes(decorationId)) {
      setMessage('すでに所持しています。')
      return
    }
    if (genre === 'クレジット' && decorationId === 'credit_daily_1000') {
      const last = profile.daily_credit_claimed_at ? new Date(profile.daily_credit_claimed_at) : null
      const now = new Date()
      if (last && isSameDay(last, now)) {
        setMessage('本日の1000クレジットは受け取り済みです。')
        return
      }
    }
    if (genre && genre !== 'クレジット') {
      const equippedConflict = (profile.decoration_ids ?? []).some((id) => {
        const item = decorations.find((d) => d.id === id)
        return item && (item.genre ?? item.id) === (targetGenre ?? decorationId)
      })
      if (equippedConflict) {
        setMessage('同じカテゴリの装着は1つまでです。先に装着を外してください。')
        return
      }
    }
    if (genre !== 'クレジット' && profile.credit < price) {
      setMessage('クレジットが不足しています。')
      return
    }
    setLoading(true)
    setMessage(null)
    const nextInventory =
      genre === 'クレジット' ? profile.decoration_inventory ?? [] : Array.from(new Set([...(profile.decoration_inventory ?? []), decorationId]))
    const updatedCredit =
      genre === 'クレジット' ? profile.credit + (bonusCredit ?? 0) : profile.credit - price

    const { data, error } = await supabase
      .from('profiles')
      .update({
        credit: updatedCredit,
        decoration_inventory: nextInventory,
        daily_credit_claimed_at:
          genre === 'クレジット' && decorationId === 'credit_daily_1000' ? new Date().toISOString() : profile.daily_credit_claimed_at,
      })
      .eq('id', session.user.id)
      .select(
        'credit, decoration_ids, decoration_inventory, daily_credit_claimed_at, username, nickname, friend_code, friend_code_public, icon_student_id, level, bio, admin'
      )
      .maybeSingle()

    setLoading(false)
    if (error) {
      setMessage(`購入に失敗しました: ${error.message}`)
      return
    }
      if (data) {
        setProfile({
          credit: data.credit ?? updatedCredit,
          decoration_ids: (data.decoration_ids as string[]) ?? profile.decoration_ids ?? [],
          decoration_inventory: (data.decoration_inventory as string[]) ?? nextInventory,
        daily_credit_claimed_at:
          (data.daily_credit_claimed_at as string) ??
          (genre === 'クレジット' && decorationId === 'credit_daily_1000' ? new Date().toISOString() : profile.daily_credit_claimed_at),
        username: (data.username as string) ?? profile.username ?? null,
        nickname: (data.nickname as string) ?? profile.nickname ?? null,
        friend_code: (data.friend_code as string) ?? profile.friend_code ?? null,
        friend_code_public: (data.friend_code_public as boolean) ?? profile.friend_code_public ?? null,
        icon_student_id: (data.icon_student_id as string) ?? profile.icon_student_id ?? null,
        level: (data.level as number) ?? profile.level ?? null,
        bio: (data.bio as string) ?? profile.bio ?? null,
        admin: (data.admin as boolean) ?? profile.admin ?? null,
      })
      if (genre === 'クレジット') {
        setEquipPromptId(null)
        setMessage(`${bonusCredit ?? 0}クレジットを受け取りました。`)
      } else {
        setEquipPromptId(decorationId)
        setMessage('購入しました。装着しますか？')
      }
      setRecentPurchaseId(decorationId)
      setTimeout(() => setRecentPurchaseId((prev) => (prev === decorationId ? null : prev)), 2000)
    }
  }

  const handleEquip = async (decorationId: string) => {
    if (!session?.user || !profile) return
    setEquipLoading(true)
    const target = decorations.find((d) => d.id === decorationId)
    const targetKey = target?.genre ?? decorationId
    const nextMap = new Map<string, string>()
    ;(profile.decoration_ids ?? []).forEach((id) => {
      const item = decorations.find((d) => d.id === id)
      const key = item?.genre ?? id
      if (!nextMap.has(key)) nextMap.set(key, id)
    })
    nextMap.set(targetKey, decorationId)
    const next = Array.from(new Set(nextMap.values()))
    const { data, error } = await supabase
      .from('profiles')
      .update({ decoration_ids: next })
      .eq('id', session.user.id)
      .select(
        'credit, decoration_ids, decoration_inventory, daily_credit_claimed_at, username, nickname, friend_code, friend_code_public, icon_student_id, level, bio, admin'
      )
      .maybeSingle()
    setEquipLoading(false)
    if (error) {
      setMessage(`装着に失敗しました: ${error.message}`)
      return
    }
    if (data) {
      setProfile({
        credit: data.credit ?? profile.credit,
        decoration_ids: (data.decoration_ids as string[]) ?? next,
        decoration_inventory: (data.decoration_inventory as string[]) ?? profile.decoration_inventory,
        daily_credit_claimed_at: (data.daily_credit_claimed_at as string) ?? profile.daily_credit_claimed_at,
        username: (data.username as string) ?? profile.username ?? null,
        nickname: (data.nickname as string) ?? profile.nickname ?? null,
        friend_code: (data.friend_code as string) ?? profile.friend_code ?? null,
        friend_code_public: (data.friend_code_public as boolean) ?? profile.friend_code_public ?? null,
        icon_student_id: (data.icon_student_id as string) ?? profile.icon_student_id ?? null,
        level: (data.level as number) ?? profile.level ?? null,
        bio: (data.bio as string) ?? profile.bio ?? null,
        admin: (data.admin as boolean) ?? profile.admin ?? null,
      })
      setEquipPromptId(null)
      setMessage('装着しました。')
    }
  }

  const previewDecorations = useMemo(() => {
    const byGenre = new Map<string, Decoration>()
    const profileIds = new Set(profile?.decoration_ids ?? [])
    decorations.forEach((d) => {
      if (!profileIds.has(d.id)) return
      const key = d.genre ?? d.id
      if (!byGenre.has(key)) byGenre.set(key, d)
    })
    if (previewId) {
      const previewItem = decorations.find((d) => d.id === previewId)
      if (previewItem) {
        const key = previewItem.genre ?? previewItem.id
        byGenre.set(key, previewItem)
      }
    }
    return Array.from(byGenre.values())
  }, [previewId, profile?.decoration_ids, decorations])

  const frameDecoration = useMemo(
    () =>
      previewDecorations.find((d) => d.style === 'red-gradient' || d.style === 'aurora-frame' || d.style === 'sunset-frame'),
    [previewDecorations]
  )

  const previewStudent = useMemo(
    () => students.find((s) => s.id === profile?.icon_student_id),
    [profile?.icon_student_id]
  )
  const previewBackground = useMemo(
    () => previewDecorations.find((d) => d.background_color || d.style === 'aurora-gradient' || d.style === 'sunset-gradient'),
    [previewDecorations]
  )
  const previewTextColor = useMemo(
    () =>
      previewBackground?.style === 'aurora-gradient' || previewBackground?.style === 'sunset-gradient'
        ? previewBackground.text_color ?? '#F8FAFC'
        : computeReadableTextColor(previewBackground?.background_color, previewBackground?.text_color),
    [previewBackground?.background_color, previewBackground?.style, previewBackground?.text_color]
  )
  const previewFont = useMemo(() => previewDecorations.find((d) => d.font_family), [previewDecorations])

  const previewStyle = useMemo(() => {
    if (previewBackground?.style === 'aurora-gradient') {
      return {
        backgroundImage: 'linear-gradient(120deg, #0ea5e9, #8b5cf6, #22d3ee)',
        backgroundSize: '200% 200%',
        animation: 'ba-aurora 12s ease infinite',
      }
    }
    if (previewBackground?.style === 'sunset-gradient') {
      return {
        backgroundImage: 'linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)',
        backgroundSize: '200% 200%',
        animation: 'ba-sunset 10s ease infinite',
      }
    }
    if (previewBackground?.background_color) {
      return { background: previewBackground.background_color }
    }
    return {}
  }, [previewBackground])

  const tags = useMemo(() => {
    const all = new Set<string>()
    decorations.forEach((d) => d.tags?.forEach((t) => all.add(t)))
    return Array.from(all).sort()
  }, [decorations])

  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const filteredDecorations = useMemo(() => {
    if (selectedTags.length === 0) return decorations
    return decorations.filter((d) => selectedTags.every((tag) => d.tags?.includes(tag)))
  }, [selectedTags, decorations])

  const decorationsByGenre = useMemo(() => {
    const map = new Map<string, typeof decorations>()
    filteredDecorations.forEach((item) => {
      const genre = item.genre ?? 'その他'
      if (!map.has(genre)) map.set(genre, [])
      map.get(genre)!.push(item)
    })
    return Array.from(map.entries())
  }, [filteredDecorations])

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <FontAwesomeIcon icon={faShop} className="text-2xl" />
        <div>
          <h1 className="text-2xl font-bold">ショップ</h1>
          <p className="text-sm text-gray-600">デコレーションやクレジットを購入できます。</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm text-gray-700">
          クレジット残高:{' '}
          {session?.user ? (
            profile ? `${profile.credit} クレジット` : '読み込み中...'
          ) : (
            'ログインすると残高が表示されます'
          )}
        </p>
        {message && <p className="mt-2 text-sm text-blue-700">{message}</p>}
      </div>

      {profile?.admin && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">管理者: 商品追加</p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700"
            >
              商品を追加
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 space-y-2">
        <p className="text-sm font-semibold text-gray-700">タグで絞り込む</p>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const active = selectedTags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setSelectedTags((prev) => (active ? prev.filter((t) => t !== tag) : [...prev, tag]))
                }
                className={`rounded-full border px-3 py-1 text-sm ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}
              >
                #{tag}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setSelectedTags([])}
            className="rounded-full border px-3 py-1 text-sm bg-white hover:bg-gray-50"
          >
            クリア
          </button>
        </div>
      </div>

      {decorationsByGenre.map(([genre, items]) => (
        <div key={genre} className="space-y-2">
          <h2 className="text-xl font-semibold">{genre}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 ${
                  profile?.decoration_ids?.includes(item.id) ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl" aria-hidden>
                    {item.emoji}
                  </span>
                  <div>
                    <p className="text-lg font-semibold">{item.name}</p>
                    <p className="text-xs text-gray-500">ID: {item.id}</p>
                  </div>
                  {profile?.admin && (
                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={async () => {
                        setDeletingId(item.id)
                        const { error } = await supabase.from('decorations').delete().eq('id', item.id)
                        setDeletingId(null)
                        if (error) {
                          setMessage(`削除に失敗しました: ${error.message}`)
                        } else {
                          setDecorations((prev) => prev.filter((d) => d.id !== item.id))
                          setMessage('商品を削除しました。')
                        }
                      }}
                      className="ml-auto rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      {deletingId === item.id ? '削除中...' : '削除'}
                    </button>
                  )}
                </div>
                <p className="mt-3 text-sm text-gray-700">{item.description}</p>
                <p className="mt-3 text-sm font-semibold text-gray-800">価格: {item.price} クレジット</p>
                {item.tags && item.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                    {item.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                  <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={loading || !session?.user || (item.genre !== 'クレジット' && profile?.decoration_inventory?.includes(item.id))}
                    onClick={() => handlePurchase(item.id, item.price, item.bonus_credit ?? undefined, item.genre ?? undefined)}
                    className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-60 transition ${
                      recentPurchaseId === item.id ? 'bg-green-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {loading ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> : null}
                    {recentPurchaseId === item.id && !loading ? (
                      <>
                        <FontAwesomeIcon icon={faCheck} className="animate-ping" />
                        <span>完了</span>
                      </>
                    ) : item.genre === 'クレジット' ? (
                      '受け取る'
                    ) : profile?.decoration_inventory?.includes(item.id) ? (
                      '所持済み'
                    ) : (
                      '購入'
                    )}
                  </button>
                  {item.genre !== 'クレジット' && (
                    <button
                      type="button"
                      onClick={() => setPreviewId(item.id)}
                      className="inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      プレビュー
                    </button>
                  )}
                </div>
                {item.genre !== 'クレジット' &&
                  profile?.decoration_inventory?.includes(item.id) &&
                  !profile.decoration_ids?.includes(item.id) && (
                    <p className="mt-2 text-xs text-gray-600">未装着です。装着するには「購入」後のモーダルで選択してください。</p>
                  )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {equipPromptId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEquipPromptId(null)
          }}
        >
          <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-semibold">デコレーションを装着しますか？</h3>
            <p className="mt-2 text-sm text-gray-700">購入したデコレーションをすぐに反映できます。</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEquipPromptId(null)}
                className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                後で
              </button>
              <button
                type="button"
                disabled={equipLoading}
                onClick={() => handleEquip(equipPromptId)}
                className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {equipLoading ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> : null}
                装着する
              </button>
            </div>
          </div>
        </div>
      )}

      {previewId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewId(null)
          }}
        >
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">デコレーションプレビュー</h3>
              <button
                type="button"
                onClick={() => setPreviewId(null)}
                className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            <div
              className={
                frameDecoration?.style === 'aurora-frame'
                  ? 'rounded-xl p-[2px] ba-aurora-frame'
                  : frameDecoration?.style === 'sunset-frame'
                    ? 'rounded-xl p-[2px] ba-sunset-frame'
                    : frameDecoration?.style === 'red-gradient'
                      ? 'rounded-xl bg-gradient-to-r from-rose-500 via-red-500 to-orange-400 p-[2px]'
                      : ''
              }
            >
              <div
                  className="relative flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
                  style={{
                  background: previewBackground?.background_color ?? previewStyle.background ?? undefined,
                  backgroundImage: previewStyle.backgroundImage,
                  backgroundSize: previewStyle.backgroundSize,
                  animation: previewStyle.animation,
                  color: previewTextColor ?? undefined,
                  fontFamily: previewFont?.font_family ?? undefined,
                  }}
                >
                {previewStudent ? (
                  <img
                    src={previewStudent.image}
                    alt={previewStudent.name}
                    className="h-16 w-16 rounded-xl object-cover border border-gray-200"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-gray-200 border border-gray-200" />
                )}
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Tools ID: {profile?.username ?? 'preview-user'}</p>
                  <h4 className="text-xl font-bold">{profile?.nickname || profile?.username || 'プレビュー'}</h4>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <span>Lv {profile?.level ?? '—'} / フレンドコード:</span>{' '}
                    <FriendCodeCopy code={profile?.friend_code ?? undefined} disabled={!profile?.friend_code_public} />
                  </p>
                </div>
                <DecorationInfoButton decorations={previewDecorations} />
              </div>
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddOpen(false)
          }}
        >
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">商品を追加</h3>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            <div className="grid gap-3">
              <input
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="名前"
                value={newItem.name ?? ''}
                onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="絵文字"
                value={newItem.emoji ?? ''}
                onChange={(e) => setNewItem((prev) => ({ ...prev, emoji: e.target.value }))}
              />
              <textarea
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="説明"
                value={newItem.description ?? ''}
                onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="価格"
                  value={newItem.price ?? 0}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, price: Number(e.target.value) }))}
                />
                <input
                  type="number"
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="ボーナスクレジット (クレジット商品用)"
                  value={newItem.bonus_credit ?? 0}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, bonus_credit: Number(e.target.value) }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="ジャンル (例: フレーム/背景/フォント/クレジット)"
                  value={newItem.genre ?? ''}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, genre: e.target.value }))}
                />
                <input
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="タグ (カンマ区切り)"
                  value={(newItem.tags ?? []).join(',')}
                  onChange={(e) =>
                    setNewItem((prev) => ({ ...prev, tags: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="背景色 (CSS値)"
                  value={newItem.background_color ?? ''}
                  onChange={(e) =>
                    setNewItem((prev) => {
                      const background_color = e.target.value
                      const text_color = computeReadableTextColor(background_color, prev.text_color ?? null)
                      return { ...prev, background_color, text_color }
                    })
                  }
                />
                <input
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="文字色 (CSS値)"
                  value={newItem.text_color ?? ''}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, text_color: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="フォントファミリー (CSS)"
                  value={newItem.font_family ?? ''}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, font_family: e.target.value }))}
                />
                <input
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="スタイル (例: red-gradient)"
                  value={newItem.style ?? ''}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, style: e.target.value }))}
                />
              </div>
              <button
                type="button"
                disabled={adding}
                onClick={async () => {
                  if (!newItem.name) return setMessage('名前は必須です。')
                  if (!newItem.emoji) return setMessage('絵文字は必須です。')
                  const id = newItem.id?.trim() || (typeof crypto !== 'undefined' ? crypto.randomUUID() : Date.now().toString())
                  setAdding(true)
                  const text_color = computeReadableTextColor(newItem.background_color, newItem.text_color ?? null)
                  const payload: Partial<Decoration> & { id: string; price: number; is_active: boolean } = {
                    id,
                    price: newItem.price ?? 0,
                    ...newItem,
                    text_color,
                    tags: newItem.tags ?? [],
                    is_active: true,
                  }
                  const { data, error } = await supabase.from('decorations').insert(payload).select().maybeSingle()
                  setAdding(false)
                  if (error) {
                    setMessage(`追加に失敗しました: ${error.message}`)
                    return
                  }
                  if (data) {
                    setDecorations((prev) => [...prev, data as Decoration])
                    setAddOpen(false)
                    setNewItem({ price: 0, genre: 'フレーム' })
                    setMessage('商品を追加しました。')
                  }
                }}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {adding ? '追加中...' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes ba-aurora {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        @keyframes ba-sunset {
          0% {
            background-position: 0% 0%;
          }
          50% {
            background-position: 100% 100%;
          }
          100% {
            background-position: 0% 0%;
          }
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
      `}</style>
    </main>
  )
}
