'use client'

import { useEffect, useState } from 'react'

interface Season {
  number: string
  startDate: string
  endDate: string
}

export default function TLFetchPage() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [season, setSeason] = useState('')
  const [message, setMessage] = useState('')

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
    try {
      const res = await fetch('/api/timelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season }),
      })
      if (res.ok) {
        setMessage('保存しました')
      } else {
        setMessage('エラーが発生しました')
      }
    } catch {
      setMessage('エラーが発生しました')
    }
  }

  return (
    <main className="p-4 space-y-2">
      <h2 className="text-lg font-bold">TL取得</h2>
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
    </main>
  )
}
