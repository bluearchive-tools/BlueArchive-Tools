import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../utils'

type AnswerPayload = {
  playerId: string
  choiceIndex: number
  stopTime?: number
  answerTime?: number
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const payload = (await request.json()) as AnswerPayload
  const resolvedParams = await params
  const roomCode = resolvedParams.code.toUpperCase()

  const supabase = getSupabaseAdmin()
  const { data: room, error: roomError } = await supabase
    .from('bgm_quiz_rooms')
    .select('current_index,total_questions,status')
    .eq('room_code', roomCode)
    .maybeSingle()

  if (roomError || !room) {
    return NextResponse.json({ error: 'ルームが見つかりません。' }, { status: 404 })
  }

  if (room.status !== 'playing') {
    return NextResponse.json({ error: 'ルームは終了しています。' }, { status: 400 })
  }

  const { data: player, error: playerError } = await supabase
    .from('bgm_quiz_players')
    .select('is_waiting')
    .eq('room_code', roomCode)
    .eq('player_id', payload.playerId)
    .maybeSingle()

  if (playerError || !player) {
    return NextResponse.json({ error: 'プレイヤーが見つかりません。' }, { status: 404 })
  }

  if (player.is_waiting) {
    return NextResponse.json({ error: '待機中のため回答できません。' }, { status: 403 })
  }

  const { data: question, error: questionError } = await supabase
    .from('bgm_quiz_questions')
    .select('correct_index,is_solved')
    .eq('room_code', roomCode)
    .eq('question_index', room.current_index)
    .maybeSingle()

  if (questionError || !question) {
    return NextResponse.json({ error: '問題が見つかりません。' }, { status: 404 })
  }

  const isCorrect = payload.choiceIndex === question.correct_index

  const { error: answerError } = await supabase.from('bgm_quiz_answers').insert({
    room_code: roomCode,
    player_id: payload.playerId,
    question_index: room.current_index,
    choice_index: payload.choiceIndex,
    is_correct: isCorrect,
    stop_time: payload.stopTime ?? null,
    answer_time: payload.answerTime ?? null,
  })

  if (answerError) {
    return NextResponse.json({ error: answerError.message }, { status: 500 })
  }

  if (isCorrect && !question.is_solved) {
    await Promise.all([
      supabase
        .from('bgm_quiz_questions')
        .update({ is_solved: true, winner_player_id: payload.playerId })
        .eq('room_code', roomCode)
        .eq('question_index', room.current_index)
        .eq('is_solved', false),
      supabase
        .from('bgm_quiz_questions_public')
        .update({ is_solved: true, winner_player_id: payload.playerId })
        .eq('room_code', roomCode)
        .eq('question_index', room.current_index)
        .eq('is_solved', false),
      supabase.rpc('increment_bgm_quiz_score', {
        p_room_code: roomCode,
        p_player_id: payload.playerId,
      }),
    ])

    const nextIndex = room.current_index + 1
    const nextStatus = nextIndex >= room.total_questions ? 'finished' : 'playing'

    await supabase
      .from('bgm_quiz_rooms')
      .update({
        current_index: Math.min(nextIndex, room.total_questions - 1),
        status: nextStatus,
      })
      .eq('room_code', roomCode)
  }

  return NextResponse.json({ isCorrect })
}
