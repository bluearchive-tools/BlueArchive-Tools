'use client'

import { useEffect, useMemo, useState } from 'react'

type StoryEffect = 'none' | 'flash' | 'shake' | 'fade'
type ElementAddMode = 'character' | 'line' | 'background'

type StoryMeta = {
  title: string
  summary: string
}

type StoryCharacter = {
  id: number
  name: string
  affiliation: string
}

type BackgroundConfig = {
  color: string
  imageUrl: string
}

type StoryChoice = {
  id: number
  label: string
  nextElementId: number
  setFlag: string
  requireFlag: string
}

type LineElement = {
  id: number
  type: 'line'
  characterId: number
  body: string
  requireFlag: string
  effect: StoryEffect
  choices: StoryChoice[]
}

type BackgroundElement = {
  id: number
  type: 'background'
  config: BackgroundConfig
}

type StoryElement = LineElement | BackgroundElement

const STAR_NUMBER_FONT_NAME = 'StudentImageStarNumber'
const STAR_NUMBER_FONT_FILE = '/fonts/student-image-star-number.otf'
const STAR_NUMBER_FONT_FALLBACK = '"MFW-PUDShinMGoPr6N-Medium", "M PLUS 1p", sans-serif'
const TEXT_REVEAL_INTERVAL_MS = 38
const AUTO_ADVANCE_DELAY_MS = 700
const TITLE_HOLD_MS = 1500

const DEFAULT_CHARACTERS: StoryCharacter[] = [
  { id: 1, name: '先生', affiliation: 'シャーレ' },
  { id: 2, name: 'アロナ', affiliation: 'シッテムの箱' },
]

const DEFAULT_ELEMENTS: StoryElement[] = [
  {
    id: 100,
    type: 'background',
    config: { color: '#ffffff', imageUrl: '' },
  },
  {
    id: 1,
    type: 'line',
    characterId: 1,
    body: '今日の作戦は2ルートあります。どちらで進みますか？',
    requireFlag: '',
    effect: 'fade',
    choices: [
      { id: 11, label: '正面突破', nextElementId: 2, setFlag: 'front', requireFlag: '' },
      { id: 12, label: '迂回ルート', nextElementId: 3, setFlag: 'detour', requireFlag: '' },
    ],
  },
  {
    id: 2,
    type: 'line',
    characterId: 2,
    body: '正面ルートで進行します。',
    requireFlag: 'front',
    effect: 'flash',
    choices: [],
  },
  {
    id: 3,
    type: 'line',
    characterId: 2,
    body: '迂回ルートで静かに進行します。',
    requireFlag: 'detour',
    effect: 'shake',
    choices: [],
  },
]

function canShowChoice(choice: StoryChoice, flags: Set<string>) {
  const required = choice.requireFlag.trim()
  return required.length === 0 || flags.has(required)
}

function isLinePlayable(element: StoryElement, flags: Set<string>) {
  if (element.type !== 'line') return false
  const required = element.requireFlag.trim()
  return required.length === 0 || flags.has(required)
}

function findFirstLineIndex(elements: StoryElement[], flags: Set<string>) {
  for (let i = 0; i < elements.length; i += 1) {
    if (isLinePlayable(elements[i], flags)) return i
  }
  return -1
}

function findNextLineIndex(elements: StoryElement[], currentIndex: number, flags: Set<string>) {
  for (let i = currentIndex + 1; i < elements.length; i += 1) {
    if (isLinePlayable(elements[i], flags)) return i
  }
  return -1
}

function findLastBackgroundBefore(elements: StoryElement[], index: number) {
  let found: BackgroundConfig | null = null
  for (let i = 0; i <= index; i += 1) {
    const element = elements[i]
    if (!element) continue
    if (element.type === 'background') {
      found = element.config
    }
  }
  return found
}

