'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import tutorialSteps from '../data/site-tutorial-steps.json'

const PROMPT_KEY = 'app:siteTutorialPrompted'
const COMPLETED_KEY = 'app:siteTutorialCompleted'
const CUSTOM_TUTORIAL_KEY = 'app:siteTutorialCustom'
const PREVIEW_RETURN_KEY = 'app:siteTutorialPreviewReturnTo'

type TutorialStep = {
  text: string
  selector?: string
  title?: string
}

type HighlightRect = {
  top: number
  left: number
  width: number
  height: number
}


type LocaleKey = 'ja' | 'en'

const getDefaultStepsFromJson = (locale: LocaleKey): TutorialStep[] => {
  const root = tutorialSteps as Record<LocaleKey, Record<string, unknown>>
  return parseSteps(root[locale] ?? root.ja)
}

const compareStepKeys = (a: string, b: string) => {
  const partA = a.match(/^(.*?)(\d+)$/)
  const partB = b.match(/^(.*?)(\d+)$/)
  if (partA && partB && partA[1] === partB[1]) {
    const numDiff = Number(partA[2]) - Number(partB[2])
    if (numDiff !== 0) return numDiff
  }
  return a.localeCompare(b)
}

const parseSteps = (value: unknown): TutorialStep[] => {
  if (!value || typeof value !== 'object') return []
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => compareStepKeys(a, b))
  return entries
    .map(([, item]) => {
      if (typeof item === 'string') return { text: item }
      if (!item || typeof item !== 'object') return null
      const data = item as Record<string, unknown>
      if (typeof data.text !== 'string' || !data.text.trim()) return null
      return {
        text: data.text,
        selector: typeof data.selector === 'string' && data.selector.trim() ? data.selector : undefined,
        title: typeof data.title === 'string' && data.title.trim() ? data.title : undefined,
      }
    })
    .filter((step): step is TutorialStep => !!step)
}


