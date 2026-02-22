'use client'

import { useEffect, useState } from 'react'
import PageHelpButton from '../../../components/PageHelpButton'

interface Season {
  number: string
  startDate: string
  endDate: string
}

export default function TLFetchClient() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [season, setSeason] = useState('')
  const [platform, setPlatform] = useState<'all' | 'youtube' | 'bilibili'>('all')
  const [message, setMessage] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [backfillRunning, setBackfillRunning] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/raids')
        if (res.ok) {
          const data = await res.json()
          setSeasons(data.seasons || [])
        }
      } catch {
        // ignore
      }
    }
    load()
  }, [])


  const handleOwnerBackfill = async () => {
    setBackfillRunning(true)
    setMessage('投稿者紐付けを実行中...')
    try {
      const res = await fetch('/api/tl-owner-backfill', { method: 'POST' })
      const json = (await res.json()) as {
        success?: boolean
        scanned?: number
        resolved?: number
        updated?: number
        unresolved?: number
        diagnostics?: {
          youtubeTarget?: number
          youtubeChannelResolved?: number
          youtubeApiKeyCount?: number
          youtubeNoApiKey?: boolean
          youtubeQuotaLikely?: boolean
          bilibiliTarget?: number
          bilibiliMidResolved?: number
          youtubeProfilesLinked?: number
          bilibiliProfilesLinked?: number
        }
      }
      if (!res.ok || !json.success) {
        setMessage('投稿者紐付けに失敗しました')
        return
      }
      const diagnostics = json.diagnostics
      const ytHint = diagnostics?.youtubeQuotaLikely
        ? ' / YouTube API制限の可能性あり'
        : diagnostics?.youtubeNoApiKey
          ? ' / YouTube APIキー未設定'
          : ''
      setMessage(
        `投稿者紐付け完了: 対象${json.scanned ?? 0}件 / 解決${json.resolved ?? 0}件 / 新規反映${json.updated ?? 0}件` +
          ` (YT取得:${diagnostics?.youtubeChannelResolved ?? 0}/${diagnostics?.youtubeTarget ?? 0}, Bili取得:${diagnostics?.bilibiliMidResolved ?? 0}/${diagnostics?.bilibiliTarget ?? 0})` +
          ytHint
      )
    } catch {
      setMessage('投稿者紐付けに失敗しました')
    } finally {
      setBackfillRunning(false)
    }
  }
  const handleFetch = async () => {
    setMessage('取得中...')
    setLogs([])
    try {
      const res = await fetch('/api/timelines?stream=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, platform }),
      })
      if (!res.body) {
        setMessage('エラーが発生しました')
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let doneReceived = false
      while (!doneReceived) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const payload = JSON.parse(line) as {
              type?: string
              message?: string
              success?: boolean
            }
            if (payload.type === 'log' && payload.message) {
              setLogs((prev) => [...prev, payload.message as string])
            }
            if (payload.type === 'done') {
              doneReceived = true
              setMessage(payload.success ? '保存しました' : 'エラーが発生しました')
            }
          } catch {
            // ignore invalid lines
          }
        }
      }
      if (!doneReceived) {
        setMessage(res.ok ? '保存しました' : 'エラーが発生しました')
      }
    } catch {
      setMessage('エラーが発生しました')
    }
  }

  return (
    <main className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">TL取得</h2>
        <PageHelpButton pageKey="tl-update" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={season}
          onChange={e => setSeason(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="">シーズンを選択</option>
          {seasons.map(s => (
            <option key={s.number} value={s.number}>
              {`シーズン${s.number} (${s.startDate}~${s.endDate})`}
            </option>
          ))}
        </select>
        <select
          value={platform}
          onChange={e => setPlatform(e.target.value as 'all' | 'youtube' | 'bilibili')}
          className="border rounded px-2 py-1"
        >
          <option value="all">全て</option>
          <option value="youtube">YouTubeのみ</option>
          <option value="bilibili">Bilibiliのみ</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleFetch}
          className="bg-blue-500 text-white px-4 py-1 rounded"
        >
          取得
        </button>
        <button
          onClick={handleOwnerBackfill}
          className="bg-emerald-600 text-white px-4 py-1 rounded disabled:opacity-60"
          disabled={backfillRunning}
        >
          {backfillRunning ? '投稿者紐付け中...' : '過去動画の投稿者紐付け'}
        </button>
      </div>
      <a
        href="/tl/pending"
        className="ml-2 inline-flex items-center rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
      >
        保留TL管理へ
      </a>
      {message && <p>{message}</p>}
      {logs.length > 0 && (
        <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs">
          <p className="font-semibold mb-2">実行ログ</p>
          <ul className="space-y-1">
            {logs.map((log, index) => (
              <li key={`${log}-${index}`} className="break-all">
                {log}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  )
}
