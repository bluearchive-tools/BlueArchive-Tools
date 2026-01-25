'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface Track {
  filename: string
  title?: string
  category: string
}

interface BgmData {
  categories: string[]
  tracks: Track[]
}

interface AnswerResult {
  track: Track
  correctTitle: string
  userAnswer: string
  isCorrect: boolean
}

const DEFAULT_MODE = 'multiple'

const normalizeAnswer = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ')

const getFallbackTitle = (track: Track) => {
  const base = track.filename.replace(/\.[^/.]+$/, '')
  return `Theme ${base}`
}

const getDisplayTitle = (track: Track) => {
  const title = track.title?.trim()
  return title ? title : getFallbackTitle(track)
}

const shuffle = <T,>(items: T[]) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function BgmQuizPage() {
  const [data, setData] = useState<BgmData>({ categories: [], tracks: [] })
  const [questionCount, setQuestionCount] = useState(5)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [mode, setMode] = useState(DEFAULT_MODE)
  const [started, setStarted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [options, setOptions] = useState<string[]>([])
  const [answerInput, setAnswerInput] = useState('')
  const [results, setResults] = useState<AnswerResult[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/bgm')
        if (res.ok) {
          setData(await res.json())
        }
      } catch {
        setData({ categories: [], tracks: [] })
      }
    }
    load()
  }, [])

  const filteredTracks = useMemo(() => {
    if (selectedCategory === 'all') return data.tracks
    return data.tracks.filter((track) => track.category === selectedCategory)
  }, [data.tracks, selectedCategory])

  const [questionTracks, setQuestionTracks] = useState<Track[]>([])

  const buildOptions = useCallback(
    (current: Track, pool: Track[]) => {
      const correct = getDisplayTitle(current)
      const optionPool = pool
        .filter((track) => track.filename !== current.filename)
        .map((track) => getDisplayTitle(track))

      const uniqueOptions = Array.from(new Set(optionPool))
      const shuffled = shuffle(uniqueOptions)
      const picked = shuffled.slice(0, 3)

      const combined = shuffle([correct, ...picked])
      while (combined.length < 4) {
        combined.push(correct)
      }
      return combined.slice(0, 4)
    },
    []
  )

  const setupQuestion = useCallback(
    (index: number, pool: Track[]) => {
      const current = pool[index]
      if (!current) return
      if (mode === 'multiple') {
        setOptions(buildOptions(current, pool))
      } else {
        setOptions([])
      }
      setAnswerInput('')
      const audio = audioRef.current
      if (audio) {
        audio.src = `/api/bgm/audio?file=${encodeURIComponent(current.filename)}`
        audio.load()
        audio.play().catch(() => {
          /* ignore autoplay errors */
        })
      }
    },
    [buildOptions, mode]
  )

  const startQuiz = () => {
    if (filteredTracks.length === 0) return
    const count = Math.max(1, Math.min(questionCount, 50))
    let picked: Track[] = []
    if (count <= filteredTracks.length) {
      picked = shuffle(filteredTracks).slice(0, count)
    } else {
      picked = Array.from({ length: count }, () => {
        const index = Math.floor(Math.random() * filteredTracks.length)
        return filteredTracks[index]
      })
    }
    setScore(0)
    setResults([])
    setQuestionTracks(picked)
    setCurrentIndex(0)
    setStarted(true)
    setupQuestion(0, picked)
  }

  const currentTrack = questionTracks[currentIndex]
  const quizFinished = started && currentIndex >= questionTracks.length

  const handleAnswer = (answer: string) => {
    if (!currentTrack) return
    const correctTitle = getDisplayTitle(currentTrack)
    const isCorrect =
      normalizeAnswer(answer) === normalizeAnswer(correctTitle)
    setScore((prev) => (isCorrect ? prev + 1 : prev))
    setResults((prev) => [
      ...prev,
      {
        track: currentTrack,
        correctTitle,
        userAnswer: answer,
        isCorrect,
      },
    ])
    const nextIndex = currentIndex + 1
    if (nextIndex >= questionTracks.length) {
      setCurrentIndex(nextIndex)
      return
    }
    setCurrentIndex(nextIndex)
    setupQuestion(nextIndex, questionTracks)
  }

  const handleSubmitText = () => {
    if (!answerInput.trim()) return
    handleAnswer(answerInput)
  }

  return (
    <main className="p-4 space-y-6 pb-16">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold">BGMクイズ</h1>
        <p className="text-sm text-gray-600">
          /data/bgm の .opus ファイルからランダム再生し、曲名を当てるクイズです。
        </p>
      </section>

      {!started && (
        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <label className="block text-sm font-medium">カテゴリー</label>
            <select
              className="w-full rounded border border-gray-300 p-2"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="all">すべて</option>
              {data.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">出題数</label>
            <input
              type="number"
              min={1}
              max={50}
              className="w-full rounded border border-gray-300 p-2"
              value={questionCount}
              onChange={(event) => setQuestionCount(Number(event.target.value))}
            />
          </div>
          <div className="space-y-2">
            <span className="block text-sm font-medium">回答形式</span>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="multiple"
                  checked={mode === 'multiple'}
                  onChange={() => setMode('multiple')}
                />
                4択
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="exact"
                  checked={mode === 'exact'}
                  onChange={() => setMode('exact')}
                />
                曲名完答
              </label>
            </div>
          </div>
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            onClick={startQuiz}
            disabled={filteredTracks.length === 0}
          >
            スタート
          </button>
          {filteredTracks.length === 0 && (
            <p className="text-sm text-red-500">
              選択したカテゴリーにBGMがありません。
            </p>
          )}
        </section>
      )}

      {started && !quizFinished && currentTrack && (
        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              問題 {currentIndex + 1} / {questionTracks.length}
            </span>
            <span>スコア: {score}</span>
          </div>
          <div className="space-y-2">
            <audio ref={audioRef} controls className="w-full" />
            <p className="text-xs text-gray-500">
              カテゴリー: {currentTrack.category}
            </p>
          </div>

          {mode === 'multiple' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((option) => (
                <button
                  key={option}
                  className="rounded border border-gray-300 px-3 py-2 text-left hover:bg-blue-50"
                  onClick={() => handleAnswer(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="flex-1 rounded border border-gray-300 p-2"
                placeholder="曲名を入力"
                value={answerInput}
                onChange={(event) => setAnswerInput(event.target.value)}
              />
              <button
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                onClick={handleSubmitText}
              >
                回答
              </button>
            </div>
          )}
        </section>
      )}

      {quizFinished && (
        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-xl font-semibold">結果</h2>
          <p>
            正解数: {score} / {questionTracks.length}
          </p>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={`${result.track.filename}-${index}`}
                className="rounded border border-gray-200 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span>
                    {index + 1}. {result.correctTitle}
                  </span>
                  <span
                    className={
                      result.isCorrect ? 'text-green-600' : 'text-red-600'
                    }
                  >
                    {result.isCorrect ? '正解' : '不正解'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  ファイル: {result.track.filename}
                </p>
                <p className="text-xs text-gray-500">
                  あなたの回答: {result.userAnswer}
                </p>
              </div>
            ))}
          </div>
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            onClick={() => {
              setStarted(false)
              setQuestionTracks([])
              setResults([])
              setScore(0)
              setCurrentIndex(0)
            }}
          >
            もう一度
          </button>
        </section>
      )}
    </main>
  )
}
