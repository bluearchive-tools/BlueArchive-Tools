import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'


interface Season {
  number: string
  startDate: string
  endDate: string
  type: string
  boss?: string
  terrain?: string
  defenseArmors?: string[]
  maxDifficulty?: string
}

interface Snippet {
  title?: string
  description?: string
  publishedAt?: string
}

interface VideoItem {
  id: { videoId: string }
  snippet: Snippet
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)
const API_KEYS = (
  process.env.YOUTUBE_API_KEYS?.split(',').map((k) => k.trim()).filter(Boolean) ||
  []
)
if (process.env.YOUTUBE_API_KEY && !API_KEYS.includes(process.env.YOUTUBE_API_KEY)) {
  API_KEYS.push(process.env.YOUTUBE_API_KEY)
}

function guessSeason(snippet: Snippet, seasons: Season[]): string | null {
  const { title = '', description = '', publishedAt } = snippet
  for (const s of seasons) {
    if (
      title.includes(`シーズン${s.number}`) ||
      description.includes(`シーズン${s.number}`) ||
      title.includes(s.number) ||
      description.includes(s.number)
    ) {
      return s.number
    }
  }
  if (!publishedAt) return null
  const date = new Date(publishedAt)
  for (const s of seasons) {
    const start = new Date(s.startDate)
    const end = new Date(s.endDate)
    if (date >= start && date <= end) {
      return s.number
    }
  }
  return null
}

async function fetchVideos(season: Season): Promise<VideoItem[]> {
  if (API_KEYS.length === 0) return []
  const base =
    'https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=50&type=video&order=date'
  const results: VideoItem[] = []
  const seen = new Set<string>()
  const armors = season.defenseArmors && season.defenseArmors.length > 0 ? season.defenseArmors : ['']
  for (const armor of armors) {
    const query = `${season.boss} ${season.terrain} ${armor}`.trim()
    for (const key of API_KEYS) {
      const res = await fetch(`${base}&q=${encodeURIComponent(query)}&key=${key}`)
      if (res.ok) {
        const data = await res.json()
        for (const item of data.items as VideoItem[]) {
          const vid = item.id.videoId
          if (!seen.has(vid)) {
            seen.add(vid)
            results.push(item)
          }
        }
        break
      }
    }
  }
  return results
}

function extractArmor(text: string): string {
  const matched: string[] = []
  if (/爆発|軽装備/.test(text)) matched.push('軽装備')
  if (/貫通|重装甲/.test(text)) matched.push('重装甲')
  if (/神秘|特殊装甲/.test(text)) matched.push('特殊装甲')
  if (/振動|弾力装甲|弾力/.test(text)) matched.push('弾力装甲')
  if (matched.length > 1) return '不明'
  return matched[0] || ''
}

function extractDifficulty(text: string): string {
  const mapping: Record<string, string> = {
    Lunatic: 'Lunatic',
    Torment: 'Torment',
    Insane: 'Insane',
    Extreme: 'Extreme',
    Hardcore: 'Hardcore',
    ルナティック: 'Lunatic',
    トーメント: 'Torment',
    インセイン: 'Insane',
    エクストリーム: 'Extreme',
    ハードコア: 'Hardcore',
  }
  for (const [k, v] of Object.entries(mapping)) {
    if (text.includes(k)) return v
  }
  return ''
}

function extractScore(text: string): string {
  const cleaned = text.replace(/,/g, '')
  const regex = /\d{4,}/g
  for (const m of cleaned.matchAll(regex)) {
    const digits = m[0]
    const num = parseInt(digits)
    if (
      ((digits.length === 4 && num >= 1900 && num <= 2100) ||
        (digits.length === 6 && digits.startsWith('20')) ||
        (digits.length === 8 && digits.startsWith('20')))
    ) {
      continue
    }
    if (digits.length === 4) return digits + '0000'
    return digits
  }
  return ''
}

function extractGuide(text: string): boolean {
  return /解説/.test(text)
}

interface Student {
  id: string
  name: string
  image: string
  attackType: string
  defenseType: string
  hasAccessory?: boolean
  altIds?: string[]
  altOf?: string
  initialStars: number
  role: string
  characterType: string
  position: string
}


async function extractFormation(text: string): Promise<string> {
  try {
    const file = path.join(process.cwd(), 'data', 'students.json')
    const raw = await fs.readFile(file, 'utf-8')
    const students = JSON.parse(raw) as Student[]
    const lines = text.split(/\r?\n/)
    const result: string[][] = []
    for (const line of lines) {
      const members = students.filter((s) => line.includes(s.name))
      if (members.length) {
        result.push(members.map((m) => m.id))
      }
    }
    if (!result.length) {
      const names = students.filter((s) => text.includes(s.name))
      if (names.length) {
        result.push(names.map((m) => m.id))
      }
    }
    return JSON.stringify(result)
  } catch {
    return '[]'
  }
}

export async function GET() {
  try {
    const raidPath = path.join(process.cwd(), 'data', 'raid.json')
    const raid = JSON.parse(await fs.readFile(raidPath, 'utf-8'))
    const seasons: Season[] = raid.seasons
    const targets = seasons.filter(
      (s) => s.type === '総力戦' || s.type === '大決戦'
    )
    if (!targets.length) return NextResponse.json({ updated: 0 })
    targets.sort(
      (a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    )
    const latest = targets[0]
    const table = `tl_${latest.number.toLowerCase()}`

    const videos = await fetchVideos(latest)
    let added = 0
    for (const info of videos) {
      const vid = info.id.videoId
      const seasonNum = guessSeason(info.snippet, [latest])
      if (seasonNum !== latest.number) continue
      const { data: exist } = await supabase
        .from(table)
        .select('*')
        .eq('videoid', vid)
        .maybeSingle()

      const text = `${info.snippet.title || ''}\n${info.snippet.description || ''}`
      const armor = extractArmor(text) || (latest.defenseArmors && latest.defenseArmors[0]) || ''
      const difficulty = extractDifficulty(text) || latest.maxDifficulty || ''
      const score = extractScore(text)
      const formation = await extractFormation(text)
      const guide = extractGuide(text)
      const formationStatus = formation && formation !== '[]' ? 'auto' : 'none'
      const entry = {
        armor,
        difficulty,
        videoid: vid,
        score,
        formation,
        guide,
        formation_status: formationStatus,
        title: info.snippet.title || '',
        description: info.snippet.description || '',
        publishedAt: info.snippet.publishedAt,
      }

      if (!exist) {
        const { error } = await supabase.from(table).insert(entry)
        if (!error) added++
      } else {
        const update: Record<string, unknown> = {}
        if (exist.difficulty !== difficulty) update.difficulty = difficulty
        if (exist.score !== score) update.score = score
        if (exist.guide !== guide) update.guide = guide
        if (exist.title !== entry.title) update.title = entry.title
        if (exist.description !== entry.description) update.description = entry.description
        if (exist.publishedAt !== entry.publishedAt) update.publishedAt = entry.publishedAt
        if (exist.formation_status !== 'manual' && exist.formation !== formation) {
          update.formation = formation
          update.formation_status = formationStatus
        }
        if (Object.keys(update).length > 0) {
          const { error } = await supabase
            .from(table)
            .update(update)
            .eq('id', exist.id)
          if (!error) added++
        }
      }
    }

    return NextResponse.json({ season: latest.number, updated: added })
  } catch {
    return NextResponse.json({ updated: 0 }, { status: 500 })
  }
}
