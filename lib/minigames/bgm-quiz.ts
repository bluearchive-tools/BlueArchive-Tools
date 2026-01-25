import type { Locale } from '../i18n/config'

type QuizQuestion = {
  hint: string
  choices: string[]
  answerIndex: number
}

const QUESTIONS: Record<Locale, QuizQuestion[]> = {
  ja: [
    {
      hint: '透き通るような青空を思わせる、学園の日常シーンでよく流れる曲',
      choices: ['Clear Morning', 'Unwelcome School', 'Hifumi Daisuki', 'Target for Love'],
      answerIndex: 0,
    },
    {
      hint: '緊張感のある旋律で、任務開始時の雰囲気を高めるバトル寄りの楽曲',
      choices: ['Colorful Mess', 'Constant Moderato', 'Ready to Go', 'Unwelcome School'],
      answerIndex: 2,
    },
    {
      hint: 'コミカルで軽快、トラブルメーカーたちの登場で印象に残りやすい曲',
      choices: ['Unwelcome School', 'Clear Morning', 'Midsummer Cat', 'Goal Wo Nerae!'],
      answerIndex: 0,
    },
  ],
  en: [
    {
      hint: 'A bright everyday campus theme that feels like a clear blue morning.',
      choices: ['Clear Morning', 'Unwelcome School', 'Hifumi Daisuki', 'Target for Love'],
      answerIndex: 0,
    },
    {
      hint: 'A battle-leaning track with tension that ramps up right as a mission begins.',
      choices: ['Colorful Mess', 'Constant Moderato', 'Ready to Go', 'Unwelcome School'],
      answerIndex: 2,
    },
    {
      hint: 'Comical and energetic, often associated with chaotic troublemakers.',
      choices: ['Unwelcome School', 'Clear Morning', 'Midsummer Cat', 'Goal Wo Nerae!'],
      answerIndex: 0,
    },
  ],
}

export function getBgmQuizQuestions(locale: Locale): QuizQuestion[] {
  return QUESTIONS[locale]
}

export type { QuizQuestion }
