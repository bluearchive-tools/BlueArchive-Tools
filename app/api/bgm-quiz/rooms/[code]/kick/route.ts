import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../utils'

type KickPayload = {
  playerId: string
  targetPlayerId: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const payload = (await request.json()) as KickPayload
  const resolvedParams = await params
  const roomCode = resolvedParams.code.toUpperCase()

  const supabase = getSupabaseAdmin()
  const { data: room, error: roomError } = await supabase
    .from('bgm_quiz_rooms')
    .select('host_player_id')
    .eq('room_code', roomCode)
    .maybeSingle()

  if (roomError || !room) {
    return NextResponse.json({ error: 'ルームが見つかりません。' }, { status: 404 })
  }

  if (room.host_player_id !== payload.playerId) {
    return NextResponse.json({ error: 'ホストのみ操作できます。' }, { status: 403 })
  }

  if (payload.targetPlayerId === room.host_player_id) {
    return NextResponse.json({ error: 'ホストは退出できません。' }, { status: 400 })
  }

  const { data: deletedPlayers, error: deleteError } = await supabase
    .from('bgm_quiz_players')
    .delete()
    .eq('room_code', roomCode)
    .eq('player_id', payload.targetPlayerId)
    .select('player_id')

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  const { data: deletedAnswers, error: answersError } = await supabase
    .from('bgm_quiz_answers')
    .delete()
    .eq('room_code', roomCode)
    .eq('player_id', payload.targetPlayerId)
    .select('id')

  if (answersError) {
    return NextResponse.json({ error: answersError.message }, { status: 500 })
  }

  const { data: updatedQuestions, error: questionError } = await supabase
    .from('bgm_quiz_questions')
    .update({ winner_player_id: null })
    .eq('room_code', roomCode)
    .eq('winner_player_id', payload.targetPlayerId)
    .select('id')

  if (questionError) {
    return NextResponse.json({ error: questionError.message }, { status: 500 })
  }

  const { data: updatedPublicQuestions, error: publicQuestionError } = await supabase
    .from('bgm_quiz_questions_public')
    .update({ winner_player_id: null })
    .eq('room_code', roomCode)
    .eq('winner_player_id', payload.targetPlayerId)
    .select('id')

  if (publicQuestionError) {
    return NextResponse.json({ error: publicQuestionError.message }, { status: 500 })
  }

  const removedAny =
    (deletedPlayers?.length ?? 0) > 0 ||
    (deletedAnswers?.length ?? 0) > 0 ||
    (updatedQuestions?.length ?? 0) > 0 ||
    (updatedPublicQuestions?.length ?? 0) > 0

  if (!removedAny) {
    return NextResponse.json({ success: true, removed: false })
  }

  return NextResponse.json({ success: true, removed: true })
}
