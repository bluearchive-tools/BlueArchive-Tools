'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShop, faSpinner } from '@fortawesome/free-solid-svg-icons'
import decorations from '../../data/decorations.json'
import FriendCodeCopy from '../../components/FriendCodeCopy'
import DecorationInfoButton from '../../components/DecorationInfoButton'

type ProfileState = {
  cost: number
  decoration_ids: string[]
  decoration_inventory: string[]
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

  const fetchProfile = useMemo(
    () => async () => {
      if (!session?.user) return
      const { data, error } = await supabase
        .from('profiles')
        .select('cost, decoration_ids, decoration_inventory')
        .eq('id', session.user.id)
        .maybeSingle()
      if (error) {
        setMessage(`プロフィール取得に失敗しました: ${error.message}`)
        return
      }
      if (data) {
        setProfile({
          cost: data.cost ?? 0,
          decoration_ids: (data.decoration_ids as string[]) ?? [],
          decoration_inventory: (data.decoration_inventory as string[]) ?? [],
        })
      }
    },
    [session?.user, supabase]
  )

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handlePurchase = async (decorationId: string, price: number) => {
    if (!session?.user) {
      setMessage('購入にはログインが必要です。')
      return
    }
    if (!profile) {
      setMessage('プロフィール情報を読み込み中です。')
      return
    }
    if (profile.cost < price) {
      setMessage('残高が不足しています。')
      return
    }
    setLoading(true)
    setMessage(null)
    const nextInventory = Array.from(new Set([...(profile.decoration_inventory ?? []), decorationId]))
    const { data, error } = await supabase
      .from('profiles')
      .update({
        cost: profile.cost - price,
        decoration_inventory: nextInventory,
      })
      .eq('id', session.user.id)
      .select('cost, decoration_ids, decoration_inventory')
      .maybeSingle()

    setLoading(false)
    if (error) {
      setMessage(`購入に失敗しました: ${error.message}`)
      return
    }
    if (data) {
      setProfile({
        cost: data.cost ?? 0,
        decoration_ids: (data.decoration_ids as string[]) ?? profile.decoration_ids ?? [],
        decoration_inventory: (data.decoration_inventory as string[]) ?? nextInventory,
      })
      setEquipPromptId(decorationId)
      setMessage('購入しました。装着しますか？')
    }
  }

  const handleEquip = async (decorationId: string) => {
    if (!session?.user || !profile) return
    setEquipLoading(true)
    const next = Array.from(new Set([...(profile.decoration_ids ?? []), decorationId]))
    const { data, error } = await supabase
      .from('profiles')
      .update({ decoration_ids: next })
      .eq('id', session.user.id)
      .select('cost, decoration_ids, decoration_inventory')
      .maybeSingle()
    setEquipLoading(false)
    if (error) {
      setMessage(`装着に失敗しました: ${error.message}`)
      return
    }
    if (data) {
      setProfile({
        cost: data.cost ?? profile.cost,
        decoration_ids: (data.decoration_ids as string[]) ?? next,
        decoration_inventory: (data.decoration_inventory as string[]) ?? profile.decoration_inventory,
      })
      setEquipPromptId(null)
      setMessage('装着しました。')
    }
  }

  const previewDecorations = useMemo(() => {
    const ids = new Set<string>(profile?.decoration_ids ?? [])
    if (previewId) ids.add(previewId)
    return decorations.filter((d) => ids.has(d.id))
  }, [previewId, profile?.decoration_ids])

  const previewHasRedFrame = previewDecorations.some((d) => d.style === 'red-gradient')

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <FontAwesomeIcon icon={faShop} className="text-2xl" />
        <div>
          <h1 className="text-2xl font-bold">デコレーションショップ</h1>
          <p className="text-sm text-gray-600">プロフィールを彩るデコレーションを選んで購入できます。</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm text-gray-700">
          残高:{' '}
          {session?.user ? (
            profile ? `${profile.cost} コスト` : '読み込み中...'
          ) : (
            'ログインすると残高が表示されます'
          )}
        </p>
        {message && <p className="mt-2 text-sm text-blue-700">{message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {decorations.map((item) => (
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
            </div>
            <p className="mt-3 text-sm text-gray-700">{item.description}</p>
            <p className="mt-3 text-sm font-semibold text-gray-800">価格: {item.price} コスト</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading || !session?.user}
                onClick={() => handlePurchase(item.id, item.price)}
                className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> : null}
                {profile?.decoration_inventory?.includes(item.id) ? '再購入' : '購入'}
              </button>
              <button
                type="button"
                onClick={() => setPreviewId(item.id)}
                className="inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                プレビュー
              </button>
            </div>
            {profile?.decoration_inventory?.includes(item.id) && !profile.decoration_ids?.includes(item.id) && (
              <p className="mt-2 text-xs text-gray-600">未装着です。装着するには「購入」後のモーダルで選択してください。</p>
            )}
          </div>
        ))}
      </div>

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
            <div className={previewHasRedFrame ? 'rounded-xl bg-gradient-to-r from-rose-500 via-red-500 to-orange-400 p-[2px]' : ''}>
              <div className="relative flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="h-16 w-16 rounded-xl bg-gray-200 border border-gray-200" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Tools ID: preview-user</p>
                  <h4 className="text-xl font-bold">プレビュー</h4>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <span>Lv — / フレンドコード:</span> <FriendCodeCopy code="0000-0000-0000" disabled />
                  </p>
                </div>
                <DecorationInfoButton decorations={previewDecorations} />
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
