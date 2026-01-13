'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type SearchEntry = {
  label: string
  path: string
  keywords?: string[]
}

const detectIsMacPlatform = () => {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
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
  { label: '神名文字計算', path: '/tools/divine-calc', keywords: ['divine'] },
  { label: '絆計算', path: '/tools/bond-calc', keywords: ['bond'] },
  { label: 'デコレーション', path: '/decorations', keywords: ['decoration'] },
  { label: 'ヘルプ(ローカル)', path: '/help/editor', keywords: ['help'] },
]

export default function FloatingSearch() {
  const router = useRouter()
  const isMacPlatform = useMemo(() => detectIsMacPlatform(), [])
  const shortcutLabel = isMacPlatform ? 'Cmd+K' : 'Ctrl+K'
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return SEARCH_PAGES
    return SEARCH_PAGES.filter((entry) => {
      const text = `${entry.label} ${entry.path} ${(entry.keywords ?? []).join(' ')}`.toLowerCase()
      return text.includes(trimmed)
    })
  }, [query])

  const visible = filtered.slice(0, 8)

  useEffect(() => {
    if (!open) return
    setActiveIndex(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if (!open) {
        if (isInput) return
        const isShortcut =
          event.key.toLowerCase() === 'k' && (isMacPlatform ? event.metaKey : event.ctrlKey)
        if (isShortcut) {
          event.preventDefault()
          setOpen(true)
        }
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        setQuery('')
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, Math.max(visible.length - 1, 0)))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const chosen = visible[activeIndex] ?? visible[0]
        if (chosen) {
          router.push(chosen.path)
          setOpen(false)
          setQuery('')
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, isMacPlatform, open, router, visible])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4"
      onClick={() => {
        setOpen(false)
        setQuery('')
      }}
    >
      <div
        className="w-full max-w-xl rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`検索（${shortcutLabel}）`}
            className="w-full bg-transparent text-base outline-none"
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500">一致するページがありません</div>
          ) : (
            <ul className="py-2">
              {visible.map((entry, index) => (
                <li key={`${entry.path}-${entry.label}`}>
                  <button
                    type="button"
                    className={`w-full px-4 py-2 text-left text-sm transition ${
                      index === activeIndex
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => {
                      router.push(entry.path)
                      setOpen(false)
                      setQuery('')
                    }}
                  >
                    <div className="font-semibold">{entry.label}</div>
                    <div className="text-xs text-gray-500">{entry.path}</div>
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
