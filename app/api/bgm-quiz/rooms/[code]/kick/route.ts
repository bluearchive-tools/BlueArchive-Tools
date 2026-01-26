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

  const { error: deleteError } = await supabase
    .from('bgm_quiz_players')
    .delete()
    .eq('room_code', roomCode)
    .eq('player_id', payload.targetPlayerId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
