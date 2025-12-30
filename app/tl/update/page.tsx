'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

interface Season {
  number: string
  startDate: string
  endDate: string
}

export default function TLFetchPage() {
  const t = useTranslations('tl.update')
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
    setMessage(t('messages.loading'))
    try {
      const res = await fetch('/api/timelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season }),
      })
      if (res.ok) {
        setMessage(t('messages.saved'))
      } else {
        setMessage(t('messages.error'))
      }
    } catch {
      setMessage(t('messages.error'))
    }
  }

  return (
    <main className="p-4 space-y-2">
      <h2 className="text-lg font-bold">{t('title')}</h2>
      <select
        value={season}
        onChange={e => setSeason(e.target.value)}
        className="border rounded px-2 py-1"
      >
        <option value="">{t('seasonPlaceholder')}</option>
        {seasons.map(s => (
          <option key={s.number} value={s.number}>
            {t('seasonOption', { number: s.number, start: s.startDate, end: s.endDate })}
          </option>
        ))}
      </select>
      <button
        onClick={handleFetch}
        className="bg-blue-500 text-white px-4 py-1 rounded"
      >
        {t('fetch')}
      </button>
      {message && <p>{message}</p>}
    </main>
  )
}
