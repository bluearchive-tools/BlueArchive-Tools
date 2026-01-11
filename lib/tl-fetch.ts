import fs from 'fs/promises'
import path from 'path'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface TLSeason {
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

interface YouTubeVideoItem {
  id: { videoId: string }
  snippet: Snippet
}

interface Student {
  id: string
  name: string
  image: string
  attackType: string
  defenseType: string
  hasAccessory?: boolean
  styleIds?: string[]
  styleOf?: string
  altIds?: string[]
  altOf?: string
  initialStars: number
  role: string
  characterType: string
  position: string
  exHitDelay?: number
  normalHitDelay?: number
}

interface UserStudent {
  student_id: string
  level: number
  star: number
  unique_star: number
  unique_level: number
  bond: number
  hp: number
  hp_wb: number
  attack: number
  attack_wb: number
  defense: number
  heal: number
  heal_wb: number
  ex_skill: number
  normal_skill: number
  passive_skill: number
  sub_skill: number
  equip1: number
  equip2: number
  equip3: number
  item_tier: number
  alt_bonds?: Record<string, number>
}

const getYouTubeApiKeys = () => {
  const keys =
    process.env.YOUTUBE_API_KEYS?.split(',').map((k) => k.trim()).filter(Boolean) ||
    []
  if (process.env.YOUTUBE_API_KEY && !keys.includes(process.env.YOUTUBE_API_KEY)) {
    keys.push(process.env.YOUTUBE_API_KEY)
  }
  return keys
}

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, '')

type PendingStatus = 'pending' | 'approved' | 'rejected'

type PendingVideoInput = {
  videoid: string
  platform: 'youtube' | 'bilibili'
  title: string
  description: string
  publishedAt?: string
  armor: string
  difficulty: string
  score: string
  formation: string
  guide: boolean
  formationStatus: string
  seasonGuess: string | null
  seasonTarget?: string | null
  reason: 'season_unknown' | 'season_mismatch'
  raw?: Record<string, unknown>
}

