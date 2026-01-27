import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../utils'

type AdvancePayload = {
  playerId: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const payload = (await request.json()) as AdvancePayload
  const resolvedParams = await params
  const roomCode = resolvedParams.code.toUpperCase()

  const supabase = getSupabaseAdmin()
  const { data: room, error: roomError } = await supabase
    .from('bgm_quiz_rooms')
    .select('current_index,total_questions,host_player_id,status')
    .eq('room_code', roomCode)
    .maybeSingle()

  if (roomError || !room) {
    return NextResponse.json({ error: 'ルームが見つかりません。' }, { status: 404 })
  }

  if (room.host_player_id !== payload.playerId) {
    return NextResponse.json({ error: 'ホストのみ進行できます。' }, { status: 403 })
  }

  if (room.status === 'finished') {
    return NextResponse.json({ error: 'ルームは終了しています。' }, { status: 400 })
  }

  const nextIndex = room.current_index + 1
  const nextStatus = nextIndex >= room.total_questions ? 'finished' : 'playing'
  const updatedIndex = Math.min(nextIndex, room.total_questions - 1)

  const { error: updateError } = await supabase
    .from('bgm_quiz_rooms')
    .update({ current_index: updatedIndex, status: nextStatus })
    .eq('room_code', roomCode)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  if (nextStatus === 'finished') {
    return NextResponse.json({ status: nextStatus, currentIndex: updatedIndex, question: null })
  }

  const { data: question, error: questionError } = await supabase
    .from('bgm_quiz_questions_public')
    .select('question_index,track_file,choices,is_solved,winner_player_id')
    .eq('room_code', roomCode)
    .eq('question_index', updatedIndex)
    .maybeSingle()

  if (questionError || !question) {
    return NextResponse.json({ error: '問題の取得に失敗しました。' }, { status: 500 })
  }

  return NextResponse.json({
    status: nextStatus,
    currentIndex: updatedIndex,
    question: {
      trackFile: question.track_file,
      choices: question.choices,
      questionIndex: question.question_index,
      isSolved: question.is_solved,
      winnerPlayerId: question.winner_player_id,
    },
  })
}
