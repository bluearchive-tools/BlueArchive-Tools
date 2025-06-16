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
    const tableName = `tl_${latest.number.toLowerCase()}`
    await supabase.rpc('create_tl_table', { name: tableName })

        .from(tableName)
        const { error } = await supabase.from(tableName).insert({
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
        const { error } = await supabase.from(table).insert({
          boss: latest.boss || '',
          terrain: latest.terrain || '',
          armor: (latest.defenseArmors && latest.defenseArmors[0]) || '',
          difficulty: latest.maxDifficulty || '',
          seasons: [latest.number],
          videoid: vid,
        })
        if (!error) added++
      }
    }

    return NextResponse.json({ season: latest.number, updated: added })
  } catch {
    return NextResponse.json({ updated: 0 }, { status: 500 })
  }
}
