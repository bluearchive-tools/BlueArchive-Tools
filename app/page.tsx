'use client'

import Link from 'next/link'
import LoginPopup from '../components/LoginPopup'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBook,
  faClipboardList,
  faGamepad,
  faGear,
  faHammer,
  faHouse,
  faUsers,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'

const PICK_RESULT_KEY = 'app:siteTutorialPickResult'

type PickCandidate = {
  selector: string
  label: string
  element: HTMLElement
}

type HomeCard = {
  href: string
  icon: IconDefinition
  title: string
  description: string
}

const escapeCssIdentifier = (value: string) => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}

const buildStrictPathSelector = (el: HTMLElement) => {
  const segments: string[] = []
  let node: HTMLElement | null = el
  while (node) {
    const current: HTMLElement = node
    if (current.tagName.toLowerCase() === 'html') break
    if (current.id) {
      segments.unshift(`#${escapeCssIdentifier(current.id)}`)
      break
    }

    const tag = current.tagName.toLowerCase()
    const parent: HTMLElement | null = current.parentElement
    if (!parent) {
      segments.unshift(tag)
      break
    }

    const sameTagSiblings = Array.from(parent.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.tagName === current.tagName
    )
    const nth = sameTagSiblings.indexOf(current) + 1
    segments.unshift(`${tag}:nth-of-type(${nth})`)
    node = parent
  }

  return segments.join(' > ')
}

const buildSelector = (el: HTMLElement) => {
  const tutorial = el.getAttribute('data-tutorial')
  if (tutorial) return `[data-tutorial="${tutorial}"]`
  return buildStrictPathSelector(el)
}

const buildLabel = (el: HTMLElement) => {
  const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ')
  return text ? text.slice(0, 40) : '<no-text>'
}

