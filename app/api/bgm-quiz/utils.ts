import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getBgmTrackDisplayTitle, getBgmTracks } from '../../../lib/minigames/bgm-quiz'

export type OnlineQuestion = {
  trackFile: string
  choices: string[]
  questionIndex: number
}

export function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。')
  }
  try {
    new URL(supabaseUrl)
  } catch {
    throw new Error('SUPABASE_URL の形式が不正です。')
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

export function generateRoomCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export function buildOnlineQuestions(params: { category: string; count: number; excludeUntitled: boolean }) {
  const { category, count, excludeUntitled } = params
  const tracks = getBgmTracks()
  const filtered = tracks.filter((track) => {
    if (excludeUntitled && !track.title?.trim()) return false
    if (category === 'all') return true
    return track.category === category
  })
  const shuffled = [...filtered].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, Math.min(count, shuffled.length))
  return selected.map((track, index) => {
    const choices = shuffled
      .filter((item) => item.file !== track.file)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((item) => getBgmTrackDisplayTitle(item))
    const answerTitle = getBgmTrackDisplayTitle(track)
    const allChoices = [...choices, answerTitle].sort(() => Math.random() - 0.5)
    return {
      questionIndex: index,
      trackFile: track.file,
      choices: allChoices,
      correctIndex: allChoices.indexOf(answerTitle),
    }
  })
}
