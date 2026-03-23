'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { getDefaultTutorialSteps, parseTutorialSteps, type TutorialStep } from '../lib/site-tutorial'
import type { Locale } from '../lib/i18n/config'

const PROMPT_KEY = 'app:siteTutorialPrompted'
const COMPLETED_KEY = 'app:siteTutorialCompleted'
const CUSTOM_TUTORIAL_KEY = 'app:siteTutorialCustom'
const PREVIEW_RETURN_KEY = 'app:siteTutorialPreviewReturnTo'

type HighlightRect = {
  top: number
  left: number
  width: number
  height: number
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
  const locale = (useLocale() as Locale) || 'ja'
  const defaultSteps = useMemo(() => getDefaultTutorialSteps(locale), [locale])
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
      const parsed = JSON.parse(custom) as Record<string, string | { text?: string; selector?: string; title?: string }>
      const customSteps = parseTutorialSteps(parsed)
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
      attributes: true,
      childList: true,
      subtree: true,
    })

    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)

    return () => {
      window.clearTimeout(delayedRectTimer)
      window.clearInterval(retryTimer)
      mutationObserver.disconnect()
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
      collapseExpanded()
    }
  }, [stepIndex, steps, tutorialOpen])

  useEffect(() => {
    if (!tutorialOpen || !steps.length) return
    if (stepIndex >= steps.length) {
      setStepIndex(steps.length - 1)
    }
  }, [stepIndex, steps.length, tutorialOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!previewMode || !tutorialOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const returnTo = localStorage.getItem(PREVIEW_RETURN_KEY) || '/tutorial/editor'
        window.location.href = returnTo
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewMode, tutorialOpen])

  const closePrompt = (accepted: boolean) => {
    setPromptOpen(false)
    try {
      localStorage.setItem(PROMPT_KEY, '1')
    } catch {
      /* ignore */
    }
    if (accepted) {
      setTutorialOpen(true)
      setStepIndex(0)
    }
  }

  const closeTutorial = () => {
    setTutorialOpen(false)
    setPromptOpen(false)
    setStepIndex(0)
    try {
      localStorage.setItem(COMPLETED_KEY, '1')
      if (previewMode) {
        const returnTo = localStorage.getItem(PREVIEW_RETURN_KEY) || '/tutorial/editor'
        localStorage.removeItem(PREVIEW_RETURN_KEY)
        window.location.href = returnTo
      }
    } catch {
      /* ignore */
    }
  }

  const goPrev = () => setStepIndex((prev) => Math.max(0, prev - 1))
  const goNext = () => {
    setStepIndex((prev) => {
      if (prev >= steps.length - 1) {
        closeTutorial()
        return prev
      }
      return prev + 1
    })
  }

  if (!promptOpen && !tutorialOpen) return null

  const current = steps[Math.max(0, Math.min(stepIndex, steps.length - 1))]
  const stepLabel = t('tutorial.stepLabel', { current: stepIndex + 1, total: steps.length })

  return (
    <>
      {highlightRect && tutorialOpen && (
        <div
          className="pointer-events-none fixed z-[190] rounded-xl ring-4 ring-sky-400/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.55)] transition-all duration-200"
          style={{
            top: Math.max(highlightRect.top - 8, 0),
            left: Math.max(highlightRect.left - 8, 0),
            width: Math.min(highlightRect.width + 16, viewport.width),
            height: Math.min(highlightRect.height + 16, viewport.height),
          }}
        />
      )}

      {promptOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:text-white">
            <h2 className="text-xl font-bold">{t('prompt.title')}</h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{t('prompt.body')}</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => closePrompt(false)} className="rounded-lg border px-4 py-2 text-sm">
                {t('prompt.no')}
              </button>
              <button type="button" onClick={() => closePrompt(true)} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white">
                {t('prompt.yes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {tutorialOpen && current && (
        <div className="fixed inset-x-0 bottom-4 z-[210] flex justify-center px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white/95 p-4 shadow-2xl ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/95 dark:text-white dark:ring-slate-700">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">{stepLabel}</p>
                <h3 className="mt-1 text-lg font-bold">{current.title || t('tutorial.title')}</h3>
              </div>
              <button type="button" onClick={closeTutorial} className="rounded-lg border px-3 py-1.5 text-sm">
                {t('tutorial.skip')}
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{current.text}</p>

            <div className="mt-4 flex items-center justify-between">
              <button type="button" onClick={goPrev} disabled={stepIndex === 0} className="rounded-lg border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40">
                {t('tutorial.back')}
              </button>
              <button type="button" onClick={goNext} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white">
                {stepIndex >= steps.length - 1 ? t('tutorial.finish') : t('tutorial.next')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
