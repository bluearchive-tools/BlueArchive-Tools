'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Footer from '../../../components/Footer'
import { useTranslations } from 'next-intl'
import {
  createBgmQuizQuestions,
  getBgmQuizCategories,
  getBgmTrackDisplayTitle,
  getBgmTracks,
  isCorrectBgmAnswer,
} from '../../../lib/minigames/bgm-quiz'
import type { QuizMode, QuizQuestion } from '../../../lib/minigames/bgm-quiz'

type Phase = 'setup' | 'playing' | 'result'

export default function BgmQuizPage() {
  const t = useTranslations('bgm-quiz')
  const tracks = useMemo(() => getBgmTracks(), [])
  const categories = useMemo(() => getBgmQuizCategories(tracks).sort(), [tracks])

  const [phase, setPhase] = useState<Phase>('setup')
  const [mode, setMode] = useState<QuizMode>('multiple-choice')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [questionCount, setQuestionCount] = useState(5)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [answerInput, setAnswerInput] = useState('')
  const [answerState, setAnswerState] = useState<'correct' | 'incorrect' | null>(null)
  const [score, setScore] = useState(0)

  const availableTracks = useMemo(() => {
    if (selectedCategory === 'all') return tracks
    return tracks.filter((track) => track.category === selectedCategory)
  }, [selectedCategory, tracks])

  const currentQuestion = questions[currentIndex]
  const totalQuestions = questions.length
  const isLastQuestion = currentIndex === totalQuestions - 1
  const isAnswered = answerState !== null

  const handleStart = () => {
    if (!tracks.length) return
    const selectedTracks = selectedCategory === 'all' ? tracks : availableTracks
    const quizQuestions = createBgmQuizQuestions(selectedTracks, questionCount, mode)
    setQuestions(quizQuestions)
    setCurrentIndex(0)
    setSelectedIndex(null)
    setAnswerInput('')
    setAnswerState(null)
    setScore(0)
    setPhase('playing')
  }

  const handleSelect = (index: number) => {
    if (isAnswered || phase !== 'playing') return
    setSelectedIndex(index)
    const isCorrect = index === currentQuestion.choices.indexOf(currentQuestion.answer)
    setAnswerState(isCorrect ? 'correct' : 'incorrect')
    if (isCorrect) {
      setScore((prev) => prev + 1)
    }
  }

  const handleSubmitAnswer = () => {
    if (isAnswered || phase !== 'playing') return
    const isCorrect = isCorrectBgmAnswer(currentQuestion.track, answerInput)
    setAnswerState(isCorrect ? 'correct' : 'incorrect')
    if (isCorrect) {
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
    setAnswerInput('')
    setAnswerState(null)
  }

  const handleRestart = () => {
    setPhase('setup')
    setQuestions([])
    setCurrentIndex(0)
    setSelectedIndex(null)
    setAnswerInput('')
    setAnswerState(null)
    setScore(0)
  }

  const resultMessage = score === totalQuestions ? t('resultPerfect') : t('resultGood')

  return (
    <>
      <main className="p-4 pb-20 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-gray-600">{t('description')}</p>
        </div>

        {phase !== 'setup' && totalQuestions > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="rounded-full bg-gray-100 px-3 py-1">
              {t('progress', { current: phase === 'result' ? totalQuestions : currentIndex + 1, total: totalQuestions })}
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
              {t('score', { score, total: totalQuestions })}
            </span>
          </div>
        )}

        {phase === 'setup' && (
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-gray-900">{t('setupTitle')}</h2>
              <p className="text-sm text-gray-600">{t('setupDescription')}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1 text-sm text-gray-700">
                <span className="font-medium">{t('categoryLabel')}</span>
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="all">{t('categoryAll')}</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm text-gray-700">
                <span className="font-medium">{t('modeLabel')}</span>
                <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="quiz-mode"
                      value="multiple-choice"
                      checked={mode === 'multiple-choice'}
                      onChange={() => setMode('multiple-choice')}
                    />
                    {t('modeMultipleChoice')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="quiz-mode"
                      value="free-input"
                      checked={mode === 'free-input'}
                      onChange={() => setMode('free-input')}
                    />
                    {t('modeFreeInput')}
                  </label>
                </div>
              </label>

              <label className="space-y-1 text-sm text-gray-700">
                <span className="font-medium">{t('questionCountLabel')}</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, availableTracks.length)}
                  value={questionCount}
                  onChange={(event) => setQuestionCount(Number(event.target.value))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-500">{t('questionCountHint', { total: availableTracks.length })}</p>
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleStart}
                disabled={availableTracks.length === 0}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {t('start')}
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

        {phase === 'playing' && currentQuestion && (
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('nowPlaying')}
              </p>
              <audio
                key={currentQuestion.track.file}
                src={`/bgm/${encodeURIComponent(currentQuestion.track.file)}`}
                controls
                autoPlay
                className="w-full"
              />
            </div>

            {mode === 'multiple-choice' ? (
              <div className="space-y-2">
                {currentQuestion.choices.map((choice, index) => {
                  const isCorrect = choice === currentQuestion.answer
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
                      key={`${choice}-${index}`}
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
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={answerInput}
                  onChange={(event) => setAnswerInput(event.target.value)}
                  placeholder={t('answerPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={isAnswered}
                />
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={isAnswered || !answerInput.trim()}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {t('submitAnswer')}
                </button>
              </div>
            )}

            {isAnswered && (
              <div
                className={`rounded-md px-4 py-3 text-sm font-medium ${
                  answerState === 'correct' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
                }`}
              >
                {answerState === 'correct'
                  ? t('correct')
                  : t('incorrect', {
                      answer: getBgmTrackDisplayTitle(currentQuestion.track),
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
              {t('score', { score, total: totalQuestions })}
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
