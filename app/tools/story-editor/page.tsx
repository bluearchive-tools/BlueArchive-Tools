'use client'

import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faExpand, faForward, faGear } from '@fortawesome/free-solid-svg-icons'

type StoryEffect = 'none' | 'flash' | 'shake' | 'fade'
type ElementAddMode = 'character' | 'line' | 'background'
type TitlePhase = 'hidden' | 'fadeIn' | 'fadeOut'
type FadePhase = 'hidden' | 'fadeIn' | 'fadeOut'
type EditorView = 'timeline' | 'characters' | 'story'

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
  locationLabel: string
  choices: StoryChoice[]
}

type BackgroundElement = {
  id: number
  type: 'background'
  config: BackgroundConfig
}

type StoryElement = LineElement | BackgroundElement

const SHIN_MARU_FONT = '"MFW-PShinMGoPr6N-Medium", "M PLUS 1p", sans-serif'
const TEXT_REVEAL_INTERVAL_MS = 38
const AUTO_ADVANCE_DELAY_MS = 700
const TITLE_HOLD_MS = 1000
const TITLE_FADE_MS = 500
const LOCATION_SHOW_MS = 1500
const LOCATION_FADE_MS = 500

const DEFAULT_CHARACTERS: StoryCharacter[] = [
  { id: 1, name: '先生', affiliation: 'シャーレ' },
  { id: 2, name: 'アロナ', affiliation: 'シッテムの箱' },
]

