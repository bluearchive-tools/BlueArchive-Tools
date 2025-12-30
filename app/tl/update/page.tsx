'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

interface Season {
  number: string
  startDate: string
  endDate: string
}

export default function TLFetchPage() {
  const t = useTranslations('tl')
  const tUpdate = useCallback(
    (key: string, values?: Record<string, unknown>) => t(`update.${key}`, values),
    [t]
  )
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
    setMessage(tUpdate('messages.loading'))
    try {
      const res = await fetch('/api/timelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season }),
      })
      if (res.ok) {
        setMessage(tUpdate('messages.saved'))
      } else {
        setMessage(tUpdate('messages.error'))
      }
    } catch {
      setMessage(tUpdate('messages.error'))
    }
  }

  return (
    <main className="p-4 space-y-2">
      <h2 className="text-lg font-bold">{tUpdate('title')}</h2>
      <select
        value={season}
        onChange={e => setSeason(e.target.value)}
        className="border rounded px-2 py-1"
      >
        <option value="">{tUpdate('seasonPlaceholder')}</option>
        {seasons.map(s => (
          <option key={s.number} value={s.number}>
            {tUpdate('seasonOption', { number: s.number, start: s.startDate, end: s.endDate })}
          </option>
        ))}
      </select>
      <button
        onClick={handleFetch}
        className="bg-blue-500 text-white px-4 py-1 rounded"
      >
        {tUpdate('fetch')}
      </button>
      {message && <p>{message}</p>}
    </main>
  )
}
