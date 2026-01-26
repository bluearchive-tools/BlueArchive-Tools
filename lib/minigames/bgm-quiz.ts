import bgmQuizData from '../../data/bgm-quiz.json'

export type BgmTrack = {
  file: string
  title?: string
  category: string
}

export type QuizMode = 'multiple-choice' | 'free-input' | 'list-select'

export type QuizQuestion = {
  track: BgmTrack
  choices: string[]
  correctIndex: number | null
}

const FALLBACK_CATEGORY = '未分類'

const normalizeText = (value: string) => value.trim().toLowerCase()

const getBaseName = (file: string) => file.replace(/\.[^/.]+$/, '')

export function getBgmTracks(): BgmTrack[] {
  return (bgmQuizData.tracks ?? []).map((track) => ({
    ...track,
    category: track.category?.trim() ? track.category : FALLBACK_CATEGORY,
  }))
}

export function getBgmTrackDisplayTitle(track: BgmTrack): string {
  const title = track.title?.trim()
  if (title) return title
  return `Theme ${getBaseName(track.file)}`
}

export function getBgmQuizCategories(tracks: BgmTrack[]): string[] {
  const categorySet = new Set<string>()
  tracks.forEach((track) => {
    categorySet.add(track.category?.trim() ? track.category : FALLBACK_CATEGORY)
  })
  return Array.from(categorySet)
}

export function isCorrectBgmAnswer(track: BgmTrack, answer: string): boolean {
  const normalized = normalizeText(answer)
  if (!normalized) return false
  const title = track.title?.trim()
  if (title) {
    return normalized === normalizeText(title)
  }
  return normalized === normalizeText(getBgmTrackDisplayTitle(track))
}

const shuffle = <T,>(values: T[]): T[] => {
  const array = [...values]
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

const buildChoices = (track: BgmTrack, pool: BgmTrack[]): string[] => {
  const answer = getBgmTrackDisplayTitle(track)
  const candidates = shuffle(pool.filter((item) => item.file !== track.file))
  const choiceSet = new Set<string>([answer])
  for (const candidate of candidates) {
    const title = getBgmTrackDisplayTitle(candidate)
    if (!choiceSet.has(title)) {
      choiceSet.add(title)
    }
    if (choiceSet.size >= 4) break
  }
  return shuffle(Array.from(choiceSet))
}

export function createBgmQuizQuestions(tracks: BgmTrack[], count: number, mode: QuizMode): QuizQuestion[] {
  const available = shuffle(tracks)
  const selected = available.slice(0, Math.min(count, available.length))
  return selected.map((track) => {
    const choices = mode === 'multiple-choice' ? buildChoices(track, tracks) : []
    return {
      track,
      choices,
      correctIndex: mode === 'multiple-choice' ? choices.indexOf(getBgmTrackDisplayTitle(track)) : null,
    }
  })
}
