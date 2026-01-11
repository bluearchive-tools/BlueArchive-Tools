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
  const [message, setMessage] = useState('')
  const [logs, setLogs] = useState<string[]>([])

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

  const handleFetch = async () => {
    setMessage('取得中...')
    setLogs([])
    try {
      const res = await fetch('/api/timelines?stream=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season }),
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
      <button
        onClick={handleFetch}
        className="bg-blue-500 text-white px-4 py-1 rounded"
      >
        取得
      </button>
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
