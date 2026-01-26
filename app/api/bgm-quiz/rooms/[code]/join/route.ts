import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../utils'

type JoinPayload = {
  displayName?: string
}

export async function POST(request: NextRequest, { params }: { params?: Promise<{ code?: string }> }) {
  const payload = (await request.json()) as JoinPayload
  const displayName = payload.displayName?.trim() || 'ゲスト'
  const resolvedParams = (await params) ?? {}
  const roomCode = resolvedParams.code?.toUpperCase()
  if (!roomCode) {
    return NextResponse.json({ error: 'ルームコードが不正です。' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  const { data: room, error: roomError } = await supabase
    .from('bgm_quiz_rooms')
    .select('room_code,current_index,total_questions,game_type,status')
    .eq('room_code', roomCode)
    .maybeSingle()

  if (roomError || !room) {
    return NextResponse.json({ error: 'ルームが見つかりません。' }, { status: 404 })
  }

  const playerId = crypto.randomUUID()
  const { error: playerError } = await supabase.from('bgm_quiz_players').insert({
    room_code: roomCode,
    player_id: playerId,
    display_name: displayName,
    score: 0,
  })

  if (playerError) {
    return NextResponse.json({ error: playerError.message }, { status: 500 })
  }

  const { data: question, error: questionError } = await supabase
    .from('bgm_quiz_questions_public')
    .select('question_index,track_file,choices')
    .eq('room_code', roomCode)
    .eq('question_index', room.current_index)
    .maybeSingle()

  if (questionError || !question) {
    return NextResponse.json({ error: '問題の取得に失敗しました。' }, { status: 500 })
  }

  return NextResponse.json({
    roomCode,
    playerId,
    totalQuestions: room.total_questions,
    currentIndex: room.current_index,
    gameType: room.game_type,
    status: room.status,
    question: {
      trackFile: question.track_file,
      choices: question.choices,
      questionIndex: question.question_index,
    },
  })
}
