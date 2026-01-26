import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../utils'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params
  const roomCode = resolvedParams.code.toUpperCase()

  const supabase = getSupabaseAdmin()

  const { data: room, error: roomError } = await supabase
    .from('bgm_quiz_rooms')
    .select('total_questions')
    .eq('room_code', roomCode)
    .maybeSingle()

  if (roomError || !room) {
    return NextResponse.json({ error: 'ルームが見つかりません。' }, { status: 404 })
  }

  const { data: players, error: playerError } = await supabase
    .from('bgm_quiz_players')
    .select('player_id,display_name,score')
    .eq('room_code', roomCode)
    .order('created_at', { ascending: true })

  if (playerError) {
    return NextResponse.json({ error: playerError.message }, { status: 500 })
  }

  const { data: answers, error: answerError } = await supabase
    .from('bgm_quiz_answers')
    .select('player_id,is_correct,stop_time,answer_time')
    .eq('room_code', roomCode)

  if (answerError) {
    return NextResponse.json({ error: answerError.message }, { status: 500 })
  }

  const stats = new Map<
    string,
    {
      playerId: string
      displayName: string
      score: number
      correctCount: number
      answerCount: number
      stopTimes: number[]
      answerTimes: number[]
    }
  >()

  ;(players ?? []).forEach((player) => {
    stats.set(player.player_id, {
      playerId: player.player_id,
      displayName: player.display_name,
      score: player.score ?? 0,
      correctCount: 0,
      answerCount: 0,
      stopTimes: [],
      answerTimes: [],
    })
  })

  ;(answers ?? []).forEach((answer) => {
    const entry =
      stats.get(answer.player_id) ??
      (() => {
        const fallback = {
          playerId: answer.player_id,
          displayName: answer.player_id,
          score: 0,
          correctCount: 0,
          answerCount: 0,
          stopTimes: [],
          answerTimes: [],
        }
        stats.set(answer.player_id, fallback)
        return fallback
      })()
    entry.answerCount += 1
    if (answer.is_correct) {
      entry.correctCount += 1
    }
    if (typeof answer.stop_time === 'number') {
      entry.stopTimes.push(answer.stop_time)
    }
    if (typeof answer.answer_time === 'number') {
      entry.answerTimes.push(answer.answer_time)
    }
  })

  const playersStats = Array.from(stats.values()).map((entry) => {
    const avgStop =
      entry.stopTimes.length > 0
        ? entry.stopTimes.reduce((sum, value) => sum + value, 0) / entry.stopTimes.length
        : null
    const avgAnswer =
      entry.answerTimes.length > 0
        ? entry.answerTimes.reduce((sum, value) => sum + value, 0) / entry.answerTimes.length
        : null
    const accuracy = entry.answerCount > 0 ? (entry.correctCount / entry.answerCount) * 100 : 0
    return {
      playerId: entry.playerId,
      displayName: entry.displayName,
      score: entry.score,
      correctCount: entry.correctCount,
      accuracy,
      averageStopTime: avgStop,
      averageAnswerTime: avgAnswer,
    }
  })

  playersStats.sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName, 'ja'))

  return NextResponse.json({
    totalQuestions: room.total_questions ?? 0,
    players: playersStats,
  })
}
