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
const API_KEY = process.env.YOUTUBE_API_KEY

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

async function fetchVideos(): Promise<VideoItem[]> {
  if (!API_KEY) return []
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=%E3%83%96%E3%83%AB%E3%83%BC%E3%82%A2%E3%83%BC%E3%82%AB%E3%82%A4%E3%83%96%20TL&key=${API_KEY}&type=video&order=date`
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.items as VideoItem[]
}

function extractArmor(text: string): string {
  if (/爆発|軽装備/.test(text)) return '軽装備'
  if (/貫通|重装甲/.test(text)) return '重装甲'
  if (/神秘|特殊装甲/.test(text)) return '特殊装甲'
  if (/振動|弾力装甲|弾力/.test(text)) return '弾力装甲'
  return ''
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
  const m = cleaned.match(/([0-9]{6,})/)
  return m ? m[1] : ''
}

async function extractFormation(text: string): Promise<string> {
  try {
    const file = path.join(process.cwd(), 'data', 'students.json')
    const raw = await fs.readFile(file, 'utf-8')
    const students = JSON.parse(raw) as { name: string }[]
    const lines = text.split(/\r?\n/)
    const result: { name: string }[][] = []
    for (const line of lines) {
      const members = students.filter((s) => line.includes(s.name))
      if (members.length) result.push(members)
    }
    if (!result.length) {
      const names = students.filter((s) => text.includes(s.name))
      if (names.length) result.push(names)
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

    const videos = await fetchVideos()
    let added = 0
    for (const info of videos) {
      const vid = info.id.videoId
      const seasonNum = guessSeason(info.snippet, [latest])
      if (seasonNum !== latest.number) continue
      const { data: exist } = await supabase
        .from(table)
        .select('id')
        .eq('videoid', vid)
        .maybeSingle()
      if (!exist) {
        const text = `${info.snippet.title || ''}\n${info.snippet.description || ''}`
        const entry = {
          armor: extractArmor(text) || (latest.defenseArmors && latest.defenseArmors[0]) || '',
          difficulty: extractDifficulty(text) || latest.maxDifficulty || '',
          videoid: vid,
          score: extractScore(text),
          formation: await extractFormation(text),
          title: info.snippet.title || '',
          description: info.snippet.description || '',
        }
        const { error } = await supabase.from(table).insert(entry)
        if (!error) added++
      }
    }

    return NextResponse.json({ season: latest.number, updated: added })
  } catch {
    return NextResponse.json({ updated: 0 }, { status: 500 })
  }
}
