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

  await supabase.from('bgm_quiz_answers').delete().eq('room_code', roomCode)
  await supabase.from('bgm_quiz_questions_public').delete().eq('room_code', roomCode)
  await supabase.from('bgm_quiz_questions').delete().eq('room_code', roomCode)
  await supabase.from('bgm_quiz_players').delete().eq('room_code', roomCode)
  await supabase.from('bgm_quiz_rooms').delete().eq('room_code', roomCode)

  return NextResponse.json({ ok: true })
}
