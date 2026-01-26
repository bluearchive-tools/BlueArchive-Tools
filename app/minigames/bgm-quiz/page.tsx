'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Footer from '../../../components/Footer'
import { useTranslations } from 'next-intl'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import {
  createBgmQuizQuestions,
  getBgmQuizCategories,
  getBgmTrackDisplayTitle,
  getBgmTracks,
  isCorrectBgmAnswer,
} from '../../../lib/minigames/bgm-quiz'
import type { QuizMode, QuizQuestion } from '../../../lib/minigames/bgm-quiz'

type Phase = 'setup' | 'playing' | 'result'
type GameType = 'normal' | 'fast' | 'intro' | 'random'

export default function BgmQuizPage() {
  const t = useTranslations('bgm-quiz')
  const tracks = useMemo(() => getBgmTracks(), [])

  const [phase, setPhase] = useState<Phase>('setup')
  const [mode, setMode] = useState<QuizMode>('multiple-choice')
  const [gameType, setGameType] = useState<GameType>('normal')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [questionCount, setQuestionCount] = useState(5)
  const [introSeconds, setIntroSeconds] = useState(5)
  const [randomSeconds, setRandomSeconds] = useState(5)
  const [excludeUntitledThemes, setExcludeUntitledThemes] = useState(false)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isMultiplayer, setIsMultiplayer] = useState(false)
  const [playerCount, setPlayerCount] = useState(2)
  const [playerScores, setPlayerScores] = useState<number[]>([])
  const [currentPlayer, setCurrentPlayer] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [answerInput, setAnswerInput] = useState('')
  const [listSelection, setListSelection] = useState('')
  const [answerState, setAnswerState] = useState<'correct' | 'incorrect' | null>(null)
  const [score, setScore] = useState(0)
  const [answerOptions, setAnswerOptions] = useState<string[]>([])
  const [hasStopped, setHasStopped] = useState(true)
  const [fastStopTimes, setFastStopTimes] = useState<Array<number | null>>([])
  const [fastAnswerTimes, setFastAnswerTimes] = useState<Array<number | null>>([])
  const [randomStart, setRandomStart] = useState<number | null>(null)
  const [playStartTime, setPlayStartTime] = useState<number | null>(null)
  const [showAudio, setShowAudio] = useState(true)
  const [fastElapsed, setFastElapsed] = useState(0)
  const [isOnline, setIsOnline] = useState(false)
  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [onlineRoomCode, setOnlineRoomCode] = useState<string | null>(null)
  const [onlinePlayerName, setOnlinePlayerName] = useState('')
  const [onlinePlayerId, setOnlinePlayerId] = useState<string | null>(null)
  const [onlineQuestion, setOnlineQuestion] = useState<{
    trackFile: string
    choices: string[]
  } | null>(null)
  const [onlinePlayers, setOnlinePlayers] = useState<Array<{ player_id: string; display_name: string; score: number }>>(
    [],
  )
  const [onlineTotalQuestions, setOnlineTotalQuestions] = useState<number | null>(null)
  const [onlineError, setOnlineError] = useState<string | null>(null)
  const [onlineLoading, setOnlineLoading] = useState(false)

  const supabase = useSupabaseClient()

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stopTimerRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const fastTimerRef = useRef<number | null>(null)

  const filteredTracks = useMemo(() => {
    if (!excludeUntitledThemes) return tracks
    return tracks.filter((track) => track.title?.trim())
  }, [excludeUntitledThemes, tracks])

  const categories = useMemo(() => getBgmQuizCategories(filteredTracks).sort(), [filteredTracks])

  useEffect(() => {
    if (selectedCategory !== 'all' && !categories.includes(selectedCategory)) {
      setSelectedCategory('all')
    }
  }, [categories, selectedCategory])

  const availableTracks = useMemo(() => {
    if (selectedCategory === 'all') return filteredTracks
    return filteredTracks.filter((track) => track.category === selectedCategory)
  }, [filteredTracks, selectedCategory])

  const currentQuestion = questions[currentIndex]
  const totalQuestions = isOnline ? onlineTotalQuestions ?? questions.length : questions.length
  const isLastQuestion = currentIndex === totalQuestions - 1
  const isAnswered = answerState !== null
  const canAnswer = gameType !== 'fast' || hasStopped
  const currentFastStopTime = fastStopTimes[currentIndex]
  const onlineScore = isOnline ? onlinePlayers.reduce((sum, player) => sum + player.score, 0) : 0
  const totalScore = isOnline ? onlineScore : isMultiplayer ? playerScores.reduce((sum, value) => sum + value, 0) : score
  const activeQuestion = isOnline ? onlineQuestion : currentQuestion
  const activeTrack = isOnline
    ? tracks.find((track) => track.file === onlineQuestion?.trackFile)
    : currentQuestion?.track

  const clearStopTimer = () => {
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
  }

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  const clearFastTimer = () => {
    if (fastTimerRef.current) {
      window.clearInterval(fastTimerRef.current)
      fastTimerRef.current = null
    }
  }

  const scheduleStopTimer = (seconds: number) => {
    clearStopTimer()
    stopTimerRef.current = window.setTimeout(() => {
      audioRef.current?.pause()
    }, seconds * 1000)
  }

  const scheduleHideAudio = (seconds: number) => {
    clearHideTimer()
    hideTimerRef.current = window.setTimeout(() => {
      audioRef.current?.pause()
      setShowAudio(false)
    }, seconds * 1000)
  }

  useEffect(() => {
    return () => {
      clearStopTimer()
      clearHideTimer()
      clearFastTimer()
    }
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return
    setHasStopped(gameType !== 'fast')
    setRandomStart(null)
    setPlayStartTime(null)
    setShowAudio(true)
    setFastElapsed(0)
    clearStopTimer()
    clearHideTimer()
    clearFastTimer()
  }, [currentQuestion?.track.file, gameType, phase])

  useEffect(() => {
    if (gameType !== 'fast') return
    if (mode !== 'multiple-choice') {
      setMode('multiple-choice')
    }
  }, [gameType, mode])

  useEffect(() => {
    if (!isOnline) return
    if (gameType !== 'fast') {
      setGameType('fast')
    }
    if (mode !== 'multiple-choice') {
      setMode('multiple-choice')
    }
  }, [gameType, isOnline, mode])

  useEffect(() => {
    if (isOnline) {
      setIsMultiplayer(false)
      return
    }
    setOnlineRoomCode(null)
    setOnlinePlayerId(null)
    setOnlineQuestion(null)
    setOnlinePlayers([])
    setOnlineTotalQuestions(null)
    setOnlineError(null)
  }, [isOnline])

  useEffect(() => {
    clearFastTimer()
    if (phase !== 'playing' || gameType !== 'fast' || hasStopped || playStartTime === null) {
      if (currentFastStopTime !== null && currentFastStopTime !== undefined) {
        setFastElapsed(currentFastStopTime)
      }
      return
    }
    fastTimerRef.current = window.setInterval(() => {
      setFastElapsed((performance.now() - playStartTime) / 1000)
    }, 10)
  }, [currentFastStopTime, gameType, hasStopped, phase, playStartTime])

  useEffect(() => {
    if (!onlineRoomCode) return
    const roomCode = onlineRoomCode

    const channel = supabase
      .channel(`bgm-quiz-room-${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bgm_quiz_rooms',
          filter: `room_code=eq.${roomCode}`,
        },
        async (payload) => {
          const updatedIndex = payload.new.current_index as number
          const status = payload.new.status as 'playing' | 'finished'
          setCurrentIndex(updatedIndex)
          if (status === 'finished') {
            setPhase('result')
            return
          }
          try {
            const question = await fetchOnlineQuestion(roomCode, updatedIndex)
            setOnlineQuestion(question)
            setAnswerState(null)
            setSelectedIndex(null)
            setHasStopped(gameType !== 'fast')
            setFastElapsed(0)
          } catch (error) {
            setOnlineError(error instanceof Error ? error.message : '問題の取得に失敗しました。')
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bgm_quiz_players',
          filter: `room_code=eq.${roomCode}`,
        },
        () => {
          void fetchOnlinePlayers(roomCode)
        },
      )
      .subscribe()

    void fetchOnlinePlayers(roomCode)

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameType, onlineRoomCode, supabase])

  const handleStart = () => {
    if (isOnline) return
    if (!filteredTracks.length) return
    const selectedTracks = selectedCategory === 'all' ? filteredTracks : availableTracks
    const quizQuestions = createBgmQuizQuestions(selectedTracks, questionCount, mode)
    const optionTitles = Array.from(
      new Set(selectedTracks.map((track) => getBgmTrackDisplayTitle(track))),
    ).sort((a, b) => a.localeCompare(b, 'ja'))
    setQuestions(quizQuestions)
    setAnswerOptions(optionTitles)
    setCurrentIndex(0)
    setSelectedIndex(null)
    setAnswerInput('')
    setListSelection('')
    setAnswerState(null)
    setScore(0)
    setHasStopped(gameType !== 'fast')
    setFastStopTimes(gameType === 'fast' ? Array(quizQuestions.length).fill(null) : [])
    setFastAnswerTimes(gameType === 'fast' ? Array(quizQuestions.length).fill(null) : [])
    setPlayerScores(isMultiplayer ? Array(Math.max(1, playerCount)).fill(0) : [])
    setCurrentPlayer(0)
    setRandomStart(null)
    setPlayStartTime(null)
    setShowAudio(true)
    setFastElapsed(0)
    setPhase('playing')
  }

  const fetchOnlineQuestion = async (roomCode: string, index: number) => {
    const response = await fetch(`/api/bgm-quiz/rooms/${roomCode}/question?index=${index}`)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error ?? '問題の取得に失敗しました。')
    }
    return data.question as { trackFile: string; choices: string[] }
  }

  const fetchOnlinePlayers = async (roomCode: string) => {
    const { data } = await supabase
      .from('bgm_quiz_players')
      .select('player_id,display_name,score')
      .eq('room_code', roomCode)
      .order('created_at', { ascending: true })
    setOnlinePlayers(data ?? [])
  }

  const createOnlineRoom = async () => {
    if (onlineLoading) return
    setOnlineLoading(true)
    setOnlineError(null)
    try {
      const response = await fetch('/api/bgm-quiz/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          questionCount,
          excludeUntitledThemes,
          displayName: onlinePlayerName,
          gameType,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error ?? 'ルーム作成に失敗しました。')
      }
      setOnlineRoomCode(data.roomCode)
      setOnlinePlayerId(data.playerId)
      setOnlineTotalQuestions(data.totalQuestions)
      setCurrentIndex(data.currentIndex)
      setOnlineQuestion(data.question)
      setPhase('playing')
      setAnswerState(null)
      setSelectedIndex(null)
      setHasStopped(gameType !== 'fast')
      await fetchOnlinePlayers(data.roomCode)
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'ルーム作成に失敗しました。')
    } finally {
      setOnlineLoading(false)
    }
  }

  const joinOnlineRoom = async () => {
    if (!roomCodeInput.trim() || onlineLoading) return
    setOnlineLoading(true)
    setOnlineError(null)
    try {
      const response = await fetch(`/api/bgm-quiz/rooms/${roomCodeInput.trim().toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: onlinePlayerName }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error ?? 'ルーム参加に失敗しました。')
      }
      setOnlineRoomCode(data.roomCode)
      setOnlinePlayerId(data.playerId)
      setOnlineTotalQuestions(data.totalQuestions)
      setCurrentIndex(data.currentIndex)
      setOnlineQuestion(data.question)
      setPhase('playing')
      setAnswerState(null)
      setSelectedIndex(null)
      setHasStopped(gameType !== 'fast')
      await fetchOnlinePlayers(data.roomCode)
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'ルーム参加に失敗しました。')
    } finally {
      setOnlineLoading(false)
    }
  }

  const submitOnlineAnswer = async (choiceIndex: number) => {
    if (!onlineRoomCode || !onlinePlayerId) return
    const response = await fetch(`/api/bgm-quiz/rooms/${onlineRoomCode}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: onlinePlayerId,
        choiceIndex,
        stopTime: currentFastStopTime,
        answerTime: fastElapsed,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      setOnlineError(data?.error ?? '回答に失敗しました。')
      return
    }
    setAnswerState(data.isCorrect ? 'correct' : 'incorrect')
  }

  const handleSelect = (index: number) => {
    if (isAnswered || phase !== 'playing' || !canAnswer) return
    setSelectedIndex(index)
    if (gameType === 'fast') {
      recordFastAnswerTime()
    }
    if (isOnline) {
      void submitOnlineAnswer(index)
      return
    }
    const isCorrect = currentQuestion.correctIndex === index
    setAnswerState(isCorrect ? 'correct' : 'incorrect')
    if (isCorrect) {
      if (isMultiplayer) {
        setPlayerScores((prev) => {
          const updated = [...prev]
          updated[currentPlayer] = (updated[currentPlayer] ?? 0) + 1
          return updated
        })
      } else {
        setScore((prev) => prev + 1)
      }
    }
  }

  const handleSubmitAnswer = () => {
    if (isAnswered || phase !== 'playing' || !canAnswer) return
    const value = mode === 'list-select' ? listSelection : answerInput
    if (gameType === 'fast') {
      recordFastAnswerTime()
    }
    if (isOnline) return
    const isCorrect = isCorrectBgmAnswer(currentQuestion.track, value)
    setAnswerState(isCorrect ? 'correct' : 'incorrect')
    if (isCorrect) {
      if (isMultiplayer) {
        setPlayerScores((prev) => {
          const updated = [...prev]
          updated[currentPlayer] = (updated[currentPlayer] ?? 0) + 1
          return updated
        })
      } else {
        setScore((prev) => prev + 1)
      }
    }
  }

  const handleNext = () => {
    if (isOnline) return
    if (!isAnswered) return
    if (isLastQuestion) {
      setPhase('result')
      return
    }
    setCurrentIndex((prev) => prev + 1)
    setSelectedIndex(null)
    setAnswerInput('')
    setListSelection('')
    setAnswerState(null)
    setHasStopped(gameType !== 'fast')
    setPlayStartTime(null)
    setRandomStart(null)
    setShowAudio(true)
    setFastElapsed(0)
    clearStopTimer()
    clearHideTimer()
    clearFastTimer()
    if (isMultiplayer) {
      setCurrentPlayer((prev) => (playerScores.length > 0 ? (prev + 1) % playerScores.length : 0))
    }
  }

  const handleRestart = () => {
    setPhase('setup')
    setQuestions([])
    setCurrentIndex(0)
    setSelectedIndex(null)
    setAnswerInput('')
    setListSelection('')
    setAnswerState(null)
    setScore(0)
    setAnswerOptions([])
    setHasStopped(true)
    setFastStopTimes([])
    setFastAnswerTimes([])
    setPlayerScores([])
    setCurrentPlayer(0)
    setRandomStart(null)
    setPlayStartTime(null)
    setShowAudio(true)
    setFastElapsed(0)
    clearStopTimer()
    clearHideTimer()
    clearFastTimer()
    if (isOnline) {
      setIsOnline(false)
    }
  }

  const resultMessage = isOnline
    ? t('onlineResultMessage')
    : score === totalQuestions
      ? t('resultPerfect')
      : t('resultGood')
  const averageFastStopTime = (() => {
    const validTimes = fastStopTimes.filter((time): time is number => time !== null)
    if (validTimes.length === 0) return null
    return validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length
  })()

  const averageFastAnswerTime = (() => {
    const validTimes = fastAnswerTimes.filter((time): time is number => time !== null)
    if (validTimes.length === 0) return null
    return validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length
  })()

  const handleAudioPlay = () => {
    if (gameType === 'fast') {
      setPlayStartTime(performance.now())
    }
    if (gameType === 'intro') {
      scheduleStopTimer(introSeconds)
      scheduleHideAudio(introSeconds)
    }
    if (gameType === 'random') {
      scheduleStopTimer(randomSeconds)
      scheduleHideAudio(randomSeconds)
    }
  }

  const handleLoadedMetadata = () => {
    if (gameType !== 'random') return
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return
    const maxStart = Math.max(0, audio.duration - randomSeconds)
    const start = Math.random() * maxStart
    audio.currentTime = start
    setRandomStart(start)
  }

  const handleStopPlayback = () => {
    if (hasStopped || gameType !== 'fast') return
    const audio = audioRef.current
    audio?.pause()
    const endTime = performance.now()
    const elapsed = playStartTime ? (endTime - playStartTime) / 1000 : 0
    setHasStopped(true)
    setFastStopTimes((prev) => {
      const updated = [...prev]
      updated[currentIndex] = elapsed
      return updated
    })
    setFastElapsed(elapsed)
  }

  const recordFastAnswerTime = () => {
    if (gameType !== 'fast' || playStartTime === null) return
    const endTime = performance.now()
    const elapsed = (endTime - playStartTime) / 1000
    setFastAnswerTimes((prev) => {
      const updated = [...prev]
      updated[currentIndex] = elapsed
      return updated
    })
  }

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
              {t('score', { score: totalScore, total: totalQuestions })}
            </span>
            {isMultiplayer && playerScores.length > 0 && (
              <span className="rounded-full bg-purple-50 px-3 py-1 text-purple-700">
                {t('currentPlayer', { index: currentPlayer + 1 })}
              </span>
            )}
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
                      disabled={isOnline}
                    />
                    {t('modeMultipleChoice')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="quiz-mode"
                      value="list-select"
                      checked={mode === 'list-select'}
                      onChange={() => setMode('list-select')}
                      disabled={gameType === 'fast' || isOnline}
                    />
                    {t('modeListSelect')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="quiz-mode"
                      value="free-input"
                      checked={mode === 'free-input'}
                      onChange={() => setMode('free-input')}
                      disabled={gameType === 'fast' || isOnline}
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

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1 text-sm text-gray-700">
                <span className="font-medium">{t('multiplayerLabel')}</span>
                <div className="flex items-center gap-2">
                  <input
                    id="multiplayer-toggle"
                    type="checkbox"
                    checked={isMultiplayer}
                    onChange={(event) => setIsMultiplayer(event.target.checked)}
                    disabled={isOnline}
                  />
                  <label htmlFor="multiplayer-toggle" className="text-sm text-gray-700">
                    {t('multiplayerToggle')}
                  </label>
                </div>
                {isMultiplayer && (
                  <div className="mt-2 space-y-1">
                    <input
                      type="number"
                      min={2}
                      max={8}
                      value={playerCount}
                      onChange={(event) => setPlayerCount(Number(event.target.value))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-gray-500">
                      {t('multiplayerHint', { count: playerCount })}
                    </p>
                  </div>
                )}
              </label>

              <label className="space-y-2 text-sm text-gray-700">
                <span className="font-medium">{t('onlineLabel')}</span>
                <div className="flex items-center gap-2">
                  <input
                    id="online-toggle"
                    type="checkbox"
                    checked={isOnline}
                    onChange={(event) => setIsOnline(event.target.checked)}
                  />
                  <label htmlFor="online-toggle" className="text-sm text-gray-700">
                    {t('onlineToggle')}
                  </label>
                </div>
                {isOnline && (
                  <div className="space-y-2">
                    <label className="block text-xs text-gray-500">
                      {t('onlineNameLabel')}
                      <input
                        type="text"
                        value={onlinePlayerName}
                        onChange={(event) => setOnlinePlayerName(event.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        placeholder={t('onlineNamePlaceholder')}
                      />
                    </label>
                    <label className="block text-xs text-gray-500">
                      {t('onlineRoomCodeLabel')}
                      <input
                        type="text"
                        value={roomCodeInput}
                        onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase tracking-widest"
                        placeholder="ABC123"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={createOnlineRoom}
                        disabled={onlineLoading}
                        className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {t('onlineCreate')}
                      </button>
                      <button
                        type="button"
                        onClick={joinOnlineRoom}
                        disabled={!roomCodeInput.trim() || onlineLoading}
                        className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {t('onlineJoin')}
                      </button>
                    </div>
                    {onlineRoomCode && (
                      <p className="text-xs text-gray-500">
                        {t('onlineRoomCreated', { code: onlineRoomCode })}
                      </p>
                    )}
                    {onlineError && <p className="text-xs text-red-600">{onlineError}</p>}
                  </div>
                )}
              </label>

              <label className="space-y-1 text-sm text-gray-700">
                <span className="font-medium">{t('gameTypeLabel')}</span>
                <select
                  value={gameType}
                  onChange={(event) => setGameType(event.target.value as GameType)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={isOnline}
                >
                  <option value="normal">{t('gameTypeNormal')}</option>
                  <option value="fast">{t('gameTypeFast')}</option>
                  <option value="intro">{t('gameTypeIntro')}</option>
                  <option value="random">{t('gameTypeRandom')}</option>
                </select>
                <p className="text-xs text-gray-500">{t(`gameTypeHint.${gameType}`)}</p>
              </label>

              {(gameType === 'intro' || gameType === 'random') && (
                <label className="space-y-1 text-sm text-gray-700">
                  <span className="font-medium">
                    {gameType === 'intro' ? t('introSecondsLabel') : t('randomSecondsLabel')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={gameType === 'intro' ? introSeconds : randomSeconds}
                    onChange={(event) =>
                      gameType === 'intro'
                        ? setIntroSeconds(Number(event.target.value))
                        : setRandomSeconds(Number(event.target.value))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    {gameType === 'intro'
                      ? t('introSecondsHint', { seconds: introSeconds })
                      : t('randomSecondsHint', { seconds: randomSeconds })}
                  </p>
                </label>
              )}

              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={excludeUntitledThemes}
                  onChange={(event) => setExcludeUntitledThemes(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{t('excludeThemeLabel')}</span>
                  <span className="block text-xs text-gray-500">{t('excludeThemeHint')}</span>
                </span>
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleStart}
                disabled={availableTracks.length === 0 || isOnline}
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

        {phase === 'playing' && activeQuestion && activeTrack && (
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('nowPlaying')}
              </p>
              {showAudio && (
                <audio
                  key={activeTrack.file}
                  src={`/bgm/${encodeURIComponent(activeTrack.file)}`}
                  controls
                  autoPlay
                  className="w-full"
                  ref={audioRef}
                  onPlay={handleAudioPlay}
                  onLoadedMetadata={handleLoadedMetadata}
                />
              )}
              {gameType === 'intro' && (
                <p className="text-xs text-gray-500">{t('introPlaybackNotice', { seconds: introSeconds })}</p>
              )}
              {gameType === 'random' && (
                <p className="text-xs text-gray-500">
                  {t('randomPlaybackNotice', {
                    seconds: randomSeconds,
                    start: randomStart !== null ? randomStart.toFixed(1) : '-',
                  })}
                </p>
              )}
              {gameType === 'fast' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStopPlayback}
                    disabled={hasStopped}
                    className="rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {t('fastStop')}
                  </button>
                  <span className="text-xs text-gray-500">
                    {hasStopped
                      ? t('fastStopped', {
                          time: currentFastStopTime !== null ? currentFastStopTime.toFixed(2) : '--',
                        })
                      : t('fastRunning', { time: fastElapsed.toFixed(2) })}
                  </span>
                </div>
              )}
            </div>

            {(gameType !== 'fast' || hasStopped) && mode === 'multiple-choice' ? (
              <div className="space-y-2">
                {activeQuestion.choices.map((choice, index) => {
                  const isCorrect = !isOnline && currentQuestion.correctIndex === index
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
                      disabled={isAnswered || !canAnswer}
                    >
                      {choice}
                    </button>
                  )
                })}
              </div>
            ) : (gameType !== 'fast' || hasStopped) && mode === 'list-select' ? (
              <div className="space-y-2">
                <select
                  value={listSelection}
                  onChange={(event) => setListSelection(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={isAnswered || !canAnswer}
                >
                  <option value="">{t('listSelectPlaceholder')}</option>
                  {answerOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={isAnswered || !listSelection || !canAnswer}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {t('submitAnswer')}
                </button>
              </div>
            ) : (gameType !== 'fast' || hasStopped) && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={answerInput}
                  onChange={(event) => setAnswerInput(event.target.value)}
                  placeholder={t('answerPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={isAnswered || !canAnswer}
                />
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={isAnswered || !answerInput.trim() || !canAnswer}
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
                      answer: activeTrack ? getBgmTrackDisplayTitle(activeTrack) : '',
                    })}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleNext}
                disabled={!isAnswered || isOnline}
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
              {t('score', { score: totalScore, total: totalQuestions })}
            </p>
            {isMultiplayer && playerScores.length > 0 && (
              <div className="space-y-2 text-sm text-gray-600">
                <p className="font-medium text-gray-700">{t('multiplayerResultTitle')}</p>
                <ul className="space-y-1">
                  {playerScores.map((value, index) => (
                    <li key={`player-score-${index}`}>
                      {t('multiplayerResultItem', { index: index + 1, score: value })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {isOnline && onlinePlayers.length > 0 && (
              <div className="space-y-2 text-sm text-gray-600">
                <p className="font-medium text-gray-700">{t('onlineResultTitle')}</p>
                <ul className="space-y-1">
                  {onlinePlayers.map((player) => (
                    <li key={player.player_id}>
                      {t('onlineResultItem', { name: player.display_name, score: player.score })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gameType === 'fast' && fastStopTimes.length > 0 && (
              <div className="space-y-2 text-sm text-gray-600">
                <p className="font-medium text-gray-700">{t('fastResultTitle')}</p>
                <ul className="space-y-1">
                  {fastStopTimes.map((time, index) => (
                    <li key={`fast-time-${index}`}>
                      {t('fastResultItem', {
                        index: index + 1,
                        stop: time !== null ? time.toFixed(2) : '--',
                        answer:
                          fastAnswerTimes[index] !== null && fastAnswerTimes[index] !== undefined
                            ? fastAnswerTimes[index]?.toFixed(2)
                            : '--',
                      })}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500">
                  {averageFastStopTime !== null
                    ? t('fastAverage', { stop: averageFastStopTime.toFixed(2) })
                    : t('fastAverageUnavailable')}
                </p>
                <p className="text-xs text-gray-500">
                  {averageFastAnswerTime !== null
                    ? t('fastAverageAnswer', { answer: averageFastAnswerTime.toFixed(2) })
                    : t('fastAverageAnswerUnavailable')}
                </p>
              </div>
            )}
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
