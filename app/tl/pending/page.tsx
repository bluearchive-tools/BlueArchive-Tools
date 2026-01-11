'use client'

import { useEffect, useState } from 'react'
import PageHelpButton from '../../../components/PageHelpButton'

type PendingVideo = {
  id: number
  videoid: string
  platform: string
  title: string
  description: string
  published_at: string | null
  armor: string
  difficulty: string
  score: string
  formation: string
  guide: boolean
  formation_status: string
  season_guess: string | null
  season_target: string | null
  reason: string
  status: string
}

export default function PendingTLPage() {
  const [items, setItems] = useState<PendingVideo[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const loadItems = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/tl-pending')
      if (!res.ok) {
        setMessage('保留動画の取得に失敗しました。権限を確認してください。')
        return
      }
      const json = (await res.json()) as { items?: PendingVideo[] }
      setItems(Array.isArray(json.items) ? json.items : [])
    } catch {
      setMessage('保留動画の取得に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadItems()
  }, [])

  const updateItem = async (id: number, data: Partial<PendingVideo>) => {
    setMessage('')
    const res = await fetch(`/api/tl-pending/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', data }),
    })
    if (!res.ok) {
      setMessage('更新に失敗しました。')
      return
    }
    await loadItems()
    setMessage('更新しました。')
  }

  const approveItem = async (id: number, seasonTarget: string | null) => {
    setMessage('')
    const res = await fetch(`/api/tl-pending/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', seasonTarget }),
    })
    if (!res.ok) {
      setMessage('承認に失敗しました。')
      return
    }
    await loadItems()
    setMessage('承認して保存しました。')
  }

  const deleteItem = async (id: number) => {
    setMessage('')
    const res = await fetch(`/api/tl-pending/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete' }),
    })
    if (!res.ok) {
      setMessage('削除に失敗しました。')
      return
    }
    await loadItems()
    setMessage('削除しました。')
  }

  const updateField = (id: number, key: keyof PendingVideo, value: string | boolean | null) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [key]: value } as PendingVideo : item
      )
    )
  }

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">保留TL管理</h2>
        <PageHelpButton pageKey="tl-pending" />
      </div>
      {message && <p className="text-sm text-gray-600">{message}</p>}
      {loading && <p className="text-sm text-gray-500">読み込み中...</p>}
      {!loading && items.length === 0 && (
        <p className="text-sm text-gray-500">保留中の動画はありません。</p>
      )}
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="rounded border border-gray-200 p-3 space-y-2 text-sm">
            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
              <span>ID: {item.id}</span>
              <span>platform: {item.platform}</span>
              <span>videoid: {item.videoid}</span>
              <span>status: {item.status}</span>
              {item.reason && <span>reason: {item.reason}</span>}
            </div>
            <div className="space-y-1">
              <label className="block">
                タイトル
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                  value={item.title ?? ''}
                  onChange={(e) => updateField(item.id, 'title', e.target.value)}
                />
              </label>
              <label className="block">
                説明
                <textarea
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                  rows={2}
                  value={item.description ?? ''}
                  onChange={(e) => updateField(item.id, 'description', e.target.value)}
                />
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="block">
                  予測シーズン
                  <input
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                    value={item.season_guess ?? ''}
                    onChange={(e) => updateField(item.id, 'season_guess', e.target.value)}
                  />
                </label>
                <label className="block">
                  保存先シーズン
                  <input
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                    value={item.season_target ?? ''}
                    onChange={(e) => updateField(item.id, 'season_target', e.target.value)}
                  />
                </label>
                <label className="block">
                  公開日時
                  <input
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                    value={item.published_at ?? ''}
                    onChange={(e) => updateField(item.id, 'published_at', e.target.value)}
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                <label className="block">
                  装甲
                  <input
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                    value={item.armor ?? ''}
                    onChange={(e) => updateField(item.id, 'armor', e.target.value)}
                  />
                </label>
                <label className="block">
                  難易度
                  <input
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                    value={item.difficulty ?? ''}
                    onChange={(e) => updateField(item.id, 'difficulty', e.target.value)}
                  />
                </label>
                <label className="block">
                  スコア
                  <input
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                    value={item.score ?? ''}
                    onChange={(e) => updateField(item.id, 'score', e.target.value)}
                  />
                </label>
                <label className="block">
                  フォーメーション状態
                  <input
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                    value={item.formation_status ?? ''}
                    onChange={(e) => updateField(item.id, 'formation_status', e.target.value)}
                  />
                </label>
              </div>
              <label className="block">
                編成JSON
                <textarea
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 font-mono"
                  rows={2}
                  value={item.formation ?? ''}
                  onChange={(e) => updateField(item.id, 'formation', e.target.value)}
                />
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(item.guide)}
                  onChange={(e) => updateField(item.id, 'guide', e.target.checked)}
                />
                解説あり
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-1 text-xs"
                onClick={() =>
                  updateItem(item.id, {
                    title: item.title,
                    description: item.description,
                    armor: item.armor,
                    difficulty: item.difficulty,
                    score: item.score,
                    formation: item.formation,
                    formation_status: item.formation_status,
                    guide: item.guide,
                    season_guess: item.season_guess,
                    season_target: item.season_target,
                    published_at: item.published_at,
                  })
                }
              >
                更新
              </button>
              <button
                type="button"
                className="rounded border border-blue-300 px-3 py-1 text-xs text-blue-700"
                onClick={() => approveItem(item.id, item.season_target)}
              >
                保存して承認
              </button>
              <button
                type="button"
                className="rounded border border-red-300 px-3 py-1 text-xs text-red-700"
                onClick={() => deleteItem(item.id)}
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