const DEFAULT_ELEMENTS: StoryElement[] = [
  { id: 100, type: 'background', config: { color: '#ffffff', imageUrl: '' } },
  {
    id: 1,
    type: 'line',
    characterId: 1,
    body: '今日の作戦は2ルートあります。どちらで進みますか？',
    requireFlag: '',
    effect: 'fade',
    locationLabel: 'SCHALE BRIDGE',
    choices: [
      { id: 11, label: '正面突破', nextElementId: 2, setFlag: 'front', requireFlag: '' },
      { id: 12, label: '迂回ルート', nextElementId: 3, setFlag: 'detour', requireFlag: '' },
    ],
  },
  { id: 2, type: 'line', characterId: 2, body: '正面ルートで進行します。', requireFlag: 'front', effect: 'flash', locationLabel: '', choices: [] },
  { id: 3, type: 'line', characterId: 2, body: '迂回ルートで静かに進行します。', requireFlag: 'detour', effect: 'shake', locationLabel: '', choices: [] },
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
    if (element.type === 'background') found = element.config
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
  const [lineLocationLabel, setLineLocationLabel] = useState('')

  const [bgColor, setBgColor] = useState('#ffffff')
  const [bgImageUrl, setBgImageUrl] = useState('')

  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [choiceEditByLine, setChoiceEditByLine] = useState<Record<number, { label: string; nextElementId: number; setFlag: string; requireFlag: string }>>({})

  const [isPlaying, setIsPlaying] = useState(false)
  const [playIndex, setPlayIndex] = useState(-1)
  const [visibleChars, setVisibleChars] = useState(0)
  const [storyFlags, setStoryFlags] = useState<string[]>([])
  const [autoMode, setAutoMode] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false)
  const [startPromptOpen, setStartPromptOpen] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [loggedLineId, setLoggedLineId] = useState<number | null>(null)
  const [backgroundOnly, setBackgroundOnly] = useState(false)

  const [titlePhase, setTitlePhase] = useState<TitlePhase>('hidden')
  const [locationPhase, setLocationPhase] = useState<FadePhase>('hidden')
  const [dialogueReady, setDialogueReady] = useState(true)

  const [forceLandscape, setForceLandscape] = useState(false)
  const [currentBackground, setCurrentBackground] = useState<BackgroundConfig>({ color: '#ffffff', imageUrl: '' })
  const [choiceAppear, setChoiceAppear] = useState(false)
  const [editorView, setEditorView] = useState<EditorView>('timeline')

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
  const canAddCharacter = useMemo(() => newCharacterName.trim() !== '' && newCharacterAffiliation.trim() !== '', [newCharacterAffiliation, newCharacterName])
  const canAddLine = useMemo(() => lineBody.trim() !== '' && characters.some((character) => character.id === lineCharacterId), [characters, lineBody, lineCharacterId])

  useEffect(() => {
    if (!isPlaying || !playingLine || titlePhase !== 'hidden' || !dialogueReady) return
    setVisibleChars(0)
    setLoggedLineId(null)
  }, [dialogueReady, isPlaying, playingLine, titlePhase])

  useEffect(() => {
    if (!isPlaying || !playingLine || titlePhase !== 'hidden' || !dialogueReady) return
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
  }, [dialogueReady, isPlaying, playingLine, titlePhase, visibleChars])

  useEffect(() => {
    if (!isPlaying || !playingLine || titlePhase !== 'hidden' || !dialogueReady) return
    if (!isLineFullyVisible) return
    if (loggedLineId === playingLine.id) return
    const characterName = playingCharacter?.name ?? '未設定'
    setLogs((prev) => [...prev, `${characterName}: ${playingLine.body}`])
    setLoggedLineId(playingLine.id)
  }, [dialogueReady, isPlaying, isLineFullyVisible, loggedLineId, playingCharacter?.name, playingLine, titlePhase])

  useEffect(() => {
    if (!isPlaying || !playingLine || !playingLine.locationLabel.trim() || titlePhase !== 'hidden' || !dialogueReady) {
      setLocationPhase('hidden')
      return
    }

    setLocationPhase('hidden')
    const fadeInId = window.setTimeout(() => setLocationPhase('fadeIn'), 16)
    const fadeOutId = window.setTimeout(() => setLocationPhase('fadeOut'), LOCATION_SHOW_MS)
    const hideId = window.setTimeout(() => setLocationPhase('hidden'), LOCATION_SHOW_MS + LOCATION_FADE_MS)
    return () => {
      window.clearTimeout(fadeInId)
      window.clearTimeout(fadeOutId)
      window.clearTimeout(hideId)
    }
  }, [dialogueReady, isPlaying, playIndex, playingLine, titlePhase])

  useEffect(() => {
    if (!isPlaying || !autoMode || !playingLine || !isLineFullyVisible || titlePhase !== 'hidden' || !dialogueReady) return
    if (visibleChoices.length > 0) return
    const timeoutId = window.setTimeout(() => goToNextLine(), AUTO_ADVANCE_DELAY_MS)
    return () => window.clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, isPlaying, isLineFullyVisible, playingLine, titlePhase, visibleChoices.length, flagsSet, playIndex, elements])

  useEffect(() => {
    const canShowChoices = titlePhase === 'hidden' && dialogueReady && isLineFullyVisible && visibleChoices.length > 0
    if (!canShowChoices) {
      setChoiceAppear(false)
      return
    }
    setChoiceAppear(false)
    const id = window.setTimeout(() => setChoiceAppear(true), 16)
    return () => window.clearTimeout(id)
  }, [dialogueReady, isLineFullyVisible, titlePhase, visibleChoices.length, playIndex])

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
    setElements((prev) => [...prev, { id, type: 'line', characterId: lineCharacterId, body: lineBody.trim(), requireFlag: lineRequireFlag.trim(), effect: lineEffect, locationLabel: lineLocationLabel.trim(), choices: [] }])
    setLineBody('')
    setLineLocationLabel('')
    setChoiceEditByLine((prev) => ({ ...prev, [id]: { label: '', nextElementId: id, setFlag: '', requireFlag: '' } }))
  }

  const addBackgroundElement = () => {
    const id = Date.now()
    setElements((prev) => [...prev, { id, type: 'background', config: { color: bgColor, imageUrl: bgImageUrl.trim() } }])
  }

  const updateBackgroundElement = (id: number, patch: Partial<BackgroundConfig>) => {
    setElements((prev) => prev.map((element) => {
      if (element.type !== 'background' || element.id !== id) return element
      return { ...element, config: { ...element.config, ...patch } }
    }))
  }

  const updateLineElement = (id: number, patch: Partial<Omit<LineElement, 'id' | 'type' | 'choices'>>) => {
    setElements((prev) => prev.map((element) => {
      if (element.type !== 'line' || element.id !== id) return element
      return { ...element, ...patch }
    }))
  }

  const removeElement = (id: number) => {
    setElements((prev) => prev.filter((element) => element.id !== id).map((element) => {
      if (element.type !== 'line') return element
      return { ...element, choices: element.choices.filter((choice) => choice.nextElementId !== id) }
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
        choices: [...element.choices, { id: Date.now(), label: edit.label.trim(), nextElementId: edit.nextElementId, setFlag: edit.setFlag.trim(), requireFlag: edit.requireFlag.trim() }],
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

    setLogs([])
    setStoryFlags([])
    setAutoMode(false)
    setMenuOpen(false)
    setLogOpen(false)
    setSkipConfirmOpen(false)
    setStartPromptOpen(true)
    setBackgroundOnly(false)
    setPlayIndex(firstLineIndex)
    setIsPlaying(true)

    setTitlePhase('hidden')
    setDialogueReady(false)
  }

  const startStoryPlayback = () => {
    setStartPromptOpen(false)

    if (meta.title.trim()) {
      setDialogueReady(false)
      setTitlePhase('hidden')
      window.setTimeout(() => setTitlePhase('fadeIn'), 16)
      window.setTimeout(() => setTitlePhase('fadeOut'), TITLE_HOLD_MS)
      window.setTimeout(() => {
        setTitlePhase('hidden')
        window.setTimeout(() => setDialogueReady(true), 220)
      }, TITLE_HOLD_MS + TITLE_FADE_MS)
    } else {
      setTitlePhase('hidden')
      setDialogueReady(true)
    }
  }

  const closePlayer = () => {
    setIsPlaying(false)
    setAutoMode(false)
    setMenuOpen(false)
    setLogOpen(false)
    setSkipConfirmOpen(false)
    setStartPromptOpen(false)
    setBackgroundOnly(false)
    setTitlePhase('hidden')
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
    const target = elements[index]
    if (target.type === 'background') {
      setCurrentBackground(target.config)
      const nextLine = findNextLineIndex(elements, index, flagsSet)
      goToIndex(nextLine)
      return
    }
    goToIndex(index)
  }

  const onTapAdvance = () => {
    if (startPromptOpen) {
      startStoryPlayback()
      return
    }
    if (backgroundOnly) {
      setBackgroundOnly(false)
      return
    }
    if (titlePhase !== 'hidden') {
      setTitlePhase('hidden')
      setDialogueReady(true)
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
    <main className="space-y-4 p-4 md:pl-72">
      <h1 className="text-xl font-bold">ストーリーエディタ</h1>

      <section>
        <aside className="rounded border bg-white p-3 md:fixed md:left-4 md:top-20 md:w-60">
          <p className="mb-2 text-sm font-semibold text-gray-700">メニュー</p>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setEditorView('timeline')}
              className={`w-full rounded px-3 py-2 text-left text-sm ${editorView === 'timeline' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
            >
              会話タイムライン
            </button>
            <button
              type="button"
              onClick={() => setEditorView('characters')}
              className={`w-full rounded px-3 py-2 text-left text-sm ${editorView === 'characters' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
            >
              キャラクター定義
            </button>
            <button
              type="button"
              onClick={() => setEditorView('story')}
              className={`w-full rounded px-3 py-2 text-left text-sm ${editorView === 'story' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
            >
              ストーリー定義
            </button>
          </div>
        </aside>

        <div className="space-y-3 md:mx-auto md:max-w-5xl">
          {editorView === 'timeline' && (
            <>
              <section className="space-y-3 rounded border bg-white p-4">
                <h2 className="font-semibold">要素追加（タイムライン）</h2>
                <select value={addMode} onChange={(event) => setAddMode(event.target.value as ElementAddMode)} className="rounded border px-3 py-2">
                  <option value="line">セリフ追加</option>
                  <option value="background">背景定義</option>
                  <option value="character">キャラクター定義</option>
                </select>

                {addMode === 'line' && (
                  <>
                    <div className="grid gap-3 md:grid-cols-4">
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
                      <input value={lineLocationLabel} onChange={(event) => setLineLocationLabel(event.target.value)} className="rounded border px-3 py-2" placeholder="場所表示オプション(任意)" />
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

                {addMode === 'character' && (
                  <p className="text-sm text-gray-600">キャラクター定義は左メニューの「キャラクター定義」から編集してください。</p>
                )}
              </section>

              <section className="space-y-3 rounded border bg-white p-4">
                <div className="flex gap-2">
                  <button type="button" onClick={openPlayer} disabled={elements.length === 0} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">再生</button>
                </div>
                <ul className="space-y-2">
                  {elements.map((element) => {
                    if (element.type === 'background') {
                      return (
                        <li key={element.id} draggable onDragStart={() => setDraggedId(element.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedId === null) return; reorderElements(draggedId, element.id); setDraggedId(null) }} className="rounded border border-blue-200 bg-blue-50 p-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold">背景要素 #{element.id}</p>
                              <button type="button" onClick={() => removeElement(element.id)} className="text-xs text-red-600">削除</button>
                            </div>
                            <div className="grid gap-2 md:grid-cols-2">
                              <input type="color" value={element.config.color} onChange={(event) => updateBackgroundElement(element.id, { color: event.target.value })} className="h-9 rounded border p-1" />
                              <input value={element.config.imageUrl} onChange={(event) => updateBackgroundElement(element.id, { imageUrl: event.target.value })} className="rounded border px-2 py-1 text-xs" placeholder="背景画像URL(後から変更可能)" />
                            </div>
                          </div>
                        </li>
                      )
                    }

                    const character = characters.find((item) => item.id === element.characterId)
                    const choiceEdit = choiceEditByLine[element.id] ?? { label: '', nextElementId: element.id, setFlag: '', requireFlag: '' }

                    return (
                      <li key={element.id} draggable onDragStart={() => setDraggedId(element.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedId === null) return; reorderElements(draggedId, element.id); setDraggedId(null) }} className="rounded border border-gray-200 bg-white p-3">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">セリフ要素 #{element.id} {character?.name ?? '未設定'} / {character?.affiliation ?? '未設定'}</p>
                              <p className="text-xs text-gray-500">条件:{element.requireFlag || 'なし'} / 効果:{element.effect} / 場所:{element.locationLabel || '-'}</p>
                              <p className="text-sm">{element.body}</p>
                            </div>
                            <button type="button" onClick={() => removeElement(element.id)} className="text-xs text-red-600">削除</button>
                          </div>

                          <details className="rounded border bg-slate-50 p-2">
                            <summary className="cursor-pointer text-xs font-semibold">オプションを見る（選択肢分岐・表示条件）</summary>
                            <div className="mt-2 space-y-2">
                              <div className="grid gap-2 md:grid-cols-3">
                                <input
                                  value={element.requireFlag}
                                  onChange={(event) => updateLineElement(element.id, { requireFlag: event.target.value })}
                                  className="rounded border px-2 py-1 text-xs"
                                  placeholder="表示条件フラグ"
                                />
                                <select
                                  value={element.effect}
                                  onChange={(event) => updateLineElement(element.id, { effect: event.target.value as StoryEffect })}
                                  className="rounded border px-2 py-1 text-xs"
                                >
                                  <option value="none">効果: なし</option>
                                  <option value="flash">効果: フラッシュ</option>
                                  <option value="shake">効果: シェイク</option>
                                  <option value="fade">効果: フェード</option>
                                </select>
                                <input
                                  value={element.locationLabel}
                                  onChange={(event) => updateLineElement(element.id, { locationLabel: event.target.value })}
                                  className="rounded border px-2 py-1 text-xs"
                                  placeholder="場所表示"
                                />
                              </div>

                              <div className="grid gap-2 md:grid-cols-4">
                                <input value={choiceEdit.label} onChange={(event) => updateChoiceEdit(element.id, { label: event.target.value })} className="rounded border px-2 py-1 text-xs" placeholder="ラベル" />
                                <select value={choiceEdit.nextElementId} onChange={(event) => updateChoiceEdit(element.id, { nextElementId: Number(event.target.value) })} className="rounded border px-2 py-1 text-xs">
                                  {elements.map((target) => <option key={target.id} value={target.id}>遷移先 #{target.id} ({target.type})</option>)}
                                </select>
                                <input value={choiceEdit.setFlag} onChange={(event) => updateChoiceEdit(element.id, { setFlag: event.target.value })} className="rounded border px-2 py-1 text-xs" placeholder="付与フラグ" />
                                <input value={choiceEdit.requireFlag} onChange={(event) => updateChoiceEdit(element.id, { requireFlag: event.target.value })} className="rounded border px-2 py-1 text-xs" placeholder="表示条件" />
                              </div>
                              <button type="button" className="rounded bg-indigo-600 px-3 py-1 text-xs text-white" onClick={() => addChoiceToLine(element.id)}>選択肢追加</button>

                              {element.choices.length > 0 && (
                                <div className="space-y-1 text-xs">
                                  {element.choices.map((choice) => (
                                    <div key={choice.id} className="flex items-center justify-between gap-2 rounded bg-white p-1">
                                      <span>{choice.label} → #{choice.nextElementId} / set:{choice.setFlag || '-'} / req:{choice.requireFlag || '-'}</span>
                                      <button type="button" className="text-red-600" onClick={() => removeChoiceFromLine(element.id, choice.id)}>削除</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </details>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </>
          )}

          {editorView === 'characters' && (
            <section className="space-y-3 rounded border bg-white p-4">
              <h2 className="font-semibold">キャラクター定義</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <input value={newCharacterName} onChange={(event) => setNewCharacterName(event.target.value)} className="rounded border px-3 py-2" placeholder="キャラクター名" />
                <input value={newCharacterAffiliation} onChange={(event) => setNewCharacterAffiliation(event.target.value)} className="rounded border px-3 py-2" placeholder="所属" />
              </div>
              <button type="button" onClick={addCharacter} disabled={!canAddCharacter} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">追加</button>

              <ul className="space-y-2 pt-2">
                {characters.map((character) => (
                  <li key={character.id} className="rounded border bg-slate-50 p-3 text-sm">
                    <p className="font-semibold">{character.name}</p>
                    <p className="text-gray-600">{character.affiliation}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {editorView === 'story' && (
            <section className="space-y-3 rounded border bg-white p-4">
              <h2 className="font-semibold">ストーリー定義</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <input value={meta.title} onChange={(event) => setMeta((prev) => ({ ...prev, title: event.target.value }))} className="rounded border px-3 py-2" placeholder="タイトル" />
                <input value={meta.summary} onChange={(event) => setMeta((prev) => ({ ...prev, summary: event.target.value }))} className="rounded border px-3 py-2" placeholder="要約" />
              </div>
            </section>
          )}
        </div>
      </section>
      {isPlaying && (
        <div className={`fixed inset-0 z-[100] bg-white text-left ${playingLine?.effect === 'flash' ? 'animate-pulse' : ''}`} onClick={onTapAdvance} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onTapAdvance() }}>
          <div className="absolute inset-0" style={{ backgroundColor: currentBackground.color, backgroundImage: currentBackground.imageUrl ? `url(${currentBackground.imageUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} />

          <div className={`absolute inset-0 ${forceLandscape ? 'flex items-center justify-center' : ''}`}>
            <div className={forceLandscape ? 'h-[100vw] w-[100vh] origin-center rotate-90' : 'h-full w-full'}>
              {!backgroundOnly && (
                <>
                  <div className="absolute right-4 top-4 z-[5] flex flex-col items-end gap-2" onClick={(event) => event.stopPropagation()}>
                    <div className="flex gap-2">
                      <button type="button" className="rounded bg-white/90 px-3 py-1 text-sm text-slate-900 italic" style={{ fontFamily: SHIN_MARU_FONT }} onClick={() => setAutoMode((prev) => !prev)}>AUTO</button>
                      <button type="button" className="rounded bg-white/90 px-3 py-1 text-sm text-slate-900 italic" style={{ fontFamily: SHIN_MARU_FONT }} onClick={() => setMenuOpen((prev) => !prev)}>MENU</button>
                    </div>
                    {menuOpen && (
                      <div className="grid grid-cols-4 gap-2 rounded bg-white/90 p-2 text-slate-800">
                        <button type="button" className="rounded bg-white p-2" title="拡大" onClick={() => { setBackgroundOnly(true); setMenuOpen(false) }}><FontAwesomeIcon icon={faExpand} /></button>
                        <button type="button" className="rounded bg-white p-2" title="設定"><FontAwesomeIcon icon={faGear} /></button>
                        <button type="button" className="rounded bg-white p-2" title="LOG" onClick={() => setLogOpen(true)}><FontAwesomeIcon icon={faBars} /></button>
                        <button type="button" className="rounded bg-white p-2" title="スキップ" onClick={() => setSkipConfirmOpen(true)}><FontAwesomeIcon icon={faForward} /></button>
                      </div>
                    )}
                  </div>

                  {titlePhase !== 'hidden' && meta.title.trim() && (
                    <div className={`absolute inset-0 z-[4] transition-opacity duration-500 ${titlePhase === 'fadeIn' ? 'opacity-100' : 'opacity-0'}`} style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}>
                      <div className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 bg-white/96 py-5 text-center transition-opacity duration-500 ${titlePhase === 'fadeIn' ? 'opacity-100' : 'opacity-0'}`}>
                        <p className="text-2xl font-bold" style={{ color: '#3a4f88' }}>{meta.title}</p>
                        {meta.summary.trim() && <p className="mt-1 text-sm" style={{ color: '#3a4f88' }}>{meta.summary}</p>}
                      </div>
                    </div>
                  )}

                  {startPromptOpen && (
                    <div className="absolute inset-0 z-[7] flex items-center justify-center bg-gray-500/95 text-center">
                      <div>
                        <p className="text-xl font-bold text-white">タップでストーリーを開始</p>
                      </div>
                    </div>
                  )}

                  {playingLine && titlePhase === 'hidden' && locationPhase !== 'hidden' && playingLine.locationLabel.trim() && (
                    <div className={`absolute left-6 top-[34%] z-[3] rounded px-4 py-2 text-sm text-white transition-opacity duration-500 ${locationPhase === 'fadeIn' ? 'opacity-100' : 'opacity-0'}`} style={{ backgroundColor: 'rgba(42,66,91,0.65)' }}>
                      {playingLine.locationLabel}
                    </div>
                  )}

                  {playingLine && dialogueReady && isLineFullyVisible && visibleChoices.length > 0 && titlePhase === 'hidden' && (
                    <div className="absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2" onClick={(event) => event.stopPropagation()}>
                      <div className={`grid w-[min(88vw,460px)] gap-2 transition-all duration-300 ${choiceAppear ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}>
                        {visibleChoices.map((choice) => (
                          <button key={choice.id} type="button" className="rounded bg-white/90 px-4 py-3 text-center text-slate-900 hover:bg-white" onClick={() => jumpToElementById(choice.nextElementId, choice.setFlag)}>
                            {choice.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {playingLine && (
                    <>
                      <div className={`absolute inset-0 ${playingLine.effect === 'fade' ? 'opacity-80' : 'opacity-100'} ${playingLine.effect === 'shake' ? 'animate-bounce' : ''}`} style={{ pointerEvents: 'none' }} />

                      <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-6" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(217,229,239,0.25) 4%, rgba(147,172,191,0.45) 9%, rgba(96,124,148,0.65) 18%, rgba(74,102,127,0.78) 38%, rgba(61,89,114,0.9) 62%, rgba(42,66,91,0.96) 100%)' }}>
                        <div className="flex items-baseline gap-3" style={{ color: '#ffffff' }}>
                          <p className="text-lg font-bold">{playingCharacter?.name ?? '未設定キャラクター'}</p>
                          <p className="text-sm font-semibold" style={{ color: '#7cd0ff' }}>{playingCharacter?.affiliation ?? '未設定'}</p>
                        </div>
                        <div className="mt-2 border-t border-white/60" />
                        <p className="mt-3 min-h-16 whitespace-pre-wrap text-base" style={{ color: '#ffffff' }}>{dialogueReady ? visibleBody : ''}</p>
                        {isLineFullyVisible && visibleChoices.length === 0 && (
                          <span className="absolute bottom-3 right-4 animate-bounce text-lg" style={{ color: '#7cd0ff' }}>▲</span>
                        )}
                      </div>
                    </>
                  )}

                  {skipConfirmOpen && (
                    <div className="absolute inset-0 z-[6] flex items-end justify-center bg-black/40" onClick={() => setSkipConfirmOpen(false)}>
                      <div className="w-[min(92vw,560px)] animate-[fadeInUp_.35s_ease-out] rounded-t-2xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
                        <p className="text-sm font-semibold text-gray-500">あらすじ</p>
                        <p className="mt-1 text-lg font-bold">{meta.title || 'タイトル未設定'}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{meta.summary || '要約未設定'}</p>
                        <p className="mt-4 text-sm text-gray-700">※この話をスキップしますか？</p>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <button type="button" className="animate-[fadeInUp_.35s_ease-out] rounded border px-4 py-2" onClick={() => setSkipConfirmOpen(false)}>キャンセル</button>
                          <button
                            type="button"
                            className="animate-[fadeInUp_.35s_ease-out] rounded bg-blue-600 px-4 py-2 text-white"
                            onClick={() => {
                              setSkipConfirmOpen(false)
                              closePlayer()
                            }}
                          >
                            OK
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {logOpen && (
                    <div className="absolute inset-0 z-[6] flex items-center justify-center bg-black/45" onClick={() => setLogOpen(false)}>
                      <div className="max-h-[70vh] w-[min(92vw,640px)] overflow-auto rounded bg-white p-4" onClick={(event) => event.stopPropagation()}>
                        <h3 className="text-lg font-bold">LOG</h3>
                        <ul className="mt-3 space-y-2 text-sm text-slate-700">
                          {logs.length === 0 ? <li>まだログがありません。</li> : logs.map((log, index) => <li key={`${index}-${log.slice(0, 12)}`}>{log}</li>)}
                        </ul>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
