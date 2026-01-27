'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { BgmTrack } from '../../../lib/minigames/bgm-quiz'
import { getBgmTrackDisplayTitle, getBgmTracks } from '../../../lib/minigames/bgm-quiz'
import AudioWithFallback from '../../../components/AudioWithFallback'

type CategoryOption = {
  label: string
  value: string
}

type SourceList = 'filtered' | 'playlist'

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
  const [activeSource, setActiveSource] = useState<SourceList>('filtered')
  const [playlist, setPlaylist] = useState<BgmTrack[]>([])
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [autoAdvance, setAutoAdvance] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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

  const activeList = useMemo(() => {
    if (activeSource === 'playlist') return playlist
    return filteredTracks
  }, [activeSource, filteredTracks, playlist])

  const activeIndex = useMemo(() => {
    if (!activeTrack) return -1
    return activeList.findIndex((track) => track.file === activeTrack.file)
  }, [activeList, activeTrack])

  useEffect(() => {
    if (!activeTrack && filteredTracks.length) {
      setActiveTrack(filteredTracks[0])
      setActiveSource('filtered')
      return
    }
    if (activeTrack && filteredTracks.length && !filteredTracks.some((track) => track.file === activeTrack.file)) {
      setActiveTrack(filteredTracks[0])
      setActiveSource('filtered')
    }
    if (activeTrack && filteredTracks.length === 0) {
      setActiveTrack(null)
    }
  }, [activeTrack, filteredTracks])

  useEffect(() => {
    if (activeSource === 'playlist' && activeTrack && !playlist.some((track) => track.file === activeTrack.file)) {
      setActiveSource('filtered')
    }
  }, [activeSource, activeTrack, playlist])

  const togglePlaylistTrack = (track: BgmTrack) => {
    setPlaylist((prev) => {
      if (prev.some((item) => item.file === track.file)) {
        return prev.filter((item) => item.file !== track.file)
      }
      return [...prev, track]
    })
  }

  const removePlaylistTrack = (track: BgmTrack) => {
    setPlaylist((prev) => prev.filter((item) => item.file !== track.file))
  }

  const playTrackFromSource = (track: BgmTrack, source: SourceList) => {
    setActiveTrack(track)
    setActiveSource(source)
  }

  const handleEnded = () => {
    if (loopEnabled || !autoAdvance) return
    if (!activeList.length) return
    if (activeIndex >= 0 && activeIndex < activeList.length - 1) {
      const next = activeList[activeIndex + 1]
      if (next) {
        playTrackFromSource(next, activeSource)
      }
    }
  }

  const playNext = () => {
    if (!activeList.length) return
    if (activeIndex >= 0 && activeIndex < activeList.length - 1) {
      playTrackFromSource(activeList[activeIndex + 1], activeSource)
    }
  }

  const playPrevious = () => {
    if (!activeList.length) return
    if (activeIndex > 0) {
      playTrackFromSource(activeList[activeIndex - 1], activeSource)
    }
  }

  return (
    <main className="p-4 space-y-4 pb-16">
      <section className="space-y-1">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-gray-500">{t('description')}</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="space-y-3 rounded-md border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('playbackOptions.title')}</p>
            <label className="flex items-center justify-between text-sm text-gray-600">
              <span>{t('playbackOptions.loop')}</span>
              <input
                type="checkbox"
                checked={loopEnabled}
                onChange={(event) => setLoopEnabled(event.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between text-sm text-gray-600">
              <span>{t('playbackOptions.autoAdvance')}</span>
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(event) => setAutoAdvance(event.target.checked)}
              />
            </label>
          </div>

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
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  {activeSource === 'playlist' ? t('playlist.active') : t('playlist.filtered')}
                </div>
                <AudioWithFallback
                  key={activeTrack.file}
                  src={`/bgm/${encodeURIComponent(activeTrack.file)}`}
                  controls
                  autoPlay
                  className="w-full"
                  loop={loopEnabled}
                  ref={audioRef}
                  onEnded={handleEnded}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={playPrevious}
                    className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    {t('playbackOptions.previous')}
                  </button>
                  <button
                    type="button"
                    onClick={playNext}
                    className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    {t('playbackOptions.next')}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">{t('empty')}</p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('playlist.title')}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (playlist.length) {
                    playTrackFromSource(playlist[0], 'playlist')
                  }
                }}
                disabled={!playlist.length}
                className="rounded-full border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
              >
                {t('playlist.play')}
              </button>
            </div>
            {playlist.length ? (
              <ul className="max-h-[200px] space-y-2 overflow-auto text-sm">
                {playlist.map((track) => (
                  <li key={track.file} className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => playTrackFromSource(track, 'playlist')}
                      className="flex-1 text-left text-sm font-medium text-blue-700 hover:underline"
                    >
                      {getBgmTrackDisplayTitle(track)}
                    </button>
                    <button
                      type="button"
                      onClick={() => removePlaylistTrack(track)}
                      className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-500 hover:bg-gray-50"
                    >
                      {t('playlist.remove')}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400">{t('playlist.empty')}</p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <ul className="max-h-[480px] space-y-2 overflow-auto">
              {filteredTracks.map((track) => {
                const isActive = activeTrack?.file === track.file
                const inPlaylist = playlist.some((item) => item.file === track.file)
                return (
                  <li key={track.file}>
                    <div
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        isActive
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => playTrackFromSource(track, 'filtered')}
                        className="w-full text-left"
                      >
                        <p className="font-medium">{getBgmTrackDisplayTitle(track)}</p>
                        <p className="text-xs text-gray-500">{track.category}</p>
                      </button>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold">
                        <button
                          type="button"
                          onClick={() => togglePlaylistTrack(track)}
                          className="rounded-full border border-gray-200 px-2 py-0.5 text-gray-500 hover:bg-gray-50"
                        >
                          {inPlaylist ? t('playlist.remove') : t('playlist.add')}
                        </button>
                      </div>
                    </div>
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
