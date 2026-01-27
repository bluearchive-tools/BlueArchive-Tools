'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { BgmTrack } from '../../../lib/minigames/bgm-quiz'
import { getBgmTrackDisplayTitle, getBgmTracks } from '../../../lib/minigames/bgm-quiz'
import AudioWithFallback from '../../../components/AudioWithFallback'

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max)

export default function BgmDjPage() {
  const t = useTranslations('bgm-dj')
  const tracks = useMemo(() => getBgmTracks(), [])
  const [query, setQuery] = useState('')
  const [crossfader, setCrossfader] = useState(0.5)

  const [leftTrack, setLeftTrack] = useState<BgmTrack | null>(null)
  const [rightTrack, setRightTrack] = useState<BgmTrack | null>(null)
  const [leftPlaying, setLeftPlaying] = useState(false)
  const [rightPlaying, setRightPlaying] = useState(false)
  const [leftVolume, setLeftVolume] = useState(0.9)
  const [rightVolume, setRightVolume] = useState(0.9)

  const leftRef = useRef<HTMLAudioElement | null>(null)
  const rightRef = useRef<HTMLAudioElement | null>(null)

  const filteredTracks = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return tracks
    return tracks.filter((track) => {
      const title = getBgmTrackDisplayTitle(track).toLowerCase()
      return (
        title.includes(normalized) ||
        track.category.toLowerCase().includes(normalized) ||
        track.file.toLowerCase().includes(normalized)
      )
    })
  }, [query, tracks])

  useEffect(() => {
    if (leftRef.current) {
      leftRef.current.volume = clamp(leftVolume * (1 - crossfader))
    }
    if (rightRef.current) {
      rightRef.current.volume = clamp(rightVolume * crossfader)
    }
  }, [leftVolume, rightVolume, crossfader])

  useEffect(() => {
    if (!leftRef.current) return
    if (leftPlaying) {
      leftRef.current.play().catch(() => undefined)
    } else {
      leftRef.current.pause()
    }
  }, [leftPlaying, leftTrack])

  useEffect(() => {
    if (!rightRef.current) return
    if (rightPlaying) {
      rightRef.current.play().catch(() => undefined)
    } else {
      rightRef.current.pause()
    }
  }, [rightPlaying, rightTrack])

  const toggleLeft = () => {
    if (!leftTrack) return
    setLeftPlaying((prev) => !prev)
  }

  const toggleRight = () => {
    if (!rightTrack) return
    setRightPlaying((prev) => !prev)
  }

  const loadLeft = (track: BgmTrack) => {
    setLeftTrack(track)
  }

  const loadRight = (track: BgmTrack) => {
    setRightTrack(track)
  }

  return (
    <main className="p-4 space-y-4 pb-16">
      <section className="space-y-1">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-gray-500">{t('description')}</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700">{t('deck.left')}</h2>
          <p className="text-xs text-gray-500">
            {leftTrack ? getBgmTrackDisplayTitle(leftTrack) : t('deck.track')}
          </p>
          {leftTrack ? (
            <AudioWithFallback
              key={leftTrack.file}
              ref={leftRef}
              src={`/bgm/${encodeURIComponent(leftTrack.file)}`}
              controls
              className="w-full"
              onPlay={() => setLeftPlaying(true)}
              onPause={() => setLeftPlaying(false)}
            />
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 p-4 text-xs text-gray-400">
              {t('deck.track')}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <button
              type="button"
              onClick={toggleLeft}
              disabled={!leftTrack}
              className="rounded-md border border-gray-200 px-3 py-1 font-semibold hover:bg-gray-50 disabled:opacity-40"
            >
              {leftPlaying ? t('deck.pause') : t('deck.play')}
            </button>
            <label className="flex items-center gap-2">
              <span>{t('deck.volume')}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={leftVolume}
                onChange={(event) => setLeftVolume(Number(event.target.value))}
              />
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700">{t('deck.right')}</h2>
          <p className="text-xs text-gray-500">
            {rightTrack ? getBgmTrackDisplayTitle(rightTrack) : t('deck.track')}
          </p>
          {rightTrack ? (
            <AudioWithFallback
              key={rightTrack.file}
              ref={rightRef}
              src={`/bgm/${encodeURIComponent(rightTrack.file)}`}
              controls
              className="w-full"
              onPlay={() => setRightPlaying(true)}
              onPause={() => setRightPlaying(false)}
            />
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 p-4 text-xs text-gray-400">
              {t('deck.track')}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <button
              type="button"
              onClick={toggleRight}
              disabled={!rightTrack}
              className="rounded-md border border-gray-200 px-3 py-1 font-semibold hover:bg-gray-50 disabled:opacity-40"
            >
              {rightPlaying ? t('deck.pause') : t('deck.play')}
            </button>
            <label className="flex items-center gap-2">
              <span>{t('deck.volume')}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={rightVolume}
                onChange={(event) => setRightVolume(Number(event.target.value))}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold text-gray-500" htmlFor="crossfader">
          {t('crossfader.label')}
        </label>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{t('crossfader.left')}</span>
          <input
            id="crossfader"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={crossfader}
            onChange={(event) => setCrossfader(Number(event.target.value))}
            className="flex-1"
          />
          <span>{t('crossfader.right')}</span>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500" htmlFor="dj-search">
            {t('search.label')}
          </label>
          <input
            id="dj-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search.placeholder')}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('list.title')}</p>
        <ul className="max-h-[420px] space-y-2 overflow-auto text-sm">
          {filteredTracks.map((track) => (
            <li key={track.file} className="rounded-lg border border-gray-200 p-3">
              <p className="font-medium">{getBgmTrackDisplayTitle(track)}</p>
              <p className="text-xs text-gray-500">{track.category}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => loadLeft(track)}
                  className="rounded-full border border-gray-200 px-2 py-0.5 text-gray-600 hover:bg-gray-50"
                >
                  {t('list.loadLeft')}
                </button>
                <button
                  type="button"
                  onClick={() => loadRight(track)}
                  className="rounded-full border border-gray-200 px-2 py-0.5 text-gray-600 hover:bg-gray-50"
                >
                  {t('list.loadRight')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
