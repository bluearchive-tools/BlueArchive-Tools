'use client'

import { useMemo, useRef, useState } from 'react'

type StoryLine = {
  id: number
  speaker: string
  text: string
}

const DEFAULT_LINES: StoryLine[] = [
  { id: 1, speaker: '先生', text: '今日の任務、準備はできていますか？' },
  { id: 2, speaker: 'アロナ', text: 'はい！いつでも開始できます。' },
]

export default function StoryEditorPage() {
  const [lines, setLines] = useState<StoryLine[]>(DEFAULT_LINES)
  const [speaker, setSpeaker] = useState('先生')
  const [text, setText] = useState('')
  const [playing, setPlaying] = useState(false)
  const [playIndex, setPlayIndex] = useState(0)
  const timerRef = useRef<number | null>(null)

  const canAdd = useMemo(() => speaker.trim().length > 0 && text.trim().length > 0, [speaker, text])

  const stopPlayback = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setPlaying(false)
  }

  const startPlayback = () => {
    if (lines.length === 0) return
    stopPlayback()
    setPlaying(true)
    setPlayIndex(0)
    timerRef.current = window.setInterval(() => {
      setPlayIndex((prev) => {
        const next = prev + 1
        if (next >= lines.length) {
          stopPlayback()
          return prev
        }
        return next
      })
    }, 1800)
  }

  const addLine = () => {
    if (!canAdd) return
    setLines((prev) => [...prev, { id: Date.now(), speaker: speaker.trim(), text: text.trim() }])
    setText('')
  }

  const removeLine = (id: number) => {
    setLines((prev) => prev.filter((line) => line.id !== id))
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-xl font-bold">ストーリーエディタ</h1>
      <p className="text-sm text-gray-600">セリフを追加して自分だけのストーリーを作成し、再生できます。</p>

      <section className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-semibold">セリフ追加</h2>
        <div className="grid gap-3 md:grid-cols-[200px_1fr_auto]">
          <input
            value={speaker}
            onChange={(event) => setSpeaker(event.target.value)}
            className="rounded border px-3 py-2"
            placeholder="話者"
          />
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="rounded border px-3 py-2"
            placeholder="セリフ"
          />
          <button
            type="button"
            onClick={addLine}
            disabled={!canAdd}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            追加
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded border bg-white p-4">
        <div className="flex gap-2">
          <button type="button" onClick={startPlayback} disabled={lines.length === 0 || playing} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">再生</button>
          <button type="button" onClick={stopPlayback} disabled={!playing} className="rounded bg-slate-600 px-4 py-2 text-white disabled:opacity-50">停止</button>
        </div>

        <ul className="space-y-2">
          {lines.map((line, index) => {
            const active = playing && index === playIndex
            return (
              <li key={line.id} className={`rounded border p-3 ${active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{line.speaker}</p>
                    <p className="text-sm">{line.text}</p>
                  </div>
                  <button type="button" onClick={() => removeLine(line.id)} className="text-xs text-red-600 hover:underline">削除</button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </main>
  )
}
