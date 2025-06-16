import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
import { Timeline } from '../../../types/timeline'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)
const API_KEY = process.env.YOUTUBE_API_KEY

interface Season {
  number: string
  startDate: string
  endDate: string
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
  // ここでは存在チェックのみを行います
  for (const s of seasons) {
    const table = `tl_${s.number.toLowerCase()}`
    const { error } = await supabase.from(table).select('id').limit(1)
    if (error) throw error
  }
  const { error } = await supabase.from('tl_unknown').select('id').limit(1)
  if (error) throw error
}

async function fetchVideos(): Promise<VideoItem[]> {
  if (!API_KEY) return []
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=%E3%83%96%E3%83%AB%E3%83%BC%E3%82%A2%E3%83%BC%E3%82%AB%E3%82%A4%E3%83%96%20TL&key=${API_KEY}&type=video&order=date`
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.items as VideoItem[]).filter(v => {
    const t = v.snippet.title || ''
    const d = v.snippet.description || ''
    return (
      t.includes('ブルアカ') ||
      t.includes('ブルーアーカイブ') ||
      d.includes('ブルアカ') ||
      d.includes('ブルーアーカイブ')
    )
  })
}

export async function GET() {
  try {
    const raidPath = path.join(process.cwd(), 'data', 'raid.json')
    const raid = JSON.parse(await fs.readFile(raidPath, 'utf-8'))
    const seasons: Season[] = raid.seasons

  await ensureTables(seasons)
  const timelines: Timeline[] = []

    const videos = await fetchVideos()
    for (const info of videos) {
      const vid = info.id.videoId
      const seasonNum = guessSeason(info.snippet, seasons)
      const table = seasonNum ? `tl_${seasonNum.toLowerCase()}` : 'tl_unknown'
      const { data: exist } = await supabase.from(table).select('id').eq('videoid', vid).maybeSingle()
      if (!exist) {
        const { error } = await supabase.from(table).insert({
          boss: '',
          terrain: '',
          armor: '',
          difficulty: '',
          seasons: seasonNum ? [seasonNum] : [],
          videoid: vid,
        })
        if (error) throw error
      }
    }

    for (const s of seasons) {
      const table = `tl_${s.number.toLowerCase()}`
      const { data } = await supabase.from(table).select('*')
      if (data) timelines.push(...data)
    }
    const { data: unknown } = await supabase.from('tl_unknown').select('*')
    if (unknown) timelines.push(...unknown)

    return NextResponse.json(timelines)
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

    const videos = await fetchVideos()
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
        const { error } = await supabase.from(table).insert({
          boss: '',
          terrain: '',
          armor: '',
          difficulty: '',
          seasons: seasonNum ? [seasonNum] : [],
          videoid: vid,
        })
        if (error) throw error
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
