'use client'

import { useEffect, useMemo, useState } from 'react'

type StoryLine = {
  id: number
  speaker: string
  affiliation: string
  body: string
}

const DEFAULT_LINES: StoryLine[] = [
  { id: 1, speaker: '先生', affiliation: 'シャーレ', body: '今日の任務、準備はできていますか？' },
  { id: 2, speaker: 'アロナ', affiliation: 'シッテムの箱', body: 'はい！いつでも開始できます。' },
]

const TEXT_REVEAL_INTERVAL_MS = 45

export default function StoryEditorPage() {
  const [lines, setLines] = useState<StoryLine[]>(DEFAULT_LINES)
  const [speaker, setSpeaker] = useState('先生')
  const [affiliation, setAffiliation] = useState('シャーレ')
  const [body, setBody] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [playIndex, setPlayIndex] = useState(0)
  const [visibleChars, setVisibleChars] = useState(0)

  const canAdd = useMemo(
    () => speaker.trim().length > 0 && affiliation.trim().length > 0 && body.trim().length > 0,
    [speaker, affiliation, body],
  )

  const addLine = () => {
    if (!canAdd) return
    setLines((prev) => [
      ...prev,
      {
        id: Date.now(),
        speaker: speaker.trim(),
        affiliation: affiliation.trim(),
        body: body.trim(),
      },
    ])
    setBody('')
  }

  const removeLine = (id: number) => {
    setLines((prev) => prev.filter((line) => line.id !== id))
  }

  const playingLine = lines[playIndex]
  const isLineFullyVisible = playingLine ? visibleChars >= playingLine.body.length : true
  const visibleBody = playingLine ? playingLine.body.slice(0, visibleChars) : ''

  useEffect(() => {
    if (!isPlaying || !playingLine) return
    setVisibleChars(0)
  }, [isPlaying, playIndex, playingLine])

  useEffect(() => {
    if (!isPlaying || !playingLine) return
    if (visibleChars >= playingLine.body.length) return

    const timerId = window.setInterval(() => {
      setVisibleChars((prev) => {
        const next = prev + 1
        if (next >= playingLine.body.length) {
          window.clearInterval(timerId)
          return playingLine.body.length
        }
        return next
      })
    }, TEXT_REVEAL_INTERVAL_MS)

    return () => window.clearInterval(timerId)
  }, [isPlaying, playingLine, visibleChars])

  useEffect(() => {
    if (!isPlaying) return

    window.scrollTo({ top: 0, behavior: 'auto' })

    const bodyStyle = document.body.style
    const htmlStyle = document.documentElement.style
    const prevBodyOverflow = bodyStyle.overflow
    const prevHtmlOverflow = htmlStyle.overflow

    bodyStyle.overflow = 'hidden'
    htmlStyle.overflow = 'hidden'

    return () => {
      bodyStyle.overflow = prevBodyOverflow
      htmlStyle.overflow = prevHtmlOverflow
    }
  }, [isPlaying])

  const openPlayer = () => {
    if (lines.length === 0) return
    setPlayIndex(0)
    setIsPlaying(true)
  }

  const closePlayer = () => {
    setIsPlaying(false)
  }

  const onTapAdvance = () => {
    if (!playingLine) return

    if (!isLineFullyVisible) {
      setVisibleChars(playingLine.body.length)
      return
    }

    if (playIndex >= lines.length - 1) {
      closePlayer()
      return
    }

    setPlayIndex((prev) => prev + 1)
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-xl font-bold">ストーリーエディタ</h1>
      <p className="text-sm text-gray-600">発言者・所属・本文を入力してストーリーを作成し、ゲーム画面風の再生でタップ送りできます。</p>

      <section className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-semibold">セリフ追加</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input value={speaker} onChange={(event) => setSpeaker(event.target.value)} className="rounded border px-3 py-2" placeholder="発言者" />
          <input value={affiliation} onChange={(event) => setAffiliation(event.target.value)} className="rounded border px-3 py-2" placeholder="発言者の所属" />
        </div>
        <div className="flex gap-3">
          <input value={body} onChange={(event) => setBody(event.target.value)} className="flex-1 rounded border px-3 py-2" placeholder="本文" />
          <button type="button" onClick={addLine} disabled={!canAdd} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">追加</button>
        </div>
      </section>

      <section className="space-y-3 rounded border bg-white p-4">
        <div className="flex gap-2">
          <button type="button" onClick={openPlayer} disabled={lines.length === 0} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">再生</button>
        </div>

        <ul className="space-y-2">
          {lines.map((line) => (
            <li key={line.id} className="rounded border border-gray-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{line.speaker}</p>
                  <p className="text-xs" style={{ color: '#7cd0ff' }}>{line.affiliation}</p>
                  <p className="mt-1 text-sm">{line.body}</p>
                </div>
                <button type="button" onClick={() => removeLine(line.id)} className="text-xs text-red-600 hover:underline">削除</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {isPlaying && playingLine && (
        <button type="button" className="fixed inset-0 z-[100] bg-white text-left" onClick={onTapAdvance}>
          <div className="absolute left-0 top-0 p-4 text-xs" style={{ color: '#ffffff' }}>タップで次へ</div>
          <div
            className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-6"
            style={{
              background: 'linear-gradient(180deg, #ffffff 0%, #c7d8e5 14%, #90a9bd 38%, #567089 68%, #2a425b 100%)',
            }}
          >
            <p className="text-lg font-bold" style={{ color: '#ffffff' }}>{playingLine.speaker}</p>
            <p className="text-sm font-semibold" style={{ color: '#7cd0ff' }}>{playingLine.affiliation}</p>
            <p className="mt-3 min-h-16 whitespace-pre-wrap text-base" style={{ color: '#ffffff' }}>{visibleBody}</p>
          </div>
        </button>
      )}
    </main>
  )
}