export default function Home() {
  const t = useTranslations('home.topPage')
  const [pickMode, setPickMode] = useState(false)
  const [pickPanelOpen, setPickPanelOpen] = useState(false)
  const [candidates, setCandidates] = useState<PickCandidate[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const enabled = params.get('tutorial') === 'pick'
    setPickMode(enabled)
    setPickPanelOpen(false)
    if (!enabled) return

    const onMove = (e: MouseEvent) => {
      const elements = document
        .elementsFromPoint(e.clientX, e.clientY)
        .filter((node): node is HTMLElement => node instanceof HTMLElement)
        .filter((el) => !el.closest('[data-picker-overlay="1"]'))

      const dedup = new Set<HTMLElement>()
      const next: PickCandidate[] = []
      for (const el of elements) {
        if (dedup.has(el)) continue
        dedup.add(el)
        next.push({
          selector: buildSelector(el),
          label: `${el.tagName.toLowerCase()} | ${buildLabel(el)}`,
          element: el,
        })
      }
      setCandidates(next)
      setSelectedIndex(0)
    }

    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  useEffect(() => {
    if (!pickMode) return

    const isPickerOverlayTarget = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('[data-picker-overlay="1"]'))

    const isBlockedInteractiveTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false
      if (isPickerOverlayTarget(target)) return false
      return Boolean(target.closest('a[href]'))
    }

    const blockPickModeInteraction = (event: MouseEvent) => {
      if (!isBlockedInteractiveTarget(event.target)) return
      event.preventDefault()
      event.stopPropagation()
    }

    const blockPickModeKeyboardInteraction = (event: KeyboardEvent) => {
      if (!(event.key === 'Enter' || event.key === ' ')) return
      if (!isBlockedInteractiveTarget(event.target)) return
      event.preventDefault()
      event.stopPropagation()
    }

    document.addEventListener('click', blockPickModeInteraction, true)
    document.addEventListener('keydown', blockPickModeKeyboardInteraction, true)
    return () => {
      document.removeEventListener('click', blockPickModeInteraction, true)
      document.removeEventListener('keydown', blockPickModeKeyboardInteraction, true)
    }
  }, [pickMode])

  useEffect(() => {
    if (!pickMode) return
    const current = candidates[selectedIndex]
    if (!current?.element) return

    const el = current.element
    const old = el.style.outline
    el.style.outline = '2px solid #22c55e'
    return () => {
      el.style.outline = old
    }
  }, [pickMode, candidates, selectedIndex])

  const confirmPick = () => {
    const picked = candidates[selectedIndex]
    if (!picked) return
    const selector = picked.selector
    try {
      localStorage.setItem(PICK_RESULT_KEY, JSON.stringify({ selector, pickedAt: Date.now() }))
    } catch {
      /* ignore */
    }
    window.opener?.postMessage({ type: 'tutorial-selector-picked', selector }, window.location.origin)
    alert(`選択したセレクタ: ${selector}\n編集画面に戻ると自動で反映されます。`)
    try {
      window.close()
    } catch {
      /* ignore */
    }
  }

  const menuItems = useMemo(
    () => [
      { key: 'dashboard', icon: faHouse, href: '/' },
      { key: 'students', icon: faUsers, href: '/students' },
      { key: 'tl', icon: faClipboardList, href: '/tl/search' },
      { key: 'tools', icon: faHammer, href: '/tools/event-schedule' },
      { key: 'minigame', icon: faGamepad, href: '/minigames/bgm-quiz' },
      { key: 'settings', icon: faGear, href: '/quick-setup' },
    ],
    []
  )

  const featureCards = useMemo<HomeCard[]>(
    () => [
      {
        href: '/students',
        icon: faUsers,
        title: t('cards.students.title'),
        description: t('cards.students.description'),
      },
      {
        href: '/tl/search',
        icon: faClipboardList,
        title: t('cards.tl.title'),
        description: t('cards.tl.description'),
      },
      {
        href: '/tools/event-schedule',
        icon: faBook,
        title: t('cards.tools.title'),
        description: t('cards.tools.description'),
      },
      {
        href: '/minigames/bgm-quiz',
        icon: faGamepad,
        title: t('cards.minigame.title'),
        description: t('cards.minigame.description'),
      },
    ],
    [t]
  )

  return (
    <>
      {pickMode && (
        <button
          data-picker-overlay="1"
          type="button"
          onClick={() => setPickPanelOpen((v) => !v)}
          className="fixed bottom-3 right-3 z-[200] rounded bg-green-600 px-3 py-2 text-xs font-semibold text-white shadow-lg"
        >
          {pickPanelOpen ? '候補パネルを閉じる' : '候補パネルを開く'}
        </button>
      )}

      {pickMode && pickPanelOpen && (
        <div data-picker-overlay="1" className="fixed bottom-14 right-3 z-[200] max-h-[70vh] w-[28rem] overflow-auto rounded border bg-white p-3 shadow-lg">
          <p className="text-sm font-bold">GUI選択モード</p>
          <p className="text-xs text-gray-600">マウス位置の配下要素を一覧表示します。選びたい要素を選択して「この要素を使う」を押してください。</p>
          <button type="button" onClick={() => setPickPanelOpen(false)} className="mt-2 rounded border px-2 py-1 text-xs">
            閉じる
          </button>
          <div className="mt-2 space-y-1">
            {candidates.map((item, index) => (
              <button
                key={`${item.selector}-${index}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={`block w-full rounded border px-2 py-1 text-left text-xs ${selectedIndex === index ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
              >
                <div className="font-mono break-all text-[11px]">{item.selector}</div>
                <div className="text-gray-600">{item.label}</div>
              </button>
            ))}
          </div>
          <button type="button" onClick={confirmPick} disabled={!candidates[selectedIndex]} className="mt-3 w-full rounded bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            この要素を使う
          </button>
        </div>
      )}

      <main className="mx-auto max-w-6xl p-4 pb-12" data-tutorial="top-home-main">
        <LoginPopup />
        <div className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-[#081b4f] via-[#0d2c77] to-[#142b57] text-white shadow-xl">
          <div className="grid gap-4 p-4 md:grid-cols-[240px_minmax(0,1fr)] md:p-6">
            <aside className="rounded-xl bg-black/20 p-3 backdrop-blur-sm">
              <p className="mb-3 text-sm font-semibold text-blue-100">{t('menuTitle')}</p>
              <nav className="space-y-2">
                {menuItems.map((item) => (
                  <Link key={item.key} href={item.href} className="flex items-center gap-2 rounded-lg border border-transparent bg-white/10 px-3 py-2 text-sm text-blue-50 transition hover:border-blue-300 hover:bg-white/20">
                    <FontAwesomeIcon icon={item.icon} className="h-4 w-4" />
                    <span>{t(`menu.${item.key}`)}</span>
                  </Link>
                ))}
              </nav>
            </aside>

            <section className="space-y-4">
              <div className="rounded-xl bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-2xl font-bold md:text-4xl">{t('hero.title')}</p>
                <p className="mt-2 text-sm text-blue-100 md:text-base">{t('hero.subtitle')}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {featureCards.map((card) => (
                  <Link key={card.href} href={card.href} className="rounded-xl border border-blue-200/30 bg-white/15 p-4 transition hover:-translate-y-0.5 hover:bg-white/25">
                    <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/40">
                      <FontAwesomeIcon icon={card.icon} className="h-4 w-4" />
                    </div>
                    <p className="text-lg font-semibold">{card.title}</p>
                    <p className="mt-1 text-sm text-blue-100">{card.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
