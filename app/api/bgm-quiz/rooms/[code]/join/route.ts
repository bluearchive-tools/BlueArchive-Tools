import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../utils'

type JoinPayload = {
  displayName?: string
  playerId?: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const payload = (await request.json()) as JoinPayload
  const displayName = payload.displayName?.trim() || 'ゲスト'
  const resolvedParams = await params
  const roomCode = resolvedParams.code.toUpperCase()

  const supabase = getSupabaseAdmin()

  const { data: room, error: roomError } = await supabase
    .from('bgm_quiz_rooms')
    .select('room_code,current_index,total_questions,game_type,status,host_player_id')
    .eq('room_code', roomCode)
    .maybeSingle()

  if (roomError || !room) {
    return NextResponse.json({ error: 'ルームが見つかりません。' }, { status: 404 })
  }

  const requestedPlayerId = payload.playerId?.trim()
  let playerId = requestedPlayerId || crypto.randomUUID()

  const { data: existingPlayer } = await supabase
    .from('bgm_quiz_players')
    .select('player_id')
    .eq('room_code', roomCode)
    .eq('player_id', playerId)
    .maybeSingle()

  if (!existingPlayer) {
    const { error: playerError } = await supabase.from('bgm_quiz_players').insert({
      room_code: roomCode,
      player_id: playerId,
      display_name: displayName,
      score: 0,
    })

    if (playerError) {
      return NextResponse.json({ error: playerError.message }, { status: 500 })
    }
  }

  let question = null
  if (room.status === 'playing') {
    const { data: questionData, error: questionError } = await supabase
      .from('bgm_quiz_questions_public')
      .select('question_index,track_file,choices,is_solved,winner_player_id')
      .eq('room_code', roomCode)
      .eq('question_index', room.current_index)
      .maybeSingle()

    if (questionError || !questionData) {
      return NextResponse.json({ error: '問題の取得に失敗しました。' }, { status: 500 })
    }

    question = {
      trackFile: questionData.track_file,
      choices: questionData.choices,
      questionIndex: questionData.question_index,
      isSolved: questionData.is_solved,
      winnerPlayerId: questionData.winner_player_id,
    }
  }

  return NextResponse.json({
    roomCode,
    playerId,
    totalQuestions: room.total_questions,
    currentIndex: room.current_index,
    gameType: room.game_type,
    status: room.status,
    hostPlayerId: room.host_player_id,
    question,
  })
}
