import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../utils'

type HostPayload = {
  playerId: string
  targetPlayerId: string
  force?: boolean
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const payload = (await request.json()) as HostPayload
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

  const { data: player } = await supabase
    .from('bgm_quiz_players')
    .select('player_id')
    .eq('room_code', roomCode)
    .eq('player_id', payload.playerId)
    .maybeSingle()

  if (!player) {
    return NextResponse.json({ error: 'プレイヤーが見つかりません。' }, { status: 404 })
  }

  if (room.host_player_id !== payload.playerId && !payload.force) {
    return NextResponse.json({ error: 'ホストのみ移譲できます。' }, { status: 403 })
  }

  const { data: target } = await supabase
    .from('bgm_quiz_players')
    .select('player_id')
    .eq('room_code', roomCode)
    .eq('player_id', payload.targetPlayerId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: '移譲先が見つかりません。' }, { status: 404 })
  }

  const { error: updateError } = await supabase
    .from('bgm_quiz_rooms')
    .update({ host_player_id: payload.targetPlayerId })
    .eq('room_code', roomCode)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
