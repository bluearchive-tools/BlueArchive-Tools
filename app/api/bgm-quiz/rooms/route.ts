import { NextResponse } from 'next/server'
import { buildOnlineQuestions, generateRoomCode, getSupabaseAdmin } from '../utils'

type CreateRoomPayload = {
  category?: string
  questionCount?: number
  excludeUntitledThemes?: boolean
  displayName?: string
  gameType?: string
}

export async function POST(request: Request) {
  const payload = (await request.json()) as CreateRoomPayload
  const category = payload.category ?? 'all'
  const questionCount = Math.max(1, Number(payload.questionCount ?? 5))
  const excludeUntitled = Boolean(payload.excludeUntitledThemes)
  const displayName = payload.displayName?.trim() || 'ゲスト'
  const gameType = payload.gameType ?? 'fast'

  const supabase = getSupabaseAdmin()
  let roomCode = generateRoomCode()

  for (let i = 0; i < 5; i += 1) {
    const { data } = await supabase.from('bgm_quiz_rooms').select('room_code').eq('room_code', roomCode).maybeSingle()
    if (!data) break
    roomCode = generateRoomCode()
  }

  const questions = buildOnlineQuestions({
    category,
    count: questionCount,
    excludeUntitled,
  })

  if (questions.length === 0) {
    return NextResponse.json({ error: '出題可能な楽曲がありません。' }, { status: 400 })
  }

  const playerId = crypto.randomUUID()

  const { error: roomError } = await supabase.from('bgm_quiz_rooms').insert({
    room_code: roomCode,
    status: 'playing',
    current_index: 0,
    total_questions: questions.length,
    game_type: gameType,
  })
  if (roomError) {
    return NextResponse.json({ error: roomError.message }, { status: 500 })
  }

  const { error: playerError } = await supabase.from('bgm_quiz_players').insert({
    room_code: roomCode,
    player_id: playerId,
    display_name: displayName,
    score: 0,
  })
  if (playerError) {
    return NextResponse.json({ error: playerError.message }, { status: 500 })
  }

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

  const currentQuestion = questions[0]

  return NextResponse.json({
    roomCode,
    playerId,
    totalQuestions: questions.length,
    currentIndex: 0,
    question: {
      trackFile: currentQuestion.trackFile,
      choices: currentQuestion.choices,
      questionIndex: currentQuestion.questionIndex,
    },
  })
}
