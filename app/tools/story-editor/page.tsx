'use client'

import { useEffect, useMemo, useState } from 'react'

type StoryEffect = 'none' | 'flash' | 'shake' | 'fade'

type StoryChoice = {
  id: number
  label: string
  nextLineId: number
  setFlag: string
  requireFlag: string
}

type StoryLine = {
  id: number
  speaker: string
  affiliation: string
  body: string
  requireFlag: string
  effect: StoryEffect
  choices: StoryChoice[]
}

const STAR_NUMBER_FONT_NAME = 'StudentImageStarNumber'
const STAR_NUMBER_FONT_FILE = '/fonts/student-image-star-number.otf'
const STAR_NUMBER_FONT_FALLBACK = '"MFW-PUDShinMGoPr6N-Medium", "M PLUS 1p", sans-serif'
const TEXT_REVEAL_INTERVAL_MS = 38
const AUTO_ADVANCE_DELAY_MS = 700

const DEFAULT_LINES: StoryLine[] = [
  {
    id: 1,
    speaker: '先生',
    affiliation: 'シャーレ',
    body: '今日の作戦は2ルートあります。どちらで進みますか？',
    requireFlag: '',
    effect: 'fade',
    choices: [
      { id: 11, label: '正面突破', nextLineId: 2, setFlag: 'front', requireFlag: '' },
      { id: 12, label: '迂回ルート', nextLineId: 3, setFlag: 'detour', requireFlag: '' },
    ],
  },
  {
    id: 2,
    speaker: 'ホシノ',
    affiliation: '対策委員会',
    body: '正面から行くよ〜。みんな、準備してね。',
    requireFlag: 'front',
    effect: 'flash',
    choices: [],
  },
  {
    id: 3,
    speaker: 'シロコ',
    affiliation: '対策委員会',
    body: '迂回する。静かに進行しよう。',
    requireFlag: 'detour',
    effect: 'shake',
    choices: [],
  },
]

function findNextPlayableIndex(lines: StoryLine[], currentIndex: number, flags: Set<string>) {
  for (let i = currentIndex + 1; i < lines.length; i += 1) {
    const required = lines[i]?.requireFlag.trim()
    if (!required || flags.has(required)) return i
  }
  return -1
}

function canShowChoice(choice: StoryChoice, flags: Set<string>) {
  const required = choice.requireFlag.trim()
  return required.length === 0 || flags.has(required)
}