const isElementVisible = (element: HTMLElement) => {
  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

const safeQuerySelector = (selector: string): HTMLElement | null => {
  try {
    const found = Array.from(document.querySelectorAll(selector)).find(
      (node): node is HTMLElement => node instanceof HTMLElement && isElementVisible(node)
    )
    return found ?? null
  } catch {
    return null
  }
}

const needsMobileToolsExpansion = (selector: string) =>
  selector.includes('[data-tutorial="header-notices"]') || selector.includes('[data-tutorial="header-settings"]')

export default function SiteTutorial() {
  const t = useTranslations('site-tutorial')
  const locale = (useLocale() as LocaleKey) || 'ja'
  const defaultSteps = useMemo(() => getDefaultStepsFromJson(locale), [locale])
  const [steps, setSteps] = useState<TutorialStep[]>(defaultSteps)
  const [promptOpen, setPromptOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null)
  const [viewport, setViewport] = useState({ width: 1280, height: 800 })
  const [previewMode, setPreviewMode] = useState(false)
  const expandedButtonsRef = useRef<HTMLButtonElement[]>([])
  const mobileToolsExpandedByTutorialRef = useRef(false)

  const collapseExpanded = () => {
    const buttons = expandedButtonsRef.current.splice(0)
    for (const button of buttons.reverse()) {
      if (!document.contains(button)) continue
      button.click()
    }
    if (mobileToolsExpandedByTutorialRef.current) {
      window.dispatchEvent(new Event('site-tutorial-close-mobile-tools'))
      mobileToolsExpandedByTutorialRef.current = false
    }
  }

  const expandAncestorsIfHidden = (target: HTMLElement) => {
    const expanded: HTMLButtonElement[] = []
    let node: HTMLElement | null = target
    while (node) {
      const isCollapsed = node.classList.contains('max-h-0')
      if (isCollapsed) {
        const toggle = node.previousElementSibling
        if (toggle instanceof HTMLButtonElement) {
          toggle.click()
          expanded.push(toggle)
        }
      }
      node = node.parentElement
    }
    return expanded
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const custom = localStorage.getItem(CUSTOM_TUTORIAL_KEY)
      if (!custom) {
        setSteps(defaultSteps)
        return
      }
      const parsed: unknown = JSON.parse(custom)
      const customSteps = parseSteps(parsed)
      setSteps(customSteps.length ? customSteps : defaultSteps)
    } catch {
      setSteps(defaultSteps)
    }
  }, [defaultSteps])


  useEffect(() => {
    const onShortcut = () => {
      setPromptOpen(false)
      setTutorialOpen(true)
      setStepIndex(0)
      try {
        localStorage.setItem(PROMPT_KEY, '1')
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('site-tutorial-shortcut', onShortcut)
    return () => window.removeEventListener('site-tutorial-shortcut', onShortcut)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const isPreview = params.get('tutorial') === 'preview'
    if (isPreview) {
      setPreviewMode(true)
      setPromptOpen(false)
      setTutorialOpen(true)
      setStepIndex(0)
      return
    }

    try {
      const prompted = localStorage.getItem(PROMPT_KEY) === '1'
      const completed = localStorage.getItem(COMPLETED_KEY) === '1'
      if (!prompted && !completed) {
        setPromptOpen(true)
      }
    } catch {
      setPromptOpen(true)
    }
  }, [])

  useEffect(() => {
    if (!tutorialOpen) {
      setHighlightRect(null)
      collapseExpanded()
      return
    }

    const current = steps[stepIndex]
    if (!current?.selector) {
      setHighlightRect(null)
      return
    }

    collapseExpanded()

    const selector = current.selector
    if (window.innerWidth < 768 && needsMobileToolsExpansion(selector)) {
      window.dispatchEvent(new Event('site-tutorial-open-mobile-tools'))
      mobileToolsExpandedByTutorialRef.current = true
    }

    const initialElement = safeQuerySelector(selector)
    if (initialElement) {
      expandedButtonsRef.current = expandAncestorsIfHidden(initialElement)
    }

    const updateRect = () => {
      const element = safeQuerySelector(selector)
      if (!element) {
        setHighlightRect(null)
        return
      }
      const rect = element.getBoundingClientRect()
      setHighlightRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
    }

    updateRect()

    const delayedRectTimer = window.setTimeout(updateRect, 320)
    const retryEnd = Date.now() + 5000
    const retryTimer = window.setInterval(() => {
      if (Date.now() > retryEnd) {
        window.clearInterval(retryTimer)
        return
      }
      updateRect()
    }, 250)

    const mutationObserver = new MutationObserver(() => {
      window.requestAnimationFrame(updateRect)
    })
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
    })

    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)

    return () => {
      mutationObserver.disconnect()
      window.clearTimeout(delayedRectTimer)
      window.clearInterval(retryTimer)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
      collapseExpanded()
    }
  }, [tutorialOpen, stepIndex, steps])

  const closePrompt = (value: boolean) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(PROMPT_KEY, '1')
      } catch {
        /* ignore */
      }
    }
    setPromptOpen(false)
    if (value) {
      setTutorialOpen(true)
      setStepIndex(0)
    }
  }

  const finishTutorial = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(COMPLETED_KEY, '1')
      } catch {
        /* ignore */
      }
    }
    setTutorialOpen(false)
    collapseExpanded()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('site-tutorial-finished'))
    }

    if (typeof window !== 'undefined' && previewMode) {
      const returnTo = localStorage.getItem(PREVIEW_RETURN_KEY)
      if (returnTo) {
        localStorage.removeItem(PREVIEW_RETURN_KEY)
        window.location.href = returnTo
      }
    }
  }

  const nextStep = () => {
    if (stepIndex >= steps.length - 1) {
      finishTutorial()
      return
    }
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))
  }

  const prevStep = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0))
  }

  if ((!promptOpen && !tutorialOpen) || steps.length === 0) return null

  const current = steps[stepIndex]

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 p-4">
      {promptOpen && (
        <div className="mx-auto mt-24 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
          <h2 className="text-lg font-semibold">{t('prompt.title')}</h2>
          <p className="mt-2 text-sm text-gray-600">{t('prompt.body')}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => closePrompt(false)} className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">{t('prompt.no')}</button>
            <button type="button" onClick={() => closePrompt(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{t('prompt.yes')}</button>
          </div>
        </div>
      )}

      {tutorialOpen && (
        <>
          {highlightRect && (
            <div
              className="fixed z-[81] rounded-lg border-2 border-blue-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none"
              style={{ top: highlightRect.top - 6, left: highlightRect.left - 6, width: highlightRect.width + 12, height: highlightRect.height + 12 }}
            />
          )}
          <div
            className="fixed z-[82] w-full max-w-xl rounded-lg bg-white p-6 shadow-lg"
            style={{
              top: highlightRect ? Math.min(highlightRect.top + highlightRect.height + 18, viewport.height - 280) : undefined,
              left: highlightRect ? Math.max(16, Math.min(highlightRect.left, viewport.width - 560)) : undefined,
              right: highlightRect ? undefined : 16,
              margin: highlightRect ? undefined : '0 auto',
              insetInline: highlightRect ? undefined : 0,
              marginTop: highlightRect ? undefined : '6rem',
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{current.title ?? t('tutorial.title')}</h2>
              <button type="button" onClick={finishTutorial} className="text-sm font-semibold text-gray-500 hover:text-gray-700">{t('tutorial.skip')}</button>
            </div>
            <p className="mt-3 text-sm text-gray-600">{t('tutorial.stepLabel', { current: stepIndex + 1, total: steps.length })}</p>
            <p className="mt-4 text-base text-gray-700">{current.text}</p>
            {current.selector && <p className="mt-2 text-xs text-gray-500">target: {current.selector}</p>}
            <div className="mt-6 flex justify-between">
              <button type="button" onClick={prevStep} disabled={stepIndex === 0} className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">{t('tutorial.back')}</button>
              <button type="button" onClick={nextStep} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{stepIndex >= steps.length - 1 ? t('tutorial.finish') : t('tutorial.next')}</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
