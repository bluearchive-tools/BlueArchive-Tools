'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'

type PendingVideo = {
  id?: string | number
  videoid: string
  platform: 'youtube' | 'bilibili'
  title: string
  description: string
  published_at: string | null
  suggested_season: string | null
  reason: string | null
}

const getVideoUrl = (videoid: string) => {
  if (videoid.startsWith('bili:')) {
    return `https://www.bilibili.com/video/${videoid.replace(/^bili:/, '')}`
  }
  return `https://www.youtube.com/watch?v=${videoid}`
}

export default function PendingTlPage() {
  const session = useSession()
  const supabase = useSupabaseClient()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<PendingVideo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())

  const [formState, setFormState] = useState<
    Record<
      string,
      {
        season: string
        armor: string
        difficulty: string
        score: string
        guide: boolean
        title: string
        description: string
        publishedAt: string
      }
    >
  >({})

  useEffect(() => {
    const load = async () => {
      if (!session?.user) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('admin')
        .eq('id', session.user.id)
        .maybeSingle()
      setIsAdmin(Boolean(data?.admin))
      setLoading(false)
    }
    void load()
  }, [session, supabase])

  useEffect(() => {
    if (!isAdmin) return
    const loadPending = async () => {
      setError(null)
      const { data, error } = await supabase
        .from('tl_pending_videos')
        .select('id, videoid, platform, title, description, published_at, suggested_season, reason')
        .order('updated_at', { ascending: false })
      if (error) {
        setError('保留動画の取得に失敗しました。')
        return
      }
      const list = (data || []) as PendingVideo[]
      setPending(list)
      const next: typeof formState = {}
      list.forEach((item) => {
        next[item.videoid] = {
          season: item.suggested_season ?? '',
          armor: '',
          difficulty: '',
          score: '',
          guide: false,
          title: item.title,
          description: item.description,
          publishedAt: item.published_at ?? '',
        }
      })
      setFormState(next)
    }
    void loadPending()
  }, [isAdmin, supabase])

  const grouped = useMemo(() => pending, [pending])

  const updateForm = (videoid: string, field: keyof (typeof formState)[string], value: string | boolean) => {
    setFormState((prev) => ({
      ...prev,
      [videoid]: {
        ...prev[videoid],
        [field]: value,
      },
    }))
  }

  const saveToTimeline = async (item: PendingVideo) => {
    const state = formState[item.videoid]
    if (!state?.season) {
      setError('シーズンを入力してください。')
      return
    }
    setError(null)
    setSavingIds((prev) => new Set(prev).add(item.videoid))
    const table = `tl_${state.season.toLowerCase()}`
    const entry = {
      armor: state.armor,
      difficulty: state.difficulty,
      videoid: item.videoid,
      score: state.score,
      formation: '[]',
      guide: state.guide,
      formation_status: 'manual',
      title: state.title,
      description: state.description,
      publishedAt: state.publishedAt || null,
    }
    const { error: insertError } = await supabase.from(table).insert(entry)
    if (insertError) {
      setError('TLの保存に失敗しました。')
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(item.videoid)
        return next
      })
      return
    }
    await supabase
      .from('tl_pending_videos')
      .delete()
      .eq('videoid', item.videoid)
    setPending((prev) => prev.filter((p) => p.videoid !== item.videoid))
    setSavingIds((prev) => {
      const next = new Set(prev)
      next.delete(item.videoid)
      return next
    })
  }

  const removePending = async (item: PendingVideo) => {
    setError(null)
    await supabase.from('tl_pending_videos').delete().eq('videoid', item.videoid)
    setPending((prev) => prev.filter((p) => p.videoid !== item.videoid))
  }

  if (loading) {
    return <main className="p-4">読み込み中...</main>
  }

  if (!isAdmin) {
    return <main className="p-4">管理者のみ閲覧できます。</main>
  }

  return (
    <main className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-bold">TL保留動画</h2>
        <p className="text-sm text-gray-500">シーズン判定できなかった動画を確認・編集して保存します。</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {grouped.length === 0 ? (
        <p className="text-sm text-gray-500">保留中の動画はありません。</p>
      ) : (
        <div className="space-y-4">
          {grouped.map((item) => {
            const state = formState[item.videoid]
            return (
              <div key={item.videoid} className="rounded border border-gray-200 p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={getVideoUrl(item.videoid)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-sm underline"
                  >
                    動画を開く
                  </a>
                  <span className="text-xs text-gray-500">{item.reason || 'pending'}</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="text-sm">
                    シーズン
                    <input
                      value={state?.season ?? ''}
                      onChange={(e) => updateForm(item.videoid, 'season', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      placeholder="例: 85"
                    />
                  </label>
                  <label className="text-sm">
                    スコア
                    <input
                      value={state?.score ?? ''}
                      onChange={(e) => updateForm(item.videoid, 'score', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-sm">
                    装甲
                    <input
                      value={state?.armor ?? ''}
                      onChange={(e) => updateForm(item.videoid, 'armor', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-sm">
                    難易度
                    <input
                      value={state?.difficulty ?? ''}
                      onChange={(e) => updateForm(item.videoid, 'difficulty', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-sm md:col-span-2">
                    タイトル
                    <input
                      value={state?.title ?? ''}
                      onChange={(e) => updateForm(item.videoid, 'title', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-sm md:col-span-2">
                    概要
                    <textarea
                      value={state?.description ?? ''}
                      onChange={(e) => updateForm(item.videoid, 'description', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      rows={3}
                    />
                  </label>
                  <label className="text-sm">
                    公開日
                    <input
                      value={state?.publishedAt ?? ''}
                      onChange={(e) => updateForm(item.videoid, 'publishedAt', e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      placeholder="YYYY-MM-DD"
                    />
                  </label>
                  <label className="text-sm flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      checked={state?.guide ?? false}
                      onChange={(e) => updateForm(item.videoid, 'guide', e.target.checked)}
                    />
                    解説付き
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => saveToTimeline(item)}
                    disabled={savingIds.has(item.videoid)}
                    className="rounded border border-blue-300 px-3 py-1 text-xs text-blue-700 disabled:opacity-60"
                  >
                    {savingIds.has(item.videoid) ? '保存中...' : '保存してTLへ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removePending(item)}
                    className="rounded border border-red-300 px-3 py-1 text-xs text-red-700"
                  >
                    保留から削除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
