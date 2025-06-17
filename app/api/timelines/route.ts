import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
import { Timeline } from '../../../types/timeline'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)
const API_KEYS = (
  process.env.YOUTUBE_API_KEYS?.split(',').map((k) => k.trim()).filter(Boolean) ||
  []
)
if (process.env.YOUTUBE_API_KEY && !API_KEYS.includes(process.env.YOUTUBE_API_KEY)) {
  API_KEYS.push(process.env.YOUTUBE_API_KEY)
}

interface Season {
  number: string
  startDate: string
  endDate: string
  boss?: string
  terrain?: string
  defenseArmors?: string[]
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

async function ensureTables(seasons: Season[]) {
  // テーブルは事前に手動で作成する想定
  // 存在しない場合はエラーとせずスキップ
  for (const s of seasons) {
    const table = `tl_${s.number.toLowerCase()}`
    const { error } = await supabase.from(table).select('id').limit(1)
    if (error) continue
  }
  await supabase.from('tl_unknown').select('id').limit(1)
}

async function fetchVideos(seasons: Season[]): Promise<VideoItem[]> {
  if (API_KEYS.length === 0 || seasons.length === 0) return []
  const base =
    'https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=50&type=video&order=date'
  const results: VideoItem[] = []
  const seen = new Set<string>()
  for (const s of seasons) {
    const armors = s.defenseArmors && s.defenseArmors.length > 0 ? s.defenseArmors : ['']
    for (const armor of armors) {
      const query = `${s.boss} ${s.terrain} ${armor}`.trim()
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

export async function GET(request: Request) {
  try {
    const reqUrl = new URL(request.url)
    const selected = reqUrl.searchParams.getAll('season')
    const raidPath = path.join(process.cwd(), 'data', 'raid.json')
    const raid = JSON.parse(await fs.readFile(raidPath, 'utf-8'))
    const seasons: Season[] = raid.seasons
    const targets =
      selected.length > 0
        ? seasons.filter((s) => selected.includes(s.number))
        : seasons

    await ensureTables(targets)
    const timelines: Timeline[] = []

    for (const s of targets) {
      const table = `tl_${s.number.toLowerCase()}`
      const { data, error } = await supabase.from(table).select('*')
      if (error) continue
      if (data) timelines.push(...data)
    }
    if (selected.length === 0) {
      const { data: unknown } = await supabase.from('tl_unknown').select('*')
      if (unknown) timelines.push(...unknown)
    }

    const normalized: Timeline[] = timelines.map((t) => {
      const raw = t as {
        id: number
        armor?: string
        difficulty?: string
        videoid: string
        score?: string
        formation?: string
        title?: string
        description?: string
      }
      return {
        id: raw.id,
        armor: raw.armor || '',
        difficulty: raw.difficulty || '',
        videoid: raw.videoid,
        score: raw.score || '',
        formation: raw.formation || '[]',
        title: raw.title || '',
        description: raw.description || '',
      }
    })

    normalized.sort(
      (a, b) => parseInt(b.score || '0') - parseInt(a.score || '0')
    )

    return NextResponse.json(normalized)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { season } = await request.json()
    const raidPath = path.join(process.cwd(), 'data', 'raid.json')
    const raid = JSON.parse(await fs.readFile(raidPath, 'utf-8'))
    const seasons: Season[] = raid.seasons

    await ensureTables(seasons)

    const targetSeasons = season
      ? seasons.filter((s) => s.number === season)
      : seasons

    const videos = await fetchVideos(targetSeasons)
    for (const info of videos) {
      const vid = info.id.videoId
      const seasonNum = guessSeason(info.snippet, seasons)
      if (season && seasonNum !== season) continue
      const table = seasonNum ? `tl_${seasonNum.toLowerCase()}` : 'tl_unknown'
      const { data: exist } = await supabase
        .from(table)
        .select('id')
        .eq('videoid', vid)
        .maybeSingle()
      if (!exist) {
        const text = `${info.snippet.title || ''}\n${info.snippet.description || ''}`
        const entry = {
          armor: extractArmor(text),
          difficulty: extractDifficulty(text),
          videoid: vid,
          score: extractScore(text),
          formation: await extractFormation(text),
          title: info.snippet.title || '',
          description: info.snippet.description || '',
        }
        const { error } = await supabase.from(table).insert(entry)
        if (error) throw error
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
