'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

const PROMPT_KEY = 'app:siteTutorialPrompted'
const COMPLETED_KEY = 'app:siteTutorialCompleted'

export default function SiteTutorial() {
  const t = useTranslations('site-tutorial')
  const steps = useMemo(() => {
    const raw = t.raw('steps') as Record<string, string>
    return Object.keys(raw)
      .sort()
      .map((key) => raw[key])
  }, [t])
  const [promptOpen, setPromptOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
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

  if (!promptOpen && !tutorialOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      {promptOpen && (
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
          <h2 className="text-lg font-semibold">{t('prompt.title')}</h2>
          <p className="mt-2 text-sm text-gray-600">{t('prompt.body')}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => closePrompt(false)}
              className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              {t('prompt.no')}
            </button>
            <button
              type="button"
              onClick={() => closePrompt(true)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {t('prompt.yes')}
            </button>
          </div>
        </div>
      )}

      {tutorialOpen && (
        <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('tutorial.title')}</h2>
            <button
              type="button"
              onClick={finishTutorial}
              className="text-sm font-semibold text-gray-500 hover:text-gray-700"
            >
              {t('tutorial.skip')}
            </button>
          </div>
          <p className="mt-3 text-sm text-gray-600">
            {t('tutorial.stepLabel', { current: stepIndex + 1, total: steps.length })}
          </p>
          <p className="mt-4 text-base text-gray-700">{steps[stepIndex]}</p>
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={prevStep}
              disabled={stepIndex === 0}
              className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              {t('tutorial.back')}
            </button>
            <button
              type="button"
              onClick={nextStep}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {stepIndex >= steps.length - 1 ? t('tutorial.finish') : t('tutorial.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
