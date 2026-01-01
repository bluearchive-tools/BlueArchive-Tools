'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShop, faSpinner } from '@fortawesome/free-solid-svg-icons'
import decorations from '../../data/decorations.json'

type ProfileState = {
  cost: number
  decoration_id: string | null
}

export default function DecorationsPage() {
  const supabase = useSupabaseClient()
  const session = useSession()
  const [profile, setProfile] = useState<ProfileState | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const fetchProfile = useMemo(
    () => async () => {
      if (!session?.user) return
      const { data, error } = await supabase
        .from('profiles')
        .select('cost, decoration_id')
        .eq('id', session.user.id)
        .maybeSingle()
      if (error) {
        setMessage(`プロフィール取得に失敗しました: ${error.message}`)
        return
      }
      if (data) {
        setProfile({ cost: data.cost ?? 0, decoration_id: data.decoration_id ?? null })
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
    const { data, error } = await supabase
      .from('profiles')
      .update({
        cost: profile.cost - price,
        decoration_id: decorationId,
      })
      .eq('id', session.user.id)
      .select('cost, decoration_id')
      .maybeSingle()

    setLoading(false)
    if (error) {
      setMessage(`購入に失敗しました: ${error.message}`)
      return
    }
    if (data) {
      setProfile({ cost: data.cost ?? 0, decoration_id: data.decoration_id ?? null })
      setMessage('購入しました。デコレーションが適用されました。')
    }
  }

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
              profile?.decoration_id === item.id ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
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
            <button
              type="button"
              disabled={loading || !session?.user}
              onClick={() => handlePurchase(item.id, item.price)}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> : null}
              {profile?.decoration_id === item.id ? '適用中' : '購入して適用'}
            </button>
          </div>
        ))}
      </div>
    </main>
  )
}
