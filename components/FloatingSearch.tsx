'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type SearchEntry = {
  label: string
  path: string
  keywords?: string[]
}

const SEARCH_SHORTCUT_STORAGE_KEY = 'app:searchShortcut'

const detectIsMacPlatform = () => {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
}

const normalizeKeyLabel = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed === ' ') return 'space'
  return trimmed.toLowerCase()
}

const parseShortcut = (value: string) => {
  const parts = value
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  const modifiers = new Set<string>()
  let key = ''
  parts.forEach((part) => {
    const lower = part.toLowerCase()
    if (lower === 'ctrl' || lower === 'control') {
      modifiers.add('ctrl')
    } else if (lower === 'cmd' || lower === 'meta' || lower === 'command') {
      modifiers.add('meta')
    } else if (lower === 'alt' || lower === 'option') {
      modifiers.add('alt')
    } else if (lower === 'shift') {
      modifiers.add('shift')
    } else {
      key = part
    }
  })
  return { modifiers, key }
}

const matchesShortcut = (event: KeyboardEvent, shortcut: string) => {
  const parsed = parseShortcut(shortcut)
  const key = normalizeKeyLabel(parsed.key)
  if (!key) return false
  if (parsed.modifiers.has('ctrl') !== event.ctrlKey) return false
  if (parsed.modifiers.has('meta') !== event.metaKey) return false
  if (parsed.modifiers.has('alt') !== event.altKey) return false
  if (parsed.modifiers.has('shift') !== event.shiftKey) return false
  return normalizeKeyLabel(event.key) === key
}

const SEARCH_PAGES: SearchEntry[] = [
  { label: 'ホーム', path: '/', keywords: ['home', 'top'] },
  { label: '設定', path: '/mypage', keywords: ['settings', 'user'] },
  { label: 'TLメーカー', path: '/tl/maker', keywords: ['tl', 'maker'] },
  { label: 'TLメーカー(dev)', path: '/tl/maker-dev', keywords: ['tl', 'maker', 'dev'] },
  { label: 'TL検索', path: '/tl/search', keywords: ['tl', 'search'] },
  { label: 'TL取得', path: '/tl/update', keywords: ['tl', 'update'] },
  { label: 'TLダメージ計算', path: '/tl/damage', keywords: ['tl', 'damage'] },
  { label: '部隊', path: '/squads', keywords: ['squad', 'party'] },
  { label: '生徒一覧', path: '/students', keywords: ['students'] },
  { label: 'イベントスケジュール', path: '/tools/event-schedule', keywords: ['event', 'schedule'] },
  { label: '育成プランニング', path: '/tools/training-planning', keywords: ['training', 'planning'] },
  { label: '神名文字計算', path: '/tools/divine-calc', keywords: ['divine'] },
  { label: '絆計算', path: '/tools/bond-calc', keywords: ['bond'] },
  { label: 'レベル計算', path: '/tools/level-calc', keywords: ['level', 'exp'] },
  { label: 'BGMプレイヤー', path: '/tools/bgm-player', keywords: ['bgm', 'music', 'player'] },
  { label: 'BGM DJ', path: '/tools/bgm-dj', keywords: ['bgm', 'dj', 'music'] },
  { label: 'デコレーション', path: '/decorations', keywords: ['decoration'] },
  { label: 'ヘルプ(ローカル)', path: '/help/editor', keywords: ['help'] },
]

export default function FloatingSearch() {
  const router = useRouter()
  const isMacPlatform = useMemo(() => detectIsMacPlatform(), [])
  const defaultShortcut = isMacPlatform ? 'Cmd+K' : 'Ctrl+K'
  const [searchShortcut, setSearchShortcut] = useState(defaultShortcut)
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const closeTimeout = useRef<number | null>(null)

  const shortcutLabel = searchShortcut || defaultShortcut

  useEffect(() => {
    const loadShortcut = () => {
      try {
        const raw = localStorage.getItem(SEARCH_SHORTCUT_STORAGE_KEY)
        if (raw && raw.trim()) {
          setSearchShortcut(raw)
          return
        }
      } catch {
        /* ignore */
      }
      setSearchShortcut(defaultShortcut)
    }
    loadShortcut()
    const onStorage = (event: StorageEvent) => {
      if (event.key === SEARCH_SHORTCUT_STORAGE_KEY) {
        loadShortcut()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [defaultShortcut])

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return SEARCH_PAGES
    return SEARCH_PAGES.filter((entry) => {
      const text = `${entry.label} ${entry.path} ${(entry.keywords ?? []).join(' ')}`.toLowerCase()
      return text.includes(trimmed)
    })
  }, [query])

  const visibleEntries = filtered.slice(0, 8)

  useEffect(() => {
    if (!open) return
    setActiveIndex(0)
    setVisible(false)
    requestAnimationFrame(() => inputRef.current?.focus())
    const id = window.setTimeout(() => setVisible(true), 20)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    const closeSearch = () => {
      setVisible(false)
      if (closeTimeout.current) {
        window.clearTimeout(closeTimeout.current)
      }
      closeTimeout.current = window.setTimeout(() => {
        setOpen(false)
        setQuery('')
      }, 160)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if (!open) {
        if (isInput) return
        if (matchesShortcut(event, searchShortcut || defaultShortcut)) {
          event.preventDefault()
          setOpen(true)
        }
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        closeSearch()
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, Math.max(visibleEntries.length - 1, 0)))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const chosen = visibleEntries[activeIndex] ?? visibleEntries[0]
        if (chosen) {
          router.push(chosen.path)
          closeSearch()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, defaultShortcut, open, router, searchShortcut, visibleEntries])

  if (!open) return null

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'
        }`}
      onClick={() => {
        setVisible(false)
        if (closeTimeout.current) {
          window.clearTimeout(closeTimeout.current)
        }
        closeTimeout.current = window.setTimeout(() => {
          setOpen(false)
          setQuery('')
        }, 160)
      }}
    >
      <div
        className={`w-full max-w-xl rounded-2xl border border-white/30 bg-white/70 shadow-2xl backdrop-blur-2xl transition-all duration-200 ease-out dark:border-slate-700/60 dark:bg-slate-900/70 ${visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-95 opacity-0'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/40 px-4 py-3 dark:border-slate-700/60">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`検索（${shortcutLabel}）`}
            className="w-full bg-transparent text-base text-gray-900 placeholder:text-gray-500 outline-none dark:text-gray-100 dark:placeholder:text-gray-400"
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {visibleEntries.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
              一致するページがありません
            </div>
          ) : (
            <ul className="py-2">
              {visibleEntries.map((entry, index) => (
                <li key={`${entry.path}-${entry.label}`}>
                  <button
                    type="button"
                    className={`w-full px-4 py-2 text-left text-sm transition ${
                      index === activeIndex
                        ? 'bg-blue-50/80 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100'
                        : 'hover:bg-white/60 dark:hover:bg-slate-800/70'
                    }`}
                    onClick={() => {
                      router.push(entry.path)
                      setVisible(false)
                      if (closeTimeout.current) {
                        window.clearTimeout(closeTimeout.current)
                      }
                      closeTimeout.current = window.setTimeout(() => {
                        setOpen(false)
                        setQuery('')
                      }, 160)
                    }}
                  >
                    <div className="font-semibold">{entry.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{entry.path}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