export default function StoryEditorPage() {
  const [lines, setLines] = useState<StoryLine[]>(DEFAULT_LINES)
  const [speaker, setSpeaker] = useState('先生')
  const [affiliation, setAffiliation] = useState('シャーレ')
  const [body, setBody] = useState('')
  const [requireFlag, setRequireFlag] = useState('')
  const [effect, setEffect] = useState<StoryEffect>('none')

  const [choiceSourceLineId, setChoiceSourceLineId] = useState(1)
  const [choiceLabel, setChoiceLabel] = useState('')
  const [choiceNextLineId, setChoiceNextLineId] = useState(1)
  const [choiceSetFlag, setChoiceSetFlag] = useState('')
  const [choiceRequireFlag, setChoiceRequireFlag] = useState('')

  const [isPlaying, setIsPlaying] = useState(false)
  const [playIndex, setPlayIndex] = useState(0)
  const [visibleChars, setVisibleChars] = useState(0)
  const [storyFlags, setStoryFlags] = useState<string[]>([])
  const [autoMode, setAutoMode] = useState(false)
  const [starNumberFontFamily, setStarNumberFontFamily] = useState(STAR_NUMBER_FONT_FALLBACK)

  const flagsSet = useMemo(() => new Set(storyFlags), [storyFlags])
  const playingLine = lines[playIndex]
  const isLineFullyVisible = playingLine ? visibleChars >= playingLine.body.length : true
  const visibleBody = playingLine ? playingLine.body.slice(0, visibleChars) : ''
  const visibleChoices = useMemo(
    () => (playingLine ? playingLine.choices.filter((choice) => canShowChoice(choice, flagsSet)) : []),
    [flagsSet, playingLine],
  )

  const canAddLine = useMemo(
    () => speaker.trim().length > 0 && affiliation.trim().length > 0 && body.trim().length > 0,
    [speaker, affiliation, body],
  )

  const canAddChoice = useMemo(
    () => choiceLabel.trim().length > 0 && lines.some((line) => line.id === choiceSourceLineId) && lines.some((line) => line.id === choiceNextLineId),
    [choiceLabel, choiceNextLineId, choiceSourceLineId, lines],
  )

  useEffect(() => {
    let cancelled = false

    const loadCustomStarFont = async () => {
      if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) {
        setStarNumberFontFamily(STAR_NUMBER_FONT_FALLBACK)
        return
      }

      try {
        const face = new FontFace(STAR_NUMBER_FONT_NAME, `url(${STAR_NUMBER_FONT_FILE})`, {
          style: 'normal',
          weight: '700',
        })
        const loadedFace = await face.load()
        if (cancelled) return
        document.fonts.add(loadedFace)
        await document.fonts.load(`700 24px ${STAR_NUMBER_FONT_NAME}`)
        if (cancelled) return
        setStarNumberFontFamily(`"${STAR_NUMBER_FONT_NAME}", ${STAR_NUMBER_FONT_FALLBACK}`)
      } catch {
        if (cancelled) return
        setStarNumberFontFamily(STAR_NUMBER_FONT_FALLBACK)
      }
    }

    loadCustomStarFont().catch(() => setStarNumberFontFamily(STAR_NUMBER_FONT_FALLBACK))

    return () => {
      cancelled = true
    }
  }, [])

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
    if (!isPlaying || !autoMode || !playingLine || !isLineFullyVisible) return
    if (visibleChoices.length > 0) return

    const timeoutId = window.setTimeout(() => {
      const nextIndex = findNextPlayableIndex(lines, playIndex, flagsSet)
      if (nextIndex < 0) {
        setIsPlaying(false)
        return
      }
      setPlayIndex(nextIndex)
    }, AUTO_ADVANCE_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [autoMode, flagsSet, isLineFullyVisible, isPlaying, lines, playIndex, playingLine, visibleChoices.length])

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

  const addLine = () => {
    if (!canAddLine) return
    const newId = Date.now()
    setLines((prev) => [
      ...prev,
      {
        id: newId,
        speaker: speaker.trim(),
        affiliation: affiliation.trim(),
        body: body.trim(),
        requireFlag: requireFlag.trim(),
        effect,
        choices: [],
      },
    ])
    setBody('')
    setChoiceNextLineId(newId)
    setChoiceSourceLineId(newId)
  }

  const removeLine = (id: number) => {
    setLines((prev) => prev.filter((line) => line.id !== id).map((line) => ({
      ...line,
      choices: line.choices.filter((choice) => choice.nextLineId !== id),
    })))
  }

  const addChoice = () => {
    if (!canAddChoice) return
    setLines((prev) => prev.map((line) => {
      if (line.id !== choiceSourceLineId) return line
      return {
        ...line,
        choices: [
          ...line.choices,
          {
            id: Date.now(),
            label: choiceLabel.trim(),
            nextLineId: choiceNextLineId,
            setFlag: choiceSetFlag.trim(),
            requireFlag: choiceRequireFlag.trim(),
          },
        ],
      }
    }))
    setChoiceLabel('')
    setChoiceSetFlag('')
    setChoiceRequireFlag('')
  }

  const removeChoice = (lineId: number, choiceId: number) => {
    setLines((prev) => prev.map((line) => {
      if (line.id !== lineId) return line
      return { ...line, choices: line.choices.filter((choice) => choice.id !== choiceId) }
    }))
  }

  const openPlayer = () => {
    const firstPlayableIndex = lines.findIndex((line) => {
      const required = line.requireFlag.trim()
      return required.length === 0
    })
    if (firstPlayableIndex < 0) return

    setStoryFlags([])
    setPlayIndex(firstPlayableIndex)
    setAutoMode(false)
    setIsPlaying(true)
  }

  const closePlayer = () => {
    setIsPlaying(false)
    setAutoMode(false)
  }

  const jumpToLineById = (lineId: number, setFlag: string) => {
    if (setFlag.trim()) {
      setStoryFlags((prev) => (prev.includes(setFlag.trim()) ? prev : [...prev, setFlag.trim()]))
    }

    const nextIndex = lines.findIndex((line) => line.id === lineId)
    if (nextIndex < 0) {
      closePlayer()
      return
    }
    setPlayIndex(nextIndex)
  }

  const onTapAdvance = () => {
    if (!playingLine) return

    if (!isLineFullyVisible) {
      setVisibleChars(playingLine.body.length)
      return
    }

    if (visibleChoices.length > 0) return

    const nextIndex = findNextPlayableIndex(lines, playIndex, flagsSet)
    if (nextIndex < 0) {
      closePlayer()
      return
    }
    setPlayIndex(nextIndex)
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-xl font-bold">ストーリーエディタ</h1>
      <p className="text-sm text-gray-600">発言者・所属・本文に加えて、選択肢、条件分岐、エフェクトを設定できます。</p>

      <section className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-semibold">セリフ追加</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input value={speaker} onChange={(event) => setSpeaker(event.target.value)} className="rounded border px-3 py-2" placeholder="発言者" />
          <input value={affiliation} onChange={(event) => setAffiliation(event.target.value)} className="rounded border px-3 py-2" placeholder="発言者の所属" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input value={requireFlag} onChange={(event) => setRequireFlag(event.target.value)} className="rounded border px-3 py-2" placeholder="表示条件フラグ(任意)" />
          <select value={effect} onChange={(event) => setEffect(event.target.value as StoryEffect)} className="rounded border px-3 py-2">
            <option value="none">エフェクト: なし</option>
            <option value="flash">エフェクト: フラッシュ</option>
            <option value="shake">エフェクト: シェイク</option>
            <option value="fade">エフェクト: フェード</option>
          </select>
        </div>
        <div className="flex gap-3">
          <input value={body} onChange={(event) => setBody(event.target.value)} className="flex-1 rounded border px-3 py-2" placeholder="本文" />
          <button type="button" onClick={addLine} disabled={!canAddLine} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">追加</button>
        </div>
      </section>

      <section className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-semibold">選択肢追加</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <select value={choiceSourceLineId} onChange={(event) => setChoiceSourceLineId(Number(event.target.value))} className="rounded border px-3 py-2">
            {lines.map((line) => <option key={line.id} value={line.id}>追加先: #{line.id} {line.speaker}</option>)}
          </select>
          <select value={choiceNextLineId} onChange={(event) => setChoiceNextLineId(Number(event.target.value))} className="rounded border px-3 py-2">
            {lines.map((line) => <option key={line.id} value={line.id}>遷移先: #{line.id} {line.speaker}</option>)}
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <input value={choiceLabel} onChange={(event) => setChoiceLabel(event.target.value)} className="rounded border px-3 py-2" placeholder="選択肢ラベル" />
          <input value={choiceSetFlag} onChange={(event) => setChoiceSetFlag(event.target.value)} className="rounded border px-3 py-2" placeholder="選択時に付与するフラグ" />
          <input value={choiceRequireFlag} onChange={(event) => setChoiceRequireFlag(event.target.value)} className="rounded border px-3 py-2" placeholder="表示条件フラグ(任意)" />
        </div>
        <button type="button" onClick={addChoice} disabled={!canAddChoice} className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">選択肢を追加</button>
      </section>

      <section className="space-y-3 rounded border bg-white p-4">
        <div className="flex gap-2">
          <button type="button" onClick={openPlayer} disabled={lines.length === 0} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">再生</button>
        </div>
        <ul className="space-y-2">
          {lines.map((line) => (
            <li key={line.id} className="rounded border border-gray-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">#{line.id} {line.speaker} / {line.affiliation}</p>
                  <p className="text-xs text-gray-500">条件: {line.requireFlag || 'なし'} / 効果: {line.effect}</p>
                  <p className="text-sm">{line.body}</p>
                  {line.choices.length > 0 && (
                    <div className="space-y-1 rounded bg-slate-50 p-2 text-xs">
                      {line.choices.map((choice) => (
                        <div key={choice.id} className="flex items-center justify-between gap-2">
                          <span>・{choice.label} → #{choice.nextLineId} / set:{choice.setFlag || '-'} / req:{choice.requireFlag || '-'}</span>
                          <button type="button" className="text-red-600" onClick={() => removeChoice(line.id, choice.id)}>削除</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => removeLine(line.id)} className="text-xs text-red-600 hover:underline">削除</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {isPlaying && playingLine && (
        <div
          className={`fixed inset-0 z-[100] bg-white text-left ${playingLine.effect === 'flash' ? 'animate-pulse' : ''}`}
          onClick={onTapAdvance}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') onTapAdvance()
          }}
          role="button"
          tabIndex={0}
        >
          <div className="absolute right-4 top-4 flex gap-2" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="rounded bg-slate-700/90 px-3 py-1 text-sm text-white"
              style={{ fontFamily: starNumberFontFamily }}
              onClick={() => setAutoMode((prev) => !prev)}
            >
              AUTO
            </button>
            <button
              type="button"
              className="rounded bg-slate-700/90 px-3 py-1 text-sm text-white"
              style={{ fontFamily: starNumberFontFamily }}
              onClick={closePlayer}
            >
              MENU
            </button>
          </div>

          <div
            className={`absolute inset-0 ${playingLine.effect === 'fade' ? 'opacity-80' : 'opacity-100'} ${playingLine.effect === 'shake' ? 'animate-bounce' : ''}`}
            style={{ pointerEvents: 'none' }}
          />

          <div
            className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-6"
            style={{
              background: 'linear-gradient(180deg, #ffffff 0%, #d9e5ef 5%, #8da6b9 11%, #5f7a91 24%, #46627b 48%, #38546e 72%, #2a425b 100%)',
            }}
          >
            <div className="flex items-baseline gap-3" style={{ color: '#ffffff' }}>
              <p className="text-lg font-bold">{playingLine.speaker}</p>
              <p className="text-sm font-semibold" style={{ color: '#7cd0ff' }}>{playingLine.affiliation}</p>
            </div>
            <div className="mt-2 border-t border-white/60" />
            <p className="mt-3 min-h-16 whitespace-pre-wrap text-base" style={{ color: '#ffffff' }}>{visibleBody}</p>

            {isLineFullyVisible && visibleChoices.length > 0 && (
              <div className="mt-4 grid gap-2" onClick={(event) => event.stopPropagation()}>
                {visibleChoices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className="rounded bg-slate-900/45 px-4 py-2 text-left text-white hover:bg-slate-900/60"
                    onClick={() => jumpToLineById(choice.nextLineId, choice.setFlag)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
