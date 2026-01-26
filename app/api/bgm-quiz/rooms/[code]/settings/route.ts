import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { buildOnlineQuestions, getSupabaseAdmin } from '../../../utils'

type SettingsPayload = {
  playerId: string
  category?: string
  questionCount?: number
  excludeUntitledThemes?: boolean
  gameType?: string
  introSeconds?: number
  randomSeconds?: number
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const payload = (await request.json()) as SettingsPayload
  const resolvedParams = await params
  const roomCode = resolvedParams.code.toUpperCase()

  const supabase = getSupabaseAdmin()
  const { data: room, error: roomError } = await supabase
    .from('bgm_quiz_rooms')
    .select('host_player_id,status')
    .eq('room_code', roomCode)
    .maybeSingle()

  if (roomError || !room) {
    return NextResponse.json({ error: 'ルームが見つかりません。' }, { status: 404 })
  }

  if (room.host_player_id !== payload.playerId) {
    return NextResponse.json({ error: 'ホストのみ設定を変更できます。' }, { status: 403 })
  }

  if (room.status === 'playing') {
    return NextResponse.json({ error: '対戦中は設定を変更できません。' }, { status: 400 })
  }

  const category = payload.category ?? 'all'
  const questionCount = Math.max(1, Number(payload.questionCount ?? 5))
  const excludeUntitled = Boolean(payload.excludeUntitledThemes)
  const gameType = payload.gameType ?? 'fast'
  const introSeconds = Math.max(1, Number(payload.introSeconds ?? 5))
  const randomSeconds = Math.max(1, Number(payload.randomSeconds ?? 5))

  const questions = buildOnlineQuestions({
    category,
    count: questionCount,
    excludeUntitled,
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

  const { error: questionError } = await supabase
    .from('bgm_quiz_questions')
    .upsert(questionRows, { onConflict: 'room_code,question_index' })
  if (questionError) {
    return NextResponse.json({ error: questionError.message }, { status: 500 })
  }

  const { error: publicError } = await supabase
    .from('bgm_quiz_questions_public')
    .upsert(questionPublicRows, { onConflict: 'room_code,question_index' })
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
      game_type: gameType,
      category,
      exclude_untitled: excludeUntitled,
      intro_seconds: introSeconds,
      random_seconds: randomSeconds,
    })
    .eq('room_code', roomCode)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    status: 'lobby',
    totalQuestions: questions.length,
  })
}
