'use client'

import { useEffect, useMemo, useState } from 'react'

type StoryEffect = 'none' | 'flash' | 'shake' | 'fade'
type ElementAddMode = 'story' | 'background' | 'character' | 'line' | 'choice'

type StoryChoice = {
  id: number
  label: string
  nextLineId: number
  setFlag: string
  requireFlag: string
}

type StoryCharacter = {
  id: number
  name: string
  affiliation: string
}

type StoryLine = {
  id: number
  characterId: number
  body: string
  requireFlag: string
  effect: StoryEffect
  choices: StoryChoice[]
}

type StoryMeta = {
  title: string
  summary: string
}

type StoryBackground = {
  color: string
  imageUrl: string
}

const STAR_NUMBER_FONT_NAME = 'StudentImageStarNumber'
const STAR_NUMBER_FONT_FILE = '/fonts/student-image-star-number.otf'
const STAR_NUMBER_FONT_FALLBACK = '"MFW-PUDShinMGoPr6N-Medium", "M PLUS 1p", sans-serif'
const TEXT_REVEAL_INTERVAL_MS = 38
const AUTO_ADVANCE_DELAY_MS = 700

const DEFAULT_CHARACTERS: StoryCharacter[] = [
  { id: 1, name: '先生', affiliation: 'シャーレ' },
  { id: 2, name: 'アロナ', affiliation: 'シッテムの箱' },
]

