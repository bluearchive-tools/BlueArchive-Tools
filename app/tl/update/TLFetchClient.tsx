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
      const res = await fetch('/api/timelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season }),
      })
      const json = (await res.json()) as { logs?: string[] }
      if (res.ok) {
        setMessage('保存しました')
        setLogs(Array.isArray(json.logs) ? json.logs : [])
      } else {
        setMessage('エラーが発生しました')
        setLogs(Array.isArray(json.logs) ? json.logs : [])
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
