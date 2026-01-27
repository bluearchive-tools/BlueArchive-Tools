import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../utils'

type ForceEndPayload = {
  playerId: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const payload = (await request.json()) as ForceEndPayload
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
    return NextResponse.json({ error: 'ホストのみ終了できます。' }, { status: 403 })
  }

  const { error: updateError } = await supabase
    .from('bgm_quiz_rooms')
    .update({ status: 'finished' })
    .eq('room_code', roomCode)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