const DEFAULT_LINES: StoryLine[] = [
  {
    id: 1,
    characterId: 1,
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
    characterId: 2,
    body: '正面ルートで進行します。',
    requireFlag: 'front',
    effect: 'flash',
    choices: [],
  },
  {
    id: 3,
    characterId: 2,
    body: '迂回ルートで静かに進行します。',
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
  const [addMode, setAddMode] = useState<ElementAddMode>('line')
  const [storyMeta, setStoryMeta] = useState<StoryMeta>({ title: 'タイトル未設定', summary: '要約未設定' })
  const [background, setBackground] = useState<StoryBackground>({ color: '#ffffff', imageUrl: '' })
  const [characters, setCharacters] = useState<StoryCharacter[]>(DEFAULT_CHARACTERS)
  const [lines, setLines] = useState<StoryLine[]>(DEFAULT_LINES)

  const [newCharacterName, setNewCharacterName] = useState('')
  const [newCharacterAffiliation, setNewCharacterAffiliation] = useState('')

  const [lineCharacterId, setLineCharacterId] = useState(DEFAULT_CHARACTERS[0].id)
  const [lineBody, setLineBody] = useState('')
  const [lineRequireFlag, setLineRequireFlag] = useState('')
  const [lineEffect, setLineEffect] = useState<StoryEffect>('none')

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
  const [forceLandscape, setForceLandscape] = useState(false)

  const flagsSet = useMemo(() => new Set(storyFlags), [storyFlags])
  const playingLine = lines[playIndex]
  const playingCharacter = useMemo(
    () => characters.find((character) => character.id === playingLine?.characterId) ?? null,
    [characters, playingLine?.characterId],
  )
  const isLineFullyVisible = playingLine ? visibleChars >= playingLine.body.length : true
  const visibleBody = playingLine ? playingLine.body.slice(0, visibleChars) : ''
  const visibleChoices = useMemo(
    () => (playingLine ? playingLine.choices.filter((choice) => canShowChoice(choice, flagsSet)) : []),
    [flagsSet, playingLine],
  )

  const canAddCharacter = useMemo(
    () => newCharacterName.trim().length > 0 && newCharacterAffiliation.trim().length > 0,
    [newCharacterAffiliation, newCharacterName],
  )
  const canAddLine = useMemo(
    () => lineBody.trim().length > 0 && characters.some((character) => character.id === lineCharacterId),
    [characters, lineBody, lineCharacterId],
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

    const isMobile = window.matchMedia('(max-width: 900px)').matches
    const isPortrait = window.matchMedia('(orientation: portrait)').matches
    setForceLandscape(isMobile && isPortrait)

    const orientation = screen.orientation
    const lockOrientation = async () => {
      const orientationWithLock = orientation as ScreenOrientation & {
        lock?: (orientation: 'any' | 'natural' | 'landscape' | 'portrait' | 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary') => Promise<void>
      }
      if (typeof orientationWithLock.lock !== 'function') return
      try {
        await orientationWithLock.lock('landscape')
      } catch {
        /* noop */
      }
    }
    lockOrientation().catch(() => undefined)

    return () => {
      bodyStyle.overflow = prevBodyOverflow
      htmlStyle.overflow = prevHtmlOverflow
      setForceLandscape(false)
    }
  }, [isPlaying])

  const addCharacter = () => {
    if (!canAddCharacter) return
    const id = Date.now()
    setCharacters((prev) => [...prev, { id, name: newCharacterName.trim(), affiliation: newCharacterAffiliation.trim() }])
    setLineCharacterId(id)
    setNewCharacterName('')
    setNewCharacterAffiliation('')
  }

  const addLine = () => {
    if (!canAddLine) return
    const newLineId = Date.now()
    setLines((prev) => [...prev, { id: newLineId, characterId: lineCharacterId, body: lineBody.trim(), requireFlag: lineRequireFlag.trim(), effect: lineEffect, choices: [] }])
    setLineBody('')
    setChoiceSourceLineId(newLineId)
    setChoiceNextLineId(newLineId)
  }

  const addChoice = () => {
    if (!canAddChoice) return
    setLines((prev) => prev.map((line) => {
      if (line.id !== choiceSourceLineId) return line
      return {
        ...line,
        choices: [...line.choices, { id: Date.now(), label: choiceLabel.trim(), nextLineId: choiceNextLineId, setFlag: choiceSetFlag.trim(), requireFlag: choiceRequireFlag.trim() }],
      }
    }))
    setChoiceLabel('')
    setChoiceSetFlag('')
    setChoiceRequireFlag('')
  }

  const removeLine = (id: number) => {
    setLines((prev) => prev.filter((line) => line.id !== id).map((line) => ({ ...line, choices: line.choices.filter((choice) => choice.nextLineId !== id) })))
  }

  const openPlayer = () => {
    const firstPlayableIndex = lines.findIndex((line) => line.requireFlag.trim().length === 0)
    if (firstPlayableIndex < 0) return
    setStoryFlags([])
    setAutoMode(false)
    setPlayIndex(firstPlayableIndex)
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

  const renderAddForm = () => {
    if (addMode === 'story') {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <input value={storyMeta.title} onChange={(event) => setStoryMeta((prev) => ({ ...prev, title: event.target.value }))} className="rounded border px-3 py-2" placeholder="タイトル" />
          <input value={storyMeta.summary} onChange={(event) => setStoryMeta((prev) => ({ ...prev, summary: event.target.value }))} className="rounded border px-3 py-2" placeholder="要約" />
        </div>
      )
    }

    if (addMode === 'background') {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <input type="color" value={background.color} onChange={(event) => setBackground((prev) => ({ ...prev, color: event.target.value }))} className="h-11 w-full rounded border px-1 py-1" />
          <input value={background.imageUrl} onChange={(event) => setBackground((prev) => ({ ...prev, imageUrl: event.target.value }))} className="rounded border px-3 py-2" placeholder="背景画像URL(任意)" />
        </div>
      )
    }

    if (addMode === 'character') {
      return (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <input value={newCharacterName} onChange={(event) => setNewCharacterName(event.target.value)} className="rounded border px-3 py-2" placeholder="キャラクター名" />
            <input value={newCharacterAffiliation} onChange={(event) => setNewCharacterAffiliation(event.target.value)} className="rounded border px-3 py-2" placeholder="所属" />
          </div>
          <button type="button" onClick={addCharacter} disabled={!canAddCharacter} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">キャラクター追加</button>
        </>
      )
    }

    if (addMode === 'line') {
      return (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <select value={lineCharacterId} onChange={(event) => setLineCharacterId(Number(event.target.value))} className="rounded border px-3 py-2">
              {characters.map((character) => <option key={character.id} value={character.id}>{character.name} / {character.affiliation}</option>)}
            </select>
            <input value={lineRequireFlag} onChange={(event) => setLineRequireFlag(event.target.value)} className="rounded border px-3 py-2" placeholder="表示条件フラグ(任意)" />
            <select value={lineEffect} onChange={(event) => setLineEffect(event.target.value as StoryEffect)} className="rounded border px-3 py-2">
              <option value="none">効果: なし</option>
              <option value="flash">効果: フラッシュ</option>
              <option value="shake">効果: シェイク</option>
              <option value="fade">効果: フェード</option>
            </select>
          </div>
          <div className="flex gap-3">
            <input value={lineBody} onChange={(event) => setLineBody(event.target.value)} className="flex-1 rounded border px-3 py-2" placeholder="本文" />
            <button type="button" onClick={addLine} disabled={!canAddLine} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">セリフ追加</button>
          </div>
        </>
      )
    }

    return (
      <>
        <div className="grid gap-3 md:grid-cols-2">
          <select value={choiceSourceLineId} onChange={(event) => setChoiceSourceLineId(Number(event.target.value))} className="rounded border px-3 py-2">
            {lines.map((line) => <option key={line.id} value={line.id}>追加先: #{line.id}</option>)}
          </select>
          <select value={choiceNextLineId} onChange={(event) => setChoiceNextLineId(Number(event.target.value))} className="rounded border px-3 py-2">
            {lines.map((line) => <option key={line.id} value={line.id}>遷移先: #{line.id}</option>)}
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <input value={choiceLabel} onChange={(event) => setChoiceLabel(event.target.value)} className="rounded border px-3 py-2" placeholder="選択肢ラベル" />
          <input value={choiceSetFlag} onChange={(event) => setChoiceSetFlag(event.target.value)} className="rounded border px-3 py-2" placeholder="選択で付与するフラグ" />
          <input value={choiceRequireFlag} onChange={(event) => setChoiceRequireFlag(event.target.value)} className="rounded border px-3 py-2" placeholder="表示条件フラグ(任意)" />
        </div>
        <button type="button" onClick={addChoice} disabled={!canAddChoice} className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">選択肢追加</button>
      </>
    )
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-xl font-bold">ストーリーエディタ</h1>
      <p className="text-sm text-gray-600">要素追加から背景・キャラクター・ストーリー定義をまとめて編集できます。</p>

      <section className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-semibold">要素追加</h2>
        <select value={addMode} onChange={(event) => setAddMode(event.target.value as ElementAddMode)} className="rounded border px-3 py-2">
          <option value="story">ストーリー定義（タイトル・要約）</option>
          <option value="background">背景設定</option>
          <option value="character">キャラクター定義</option>
          <option value="line">セリフ追加</option>
          <option value="choice">選択肢追加</option>
        </select>
        {renderAddForm()}
      </section>

      <section className="space-y-2 rounded border bg-white p-4">
        <h2 className="font-semibold">ストーリー定義プレビュー</h2>
        <p className="text-lg font-bold">{storyMeta.title}</p>
        <p className="text-sm text-gray-600">{storyMeta.summary}</p>
      </section>

      <section className="space-y-3 rounded border bg-white p-4">
        <div className="flex gap-2">
          <button type="button" onClick={openPlayer} disabled={lines.length === 0} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">再生</button>
        </div>

        <ul className="space-y-2">
          {lines.map((line) => {
            const character = characters.find((item) => item.id === line.characterId)
            return (
              <li key={line.id} className="rounded border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">#{line.id} {character?.name ?? '未設定'} / {character?.affiliation ?? '未設定'}</p>
                    <p className="text-xs text-gray-500">条件: {line.requireFlag || 'なし'} / 効果: {line.effect}</p>
                    <p className="text-sm">{line.body}</p>
                    {line.choices.length > 0 && (
                      <div className="space-y-1 rounded bg-slate-50 p-2 text-xs">
                        {line.choices.map((choice) => (
                          <p key={choice.id}>・{choice.label} → #{choice.nextLineId} / set:{choice.setFlag || '-'} / req:{choice.requireFlag || '-'}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => removeLine(line.id)} className="text-xs text-red-600 hover:underline">削除</button>
                </div>
              </li>
            )
          })}
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
          <div className="absolute inset-0" style={{ backgroundColor: background.color, backgroundImage: background.imageUrl ? `url(${background.imageUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} />

          <div className={`absolute inset-0 ${forceLandscape ? 'flex items-center justify-center' : ''}`}>
            <div className={forceLandscape ? 'h-[100vw] w-[100vh] origin-center rotate-90' : 'h-full w-full'}>
              <div className="absolute right-4 top-4 flex gap-2" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="rounded bg-slate-700/90 px-3 py-1 text-sm text-white" style={{ fontFamily: starNumberFontFamily }} onClick={() => setAutoMode((prev) => !prev)}>AUTO</button>
                <button type="button" className="rounded bg-slate-700/90 px-3 py-1 text-sm text-white" style={{ fontFamily: starNumberFontFamily }} onClick={closePlayer}>MENU</button>
              </div>

              <div className={`absolute inset-0 ${playingLine.effect === 'fade' ? 'opacity-80' : 'opacity-100'} ${playingLine.effect === 'shake' ? 'animate-bounce' : ''}`} style={{ pointerEvents: 'none' }} />

              {isLineFullyVisible && visibleChoices.length > 0 && (
                <div className="absolute left-1/2 top-1/2 z-[2] grid w-[min(88vw,460px)] -translate-x-1/2 -translate-y-1/2 gap-2" onClick={(event) => event.stopPropagation()}>
                  {visibleChoices.map((choice) => (
                    <button key={choice.id} type="button" className="rounded bg-slate-900/60 px-4 py-3 text-left text-white hover:bg-slate-900/75" onClick={() => jumpToLineById(choice.nextLineId, choice.setFlag)}>
                      {choice.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-6" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #d9e5ef 4%, #93acbf 9%, #607c94 18%, #4a667f 38%, #3d5972 62%, #2a425b 100%)' }}>
                <div className="flex items-baseline gap-3" style={{ color: '#ffffff' }}>
                  <p className="text-lg font-bold">{playingCharacter?.name ?? '未設定キャラクター'}</p>
                  <p className="text-sm font-semibold" style={{ color: '#7cd0ff' }}>{playingCharacter?.affiliation ?? '未設定'}</p>
                </div>
                <div className="mt-2 border-t border-white/60" />
                <p className="mt-3 min-h-16 whitespace-pre-wrap text-base" style={{ color: '#ffffff' }}>{visibleBody}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
