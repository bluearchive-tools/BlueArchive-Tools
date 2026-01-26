'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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

type Phase = 'setup' | 'lobby' | 'playing' | 'result'
type GameType = 'normal' | 'fast' | 'intro' | 'random'
type OnlineQuestion = {
  trackFile: string
  choices: string[]
  questionIndex: number
  isSolved: boolean
  winnerPlayerId: string | null
}

const detectOsInfo = (): string => {
  if (typeof navigator === 'undefined') return 'Unknown'
  const ua = navigator.userAgent
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform

  if (/Windows NT/.test(ua)) {
    const match = ua.match(/Windows NT ([\d.]+)/)
    if (match?.[1]) {
      const version = match[1]
      const mapped =
        version === '10.0' ? 'Windows 10/11' : version === '6.3' ? 'Windows 8.1' : version === '6.2' ? 'Windows 8' : version === '6.1' ? 'Windows 7' : `Windows ${version}`
      return mapped
    }
    return 'Windows'
  }
  if (/Android/.test(ua)) {
    const match = ua.match(/Android ([\d.]+)/)
    return match?.[1] ? `Android ${match[1]}` : 'Android'
  }
  if (/iPhone OS/.test(ua) || /iPad OS/.test(ua)) {
    const match = ua.match(/OS (\d+[_\d]*)/)
    const version = match?.[1]?.replace(/_/g, '.')
    return version ? `iOS ${version}` : 'iOS'
  }
  if (/Mac OS X/.test(ua)) {
    const match = ua.match(/Mac OS X (\d+[_\d]*)/)
    const version = match?.[1]?.replace(/_/g, '.')
    return version ? `macOS ${version}` : 'macOS'
  }
  if (/Linux/.test(ua)) {
    return platform ? `${platform}` : 'Linux'
  }
  return platform ?? 'Unknown'
}

