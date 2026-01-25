'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Footer from '../../../components/Footer'
import { useLocale, useTranslations } from 'next-intl'
import { getBgmQuizQuestions } from '../../../lib/minigames/bgm-quiz'
import type { Locale } from '../../../lib/i18n/config'

type Phase = 'playing' | 'result'

export default function BgmQuizPage() {
  const t = useTranslations('bgm-quiz')
  const locale = useLocale() as Locale

  const questions = useMemo(() => getBgmQuizQuestions(locale), [locale])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [phase, setPhase] = useState<Phase>('playing')

  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1
  const isAnswered = selectedIndex !== null

  const handleSelect = (index: number) => {
    if (isAnswered || phase !== 'playing') return
    setSelectedIndex(index)
    if (index === currentQuestion.answerIndex) {
      setScore((prev) => prev + 1)
    }
  }

  const handleNext = () => {
    if (!isAnswered) return
    if (isLastQuestion) {
      setPhase('result')
      return
    }
    setCurrentIndex((prev) => prev + 1)
    setSelectedIndex(null)
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setSelectedIndex(null)
    setScore(0)
    setPhase('playing')
  }

  const resultMessage = score === questions.length ? t('resultPerfect') : t('resultGood')

  return (
    <>
      <main className="p-4 pb-20 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-gray-600">{t('description')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span className="rounded-full bg-gray-100 px-3 py-1">
            {t('progress', { current: phase === 'result' ? questions.length : currentIndex + 1, total: questions.length })}
          </span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
            {t('score', { score, total: questions.length })}
          </span>
        </div>

        {phase === 'playing' && currentQuestion && (
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('hintLabel')}
              </p>
              <p className="text-base text-gray-800">{currentQuestion.hint}</p>
            </div>

            <div className="space-y-2">
              {currentQuestion.choices.map((choice, index) => {
                const isCorrect = index === currentQuestion.answerIndex
                const isSelected = index === selectedIndex
                const showCorrect = isAnswered && isCorrect
                const showIncorrect = isAnswered && isSelected && !isCorrect

                const baseClasses =
                  'w-full rounded-md border px-4 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

                const stateClasses = showCorrect
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : showIncorrect
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-800 hover:border-blue-200 hover:bg-blue-50/60'

                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => handleSelect(index)}
                    className={`${baseClasses} ${stateClasses}`}
                    disabled={isAnswered}
                  >
                    {choice}
                  </button>
                )
              })}
            </div>

            {isAnswered && (
              <div
                className={`rounded-md px-4 py-3 text-sm font-medium ${
                  selectedIndex === currentQuestion.answerIndex
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {selectedIndex === currentQuestion.answerIndex
                  ? t('correct')
                  : t('incorrect', {
                      answer: currentQuestion.choices[currentQuestion.answerIndex],
                    })}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleNext}
                disabled={!isAnswered}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isLastQuestion ? t('resultTitle') : t('next')}
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                {t('restart')}
              </button>
              <Link
                href="/"
                className="inline-flex items-center rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                {t('home')}
              </Link>
            </div>
          </section>
        )}

        {phase === 'result' && (
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-gray-900">{t('resultTitle')}</h2>
              <p className="text-sm text-gray-600">{resultMessage}</p>
            </div>
            <p className="text-3xl font-extrabold text-blue-700">
              {t('score', { score, total: questions.length })}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={handleRestart}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                {t('restart')}
              </button>
              <Link
                href="/"
                className="inline-flex items-center rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                {t('home')}
              </Link>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  )
}
