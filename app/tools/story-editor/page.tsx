'use client'

import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faExpand, faForward, faGear, faXmark } from '@fortawesome/free-solid-svg-icons'

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
  portraitUrl: string
  wikiTitle: string
  expressions: Array<{ name: string; imageUrl: string }>
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
  expressionName: string
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
  { id: 1, name: '先生', affiliation: 'シャーレ', portraitUrl: '', wikiTitle: '', expressions: [] },
  { id: 2, name: 'アロナ', affiliation: 'シッテムの箱', portraitUrl: '', wikiTitle: 'Arona', expressions: [] },
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
    expressionName: '',
    choices: [
      { id: 11, label: '正面突破', nextElementId: 2, setFlag: 'front', requireFlag: '' },
      { id: 12, label: '迂回ルート', nextElementId: 3, setFlag: 'detour', requireFlag: '' },
    ],
  },
  { id: 2, type: 'line', characterId: 2, body: '正面ルートで進行します。', requireFlag: 'front', effect: 'flash', locationLabel: '', expressionName: '', choices: [] },
  { id: 3, type: 'line', characterId: 2, body: '迂回ルートで静かに進行します。', requireFlag: 'detour', effect: 'shake', locationLabel: '', expressionName: '', choices: [] },
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
  const [newCharacterPortraitUrl, setNewCharacterPortraitUrl] = useState('')
  const [newCharacterWikiTitle, setNewCharacterWikiTitle] = useState('')

  const [lineCharacterId, setLineCharacterId] = useState(DEFAULT_CHARACTERS[0].id)
  const [lineBody, setLineBody] = useState('')
  const [lineRequireFlag, setLineRequireFlag] = useState('')
  const [lineEffect, setLineEffect] = useState<StoryEffect>('none')
  const [lineLocationLabel, setLineLocationLabel] = useState('')
  const [lineExpressionName, setLineExpressionName] = useState('')

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
  const [logs, setLogs] = useState<StoryLog[]>([])
  const [loggedLineId, setLoggedLineId] = useState<number | null>(null)
  const [backgroundOnly, setBackgroundOnly] = useState(false)

  const [titlePhase, setTitlePhase] = useState<TitlePhase>('hidden')
  const [locationPhase, setLocationPhase] = useState<FadePhase>('hidden')
  const [dialogueReady, setDialogueReady] = useState(true)

  const [forceLandscape, setForceLandscape] = useState(false)
  const [currentBackground, setCurrentBackground] = useState<BackgroundConfig>({ color: '#ffffff', imageUrl: '' })
  const [choiceAppear, setChoiceAppear] = useState(false)
  const [editorView, setEditorView] = useState<EditorView>('timeline')
  const [expressionFetchStateByCharacter, setExpressionFetchStateByCharacter] = useState<Record<number, string>>({})

  const flagsSet = useMemo(() => new Set(storyFlags), [storyFlags])
  const playingElement = playIndex >= 0 ? elements[playIndex] ?? null : null
  const playingLine = playingElement?.type === 'line' ? playingElement : null
  const playingCharacter = useMemo(
    () => characters.find((character) => character.id === (playingLine?.characterId ?? -1)) ?? null,
    [characters, playingLine?.characterId],
  )
  const playingExpressionUrl = useMemo(() => {
    if (!playingLine || !playingCharacter) return ''
    const expression = playingCharacter.expressions.find((item) => item.name === playingLine.expressionName)
    return expression?.imageUrl ?? ''
  }, [playingCharacter, playingLine])

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
    setLogs((prev) => [...prev, { lineId: playingLine.id, speaker: characterName, body: playingLine.body, expressionImageUrl: playingExpressionUrl }])
    setLoggedLineId(playingLine.id)
  }, [dialogueReady, isPlaying, isLineFullyVisible, loggedLineId, playingCharacter?.name, playingExpressionUrl, playingLine, titlePhase])

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
    setCharacters((prev) => [...prev, {
      id,
      name: newCharacterName.trim(),
      affiliation: newCharacterAffiliation.trim(),
      portraitUrl: newCharacterPortraitUrl.trim(),
      wikiTitle: newCharacterWikiTitle.trim(),
      expressions: [],
    }])
    setLineCharacterId(id)
    setNewCharacterName('')
    setNewCharacterAffiliation('')
    setNewCharacterPortraitUrl('')
    setNewCharacterWikiTitle('')
  }

  const addLine = () => {
    if (!canAddLine) return
    const id = Date.now()
    setElements((prev) => [...prev, {
      id,
      type: 'line',
      characterId: lineCharacterId,
      body: lineBody.trim(),
      requireFlag: lineRequireFlag.trim(),
      effect: lineEffect,
      locationLabel: lineLocationLabel.trim(),
      expressionName: lineExpressionName,
      choices: [],
    }])
    setLineBody('')
    setLineLocationLabel('')
    setLineExpressionName('')
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

  const updateCharacter = (id: number, patch: Partial<Omit<StoryCharacter, 'id'>>) => {
    setCharacters((prev) => prev.map((character) => (character.id === id ? { ...character, ...patch } : character)))
  }

  const removeCharacter = (id: number) => {
    setCharacters((prev) => prev.filter((character) => character.id !== id))
    setElements((prev) => prev.filter((element) => element.type !== 'line' || element.characterId !== id))
    setLineCharacterId((prev) => {
      if (prev !== id) return prev
      const next = characters.find((character) => character.id !== id)
      return next?.id ?? 0
    })
  }

  const fetchExpressionsFromWiki = async (character: StoryCharacter) => {
    const title = character.wikiTitle.trim()
    if (!title) {
      setExpressionFetchStateByCharacter((prev) => ({ ...prev, [character.id]: 'wikiTitle を入力してください' }))
      return
    }

    setExpressionFetchStateByCharacter((prev) => ({ ...prev, [character.id]: '取得中...' }))

    try {
      const response = await fetch(`https://bluearchive.wiki/wiki/${encodeURIComponent(title)}?output=1&format=json`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json() as { files?: Array<{ name?: string; url?: string }> }
      const rawFiles = Array.isArray(data.files) ? data.files : []
      const expressions = rawFiles
        .filter((file) => typeof file.name === 'string' && typeof file.url === 'string' && file.name.includes('Portrait') && file.name.includes('.webp'))
        .map((file) => ({
          name: file.name!.replace(/\.[^.]+$/, '').replace(/^.*?Portrait_?/, ''),
          imageUrl: file.url!,
        }))
      if (expressions.length === 0) {
        setExpressionFetchStateByCharacter((prev) => ({ ...prev, [character.id]: '表情差分が見つかりませんでした' }))
        return
      }
      updateCharacter(character.id, { expressions })
      setExpressionFetchStateByCharacter((prev) => ({ ...prev, [character.id]: `${expressions.length} 件取得しました` }))
    } catch {
      setExpressionFetchStateByCharacter((prev) => ({ ...prev, [character.id]: '取得に失敗しました' }))
    }
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
    <main className="space-y-4 p-4">
      <h1 className="text-xl font-bold">ストーリーエディタ</h1>

      <section className="md:flex md:items-start md:gap-4">
        <aside className="rounded border bg-white p-3 md:w-60 md:shrink-0">
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

        <div className="min-w-0 flex-1 space-y-3 md:max-w-5xl">
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
                      <select value={lineCharacterId} onChange={(event) => {
                        const nextId = Number(event.target.value)
                        setLineCharacterId(nextId)
                        const character = characters.find((item) => item.id === nextId)
                        setLineExpressionName(character?.expressions[0]?.name ?? '')
                      }} className="rounded border px-3 py-2">
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
                    <div className="grid gap-3 md:grid-cols-4">
                      <input value={lineBody} onChange={(event) => setLineBody(event.target.value)} className="rounded border px-3 py-2 md:col-span-2" placeholder="本文" />
                      <select value={lineExpressionName} onChange={(event) => setLineExpressionName(event.target.value)} className="rounded border px-3 py-2">
                        <option value="">表情: なし</option>
                        {(characters.find((character) => character.id === lineCharacterId)?.expressions ?? []).map((expression) => <option key={expression.name} value={expression.name}>{expression.name}</option>)}
                      </select>
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

              <section className="space-y-3 bg-white p-4">
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
                            <summary className="cursor-pointer text-xs font-semibold">編集・分岐オプション</summary>
                            <div className="mt-2 space-y-2">
                              <div className="grid gap-2 md:grid-cols-2">
                                <select value={element.characterId} onChange={(event) => updateLineElement(element.id, { characterId: Number(event.target.value) })} className="rounded border px-2 py-1 text-xs">
                                  {characters.map((targetCharacter) => <option key={targetCharacter.id} value={targetCharacter.id}>{targetCharacter.name} / {targetCharacter.affiliation}</option>)}
                                </select>
                                <select value={element.expressionName} onChange={(event) => updateLineElement(element.id, { expressionName: event.target.value })} className="rounded border px-2 py-1 text-xs">
                                  <option value="">表情: なし</option>
                                  {(characters.find((item) => item.id === element.characterId)?.expressions ?? []).map((expression) => <option key={expression.name} value={expression.name}>{expression.name}</option>)}
                                </select>
                              </div>
                              <textarea value={element.body} onChange={(event) => updateLineElement(element.id, { body: event.target.value })} className="min-h-20 w-full rounded border px-2 py-1 text-xs" placeholder="本文" />
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
                <input value={newCharacterPortraitUrl} onChange={(event) => setNewCharacterPortraitUrl(event.target.value)} className="rounded border px-3 py-2" placeholder="立ち絵URL" />
                <input value={newCharacterWikiTitle} onChange={(event) => setNewCharacterWikiTitle(event.target.value)} className="rounded border px-3 py-2" placeholder="bluearchive.wiki タイトル" />
              </div>
              <button type="button" onClick={addCharacter} disabled={!canAddCharacter} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">追加</button>

              <ul className="space-y-2 pt-2">
                {characters.map((character) => (
                  <li key={character.id} className="rounded border bg-slate-50 p-3 text-sm">
                    <div className="grid gap-2 md:grid-cols-2">
                      <input value={character.name} onChange={(event) => updateCharacter(character.id, { name: event.target.value })} className="rounded border px-2 py-1" placeholder="キャラクター名" />
                      <input value={character.affiliation} onChange={(event) => updateCharacter(character.id, { affiliation: event.target.value })} className="rounded border px-2 py-1" placeholder="所属" />
                      <input value={character.portraitUrl} onChange={(event) => updateCharacter(character.id, { portraitUrl: event.target.value })} className="rounded border px-2 py-1 md:col-span-2" placeholder="立ち絵URL" />
                      <input value={character.wikiTitle} onChange={(event) => updateCharacter(character.id, { wikiTitle: event.target.value })} className="rounded border px-2 py-1" placeholder="bluearchive.wiki タイトル" />
                      <div className="flex gap-2">
                        <button type="button" className="rounded bg-sky-600 px-3 py-1 text-xs text-white" onClick={() => fetchExpressionsFromWiki(character)}>表情差分を取得</button>
                        <button type="button" className="rounded border border-red-300 px-3 py-1 text-xs text-red-700" onClick={() => removeCharacter(character.id)}>削除</button>
                      </div>
                    </div>
                    {expressionFetchStateByCharacter[character.id] && <p className="mt-2 text-xs text-gray-600">{expressionFetchStateByCharacter[character.id]}</p>}
                    {character.portraitUrl && (
                      <img src={character.portraitUrl} alt={`${character.name} 立ち絵`} className="mt-2 h-24 rounded object-contain" />
                    )}
                    {character.expressions.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                        {character.expressions.map((expression) => (
                          <div key={expression.name} className="rounded border bg-white p-1">
                            <img src={expression.imageUrl} alt={expression.name} className="h-16 w-full rounded object-cover" />
                            <p className="truncate text-[10px]">{expression.name}</p>
                          </div>
                        ))}
                      </div>
                    )}
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
                      {playingCharacter?.portraitUrl && (
                        <img src={playingCharacter.portraitUrl} alt={`${playingCharacter.name}立ち絵`} className="absolute bottom-24 left-4 z-[2] h-[52vh] object-contain" style={{ filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.35))' }} />
                      )}

                      <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-6" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(217,229,239,0.25) 4%, rgba(147,172,191,0.45) 9%, rgba(96,124,148,0.65) 18%, rgba(74,102,127,0.78) 38%, rgba(61,89,114,0.9) 62%, rgba(42,66,91,0.96) 100%)' }}>
                        <div className="flex items-end gap-3" style={{ color: '#ffffff' }}>
                          {playingExpressionUrl && <img src={playingExpressionUrl} alt={playingLine.expressionName || '表情'} className="h-14 w-14 rounded-md object-cover" />}
                          <div className="flex items-baseline gap-3">
                            <p className="text-lg font-bold">{playingCharacter?.name ?? '未設定キャラクター'}</p>
                            <p className="text-sm font-semibold" style={{ color: '#7cd0ff' }}>{playingCharacter?.affiliation ?? '未設定'}</p>
                          </div>
                        </div>
                        <div className="mt-2 border-t border-white/60" />
                        <p className="mt-3 min-h-16 whitespace-pre-wrap text-base" style={{ color: '#ffffff' }}>{dialogueReady ? visibleBody : ''}</p>
                        {isLineFullyVisible && visibleChoices.length === 0 && (
                          <span className="absolute bottom-3 right-4 animate-bounce text-lg" style={{ color: '#7cd0ff' }}>▼</span>
                        )}
                      </div>
                    </>
                  )}

                  {skipConfirmOpen && (
                    <div className="absolute inset-0 z-[6] flex items-center justify-center bg-slate-900/45" onClick={() => setSkipConfirmOpen(false)}>
                      <div className="w-[min(92vw,720px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-between border-b px-5 py-3" style={{ background: 'linear-gradient(120deg,#e7f2ff 0%,#f6fbff 45%,#ffffff 100%)' }}>
                          <div className="text-center">
                            <p className="text-3xl font-bold tracking-wide text-[#2d406f]">あらすじ</p>
                            <div className="mx-auto mt-1 h-1 w-20 rounded bg-yellow-300" />
                          </div>
                          <button type="button" onClick={() => setSkipConfirmOpen(false)} className="text-3xl text-[#1e315f]"><FontAwesomeIcon icon={faXmark} /></button>
                        </div>
                        <div className="p-5">
                          <p className="text-center text-2xl font-bold text-[#2f406d]">{meta.title || 'タイトル未設定'}</p>
                          <div className="mt-4 rounded border bg-slate-100 p-4 text-lg leading-relaxed text-slate-700">{meta.summary || '要約未設定'}</div>
                          <p className="mt-6 text-center text-3xl font-semibold text-[#2f406d]">※この話をスキップしますか？</p>
                          <div className="mt-6 grid grid-cols-2 gap-4">
                            <button type="button" className="rounded-xl bg-[#d9edf9] px-4 py-3 text-3xl font-bold text-[#24406b] shadow" onClick={() => setSkipConfirmOpen(false)}>キャンセル</button>
                            <button
                              type="button"
                              className="rounded-xl bg-cyan-300 px-4 py-3 text-3xl font-bold text-[#24406b] shadow"
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
                    </div>
                  )}

                  {logOpen && (
                    <div className="absolute inset-0 z-[6] flex items-center justify-center bg-slate-900/40" onClick={() => setLogOpen(false)}>
                      <div className="flex h-[80vh] w-[min(95vw,1180px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f2f4f8] shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-center border-b bg-white px-5 py-3 text-[#2d406f]">
                          <p className="text-4xl font-bold">LOG</p>
                          <div className="absolute right-8"><button type="button" className="text-4xl" onClick={() => setLogOpen(false)}><FontAwesomeIcon icon={faXmark} /></button></div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                          {logs.length === 0 ? (
                            <p className="text-sm text-slate-500">まだログがありません。</p>
                          ) : (
                            <ul className="space-y-3">
                              {logs.map((log, index) => (
                                <li key={`${log.lineId}-${index}`} className="flex items-end gap-3">
                                  <div className="h-20 w-20 overflow-hidden rounded-lg border bg-white">
                                    {log.expressionImageUrl ? <img src={log.expressionImageUrl} alt={log.speaker} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-slate-400">No Img</div>}
                                  </div>
                                  <div className="flex-1 rounded-xl bg-white p-3 shadow-sm">
                                    <p className="text-2xl font-bold text-[#2f406d]">{log.speaker}</p>
                                    <p className="mt-1 text-xl text-slate-700">{log.body}</p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
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

