'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { BgmTrack } from '../../../lib/minigames/bgm-quiz'
import { getBgmTrackDisplayTitle, getBgmTracks } from '../../../lib/minigames/bgm-quiz'

type CategoryOption = {
  label: string
  value: string
}

export default function BgmPlayerPage() {
  const t = useTranslations('bgm-player')
  const tracks = useMemo(() => getBgmTracks(), [])
  const categories = useMemo<CategoryOption[]>(() => {
    const values = Array.from(new Set(tracks.map((track) => track.category))).sort()
    return [{ label: t('filters.all'), value: 'all' }, ...values.map((value) => ({ label: value, value }))]
  }, [t, tracks])

  const [category, setCategory] = useState<string>('all')
  const [query, setQuery] = useState<string>('')
  const [activeTrack, setActiveTrack] = useState<BgmTrack | null>(null)

  const filteredTracks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return tracks.filter((track) => {
      const matchesCategory = category === 'all' || track.category === category
      if (!matchesCategory) return false
      if (!normalizedQuery) return true
      const title = getBgmTrackDisplayTitle(track).toLowerCase()
      return title.includes(normalizedQuery) || track.file.toLowerCase().includes(normalizedQuery)
    })
  }, [category, query, tracks])

  useEffect(() => {
    if (!activeTrack && filteredTracks.length) {
      setActiveTrack(filteredTracks[0])
      return
    }
    if (activeTrack && filteredTracks.length && !filteredTracks.some((track) => track.file === activeTrack.file)) {
      setActiveTrack(filteredTracks[0])
    }
    if (activeTrack && filteredTracks.length === 0) {
      setActiveTrack(null)
    }
  }, [activeTrack, filteredTracks])

  return (
    <main className="p-4 space-y-4 pb-16">
      <section className="space-y-1">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-gray-500">{t('description')}</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500" htmlFor="bgm-category">
              {t('filters.category')}
            </label>
            <select
              id="bgm-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500" htmlFor="bgm-search">
              {t('filters.search')}
            </label>
            <input
              id="bgm-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('filters.searchPlaceholder')}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <p className="text-xs text-gray-500">
            {t('filters.count', { count: filteredTracks.length })}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('nowPlaying')}
            </p>
            {activeTrack ? (
              <>
                <div>
                  <p className="text-base font-semibold">{getBgmTrackDisplayTitle(activeTrack)}</p>
                  <p className="text-xs text-gray-500">{activeTrack.category}</p>
                </div>
                <audio
                  key={activeTrack.file}
                  src={`/bgm/${encodeURIComponent(activeTrack.file)}`}
                  controls
                  autoPlay
                  className="w-full"
                />
              </>
            ) : (
              <p className="text-sm text-gray-500">{t('empty')}</p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <ul className="max-h-[480px] space-y-2 overflow-auto">
              {filteredTracks.map((track) => {
                const isActive = activeTrack?.file === track.file
                return (
                  <li key={track.file}>
                    <button
                      type="button"
                      onClick={() => setActiveTrack(track)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        isActive
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <p className="font-medium">{getBgmTrackDisplayTitle(track)}</p>
                      <p className="text-xs text-gray-500">{track.category}</p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}
