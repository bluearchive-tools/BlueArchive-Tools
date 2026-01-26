import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../utils'

type LeavePayload = {
  playerId: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const payload = (await request.json()) as LeavePayload
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

  const { error: deleteError } = await supabase
    .from('bgm_quiz_players')
    .delete()
    .eq('room_code', roomCode)
    .eq('player_id', payload.playerId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  const { data: remainingPlayers } = await supabase
    .from('bgm_quiz_players')
    .select('player_id')
    .eq('room_code', roomCode)
    .order('created_at', { ascending: true })

  if (!remainingPlayers || remainingPlayers.length === 0) {
    await supabase.from('bgm_quiz_answers').delete().eq('room_code', roomCode)
    await supabase.from('bgm_quiz_questions_public').delete().eq('room_code', roomCode)
    await supabase.from('bgm_quiz_questions').delete().eq('room_code', roomCode)
    await supabase.from('bgm_quiz_rooms').delete().eq('room_code', roomCode)
    return NextResponse.json({ ok: true, deleted: true })
  }

  if (room.host_player_id === payload.playerId) {
    const nextHost = remainingPlayers[0]?.player_id
    if (nextHost) {
      await supabase.from('bgm_quiz_rooms').update({ host_player_id: nextHost }).eq('room_code', roomCode)
    }
  }

  return NextResponse.json({ ok: true })
}
