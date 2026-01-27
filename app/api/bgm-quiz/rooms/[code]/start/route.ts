import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../utils'

type StartPayload = {
  playerId: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const payload = (await request.json()) as StartPayload
  const resolvedParams = await params
  const roomCode = resolvedParams.code.toUpperCase()

  const supabase = getSupabaseAdmin()
  const { data: room, error: roomError } = await supabase
    .from('bgm_quiz_rooms')
    .select('status,current_index,total_questions,host_player_id')
    .eq('room_code', roomCode)
    .maybeSingle()

  if (roomError || !room) {
    return NextResponse.json({ error: 'ルームが見つかりません。' }, { status: 404 })
  }

  if (room.host_player_id !== payload.playerId) {
    return NextResponse.json({ error: 'ホストのみ開始できます。' }, { status: 403 })
  }

  if (room.status === 'finished') {
    return NextResponse.json({ error: 'ルームは終了しています。' }, { status: 400 })
  }

  if (room.status !== 'playing') {
    const { error: updateError } = await supabase
      .from('bgm_quiz_rooms')
      .update({ status: 'playing' })
      .eq('room_code', roomCode)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  }

  await supabase
    .from('bgm_quiz_players')
    .update({ is_waiting: false, ready_question_index: null })
    .eq('room_code', roomCode)

  const { data: question, error: questionError } = await supabase
    .from('bgm_quiz_questions_public')
    .select('question_index,track_file,choices,is_solved,winner_player_id')
    .eq('room_code', roomCode)
    .eq('question_index', room.current_index)
    .maybeSingle()

  if (questionError || !question) {
    return NextResponse.json({ error: '問題の取得に失敗しました。' }, { status: 500 })
  }

  return NextResponse.json({
    status: 'playing',
    currentIndex: room.current_index,
    question: {
      trackFile: question.track_file,
      choices: question.choices,
      questionIndex: question.question_index,
      isSolved: question.is_solved,
      winnerPlayerId: question.winner_player_id,
    },
  })
}
