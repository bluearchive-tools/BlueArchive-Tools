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
  const m = cleaned.match(/([0-9]{4,})/)
  if (!m) return ''
  const digits = m[1]
  if (digits.length === 4) return digits + '0000'
  return digits
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

interface Member extends Student {
  level?: number
  bond?: number
  ex_skill?: number
  normal_skill?: number
  passive_skill?: number
  sub_skill?: number
  equip1?: number
  equip2?: number
  equip3?: number
  item_tier?: number
}

interface UserStudent extends Member {
  student_id: string
}

function parseNumbers(
  line: string,
  regex: RegExp,
  maxValue?: number
): number | undefined {
  const m = line.match(regex)
  if (!m) return undefined
  const val = m[1].toUpperCase()
  if (val === 'M' && maxValue) return maxValue
  return Number(val)
}

function parseCompactSkill(line: string) {
  const m = line.match(/\b([M\d]{4})\b/)
  if (!m) return {}
  const [e, n, p, s] = m[1].split('')
  return {
    ex: e === 'M' ? 5 : Number(e),
    ns: n === 'M' ? 10 : Number(n),
    ps: p === 'M' ? 10 : Number(p),
    ss: s === 'M' ? 10 : Number(s),
  }
}

async function extractFormation(text: string): Promise<string> {
  try {
    const file = path.join(process.cwd(), 'data', 'students.json')
    const raw = await fs.readFile(file, 'utf-8')
    const students = JSON.parse(raw) as Student[]
    const ids = students.filter((s) => text.includes(s.name)).map((s) => s.id)
    const userMap: Record<string, Member> = {}
    if (ids.length) {
      const { data } = await supabase
        .from('user_students')
        .select('*')
        .in('student_id', ids)
      if (data) {
        for (const row of data as UserStudent[]) {
          userMap[row.student_id] = row as Member
        }
      }
    }
    const lines = text.split(/\r?\n/)
    const result: Member[][] = []
    for (const line of lines) {
      const members = students.filter((s) => line.includes(s.name))
      if (members.length) {
        const compact = parseCompactSkill(line)
        const level = parseNumbers(line, /Lv\.?\s*(\d+)/i)
        const bond = parseNumbers(line, /絆\s*(\d+)/)
        const ex =
          parseNumbers(line, /EX(?:スキル)?\s*(\d+|M)/i, 5) ?? compact.ex
        const ns =
          parseNumbers(line, /NS(?:スキル)?\s*(\d+|M)/i, 10) ?? compact.ns
        const ps =
          parseNumbers(line, /PS(?:スキル)?\s*(\d+|M)/i, 10) ?? compact.ps
        const ss =
          parseNumbers(line, /SS(?:スキル)?\s*(\d+|M)/i, 10) ?? compact.ss
        const gearMatches = [...line.matchAll(/T(\d+)/gi)].map((m) => Number(m[1]))
        const ue = parseNumbers(line, /(?:愛用品|UE)\s*T?(\d+)/i)
        result.push(
          members.map((m) => {
            const base = userMap[m.id] || {}
            return {
              ...m,
              level: level ?? base.level,
              bond: bond ?? base.bond,
              ex_skill: ex ?? base.ex_skill,
              normal_skill: ns ?? base.normal_skill,
              passive_skill: ps ?? base.passive_skill,
              sub_skill: ss ?? base.sub_skill,
              equip1: gearMatches[0] ?? base.equip1,
              equip2: gearMatches[1] ?? base.equip2,
              equip3: gearMatches[2] ?? base.equip3,
              item_tier: ue ?? base.item_tier,
            }
          })
        )
      }
    }
    if (!result.length) {
      const names = students.filter((s) => text.includes(s.name))
      if (names.length)
        result.push(
          names.map((m) => ({
            ...m,
            ...(userMap[m.id] || {}),
          }))
        )
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
    const timelines: Record<string, unknown>[] = []

    for (const s of targets) {
      const table = `tl_${s.number.toLowerCase()}`
      const { data, error } = await supabase.from(table).select('*')
      if (error) continue
      if (data) {
        timelines.push(
          ...(data as Record<string, unknown>[]).map((d) => ({
            ...(d as Record<string, unknown>),
            season: s.number,
          }))
        )
      }
    }
    if (selected.length === 0) {
      const { data: unknown } = await supabase
        .from('tl_unknown')
        .select('*')
      if (unknown)
        timelines.push(
          ...(unknown as Record<string, unknown>[]).map((d) => ({
            ...(d as Record<string, unknown>),
            season: '',
          }))
        )
    }

    const normalized: Timeline[] = timelines.map((t) => {
      const raw = t as {
        id: number
        armor?: string
        difficulty?: string
        videoid: string
        score?: string
        formation?: string
        guide?: boolean
        formation_status?: string
        title?: string
        description?: string
        publishedAt?: string
        season?: string
      }
      const formationVal = raw.formation || '[]'
      return {
        id: raw.id,
        armor: raw.armor || '',
        difficulty: raw.difficulty || '',
        videoid: raw.videoid,
        score: raw.score || '',
        formation: formationVal,
        guide: Boolean(raw.guide),
        formationStatus:
          raw.formation_status ||
          (formationVal && formationVal !== '[]' ? 'auto' : 'none'),
        title: raw.title || '',
        description: raw.description || '',
        publishedAt: raw.publishedAt,
        season: raw.season,
      }
    })

    normalized.sort((a, b) => {
      if (a.armor === '不明' && b.armor !== '不明') return 1
      if (a.armor !== '不明' && b.armor === '不明') return -1
      return parseInt(b.score || '0') - parseInt(a.score || '0')
    })

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
        .select('*')
        .eq('videoid', vid)
        .maybeSingle()

      const text = `${info.snippet.title || ''}\n${info.snippet.description || ''}`
      const armor = extractArmor(text)
      const difficulty = extractDifficulty(text)
      const score = extractScore(text)
      const formation = await extractFormation(text)
      const guide = extractGuide(text)
      const formationStatus =
        formation && formation !== '[]' ? 'auto' : 'none'
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
        if (error) throw error
      } else {
        const update: Record<string, unknown> = {}
        if (exist.armor !== armor) update.armor = armor
        if (exist.difficulty !== difficulty) update.difficulty = difficulty
        if (exist.score !== score) update.score = score
        if (exist.guide !== guide) update.guide = guide
        if (exist.title !== entry.title) update.title = entry.title
        if (exist.description !== entry.description)
          update.description = entry.description
        if (exist.publishedAt !== entry.publishedAt)
          update.publishedAt = entry.publishedAt
        if (
          exist.formation_status !== 'manual' &&
          exist.formation !== formation
        ) {
          update.formation = formation
          update.formation_status = formationStatus
        }
        if (Object.keys(update).length > 0) {
          const { error } = await supabase
            .from(table)
            .update(update)
            .eq('id', exist.id)
          if (error) throw error
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
