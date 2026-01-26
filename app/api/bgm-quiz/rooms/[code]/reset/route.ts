import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { buildOnlineQuestions, getSupabaseAdmin } from '../../../utils'

type ResetPayload = {
  playerId: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const payload = (await request.json()) as ResetPayload
  const resolvedParams = await params
  const roomCode = resolvedParams.code.toUpperCase()

  const supabase = getSupabaseAdmin()
  const { data: room, error: roomError } = await supabase
    .from('bgm_quiz_rooms')
    .select('host_player_id,status,total_questions,category,exclude_untitled,game_type,intro_seconds,random_seconds')
    .eq('room_code', roomCode)
    .maybeSingle()

  if (roomError || !room) {
    return NextResponse.json({ error: 'ルームが見つかりません。' }, { status: 404 })
  }

  const isHost = room.host_player_id === payload.playerId
  if (!isHost && room.status !== 'finished') {
    return NextResponse.json({ error: 'ホストのみロビーに戻せます。' }, { status: 403 })
  }

  const questions = buildOnlineQuestions({
    category: room.category ?? 'all',
    count: Math.max(1, Number(room.total_questions ?? 5)),
    excludeUntitled: Boolean(room.exclude_untitled),
  })

  if (questions.length === 0) {
    return NextResponse.json({ error: '出題可能な楽曲がありません。' }, { status: 400 })
  }

  await supabase.from('bgm_quiz_answers').delete().eq('room_code', roomCode)
  await supabase.from('bgm_quiz_questions').delete().eq('room_code', roomCode)
  await supabase.from('bgm_quiz_questions_public').delete().eq('room_code', roomCode)

  const questionRows = questions.map((question) => ({
    room_code: roomCode,
    question_index: question.questionIndex,
    track_file: question.trackFile,
    choices: question.choices,
    correct_index: question.correctIndex,
  }))

  const questionPublicRows = questions.map((question) => ({
    room_code: roomCode,
    question_index: question.questionIndex,
    track_file: question.trackFile,
    choices: question.choices,
  }))

  const { error: questionError } = await supabase.from('bgm_quiz_questions').insert(questionRows)
  if (questionError) {
    return NextResponse.json({ error: questionError.message }, { status: 500 })
  }

  const { error: publicError } = await supabase.from('bgm_quiz_questions_public').insert(questionPublicRows)
  if (publicError) {
    return NextResponse.json({ error: publicError.message }, { status: 500 })
  }

  await supabase
    .from('bgm_quiz_players')
    .update({ score: 0, is_waiting: false, ready_question_index: null })
    .eq('room_code', roomCode)

  const { error: updateError } = await supabase
    .from('bgm_quiz_rooms')
    .update({
      status: 'lobby',
      current_index: 0,
      total_questions: questions.length,
      game_type: room.game_type ?? 'fast',
      category: room.category ?? 'all',
      exclude_untitled: room.exclude_untitled ?? false,
      intro_seconds: room.intro_seconds ?? 5,
      random_seconds: room.random_seconds ?? 5,
    })
    .eq('room_code', roomCode)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ status: 'lobby', totalQuestions: questions.length })
}
