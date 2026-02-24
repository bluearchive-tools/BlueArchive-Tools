// app/page.tsx
'use client'

import CollapsibleBox from '../components/CollapsibleBox'
import FeatureItem from '../components/FeatureItem'
import Link from 'next/link'
import LoginPopup from '../components/LoginPopup'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

const PICK_RESULT_KEY = 'app:siteTutorialPickResult'

type PickCandidate = {
  selector: string
  label: string
}

const buildSelector = (el: HTMLElement) => {
  const tutorial = el.getAttribute('data-tutorial')
  if (tutorial) return `[data-tutorial="${tutorial}"]`
  if (el.id) return `#${el.id}`
  const classNames = Array.from(el.classList).slice(0, 2)
  if (classNames.length > 0) return `${el.tagName.toLowerCase()}.${classNames.join('.')}`
  return el.tagName.toLowerCase()
}

const buildLabel = (el: HTMLElement) => {
  const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ')
  if (text) return text.slice(0, 40)
  return '<no-text>'
}

export default function Home() {
  const t = useTranslations('home.sections')
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

    let outlined: HTMLElement | null = null
    const previousOutline = new WeakMap<HTMLElement, string>()

    const clearOutline = () => {
      if (!outlined) return
      outlined.style.outline = previousOutline.get(outlined) ?? ''
      outlined = null
    }

    const updateCandidates = (x: number, y: number) => {
      const elements = document
        .elementsFromPoint(x, y)
        .filter((node): node is HTMLElement => node instanceof HTMLElement)
        .filter((el) => !el.closest('[data-picker-overlay="1"]'))

      const dedup = new Set<string>()
      const next: PickCandidate[] = []
      for (const el of elements) {
        const selector = buildSelector(el)
        if (dedup.has(selector)) continue
        dedup.add(selector)
        next.push({ selector, label: `${el.tagName.toLowerCase()} | ${buildLabel(el)}` })
      }
      setCandidates(next)
      setSelectedIndex(0)
    }

    const onMove = (e: MouseEvent) => {
      updateCandidates(e.clientX, e.clientY)
    }

    document.addEventListener('mousemove', onMove)

    return () => {
      document.removeEventListener('mousemove', onMove)
      clearOutline()
    }
  }, [])

  useEffect(() => {
    if (!pickMode) return
    const current = candidates[selectedIndex]
    if (!current) return

    const el = document.querySelector(current.selector) as HTMLElement | null
    if (!el) return
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

  return (
    <>
      {pickMode && (
        <button data-picker-overlay="1" type="button" onClick={() => setPickPanelOpen((v) => !v)} className="fixed right-3 top-3 z-[200] rounded bg-green-600 px-3 py-2 text-xs font-semibold text-white shadow-lg">
          {pickPanelOpen ? '候補パネルを閉じる' : '候補パネルを開く'}
        </button>
      )}

      {pickMode && pickPanelOpen && (
        <div data-picker-overlay="1" className="fixed right-3 top-14 z-[200] w-[28rem] max-h-[70vh] overflow-auto rounded border bg-white p-3 shadow-lg">
          <p className="text-sm font-bold">GUI選択モード</p>
          <p className="text-xs text-gray-600">マウス位置の配下要素を一覧表示します。選びたい要素を選択して「この要素を使う」を押してください。</p>
          <button type="button" onClick={() => setPickPanelOpen(false)} className="mt-2 rounded border px-2 py-1 text-xs">閉じる</button>
          <div className="mt-2 space-y-1">
            {candidates.map((item, index) => (
              <button
                key={`${item.selector}-${index}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={`block w-full rounded border px-2 py-1 text-left text-xs ${selectedIndex === index ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
              >
                <div className="font-mono text-[11px] break-all">{item.selector}</div>
                <div className="text-gray-600">{item.label}</div>
              </button>
            ))}
          </div>
          <button type="button" onClick={confirmPick} disabled={!candidates[selectedIndex]} className="mt-3 w-full rounded bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            この要素を使う
          </button>
        </div>
      )}

      <main data-tutorial="home-main" className="p-4 space-y-4 pb-16">
        <LoginPopup />
        <CollapsibleBox title={t('students.title')} description={t('students.description')}>
          <div data-tutorial="home-links" className="space-y-2">
            <Link href="/students">
              <FeatureItem title={t('students.actions.view.title')} description={t('students.actions.view.description')} />
            </Link>
            <Link href="/students/import">
              <FeatureItem title={t('students.actions.import.title')} description={t('students.actions.import.description')} />
            </Link>
            <Link href="/squads">
              <FeatureItem title={t('students.actions.squads.title')} description={t('students.actions.squads.description')} />
            </Link>
          </div>
        </CollapsibleBox>

        <CollapsibleBox title={t('tlTools.title')} description={t('tlTools.description')}>
          <div className="space-y-2">
            <Link href="/tl/search"><FeatureItem title={t('tlTools.actions.search.title')} description={t('tlTools.actions.search.description')} /></Link>
            <Link href="/tl/search-beta"><FeatureItem title="TL検索β" description="β版の総力戦/大決戦検索UIです" /></Link>
            <Link href="/tl/maker"><FeatureItem title={t('tlTools.actions.maker.title')} description={t('tlTools.actions.maker.description')} /></Link>
            <Link href="/tl/maker-dev"><FeatureItem title={t('tlTools.actions.makerDev.title')} description={t('tlTools.actions.makerDev.description')} /></Link>
          </div>
          <div aria-disabled="true" className="opacity-50 grayscale cursor-not-allowed select-none"><div className="pointer-events-none"><FeatureItem title={t('tlTools.actions.videoToTl.title')} description={t('tlTools.actions.videoToTl.description')} /></div></div>
        </CollapsibleBox>

        <CollapsibleBox title={t('tools.title')} description={t('tools.description')}>
          <div data-tutorial="tools-links" className="space-y-2">
            <Link href="/tools/training-planning"><FeatureItem title={t('tools.actions.trainingPlanning.title')} description={t('tools.actions.trainingPlanning.description')} /></Link>
            <Link href="/tools/event-schedule"><FeatureItem title={t('tools.actions.eventSchedule.title')} description={t('tools.actions.eventSchedule.description')} /></Link>
            <Link href="/tools/bgm-player"><FeatureItem title={t('tools.actions.bgmPlayer.title')} description={t('tools.actions.bgmPlayer.description')} /></Link>
            <Link href="/tools/bgm-dj"><FeatureItem title={t('tools.actions.bgmDj.title')} description={t('tools.actions.bgmDj.description')} /></Link>
          </div>
        </CollapsibleBox>

        <CollapsibleBox title={t('minigames.title')} description={t('minigames.description')}>
          <div className="space-y-2">
            <Link href="/minigames/bgm-quiz"><FeatureItem title={t('minigames.actions.bgmQuiz.title')} description={t('minigames.actions.bgmQuiz.description')} /></Link>
          </div>
        </CollapsibleBox>
      </main>
    </>
  )
}