export default function StoryEditorPage() {
  const [meta, setMeta] = useState<StoryMeta>({ title: '', summary: '' })
  const [characters, setCharacters] = useState<StoryCharacter[]>(DEFAULT_CHARACTERS)
  const [elements, setElements] = useState<StoryElement[]>(DEFAULT_ELEMENTS)

  const [addMode, setAddMode] = useState<ElementAddMode>('line')
  const [newCharacterName, setNewCharacterName] = useState('')
  const [newCharacterAffiliation, setNewCharacterAffiliation] = useState('')

  const [lineCharacterId, setLineCharacterId] = useState(DEFAULT_CHARACTERS[0].id)
  const [lineBody, setLineBody] = useState('')
  const [lineRequireFlag, setLineRequireFlag] = useState('')
  const [lineEffect, setLineEffect] = useState<StoryEffect>('none')

  const [bgColor, setBgColor] = useState('#ffffff')
  const [bgImageUrl, setBgImageUrl] = useState('')

  const [draggedId, setDraggedId] = useState<number | null>(null)

  const [choiceEditByLine, setChoiceEditByLine] = useState<Record<number, { label: string; nextElementId: number; setFlag: string; requireFlag: string }>>({})

  const [isPlaying, setIsPlaying] = useState(false)
  const [playIndex, setPlayIndex] = useState(-1)
  const [visibleChars, setVisibleChars] = useState(0)
  const [storyFlags, setStoryFlags] = useState<string[]>([])
  const [autoMode, setAutoMode] = useState(false)
  const [titleVisible, setTitleVisible] = useState(false)
  const [starNumberFontFamily, setStarNumberFontFamily] = useState(STAR_NUMBER_FONT_FALLBACK)
  const [forceLandscape, setForceLandscape] = useState(false)
  const [currentBackground, setCurrentBackground] = useState<BackgroundConfig>({ color: '#ffffff', imageUrl: '' })

  const flagsSet = useMemo(() => new Set(storyFlags), [storyFlags])
  const playingElement = playIndex >= 0 ? elements[playIndex] ?? null : null
  const playingLine = playingElement?.type === 'line' ? playingElement : null
  const playingCharacter = useMemo(
    () => characters.find((character) => character.id === (playingLine?.characterId ?? -1)) ?? null,
    [characters, playingLine?.characterId],
  )

  const visibleChoices = useMemo(() => {
    if (!playingLine) return []
    return playingLine.choices.filter((choice) => canShowChoice(choice, flagsSet))
  }, [flagsSet, playingLine])

  const isLineFullyVisible = playingLine ? visibleChars >= playingLine.body.length : true
  const visibleBody = playingLine ? playingLine.body.slice(0, visibleChars) : ''

  const canAddCharacter = useMemo(
    () => newCharacterName.trim().length > 0 && newCharacterAffiliation.trim().length > 0,
    [newCharacterAffiliation, newCharacterName],
  )
  const canAddLine = useMemo(
    () => lineBody.trim().length > 0 && characters.some((character) => character.id === lineCharacterId),
    [characters, lineBody, lineCharacterId],
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
    if (!isPlaying || !playingLine || titleVisible) return
    setVisibleChars(0)
  }, [isPlaying, playingLine, titleVisible])

  useEffect(() => {
    if (!isPlaying || !playingLine || titleVisible) return
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
  }, [isPlaying, playingLine, titleVisible, visibleChars])

  useEffect(() => {
    if (!isPlaying || !autoMode || !playingLine || !isLineFullyVisible || titleVisible) return
    if (visibleChoices.length > 0) return

    const timeoutId = window.setTimeout(() => {
      goToNextLine()
    }, AUTO_ADVANCE_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, isPlaying, isLineFullyVisible, playingLine, titleVisible, visibleChoices.length, flagsSet, playIndex, elements])

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
    const id = Date.now()
    setElements((prev) => [...prev, { id, type: 'line', characterId: lineCharacterId, body: lineBody.trim(), requireFlag: lineRequireFlag.trim(), effect: lineEffect, choices: [] }])
    setLineBody('')
    setChoiceEditByLine((prev) => ({ ...prev, [id]: { label: '', nextElementId: id, setFlag: '', requireFlag: '' } }))
  }

  const addBackgroundElement = () => {
    const id = Date.now()
    setElements((prev) => [...prev, { id, type: 'background', config: { color: bgColor, imageUrl: bgImageUrl.trim() } }])
  }

  const removeElement = (id: number) => {
    setElements((prev) => prev.filter((element) => element.id !== id).map((element) => {
      if (element.type !== 'line') return element
      return {
        ...element,
        choices: element.choices.filter((choice) => choice.nextElementId !== id),
      }
    }))
  }

  const reorderElements = (fromId: number, toId: number) => {
    if (fromId === toId) return
    setElements((prev) => {
      const fromIndex = prev.findIndex((element) => element.id === fromId)
      const toIndex = prev.findIndex((element) => element.id === toId)
      if (fromIndex < 0 || toIndex < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  const updateChoiceEdit = (lineId: number, patch: Partial<{ label: string; nextElementId: number; setFlag: string; requireFlag: string }>) => {
    setChoiceEditByLine((prev) => {
      const current = prev[lineId] ?? { label: '', nextElementId: lineId, setFlag: '', requireFlag: '' }
      return { ...prev, [lineId]: { ...current, ...patch } }
    })
  }

  const addChoiceToLine = (lineId: number) => {
    const edit = choiceEditByLine[lineId] ?? { label: '', nextElementId: lineId, setFlag: '', requireFlag: '' }
    if (!edit.label.trim()) return

    setElements((prev) => prev.map((element) => {
      if (element.type !== 'line' || element.id !== lineId) return element
      return {
        ...element,
        choices: [
          ...element.choices,
          {
            id: Date.now(),
            label: edit.label.trim(),
            nextElementId: edit.nextElementId,
            setFlag: edit.setFlag.trim(),
            requireFlag: edit.requireFlag.trim(),
          },
        ],
      }
    }))

    updateChoiceEdit(lineId, { label: '', setFlag: '', requireFlag: '' })
  }

  const removeChoiceFromLine = (lineId: number, choiceId: number) => {
    setElements((prev) => prev.map((element) => {
      if (element.type !== 'line' || element.id !== lineId) return element
      return { ...element, choices: element.choices.filter((choice) => choice.id !== choiceId) }
    }))
  }

  const openPlayer = () => {
    const emptyFlags = new Set<string>()
    const firstLineIndex = findFirstLineIndex(elements, emptyFlags)
    if (firstLineIndex < 0) return

    const initialBg = findLastBackgroundBefore(elements, firstLineIndex)
    if (initialBg) setCurrentBackground(initialBg)

    setStoryFlags([])
    setAutoMode(false)
    setPlayIndex(firstLineIndex)
    setIsPlaying(true)

    if (meta.title.trim()) {
      setTitleVisible(true)
      const timerId = window.setTimeout(() => {
        setTitleVisible(false)
      }, TITLE_HOLD_MS)
      return () => window.clearTimeout(timerId)
    }
    setTitleVisible(false)
  }

  const closePlayer = () => {
    setIsPlaying(false)
    setAutoMode(false)
    setTitleVisible(false)
  }

  const goToIndex = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= elements.length) {
      closePlayer()
      return
    }
    const bg = findLastBackgroundBefore(elements, nextIndex)
    if (bg) setCurrentBackground(bg)
    setPlayIndex(nextIndex)
  }

  const goToNextLine = () => {
    const nextIndex = findNextLineIndex(elements, playIndex, flagsSet)
    if (nextIndex < 0) {
      closePlayer()
      return
    }
    goToIndex(nextIndex)
  }

  const jumpToElementById = (elementId: number, setFlag: string) => {
    if (setFlag.trim()) {
      setStoryFlags((prev) => (prev.includes(setFlag.trim()) ? prev : [...prev, setFlag.trim()]))
    }

    const index = elements.findIndex((element) => element.id === elementId)
    if (index < 0) {
      closePlayer()
      return
    }

    const element = elements[index]
    if (element.type === 'background') {
      setCurrentBackground(element.config)
      const nextLineIndex = findNextLineIndex(elements, index, flagsSet)
      goToIndex(nextLineIndex)
      return
    }

    goToIndex(index)
  }

  const onTapAdvance = () => {
    if (titleVisible) {
      setTitleVisible(false)
      return
    }

    if (!playingLine) return

    if (!isLineFullyVisible) {
      setVisibleChars(playingLine.body.length)
      return
    }

    if (visibleChoices.length > 0) return

    goToNextLine()
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-xl font-bold">ストーリーエディタ</h1>

      <section className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-semibold">要素追加</h2>
        <select value={addMode} onChange={(event) => setAddMode(event.target.value as ElementAddMode)} className="rounded border px-3 py-2">
          <option value="character">キャラクター定義</option>
          <option value="line">セリフ追加</option>
          <option value="background">背景定義</option>
        </select>

        {addMode === 'character' && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <input value={newCharacterName} onChange={(event) => setNewCharacterName(event.target.value)} className="rounded border px-3 py-2" placeholder="キャラクター名" />
              <input value={newCharacterAffiliation} onChange={(event) => setNewCharacterAffiliation(event.target.value)} className="rounded border px-3 py-2" placeholder="所属" />
            </div>
            <button type="button" onClick={addCharacter} disabled={!canAddCharacter} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">追加</button>
          </>
        )}

        {addMode === 'line' && (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <select value={lineCharacterId} onChange={(event) => setLineCharacterId(Number(event.target.value))} className="rounded border px-3 py-2">
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>{character.name} / {character.affiliation}</option>
                ))}
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
              <button type="button" onClick={addLine} disabled={!canAddLine} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">追加</button>
            </div>
          </>
        )}

        {addMode === 'background' && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <input type="color" value={bgColor} onChange={(event) => setBgColor(event.target.value)} className="h-11 w-full rounded border p-1" />
              <input value={bgImageUrl} onChange={(event) => setBgImageUrl(event.target.value)} className="rounded border px-3 py-2" placeholder="背景画像URL(任意)" />
            </div>
            <button type="button" onClick={addBackgroundElement} className="rounded bg-blue-600 px-4 py-2 text-white">追加</button>
          </>
        )}
      </section>

      <section className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-semibold">ストーリー定義</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input value={meta.title} onChange={(event) => setMeta((prev) => ({ ...prev, title: event.target.value }))} className="rounded border px-3 py-2" placeholder="タイトル" />
          <input value={meta.summary} onChange={(event) => setMeta((prev) => ({ ...prev, summary: event.target.value }))} className="rounded border px-3 py-2" placeholder="要約" />
        </div>
      </section>

      <section className="space-y-3 rounded border bg-white p-4">
        <div className="flex gap-2">
          <button type="button" onClick={openPlayer} disabled={elements.length === 0} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">再生</button>
        </div>

        <ul className="space-y-2">
          {elements.map((element) => {
            if (element.type === 'background') {
              return (
                <li
                  key={element.id}
                  draggable
                  onDragStart={() => setDraggedId(element.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedId === null) return
                    reorderElements(draggedId, element.id)
                    setDraggedId(null)
                  }}
                  className="rounded border border-blue-200 bg-blue-50 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">背景要素 #{element.id}</p>
                      <p className="text-xs">color: {element.config.color} / image: {element.config.imageUrl || 'なし'}</p>
                    </div>
                    <button type="button" onClick={() => removeElement(element.id)} className="text-xs text-red-600">削除</button>
                  </div>
                </li>
              )
            }

            const character = characters.find((item) => item.id === element.characterId)
            const choiceEdit = choiceEditByLine[element.id] ?? { label: '', nextElementId: element.id, setFlag: '', requireFlag: '' }

            return (
              <li
                key={element.id}
                draggable
                onDragStart={() => setDraggedId(element.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedId === null) return
                  reorderElements(draggedId, element.id)
                  setDraggedId(null)
                }}
                className="rounded border border-gray-200 bg-white p-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">セリフ要素 #{element.id} {character?.name ?? '未設定'} / {character?.affiliation ?? '未設定'}</p>
                      <p className="text-xs text-gray-500">条件: {element.requireFlag || 'なし'} / 効果: {element.effect}</p>
                      <p className="text-sm">{element.body}</p>
                    </div>
                    <button type="button" onClick={() => removeElement(element.id)} className="text-xs text-red-600">削除</button>
                  </div>

                  <div className="rounded border bg-slate-50 p-2">
                    <p className="text-xs font-semibold">この要素の選択肢分岐（入れ子定義）</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-4">
                      <input value={choiceEdit.label} onChange={(event) => updateChoiceEdit(element.id, { label: event.target.value })} className="rounded border px-2 py-1 text-xs" placeholder="ラベル" />
                      <select value={choiceEdit.nextElementId} onChange={(event) => updateChoiceEdit(element.id, { nextElementId: Number(event.target.value) })} className="rounded border px-2 py-1 text-xs">
                        {elements.map((target) => (
                          <option key={target.id} value={target.id}>遷移先 #{target.id} ({target.type})</option>
                        ))}
                      </select>
                      <input value={choiceEdit.setFlag} onChange={(event) => updateChoiceEdit(element.id, { setFlag: event.target.value })} className="rounded border px-2 py-1 text-xs" placeholder="付与フラグ" />
                      <input value={choiceEdit.requireFlag} onChange={(event) => updateChoiceEdit(element.id, { requireFlag: event.target.value })} className="rounded border px-2 py-1 text-xs" placeholder="表示条件フラグ" />
                    </div>
                    <button type="button" className="mt-2 rounded bg-indigo-600 px-3 py-1 text-xs text-white" onClick={() => addChoiceToLine(element.id)}>選択肢追加</button>

                    {element.choices.length > 0 && (
                      <div className="mt-2 space-y-1 text-xs">
                        {element.choices.map((choice) => (
                          <div key={choice.id} className="flex items-center justify-between gap-2 rounded bg-white p-1">
                            <span>{choice.label} → #{choice.nextElementId} / set:{choice.setFlag || '-'} / req:{choice.requireFlag || '-'}</span>
                            <button type="button" className="text-red-600" onClick={() => removeChoiceFromLine(element.id, choice.id)}>削除</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {isPlaying && (
        <div
          className={`fixed inset-0 z-[100] bg-white text-left ${playingLine?.effect === 'flash' ? 'animate-pulse' : ''}`}
          onClick={onTapAdvance}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') onTapAdvance()
          }}
        >
          <div className="absolute inset-0" style={{ backgroundColor: currentBackground.color, backgroundImage: currentBackground.imageUrl ? `url(${currentBackground.imageUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} />

          <div className={`absolute inset-0 ${forceLandscape ? 'flex items-center justify-center' : ''}`}>
            <div className={forceLandscape ? 'h-[100vw] w-[100vh] origin-center rotate-90' : 'h-full w-full'}>
              <div className="absolute right-4 top-4 flex gap-2" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="rounded bg-slate-700/90 px-3 py-1 text-sm text-white" style={{ fontFamily: starNumberFontFamily }} onClick={() => setAutoMode((prev) => !prev)}>AUTO</button>
                <button type="button" className="rounded bg-slate-700/90 px-3 py-1 text-sm text-white" style={{ fontFamily: starNumberFontFamily }} onClick={closePlayer}>MENU</button>
              </div>

              {titleVisible && meta.title.trim() && (
                <div className="absolute left-1/2 top-1/4 z-[3] -translate-x-1/2 rounded bg-black/40 px-6 py-3 text-center text-white">
                  <p className="text-xl font-bold">{meta.title}</p>
                  {meta.summary.trim() && <p className="mt-1 text-sm opacity-90">{meta.summary}</p>}
                </div>
              )}

              {playingLine && (
                <>
                  {isLineFullyVisible && visibleChoices.length > 0 && !titleVisible && (
                    <div className="absolute left-1/2 top-1/2 z-[2] grid w-[min(88vw,460px)] -translate-x-1/2 -translate-y-1/2 gap-2" onClick={(event) => event.stopPropagation()}>
                      {visibleChoices.map((choice) => (
                        <button key={choice.id} type="button" className="rounded bg-slate-900/60 px-4 py-3 text-left text-white hover:bg-slate-900/75" onClick={() => jumpToElementById(choice.nextElementId, choice.setFlag)}>
                          {choice.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={`absolute inset-0 ${playingLine.effect === 'fade' ? 'opacity-80' : 'opacity-100'} ${playingLine.effect === 'shake' ? 'animate-bounce' : ''}`} style={{ pointerEvents: 'none' }} />

                  <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-6" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #d9e5ef 4%, #93acbf 9%, #607c94 18%, #4a667f 38%, #3d5972 62%, #2a425b 100%)' }}>
                    <div className="flex items-baseline gap-3" style={{ color: '#ffffff' }}>
                      <p className="text-lg font-bold">{playingCharacter?.name ?? '未設定キャラクター'}</p>
                      <p className="text-sm font-semibold" style={{ color: '#7cd0ff' }}>{playingCharacter?.affiliation ?? '未設定'}</p>
                    </div>
                    <div className="mt-2 border-t border-white/60" />
                    <p className="mt-3 min-h-16 whitespace-pre-wrap text-base" style={{ color: '#ffffff' }}>{titleVisible ? '' : visibleBody}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