export function guessSeason(snippet: Snippet, seasons: TLSeason[]): string | null {
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

export function extractArmor(text: string): string {
  const matched: string[] = []
  if (/爆発|軽装備/.test(text)) matched.push('軽装備')
  if (/貫通|重装甲/.test(text)) matched.push('重装甲')
  if (/神秘|特殊装甲/.test(text)) matched.push('特殊装甲')
  if (/振動|弾力装甲|弾力/.test(text)) matched.push('弾力装甲')
  if (matched.length > 1) return '不明'
  return matched[0] || ''
}

export function extractDifficulty(text: string): string {
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

export function extractScore(text: string): string {
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

export function extractGuide(text: string): boolean {
  return /解説/.test(text)
}

export async function extractFormation(
  supabase: SupabaseClient,
  text: string
): Promise<string> {
  try {
    const file = path.join(process.cwd(), 'data', 'students.json')
    const raw = await fs.readFile(file, 'utf-8')
    const students = JSON.parse(raw) as Student[]
    const lines = text.split(/\r?\n/)
    const teams: Student[][] = []
    const ids = new Set<string>()
    for (const line of lines) {
      const members = students.filter((s) => line.includes(s.name))
      if (members.length) {
        teams.push(members)
        members.forEach((m) => ids.add(m.id))
      }
    }
    if (teams.length === 0) {
      const members = students.filter((s) => text.includes(s.name))
      if (members.length) {
        teams.push(members)
        members.forEach((m) => ids.add(m.id))
      }
    }
    if (ids.size === 0) return '[]'
    const { data } = await supabase
      .from('user_students')
      .select('*')
      .in('student_id', Array.from(ids))
    const rows = (data as UserStudent[]) || []
    const map: Record<string, UserStudent> = {}
    for (const r of rows) {
      map[r.student_id] = r
    }
    const result = teams.map((team) =>
      team.map((m) => ({
        id: m.id,
        name: m.name,
        level: map[m.id]?.level ?? null,
        star: map[m.id]?.star ?? null,
        unique_star: map[m.id]?.unique_star ?? null,
        unique_level: map[m.id]?.unique_level ?? null,
        bond: map[m.id]?.bond ?? null,
        hp: map[m.id]?.hp ?? null,
        hp_wb: map[m.id]?.hp_wb ?? null,
        attack: map[m.id]?.attack ?? null,
        attack_wb: map[m.id]?.attack_wb ?? null,
        defense: map[m.id]?.defense ?? null,
        heal: map[m.id]?.heal ?? null,
        heal_wb: map[m.id]?.heal_wb ?? null,
        ex_skill: map[m.id]?.ex_skill ?? null,
        normal_skill: map[m.id]?.normal_skill ?? null,
        passive_skill: map[m.id]?.passive_skill ?? null,
        sub_skill: map[m.id]?.sub_skill ?? null,
        equip1: map[m.id]?.equip1 ?? null,
        equip2: map[m.id]?.equip2 ?? null,
        equip3: map[m.id]?.equip3 ?? null,
        item_tier: map[m.id]?.item_tier ?? null,
        alt_bonds: map[m.id]?.alt_bonds ?? null,
      }))
    )
    return JSON.stringify(result)
  } catch {
    return '[]'
  }
}

export async function fetchYouTubeVideos(seasons: TLSeason[]): Promise<YouTubeVideoItem[]> {
  const apiKeys = getYouTubeApiKeys()
  if (apiKeys.length === 0 || seasons.length === 0) return []
  const base =
    'https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=50&type=video&order=date'
  const results: YouTubeVideoItem[] = []
  const seen = new Set<string>()
  const difficulties = ['Hardcore', 'Extreme', 'Insane', 'Torment', 'Lunatic']
  for (const s of seasons) {
    const armors = s.defenseArmors && s.defenseArmors.length > 0 ? s.defenseArmors : ['']
    for (const armor of armors) {
      for (const difficulty of difficulties) {
        const query = `${s.boss} ${s.terrain} ${armor} ${difficulty}`.trim()
        if (!query) continue
        for (const key of apiKeys) {
          const res = await fetch(`${base}&q=${encodeURIComponent(query)}&key=${key}`)
          if (res.ok) {
            const data = await res.json()
            for (const item of data.items as YouTubeVideoItem[]) {
              const vid = item?.id?.videoId
              if (!vid) continue
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
  }
  return results
}

type BilibiliKeywordConfig = {
  replacements: Record<string, string | string[]>
}

function normalizeReplacement(value: string | string[]): string[] {
  return Array.isArray(value) ? value.filter((item) => item.trim().length > 0) : [value]
}

function buildBilibiliQueries(
  terms: Array<string | undefined>,
  replacements: Record<string, string | string[]>
): string[] {
  let queries = ['']
  for (const term of terms) {
    if (!term) continue
    const mapped = replacements[term]
    const variants = mapped ? normalizeReplacement(mapped) : [term]
    queries = queries.flatMap((prefix) =>
      variants.map((variant) => (prefix ? `${prefix} ${variant}` : variant).trim())
    )
  }
  return queries.filter((q) => q.length > 0)
}

export async function fetchYouTubeSnippets(videoIds: string[]): Promise<Record<string, Snippet>> {
  const apiKeys = getYouTubeApiKeys()
  const out: Record<string, Snippet> = {}
  if (apiKeys.length === 0 || videoIds.length === 0) return out

  const ids = Array.from(
    new Set(videoIds.filter((v): v is string => typeof v === 'string' && v.length > 0))
  )
  if (ids.length === 0) return out

  const base = 'https://www.googleapis.com/youtube/v3/videos?part=snippet&maxResults=50'

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    if (chunk.length === 0) continue

    for (const key of apiKeys) {
      const res = await fetch(`${base}&id=${chunk.join(',')}&key=${key}`)
      if (!res.ok) continue

      const data = await res.json()
      for (const item of (data.items || []) as Array<{ id: string; snippet: Snippet }>) {
        if (item?.id) out[item.id] = item.snippet || {}
      }
      break
    }
  }

  return out
}

export async function fetchBilibiliVideos(seasons: TLSeason[]) {
  if (seasons.length === 0) return []
  const results: Array<{
    bvid: string
    title: string
    description: string
    publishedAt?: string
    thumbnail?: string
  }> = []
  const seen = new Set<string>()
  let replacements: Record<string, string | string[]> = {}
  try {
    const configPath = path.join(process.cwd(), 'data', 'bilibili-keywords.json')
    const raw = await fs.readFile(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as BilibiliKeywordConfig
    replacements = parsed?.replacements ?? {}
  } catch {
    replacements = {}
  }
  for (const s of seasons) {
    const armors = s.defenseArmors && s.defenseArmors.length > 0 ? s.defenseArmors : ['']
    for (const armor of armors) {
      const queries = buildBilibiliQueries([s.boss, s.terrain, armor], replacements)
      for (const query of queries) {
        const params = new URLSearchParams({
          search_type: 'video',
          keyword: query,
          order: 'pubdate',
          page: '1',
          page_size: '50',
        })
        const res = await fetch(`https://api.bilibili.com/x/web-interface/search/type?${params}`)
        if (!res.ok) continue
        const json = (await res.json()) as {
          data?: {
            result?: Array<{
              bvid?: string
              title?: string
              description?: string
              pubdate?: number
              pic?: string
            }>
          }
        }
        const items = json.data?.result ?? []
        for (const item of items) {
          if (!item?.bvid) continue
          if (seen.has(item.bvid)) continue
          seen.add(item.bvid)
          results.push({
            bvid: item.bvid,
            title: stripHtml(item.title ?? ''),
            description: stripHtml(item.description ?? ''),
            publishedAt: item.pubdate ? new Date(item.pubdate * 1000).toISOString() : undefined,
            thumbnail: item.pic ? (item.pic.startsWith('//') ? `https:${item.pic}` : item.pic) : undefined,
          })
        }
      }
    }
  }
  return results
}

export const toStoredVideoId = (platform: 'youtube' | 'bilibili', id: string) =>
  platform === 'bilibili' ? `bili:${id}` : id

async function upsertPendingVideo(
  supabase: SupabaseClient,
  pending: PendingVideoInput
) {
  const payload = {
    videoid: pending.videoid,
    platform: pending.platform,
    title: pending.title,
    description: pending.description,
    published_at: pending.publishedAt ?? null,
    armor: pending.armor,
    difficulty: pending.difficulty,
    score: pending.score,
    formation: pending.formation,
    guide: pending.guide,
    formation_status: pending.formationStatus,
    season_guess: pending.seasonGuess,
    season_target: pending.seasonTarget ?? null,
    status: 'pending' satisfies PendingStatus,
    reason: pending.reason,
    raw: pending.raw ?? null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('tl_pending_videos')
    .upsert(payload, { onConflict: 'videoid' })
  return error ?? null
}

export async function upsertTimelines(params: {
  supabase: SupabaseClient
  seasons: TLSeason[]
  season?: string | null
  log?: (message: string) => void
}) {
  const { supabase, seasons, season, log } = params
  const pushLog = (message: string) => {
    if (log) log(message)
  }
  const upsertPendingFromSnippet = async (
    platform: 'youtube' | 'bilibili',
    storedId: string,
    snippet: Snippet,
    seasonNum: string | null,
    reason: 'season_unknown' | 'season_mismatch',
    raw?: Record<string, unknown>,
    seasonTarget?: string | null
  ) => {
    const text = `${snippet.title || ''}\n${snippet.description || ''}`
    const formation = await extractFormation(supabase, text)
    const error = await upsertPendingVideo(supabase, {
      videoid: storedId,
      platform,
      title: snippet.title || '',
      description: snippet.description || '',
      publishedAt: snippet.publishedAt,
      armor: extractArmor(text),
      difficulty: extractDifficulty(text),
      score: extractScore(text),
      formation,
      guide: extractGuide(text),
      formationStatus: formation && formation !== '[]' ? 'auto' : 'none',
      seasonGuess: seasonNum,
      seasonTarget,
      reason,
      raw,
    })
    if (error) {
      pushLog(
        `保留登録に失敗: ${platform} ${storedId} (${reason}) ${error.message ?? 'unknown'}`
      )
    }
  }
  let fullUsed = 0
  let fallbackUsed = 0
  let updated = 0
  let pending = 0

  const targetSeasons = season
    ? seasons.filter((s) => s.number === season)
    : seasons
  pushLog(`開始: 対象シーズン=${targetSeasons.map((s) => s.number).join(',') || 'なし'}`)

  const ytVideos = await fetchYouTubeVideos(targetSeasons)
  pushLog(`YouTube検索結果: ${ytVideos.length}件`)
  const ytIds = ytVideos
    .map((v) => v.id?.videoId)
    .filter((v): v is string => Boolean(v))
  const ytSnippets = await fetchYouTubeSnippets(ytIds)
  pushLog(`YouTube詳細スニペット取得: ${Object.keys(ytSnippets).length}件`)

  const biliVideos = await fetchBilibiliVideos(targetSeasons)
  pushLog(`Bilibili検索結果: ${biliVideos.length}件`)

  const allVideoIds = [
    ...ytIds.map((id) => toStoredVideoId('youtube', id)),
    ...biliVideos.map((v) => toStoredVideoId('bilibili', v.bvid)),
  ]

  const lockedVideoIds = new Set<string>()
  if (allVideoIds.length > 0) {
    const { data: flags } = await supabase
      .from('tl_video_update_policy')
      .select('videoid, skip_update')
      .in('videoid', allVideoIds)

    for (const f of (flags || []) as Array<{ videoid: string; skip_update: boolean }>) {
      if (f?.videoid && f.skip_update) lockedVideoIds.add(f.videoid)
    }
    pushLog(`更新保護: ${lockedVideoIds.size}件`)
  }

  for (const info of ytVideos) {
    const vid = info?.id?.videoId
    if (!vid) continue
    const storedId = toStoredVideoId('youtube', vid)
    const full = ytSnippets[vid]
    const snippet = full || info.snippet
    if (full) fullUsed++
    else fallbackUsed++
    const seasonNum = guessSeason(snippet, seasons)
    if (season && seasonNum !== season) {
      const reason = seasonNum ? 'season_mismatch' : 'season_unknown'
      await upsertPendingFromSnippet(
        'youtube',
        storedId,
        snippet,
        seasonNum,
        reason,
        { snippet },
        season
      )
      pending++
      pushLog(`YouTube ${vid}: シーズン不一致のため保留 (detected=${seasonNum ?? 'unknown'})`)
      continue
    }
    if (!seasonNum) {
      await upsertPendingFromSnippet(
        'youtube',
        storedId,
        snippet,
        seasonNum,
        'season_unknown',
        { snippet },
        season ?? null
      )
      pending++
      pushLog(`YouTube ${vid}: シーズン判定不能のため保留`)
      continue
    }
    if (lockedVideoIds.has(storedId)) {
      pushLog(`YouTube ${vid}: 更新保護のためスキップ`)
      continue
    }
    const table = seasonNum ? `tl_${seasonNum.toLowerCase()}` : 'tl_unknown'
    const { data: exist } = await supabase
      .from(table)
      .select('*')
      .eq('videoid', storedId)
      .maybeSingle()

    const text = `${snippet.title || ''}\n${snippet.description || ''}`
    const armor = extractArmor(text)
    const difficulty = extractDifficulty(text)
    const score = extractScore(text)
    const formation = await extractFormation(supabase, text)
    const guide = extractGuide(text)
    const formationStatus =
      formation && formation !== '[]' ? 'auto' : 'none'
    const entry = {
      armor,
      difficulty,
      videoid: storedId,
      score,
      formation,
      guide,
      formation_status: formationStatus,
      title: snippet.title || '',
      description: snippet.description || '',
      publishedAt: snippet.publishedAt,
    }

    if (!exist) {
      const { error } = await supabase.from(table).insert(entry)
      if (!error) {
        updated++
        pushLog(`YouTube ${vid}: 追加 (season=${seasonNum ?? 'unknown'})`)
      }
    } else {
      const update: Record<string, unknown> = {}
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
        if (!error) {
          updated++
          pushLog(`YouTube ${vid}: 更新 (season=${seasonNum ?? 'unknown'})`)
        }
      } else {
        pushLog(`YouTube ${vid}: 更新なし`)
      }
    }
  }

  for (const info of biliVideos) {
    const storedId = toStoredVideoId('bilibili', info.bvid)
    const snippet: Snippet = {
      title: info.title,
      description: info.description,
      publishedAt: info.publishedAt,
    }
    const seasonNum = guessSeason(snippet, seasons)
    if (season && seasonNum !== season) {
      const reason = seasonNum ? 'season_mismatch' : 'season_unknown'
      await upsertPendingFromSnippet(
        'bilibili',
        storedId,
        snippet,
        seasonNum,
        reason,
        { snippet },
        season
      )
      pending++
      pushLog(`Bilibili ${info.bvid}: シーズン不一致のため保留 (detected=${seasonNum ?? 'unknown'})`)
      continue
    }
    if (!seasonNum) {
      await upsertPendingFromSnippet(
        'bilibili',
        storedId,
        snippet,
        seasonNum,
        'season_unknown',
        { snippet },
        season ?? null
      )
      pending++
      pushLog(`Bilibili ${info.bvid}: シーズン判定不能のため保留`)
      continue
    }
    if (lockedVideoIds.has(storedId)) {
      pushLog(`Bilibili ${info.bvid}: 更新保護のためスキップ`)
      continue
    }
    const table = seasonNum ? `tl_${seasonNum.toLowerCase()}` : 'tl_unknown'
    const { data: exist } = await supabase
      .from(table)
      .select('*')
      .eq('videoid', storedId)
      .maybeSingle()

    const text = `${snippet.title || ''}\n${snippet.description || ''}`
    const armor = extractArmor(text)
    const difficulty = extractDifficulty(text)
    const score = extractScore(text)
    const formation = await extractFormation(supabase, text)
    const guide = extractGuide(text)
    const formationStatus =
      formation && formation !== '[]' ? 'auto' : 'none'
    const entry = {
      armor,
      difficulty,
      videoid: storedId,
      score,
      formation,
      guide,
      formation_status: formationStatus,
      title: snippet.title || '',
      description: snippet.description || '',
      publishedAt: snippet.publishedAt,
    }

    if (!exist) {
      const { error } = await supabase.from(table).insert(entry)
      if (!error) {
        updated++
        pushLog(`Bilibili ${info.bvid}: 追加 (season=${seasonNum ?? 'unknown'})`)
      }
    } else {
      const update: Record<string, unknown> = {}
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
        if (!error) {
          updated++
          pushLog(`Bilibili ${info.bvid}: 更新 (season=${seasonNum ?? 'unknown'})`)
        }
      } else {
        pushLog(`Bilibili ${info.bvid}: 更新なし`)
      }
    }
  }

  pushLog(`完了: 更新件数=${updated} / 保留件数=${pending}`)
  return { fullUsed, fallbackUsed, updated, pending }
}
