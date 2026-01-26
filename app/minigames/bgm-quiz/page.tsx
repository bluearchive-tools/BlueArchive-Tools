'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Footer from '../../../components/Footer'
import { useTranslations } from 'next-intl'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { toPng } from 'html-to-image'
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
type OnlinePlayer = {
  player_id: string
  display_name: string
  score: number
  is_waiting: boolean
  ready_question_index: number | null
}
type OnlineStatsPlayer = {
  playerId: string
  displayName: string
  score: number
  correctCount: number
  accuracy: number
  averageStopTime: number | null
  averageAnswerTime: number | null
}
type OnlineStats = {
  totalQuestions: number
  players: OnlineStatsPlayer[]
}
type OnlineAction =
  | 'create'
  | 'join'
  | 'start'
  | 'advance'
  | 'kick'
  | 'answer'
  | 'settings'
  | 'reset'
  | 'share'

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
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([])
  const [onlineTotalQuestions, setOnlineTotalQuestions] = useState<number | null>(null)
  const [onlinePresence, setOnlinePresence] = useState<Record<string, boolean>>({})
  const [onlineError, setOnlineError] = useState<string | null>(null)
  const [onlineLoading, setOnlineLoading] = useState(false)
  const [onlineAction, setOnlineAction] = useState<OnlineAction | null>(null)
  const [onlineAnswerIndex, setOnlineAnswerIndex] = useState<number | null>(null)
  const [onlineShareCopied, setOnlineShareCopied] = useState(false)
  const [osInfo, setOsInfo] = useState<string | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [lastReadyIndex, setLastReadyIndex] = useState<number | null>(null)
  const [onlineStats, setOnlineStats] = useState<OnlineStats | null>(null)
  const [onlineStatsLoading, setOnlineStatsLoading] = useState(false)
  const [onlineStatsError, setOnlineStatsError] = useState<string | null>(null)
  const [showOnlineStats, setShowOnlineStats] = useState(false)
  const [hasEditedOnlineSettings, setHasEditedOnlineSettings] = useState(false)
  const [onlineJoinMode, setOnlineJoinMode] = useState(false)
  const [pendingAutoJoin, setPendingAutoJoin] = useState(false)

  const supabase = useSupabaseClient()

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stopTimerRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const fastTimerRef = useRef<number | null>(null)
  const statsRef = useRef<HTMLDivElement | null>(null)
  const settingsUpdateTimerRef = useRef<number | null>(null)

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
  const currentOnlinePlayer = useMemo(
    () => onlinePlayers.find((player) => player.player_id === onlinePlayerId) ?? null,
    [onlinePlayers, onlinePlayerId],
  )
  const isCurrentPlayerWaiting = Boolean(currentOnlinePlayer?.is_waiting)
  const activeOnlinePlayers = useMemo(
    () => onlinePlayers.filter((player) => !player.is_waiting),
    [onlinePlayers],
  )
  const allOnlineReady =
    isOnline &&
    phase === 'playing' &&
    activeOnlinePlayers.length > 0 &&
    activeOnlinePlayers.every((player) => player.ready_question_index === currentIndex)
  const isOnlineAnswerLocked = isOnline && (isCurrentPlayerWaiting || !allOnlineReady || onlineAction === 'answer')
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
      if (settingsUpdateTimerRef.current) {
        window.clearTimeout(settingsUpdateTimerRef.current)
        settingsUpdateTimerRef.current = null
      }
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
    setOnlineJoinMode(false)
    setPendingAutoJoin(true)
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
    setOnlineAction(null)
    setOnlineAnswerIndex(null)
    setLastReadyIndex(null)
    setOnlineStats(null)
    setOnlineStatsError(null)
    setShowOnlineStats(false)
    setHasEditedOnlineSettings(false)
    setOnlineJoinMode(false)
    setPendingAutoJoin(false)
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

  const fetchOnlinePlayers = useCallback(
    async (roomCode: string) => {
      const { data } = await supabase
        .from('bgm_quiz_players')
        .select('player_id,display_name,score,is_waiting,ready_question_index')
        .eq('room_code', roomCode)
        .order('created_at', { ascending: true })
      setOnlinePlayers(
        (data ?? []).map((player) => ({
          ...player,
          is_waiting: Boolean(player.is_waiting),
          ready_question_index: player.ready_question_index ?? null,
        })),
      )
    },
    [supabase],
  )

  const joinOnlineRoom = useCallback(async () => {
    if (!roomCodeInput.trim() || onlineLoading) return
    setOnlineLoading(true)
    setOnlineAction('join')
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
      if (data.category) {
        setSelectedCategory(data.category)
      }
      setExcludeUntitledThemes(Boolean(data.excludeUntitledThemes))
      if (data.totalQuestions) {
        setQuestionCount(data.totalQuestions)
      }
      if (data.gameType) {
        setGameType(data.gameType as GameType)
      }
      if (typeof data.introSeconds === 'number') {
        setIntroSeconds(data.introSeconds)
      }
      if (typeof data.randomSeconds === 'number') {
        setRandomSeconds(data.randomSeconds)
      }
      setPhase(data.status === 'playing' ? 'playing' : 'lobby')
      setAnswerState(null)
      setSelectedIndex(null)
      setHasStopped(gameType !== 'fast')
      await fetchOnlinePlayers(data.roomCode)
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'ルーム参加に失敗しました。')
      setOnlineJoinMode(true)
    } finally {
      setOnlineLoading(false)
      setOnlineAction(null)
    }
  }, [
    fetchOnlinePlayers,
    gameType,
    onlineLoading,
    onlinePlayerId,
    onlinePlayerName,
    roomCodeInput,
  ])

  useEffect(() => {
    if (!pendingAutoJoin || !isOnline) return
    if (!roomCodeInput.trim()) return
    if (onlineRoomCode) {
      setPendingAutoJoin(false)
      return
    }
    if (!sessionLoaded) return
    void joinOnlineRoom().finally(() => setPendingAutoJoin(false))
  }, [isOnline, joinOnlineRoom, onlineRoomCode, pendingAutoJoin, roomCodeInput, sessionLoaded])

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
    if (!isOnline) return
    if (mode !== 'list-select') return
    if (!onlineQuestion) return
    setAnswerOptions(onlineQuestion.choices)
  }, [isOnline, mode, onlineQuestion])

  useEffect(() => {
    if (!isOnline || phase !== 'playing') return
    setLastReadyIndex(null)
  }, [currentIndex, isOnline, phase])

  useEffect(() => {
    if (!isOnline || phase !== 'playing') return
    if (!allOnlineReady) return
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) return
    audio.play().catch(() => null)
  }, [allOnlineReady, currentIndex, isOnline, phase])

  useEffect(() => {
    if (!onlineRoomCode || !onlinePlayerId) return
    const sendHeartbeat = async () => {
      try {
        await fetch(`/api/bgm-quiz/rooms/${onlineRoomCode}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: onlinePlayerId }),
        })
      } catch {
        // ignore heartbeat errors
      }
    }
    void sendHeartbeat()
    const intervalId = window.setInterval(sendHeartbeat, 30000)
    return () => window.clearInterval(intervalId)
  }, [onlinePlayerId, onlineRoomCode])

  const fetchOnlineQuestion = useCallback(async (roomCode: string, index: number) => {
    const response = await fetch(`/api/bgm-quiz/rooms/${roomCode}/question?index=${index}`)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error ?? '問題の取得に失敗しました。')
    }
    return data.question as OnlineQuestion
  }, [])

  const markOnlineReady = useCallback(
    async (questionIndex: number) => {
      if (!onlineRoomCode || !onlinePlayerId) return
      if (lastReadyIndex === questionIndex) return
      setLastReadyIndex(questionIndex)
      try {
        await fetch(`/api/bgm-quiz/rooms/${onlineRoomCode}/ready`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: onlinePlayerId, questionIndex }),
        })
      } catch {
        // ignore ready errors
      }
    },
    [lastReadyIndex, onlinePlayerId, onlineRoomCode],
  )

  const fetchOnlineRoomStatus = useCallback(
    async (roomCode: string) => {
      const { data } = await supabase
        .from('bgm_quiz_rooms')
        .select(
          'status,current_index,host_player_id,total_questions,category,exclude_untitled,game_type,intro_seconds,random_seconds',
        )
        .eq('room_code', roomCode)
        .maybeSingle()
      if (!data) return
      const isHostPlayer = onlinePlayerId && data.host_player_id === onlinePlayerId
      setOnlineRoomStatus(data.status)
      setOnlineHostPlayerId(data.host_player_id)
      setOnlineTotalQuestions(data.total_questions)
      setCurrentIndex(data.current_index)
      if (!isHostPlayer || data.status !== 'lobby' || !hasEditedOnlineSettings) {
        setSelectedCategory(data.category ?? 'all')
        setExcludeUntitledThemes(Boolean(data.exclude_untitled))
        setQuestionCount(data.total_questions)
        setGameType((data.game_type as GameType) ?? 'fast')
        if (typeof data.intro_seconds === 'number') {
          setIntroSeconds(data.intro_seconds)
        }
        if (typeof data.random_seconds === 'number') {
          setRandomSeconds(data.random_seconds)
        }
      }
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
    [fetchOnlineQuestion, hasEditedOnlineSettings, onlinePlayerId, supabase],
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
        const gameTypeValue = (payload.new.game_type as GameType | undefined) ?? 'fast'
        const categoryValue = (payload.new.category as string | undefined) ?? 'all'
        const excludeUntitledValue = Boolean(payload.new.exclude_untitled)
        const introSecondsValue = payload.new.intro_seconds as number | null
        const randomSecondsValue = payload.new.random_seconds as number | null
        const totalQuestionsValue = payload.new.total_questions as number | null
        const hostPlayerIdValue = payload.new.host_player_id as string | null
        const isHostPlayer = onlinePlayerId && hostPlayerIdValue === onlinePlayerId
        setCurrentIndex(updatedIndex)
        setOnlineRoomStatus(status)
        if (!isHostPlayer || status !== 'lobby' || !hasEditedOnlineSettings) {
          setSelectedCategory(categoryValue)
          setExcludeUntitledThemes(excludeUntitledValue)
          if (totalQuestionsValue) {
            setQuestionCount(totalQuestionsValue)
            setOnlineTotalQuestions(totalQuestionsValue)
          }
          setGameType(gameTypeValue)
          if (typeof introSecondsValue === 'number') {
            setIntroSeconds(introSecondsValue)
          }
          if (typeof randomSecondsValue === 'number') {
            setRandomSeconds(randomSecondsValue)
          }
        }
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
          setAnswerInput('')
          setListSelection('')
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
    hasEditedOnlineSettings,
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

  useEffect(() => {
    if (phase !== 'lobby') {
      setHasEditedOnlineSettings(false)
    }
  }, [phase])

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
    setOnlineAction('create')
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
          introSeconds,
          randomSeconds,
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
      if (data.category) {
        setSelectedCategory(data.category)
      }
      setExcludeUntitledThemes(Boolean(data.excludeUntitledThemes))
      if (data.totalQuestions) {
        setQuestionCount(data.totalQuestions)
      }
      if (data.gameType) {
        setGameType(data.gameType as GameType)
      }
      if (typeof data.introSeconds === 'number') {
        setIntroSeconds(data.introSeconds)
      }
      if (typeof data.randomSeconds === 'number') {
        setRandomSeconds(data.randomSeconds)
      }
      setPhase(data.status === 'playing' ? 'playing' : 'lobby')
      setAnswerState(null)
      setSelectedIndex(null)
      setHasStopped(gameType !== 'fast')
      await fetchOnlinePlayers(data.roomCode)
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'ルーム作成に失敗しました。')
    } finally {
      setOnlineLoading(false)
      setOnlineAction(null)
    }
  }

  const startOnlineMatch = async () => {
    if (!onlineRoomCode || !onlinePlayerId || onlineLoading) return
    setOnlineLoading(true)
    setOnlineAction('start')
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
      setOnlineAction(null)
    }
  }

  const advanceOnlineQuestion = async () => {
    if (!onlineRoomCode || !onlinePlayerId || onlineLoading) return
    setOnlineLoading(true)
    setOnlineAction('advance')
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
      setOnlineAction(null)
    }
  }

  const kickOnlinePlayer = async (targetPlayerId: string) => {
    if (!onlineRoomCode || !onlinePlayerId || onlineLoading) return
    setOnlineLoading(true)
    setOnlineAction('kick')
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
      setOnlineAction(null)
    }
  }

  const copyOnlineShareLink = async () => {
    if (!onlineShareUrl) return
    setOnlineAction('share')
    try {
      await navigator.clipboard.writeText(onlineShareUrl)
      setOnlineShareCopied(true)
    } catch {
      setOnlineError(t('onlineShareCopyFailed'))
    } finally {
      setOnlineAction(null)
    }
  }

  const submitOnlineAnswer = async (payload: { choiceIndex?: number; answerText?: string }) => {
    if (!onlineRoomCode || !onlinePlayerId) return
    if (isCurrentPlayerWaiting) return
    setOnlineAction('answer')
    if (typeof payload.choiceIndex === 'number') {
      setOnlineAnswerIndex(payload.choiceIndex)
    }
    try {
      const response = await fetch(`/api/bgm-quiz/rooms/${onlineRoomCode}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: onlinePlayerId,
          choiceIndex: payload.choiceIndex,
          answerText: payload.answerText,
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
    } finally {
      setOnlineAction(null)
      setOnlineAnswerIndex(null)
    }
  }

  const updateOnlineSettings = async () => {
    if (!onlineRoomCode || !onlinePlayerId || !isHost || onlineLoading || onlineRoomStatus !== 'lobby') return
    setOnlineLoading(true)
    setOnlineAction('settings')
    setOnlineError(null)
    try {
      const response = await fetch(`/api/bgm-quiz/rooms/${onlineRoomCode}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: onlinePlayerId,
          category: selectedCategory,
          questionCount,
          excludeUntitledThemes,
          gameType,
          introSeconds,
          randomSeconds,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error ?? '設定の更新に失敗しました。')
      }
      setOnlineRoomStatus(data.status ?? 'lobby')
      setOnlineTotalQuestions(data.totalQuestions ?? null)
      setCurrentIndex(0)
      setOnlineQuestion(null)
      setPhase('lobby')
      setAnswerState(null)
      setSelectedIndex(null)
      setHasStopped(gameType !== 'fast')
      await fetchOnlinePlayers(onlineRoomCode)
      setHasEditedOnlineSettings(false)
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : '設定の更新に失敗しました。')
    } finally {
      setOnlineLoading(false)
      setOnlineAction(null)
    }
  }

  const resetOnlineRoom = async () => {
    if (!onlineRoomCode || !onlinePlayerId || onlineLoading) return
    setOnlineLoading(true)
    setOnlineAction('reset')
    setOnlineError(null)
    try {
      const response = await fetch(`/api/bgm-quiz/rooms/${onlineRoomCode}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: onlinePlayerId }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error ?? 'ロビーに戻れませんでした。')
      }
      setOnlineRoomStatus(data.status ?? 'lobby')
      setOnlineTotalQuestions(data.totalQuestions ?? null)
      setCurrentIndex(0)
      setOnlineQuestion(null)
      setPhase('lobby')
      setAnswerState(null)
      setSelectedIndex(null)
      setHasStopped(gameType !== 'fast')
      await fetchOnlinePlayers(onlineRoomCode)
      setHasEditedOnlineSettings(false)
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'ロビーに戻れませんでした。')
    } finally {
      setOnlineLoading(false)
      setOnlineAction(null)
    }
  }

  const fetchOnlineStats = useCallback(async () => {
    if (!onlineRoomCode) return
    setOnlineStatsLoading(true)
    setOnlineStatsError(null)
    try {
      const response = await fetch(`/api/bgm-quiz/rooms/${onlineRoomCode}/stats`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error ?? '統計の取得に失敗しました。')
      }
      setOnlineStats(data as OnlineStats)
    } catch (error) {
      setOnlineStatsError(error instanceof Error ? error.message : '統計の取得に失敗しました。')
    } finally {
      setOnlineStatsLoading(false)
    }
  }, [onlineRoomCode])

  const openOnlineStats = async () => {
    setShowOnlineStats(true)
    if (!onlineStats && !onlineStatsLoading) {
      await fetchOnlineStats()
    }
  }

  const buildStatsImage = async () => {
    if (!statsRef.current) return null
    return toPng(statsRef.current, { cacheBust: true, pixelRatio: 2 })
  }

  const downloadStatsImage = async () => {
    const dataUrl = await buildStatsImage()
    if (!dataUrl) return
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `bgm-quiz-stats-${onlineRoomCode ?? 'room'}.png`
    link.click()
  }

  const shareStatsImage = async () => {
    const dataUrl = await buildStatsImage()
    if (!dataUrl) return
    const blob = await (await fetch(dataUrl)).blob()
    const file = new File([blob], `bgm-quiz-stats-${onlineRoomCode ?? 'room'}.png`, {
      type: 'image/png',
    })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: t('onlineStatsTitle'),
        text: t('onlineStatsShareText'),
      })
      return
    }
    await downloadStatsImage()
  }

  const handleSelect = (index: number) => {
    if (isAnswered || phase !== 'playing' || !canAnswer) return
    if (isOnline && isOnlineAnswerLocked) return
    setSelectedIndex(index)
    if (gameType === 'fast') {
      recordFastAnswerTime()
    }
    if (isOnline) {
      void submitOnlineAnswer({ choiceIndex: index })
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
    if (isOnline && isOnlineAnswerLocked) return
    const value = mode === 'list-select' ? listSelection : answerInput
    if (gameType === 'fast') {
      recordFastAnswerTime()
    }
    if (isOnline) {
      if (!value.trim()) return
      void submitOnlineAnswer({ answerText: value })
      return
    }
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
    if (isOnline) {
      void resetOnlineRoom()
      return
    }
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

  const handleAudioReady = () => {
    if (!isOnline) return
    void markOnlineReady(currentIndex)
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

  const queueOnlineSettingsUpdate = () => {
    if (!isOnline || phase !== 'lobby' || !isHost || onlineRoomStatus !== 'lobby') return
    setHasEditedOnlineSettings(true)
    if (settingsUpdateTimerRef.current) {
      window.clearTimeout(settingsUpdateTimerRef.current)
    }
    settingsUpdateTimerRef.current = window.setTimeout(() => {
      void updateOnlineSettings()
    }, 600)
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
            {player.is_waiting && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                {t('onlineWaitingBadge')}
              </span>
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
                disabled={onlineLoading}
                className="rounded-full border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-1">
                  {onlineAction === 'kick' && (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                  )}
                  {t('onlineKick')}
                </span>
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
                      disabled={false}
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
                      disabled={gameType === 'fast'}
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
                      disabled={gameType === 'fast'}
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
                    {onlineJoinMode && !pendingAutoJoin && (
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
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOnlineJoinMode(false)
                          setRoomCodeInput('')
                          void createOnlineRoom()
                        }}
                        disabled={onlineLoading || pendingAutoJoin}
                        className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        <span className="inline-flex items-center gap-2">
                          {onlineAction === 'create' && (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          )}
                          {t('onlineCreate')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!onlineJoinMode) {
                            setOnlineJoinMode(true)
                            return
                          }
                          void joinOnlineRoom()
                        }}
                        disabled={(onlineJoinMode && !roomCodeInput.trim()) || onlineLoading || pendingAutoJoin}
                        className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        <span className="inline-flex items-center gap-2">
                          {onlineAction === 'join' && (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          )}
                          {t('onlineJoin')}
                        </span>
                      </button>
                    </div>
                    {pendingAutoJoin && <p className="text-xs text-gray-500">{t('onlineAutoJoining')}</p>}
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
                  disabled={false}
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
                        disabled={onlineAction === 'share'}
                        className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        <span className="inline-flex items-center gap-2">
                          {onlineAction === 'share' && (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          )}
                          {onlineShareCopied ? t('onlineShareCopied') : t('onlineShareCopy')}
                        </span>
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
            <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <div className="space-y-1">
                <p className="font-semibold">{t('onlineSettingsTitle')}</p>
                <p className="text-xs text-gray-500">{t('onlineSettingsDescription')}</p>
                {!isHost && <p className="text-xs text-gray-500">{t('onlineSettingsGuestNote')}</p>}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs text-gray-600">
                  <span className="font-medium">{t('categoryLabel')}</span>
                  <select
                    value={selectedCategory}
                    onChange={(event) => {
                      setSelectedCategory(event.target.value)
                      queueOnlineSettingsUpdate()
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    disabled={!isHost || onlineLoading}
                  >
                    <option value="all">{t('categoryAll')}</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-gray-600">
                  <span className="font-medium">{t('questionCountLabel')}</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, availableTracks.length)}
                    value={questionCount}
                    onChange={(event) => {
                      setQuestionCount(Number(event.target.value))
                      queueOnlineSettingsUpdate()
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    disabled={!isHost || onlineLoading}
                  />
                </label>
                <label className="space-y-1 text-xs text-gray-600">
                  <span className="font-medium">{t('gameTypeLabel')}</span>
                  <select
                    value={gameType}
                    onChange={(event) => {
                      setGameType(event.target.value as GameType)
                      queueOnlineSettingsUpdate()
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    disabled={!isHost || onlineLoading}
                  >
                    <option value="normal">{t('gameTypeNormal')}</option>
                    <option value="fast">{t('gameTypeFast')}</option>
                    <option value="intro">{t('gameTypeIntro')}</option>
                    <option value="random">{t('gameTypeRandom')}</option>
                  </select>
                </label>
                {(gameType === 'intro' || gameType === 'random') && (
                  <label className="space-y-1 text-xs text-gray-600">
                    <span className="font-medium">
                      {gameType === 'intro' ? t('introSecondsLabel') : t('randomSecondsLabel')}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={gameType === 'intro' ? introSeconds : randomSeconds}
                      onChange={(event) => {
                        if (gameType === 'intro') {
                          setIntroSeconds(Number(event.target.value))
                        } else {
                          setRandomSeconds(Number(event.target.value))
                        }
                        queueOnlineSettingsUpdate()
                      }}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      disabled={!isHost || onlineLoading}
                    />
                  </label>
                )}
                <label className="flex items-start gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={excludeUntitledThemes}
                    onChange={(event) => {
                      setExcludeUntitledThemes(event.target.checked)
                      queueOnlineSettingsUpdate()
                    }}
                    className="mt-1"
                    disabled={!isHost || onlineLoading}
                  />
                  <span>
                    <span className="font-medium">{t('excludeThemeLabel')}</span>
                    <span className="block text-[10px] text-gray-500">{t('excludeThemeHint')}</span>
                  </span>
                </label>
              </div>
              {isHost && onlineAction === 'settings' && (
                <p className="text-xs text-gray-500">{t('onlineSettingsSaving')}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isHost ? (
                <button
                  type="button"
                  onClick={startOnlineMatch}
                  disabled={onlineLoading}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  <span className="inline-flex items-center gap-2">
                    {onlineAction === 'start' && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    {t('onlineStartMatch')}
                  </span>
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
                  disabled={onlineAction === 'share'}
                  className="rounded-full border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-1">
                    {onlineAction === 'share' && (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-transparent" />
                    )}
                    {onlineShareCopied ? t('onlineShareCopied') : t('onlineShareCopy')}
                  </span>
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
                  autoPlay={!isOnline || allOnlineReady}
                  className="w-full"
                  ref={audioRef}
                  onPlay={handleAudioPlay}
                  onLoadedMetadata={handleLoadedMetadata}
                  onCanPlayThrough={handleAudioReady}
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
              {isOnline && !allOnlineReady && (
                <p className="text-xs text-amber-600">{t('onlineWaitingReady')}</p>
              )}
              {isOnline && isCurrentPlayerWaiting && (
                <p className="text-xs text-gray-600">{t('onlineWaitingSpectator')}</p>
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
                      disabled={isAnswered || !canAnswer || isOnlineAnswerLocked}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span>{choice}</span>
                        {isOnline && onlineAction === 'answer' && onlineAnswerIndex === index && (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                        )}
                      </span>
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
                  disabled={isAnswered || !canAnswer || isOnlineAnswerLocked}
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
                  disabled={isAnswered || !listSelection || !canAnswer || isOnlineAnswerLocked}
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
                  disabled={isAnswered || !canAnswer || isOnlineAnswerLocked}
                />
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={isAnswered || !answerInput.trim() || !canAnswer || isOnlineAnswerLocked}
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
                    <span className="inline-flex items-center gap-2">
                      {onlineAction === 'advance' && (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      )}
                      {isLastQuestion ? t('resultTitle') : t('next')}
                    </span>
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
              {isOnline && (
                <button
                  type="button"
                  onClick={openOnlineStats}
                  className="rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  {t('onlineStatsOpen')}
                </button>
              )}
              <button
                type="button"
                onClick={handleRestart}
                disabled={isOnline && onlineLoading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <span className="inline-flex items-center gap-2">
                  {onlineAction === 'reset' && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  {isOnline ? t('onlineReturnLobby') : t('restart')}
                </span>
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

        {showOnlineStats && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-lg">
              <div ref={statsRef} className="space-y-4 rounded-md border border-gray-200 bg-gray-50 p-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-gray-900">{t('onlineStatsTitle')}</h3>
                  <p className="text-xs text-gray-500">{t('onlineStatsDescription')}</p>
                </div>
                {onlineStatsLoading && (
                  <p className="text-sm text-gray-500">{t('onlineStatsLoading')}</p>
                )}
                {!onlineStatsLoading && onlineStatsError && (
                  <p className="text-sm text-red-600">{onlineStatsError}</p>
                )}
                {!onlineStatsLoading && onlineStats && (
                  <div className="space-y-3 text-sm text-gray-700">
                    <p className="font-medium text-gray-800">
                      {t('onlineStatsTotalQuestions', { total: onlineStats.totalQuestions })}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse text-left text-xs">
                        <thead className="bg-gray-100 text-gray-600">
                          <tr>
                            <th className="border border-gray-200 px-2 py-1">{t('onlineStatsHeaderPlayer')}</th>
                            <th className="border border-gray-200 px-2 py-1">{t('onlineStatsHeaderScore')}</th>
                            <th className="border border-gray-200 px-2 py-1">{t('onlineStatsHeaderCorrect')}</th>
                            <th className="border border-gray-200 px-2 py-1">{t('onlineStatsHeaderAccuracy')}</th>
                            <th className="border border-gray-200 px-2 py-1">{t('onlineStatsHeaderStop')}</th>
                            <th className="border border-gray-200 px-2 py-1">{t('onlineStatsHeaderAnswer')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {onlineStats.players.map((player) => (
                            <tr key={player.playerId} className="bg-white">
                              <td className="border border-gray-200 px-2 py-1 font-medium">
                                {player.displayName}
                              </td>
                              <td className="border border-gray-200 px-2 py-1">{player.score}</td>
                              <td className="border border-gray-200 px-2 py-1">{player.correctCount}</td>
                              <td className="border border-gray-200 px-2 py-1">
                                {player.accuracy.toFixed(1)}%
                              </td>
                              <td className="border border-gray-200 px-2 py-1">
                                {player.averageStopTime !== null ? player.averageStopTime.toFixed(2) : '--'}
                              </td>
                              <td className="border border-gray-200 px-2 py-1">
                                {player.averageAnswerTime !== null ? player.averageAnswerTime.toFixed(2) : '--'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={downloadStatsImage}
                  className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                >
                  {t('onlineStatsDownload')}
                </button>
                <button
                  type="button"
                  onClick={shareStatsImage}
                  className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  {t('onlineStatsShare')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowOnlineStats(false)}
                  className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  {t('onlineStatsClose')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