export default function BgmQuizPage() {
  const t = useTranslations('bgm-quiz')
  const tracks = useMemo(() => getBgmTracks(), [])
  const searchParams = useSearchParams()

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
  const [onlineRoomStatus, setOnlineRoomStatus] = useState<'lobby' | 'playing' | 'finished' | null>(null)
  const [onlineHostPlayerId, setOnlineHostPlayerId] = useState<string | null>(null)
  const [onlinePlayerName, setOnlinePlayerName] = useState('')
  const [onlinePlayerId, setOnlinePlayerId] = useState<string | null>(null)
  const [onlineQuestion, setOnlineQuestion] = useState<OnlineQuestion | null>(null)
  const [onlinePlayers, setOnlinePlayers] = useState<Array<{ player_id: string; display_name: string; score: number }>>(
    [],
  )
  const [onlineTotalQuestions, setOnlineTotalQuestions] = useState<number | null>(null)
  const [onlinePresence, setOnlinePresence] = useState<Record<string, boolean>>({})
  const [onlineError, setOnlineError] = useState<string | null>(null)
  const [onlineLoading, setOnlineLoading] = useState(false)
  const [onlineShareCopied, setOnlineShareCopied] = useState(false)
  const [osInfo, setOsInfo] = useState<string | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)

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
  const isHost = Boolean(onlinePlayerId && onlineHostPlayerId && onlinePlayerId === onlineHostPlayerId)
  const canAdvanceOnline = Boolean(isHost && onlineQuestion?.isSolved && onlineRoomStatus === 'playing')
  const onlineShareUrl = useMemo(() => {
    if (!onlineRoomCode || typeof window === 'undefined') return null
    return `${window.location.origin}/minigames/bgm-quiz?room=${onlineRoomCode}`
  }, [onlineRoomCode])
  const onlineWinnerName = useMemo(() => {
    if (!onlineQuestion?.winnerPlayerId) return null
    return onlinePlayers.find((player) => player.player_id === onlineQuestion.winnerPlayerId)?.display_name ?? null
  }, [onlinePlayers, onlineQuestion?.winnerPlayerId])
  const formatSeconds = (value: number | null | undefined) => (typeof value === 'number' ? value.toFixed(2) : '--')

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
    setOsInfo(detectOsInfo())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem('bgmQuizOnlineSession')
    if (!saved) {
      setSessionLoaded(true)
      return
    }
    try {
      const parsed = JSON.parse(saved) as { roomCode?: string; playerId?: string; displayName?: string }
      if (parsed.roomCode) {
        setIsOnline(true)
        setRoomCodeInput(parsed.roomCode)
        setOnlineRoomCode(parsed.roomCode)
      }
      if (parsed.playerId) {
        setOnlinePlayerId(parsed.playerId)
      }
      if (parsed.displayName) {
        setOnlinePlayerName(parsed.displayName)
      }
    } catch {
      window.localStorage.removeItem('bgmQuizOnlineSession')
    } finally {
      setSessionLoaded(true)
    }
  }, [])

  useEffect(() => {
    const roomFromUrl = searchParams.get('room')
    if (!roomFromUrl) return
    setIsOnline(true)
    setRoomCodeInput(roomFromUrl.toUpperCase())
  }, [searchParams])

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
    setOnlineRoomStatus(null)
    setOnlineHostPlayerId(null)
    setOnlinePlayerId(null)
    setOnlineQuestion(null)
    setOnlinePlayers([])
    setOnlineTotalQuestions(null)
    setOnlinePresence({})
    setOnlineError(null)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('bgmQuizOnlineSession')
    }
  }, [isOnline])

  useEffect(() => {
    setOnlineShareCopied(false)
  }, [onlineRoomCode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!onlineRoomCode || !onlinePlayerId) return
    const payload = JSON.stringify({
      roomCode: onlineRoomCode,
      playerId: onlinePlayerId,
      displayName: onlinePlayerName,
    })
    window.localStorage.setItem('bgmQuizOnlineSession', payload)
  }, [onlinePlayerId, onlinePlayerName, onlineRoomCode])

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

  const fetchOnlineQuestion = useCallback(async (roomCode: string, index: number) => {
    const response = await fetch(`/api/bgm-quiz/rooms/${roomCode}/question?index=${index}`)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error ?? '問題の取得に失敗しました。')
    }
    return data.question as OnlineQuestion
  }, [])

  const fetchOnlineRoomStatus = useCallback(
    async (roomCode: string) => {
      const { data } = await supabase
        .from('bgm_quiz_rooms')
        .select('status,current_index,host_player_id,total_questions')
        .eq('room_code', roomCode)
        .maybeSingle()
      if (!data) return
      setOnlineRoomStatus(data.status)
      setOnlineHostPlayerId(data.host_player_id)
      setOnlineTotalQuestions(data.total_questions)
      setCurrentIndex(data.current_index)
      if (data.status === 'finished') {
        setPhase('result')
        return
      }
      if (data.status === 'lobby') {
        setPhase('lobby')
        setOnlineQuestion(null)
        return
      }
      setPhase('playing')
      try {
        const question = await fetchOnlineQuestion(roomCode, data.current_index)
        setOnlineQuestion(question)
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : '問題の取得に失敗しました。')
      }
    },
    [fetchOnlineQuestion, supabase],
  )

  const fetchOnlinePlayers = useCallback(
    async (roomCode: string) => {
      const { data } = await supabase
        .from('bgm_quiz_players')
        .select('player_id,display_name,score')
        .eq('room_code', roomCode)
        .order('created_at', { ascending: true })
      setOnlinePlayers(data ?? [])
    },
    [supabase],
  )

  useEffect(() => {
    if (!onlineRoomCode || !onlinePlayerId) return
    const roomCode = onlineRoomCode

    const channel = supabase.channel(`bgm-quiz-room-${roomCode}`, {
      config: {
        presence: { key: onlinePlayerId },
      },
    })

    const syncPresence = () => {
      const state = channel.presenceState()
      const onlineIds = new Set<string>()
      Object.values(state).forEach((presences) => {
        presences.forEach((presence) => {
          if (typeof presence === 'object' && presence && 'player_id' in presence) {
            onlineIds.add(String(presence.player_id))
          }
        })
      })
      const nextPresence: Record<string, boolean> = {}
      onlineIds.forEach((id) => {
        nextPresence[id] = true
      })
      setOnlinePresence(nextPresence)
    }

    channel.on('presence', { event: 'sync' }, syncPresence)
    channel.on('presence', { event: 'join' }, syncPresence)
    channel.on('presence', { event: 'leave' }, syncPresence)

    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'bgm_quiz_rooms',
        filter: `room_code=eq.${roomCode}`,
      },
      async (payload) => {
        const updatedIndex = payload.new.current_index as number
        const status = payload.new.status as 'playing' | 'finished' | 'lobby'
        setCurrentIndex(updatedIndex)
        setOnlineRoomStatus(status)
        if (status === 'finished') {
          setPhase('result')
          return
        }
        if (status === 'lobby') {
          setPhase('lobby')
          setOnlineQuestion(null)
          return
        }
        setPhase('playing')
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

    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'bgm_quiz_questions_public',
        filter: `room_code=eq.${roomCode}`,
      },
      (payload) => {
        const updated = payload.new as { question_index: number; is_solved: boolean; winner_player_id: string | null }
        setOnlineQuestion((prev) => {
          if (!prev || prev.questionIndex !== updated.question_index) return prev
          return { ...prev, isSolved: updated.is_solved, winnerPlayerId: updated.winner_player_id }
        })
      },
    )

    channel.on(
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

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.track({
          player_id: onlinePlayerId,
          display_name: onlinePlayerName || 'ゲスト',
        })
      }
    })

    void fetchOnlinePlayers(roomCode)

    return () => {
      supabase.removeChannel(channel)
    }
  }, [
    fetchOnlinePlayers,
    fetchOnlineQuestion,
    gameType,
    onlinePlayerId,
    onlinePlayerName,
    onlineRoomCode,
    supabase,
  ])

  useEffect(() => {
    if (!onlineRoomCode || !sessionLoaded) return
    void fetchOnlinePlayers(onlineRoomCode)
    void fetchOnlineRoomStatus(onlineRoomCode)
    const intervalId = window.setInterval(() => {
      void fetchOnlinePlayers(onlineRoomCode)
      void fetchOnlineRoomStatus(onlineRoomCode)
    }, 4000)
    return () => window.clearInterval(intervalId)
  }, [fetchOnlinePlayers, fetchOnlineRoomStatus, onlineRoomCode, sessionLoaded])

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
      setOnlineHostPlayerId(data.hostPlayerId ?? null)
      setOnlineTotalQuestions(data.totalQuestions)
      setCurrentIndex(data.currentIndex)
      setOnlineRoomStatus(data.status ?? 'lobby')
      setOnlineQuestion(data.question ?? null)
      setPhase(data.status === 'playing' ? 'playing' : 'lobby')
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
        body: JSON.stringify({ displayName: onlinePlayerName, playerId: onlinePlayerId ?? undefined }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error ?? 'ルーム参加に失敗しました。')
      }
      setOnlineRoomCode(data.roomCode)
      setOnlinePlayerId(data.playerId)
      setOnlineHostPlayerId(data.hostPlayerId ?? null)
      setOnlineTotalQuestions(data.totalQuestions)
      setCurrentIndex(data.currentIndex)
      setOnlineRoomStatus(data.status ?? 'lobby')
      setOnlineQuestion(data.question ?? null)
      setPhase(data.status === 'playing' ? 'playing' : 'lobby')
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

  const startOnlineMatch = async () => {
    if (!onlineRoomCode || !onlinePlayerId || onlineLoading) return
    setOnlineLoading(true)
    setOnlineError(null)
    try {
      const response = await fetch(`/api/bgm-quiz/rooms/${onlineRoomCode}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: onlinePlayerId }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error ?? '対戦開始に失敗しました。')
      }
      setOnlineRoomStatus(data.status)
      setCurrentIndex(data.currentIndex)
      setOnlineQuestion(data.question ?? null)
      setPhase('playing')
      setAnswerState(null)
      setSelectedIndex(null)
      setHasStopped(gameType !== 'fast')
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : '対戦開始に失敗しました。')
    } finally {
      setOnlineLoading(false)
    }
  }

  const advanceOnlineQuestion = async () => {
    if (!onlineRoomCode || !onlinePlayerId || onlineLoading) return
    setOnlineLoading(true)
    setOnlineError(null)
    try {
      const response = await fetch(`/api/bgm-quiz/rooms/${onlineRoomCode}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: onlinePlayerId }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error ?? '次の問題へ進めませんでした。')
      }
      setOnlineRoomStatus(data.status)
      setCurrentIndex(data.currentIndex)
      setOnlineQuestion(data.question ?? null)
      setAnswerState(null)
      setSelectedIndex(null)
      setHasStopped(gameType !== 'fast')
      if (data.status === 'finished') {
        setPhase('result')
      }
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : '次の問題へ進めませんでした。')
    } finally {
      setOnlineLoading(false)
    }
  }

  const kickOnlinePlayer = async (targetPlayerId: string) => {
    if (!onlineRoomCode || !onlinePlayerId || onlineLoading) return
    setOnlineLoading(true)
    setOnlineError(null)
    try {
      const response = await fetch(`/api/bgm-quiz/rooms/${onlineRoomCode}/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: onlinePlayerId, targetPlayerId }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error ?? '退出処理に失敗しました。')
      }
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : '退出処理に失敗しました。')
    } finally {
      setOnlineLoading(false)
    }
  }

  const copyOnlineShareLink = async () => {
    if (!onlineShareUrl) return
    try {
      await navigator.clipboard.writeText(onlineShareUrl)
      setOnlineShareCopied(true)
    } catch {
      setOnlineError(t('onlineShareCopyFailed'))
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

  const onlinePlayerList = isOnline ? (
    <ul className="flex flex-wrap gap-2">
      {onlinePlayers.map((player) => {
        const isPlayerOnline = Boolean(onlinePresence[player.player_id])
        const isPlayerHost = player.player_id === onlineHostPlayerId
        return (
          <li
            key={player.player_id}
            className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700"
          >
            <span
              className={`h-2 w-2 rounded-full ${isPlayerOnline ? 'bg-emerald-500' : 'bg-gray-400'}`}
              aria-label={isPlayerOnline ? t('onlineStatusOnline') : t('onlineStatusOffline')}
            />
            <span className="font-medium">{player.display_name}</span>
            {isPlayerHost && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                {t('onlineHostBadge')}
              </span>
            )}
            {phase === 'playing' && (
              <span className="text-[10px] text-gray-500">{t('onlineScoreBadge', { score: player.score })}</span>
            )}
            {!isPlayerOnline && (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                {t('onlineStatusOffline')}
              </span>
            )}
            {isHost && !isPlayerHost && (
              <button
                type="button"
                onClick={() => kickOnlinePlayer(player.player_id)}
                className="rounded-full border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-50"
              >
                {t('onlineKick')}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  ) : null

  return (
    <>
      <main className="p-4 pb-20 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-gray-600">{t('description')}</p>
          {osInfo && <p className="text-xs text-gray-500">{t('osInfo', { os: osInfo })}</p>}
        </div>

        {(phase === 'playing' || phase === 'result') && totalQuestions > 0 && (
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

        {phase === 'lobby' && isOnline && (
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-gray-900">{t('onlineLobbyTitle')}</h2>
              <p className="text-sm text-gray-600">{t('onlineLobbyDescription')}</p>
            </div>
            {onlineRoomCode && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                <p className="font-semibold">{t('onlineRoomCreated', { code: onlineRoomCode })}</p>
                {onlineShareUrl && (
                  <div className="mt-2 space-y-2">
                    <label className="block text-xs text-gray-500">{t('onlineShareLabel')}</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={onlineShareUrl}
                        readOnly
                        className="w-full flex-1 rounded-md border border-gray-300 px-3 py-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={copyOnlineShareLink}
                        className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        {onlineShareCopied ? t('onlineShareCopied') : t('onlineShareCopy')}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">{t('onlineShareHint')}</p>
                  </div>
                )}
              </div>
            )}
            {onlinePlayers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('onlinePlayerList')}
                </p>
                {onlinePlayerList}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {isHost ? (
                <button
                  type="button"
                  onClick={startOnlineMatch}
                  disabled={onlineLoading}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {t('onlineStartMatch')}
                </button>
              ) : (
                <p className="text-sm text-gray-600">{t('onlineWaitingHost')}</p>
              )}
            </div>
            {onlineError && <p className="text-xs text-red-600">{onlineError}</p>}
          </section>
        )}

        {phase === 'playing' && activeQuestion && activeTrack && (
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            {isOnline && onlinePlayers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('onlinePlayerList')}
                </p>
                {onlinePlayerList}
              </div>
            )}
            {isOnline && onlineShareUrl && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>{t('onlineShareLabel')}</span>
                <button
                  type="button"
                  onClick={copyOnlineShareLink}
                  className="rounded-full border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-50"
                >
                  {onlineShareCopied ? t('onlineShareCopied') : t('onlineShareCopy')}
                </button>
              </div>
            )}
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
                    start: typeof randomStart === 'number' ? randomStart.toFixed(1) : '-',
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
                          time: formatSeconds(currentFastStopTime),
                        })
                      : t('fastRunning', { time: formatSeconds(fastElapsed) })}
                  </span>
                </div>
              )}
            </div>

            {isOnline && onlineQuestion?.isSolved && (
              <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-700">
                {onlineWinnerName
                  ? t('onlineSolvedBy', { name: onlineWinnerName })
                  : t('onlineSolved')}
              </div>
            )}

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
              {isOnline ? (
                isHost ? (
                  <button
                    type="button"
                    onClick={advanceOnlineQuestion}
                    disabled={!canAdvanceOnline || onlineLoading}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {isLastQuestion ? t('resultTitle') : t('next')}
                  </button>
                ) : (
                  <span className="inline-flex items-center rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600">
                    {t('onlineWaitingNext')}
                  </span>
                )
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!isAnswered}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {isLastQuestion ? t('resultTitle') : t('next')}
                </button>
              )}
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
