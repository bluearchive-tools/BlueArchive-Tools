import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../utils'

export async function GET(request: Request, context: { params: { code: string } }) {
  const { searchParams } = new URL(request.url)
  const index = Number(searchParams.get('index') ?? 0)
  const roomCode = context.params.code.toUpperCase()

  const supabase = getSupabaseAdmin()
  const { data: question, error } = await supabase
    .from('bgm_quiz_questions_public')
    .select('question_index,track_file,choices')
    .eq('room_code', roomCode)
    .eq('question_index', index)
    .maybeSingle()

  if (error || !question) {
    return NextResponse.json({ error: '問題が見つかりません。' }, { status: 404 })
  }

  return NextResponse.json({
    question: {
      trackFile: question.track_file,
      choices: question.choices,
      questionIndex: question.question_index,
    },
  })
}
