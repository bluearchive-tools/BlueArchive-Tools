import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../utils'

type DisbandPayload = {
  playerId: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const payload = (await request.json()) as DisbandPayload
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
    return NextResponse.json({ error: 'ホストのみ解散できます。' }, { status: 403 })
  }

  const { error: answersError } = await supabase.from('bgm_quiz_answers').delete().eq('room_code', roomCode)
  if (answersError) {
    return NextResponse.json({ error: answersError.message }, { status: 500 })
  }

  const { error: publicQuestionError } = await supabase
    .from('bgm_quiz_questions_public')
    .delete()
    .eq('room_code', roomCode)
  if (publicQuestionError) {
    return NextResponse.json({ error: publicQuestionError.message }, { status: 500 })
  }

  const { error: questionError } = await supabase.from('bgm_quiz_questions').delete().eq('room_code', roomCode)
  if (questionError) {
    return NextResponse.json({ error: questionError.message }, { status: 500 })
  }

  const { error: playersError } = await supabase.from('bgm_quiz_players').delete().eq('room_code', roomCode)
  if (playersError) {
    return NextResponse.json({ error: playersError.message }, { status: 500 })
  }

  const { error: roomDeleteError } = await supabase.from('bgm_quiz_rooms').delete().eq('room_code', roomCode)
  if (roomDeleteError) {
    return NextResponse.json({ error: roomDeleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
