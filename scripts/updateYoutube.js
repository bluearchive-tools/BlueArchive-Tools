const fs = require('fs/promises')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean)
if (process.env.YOUTUBE_API_KEY) {
  if (!API_KEYS.includes(process.env.YOUTUBE_API_KEY)) {
    API_KEYS.push(process.env.YOUTUBE_API_KEY)
  }
}
if (API_KEYS.length === 0) {
  console.error('YOUTUBE_API_KEYS is not set')
  process.exit(1)
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase env vars are not set')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)

const RAID_FILE = path.join(__dirname, '..', 'data', 'raid.json')

function extractArmor(text) {
  const matched = []
  if (/爆発|軽装備/.test(text)) matched.push('軽装備')
  if (/貫通|重装甲/.test(text)) matched.push('重装甲')
  if (/神秘|特殊装甲/.test(text)) matched.push('特殊装甲')
  if (/振動|弾力装甲|弾力/.test(text)) matched.push('弾力装甲')
  if (matched.length > 1) return '不明'
  return matched[0] || ''
}

function extractDifficulty(text) {
  const mapping = {
    Lunatic: 'Lunatic',
    Torment: 'Torment',
    Insane: 'Insane',
    Extreme: 'Extreme',
    Hardcore: 'Hardcore',
    'ルナティック': 'Lunatic',
    'トーメント': 'Torment',
    'インセイン': 'Insane',
    'エクストリーム': 'Extreme',
    'ハードコア': 'Hardcore',
  }
  for (const k in mapping) {
    if (text.includes(k)) return mapping[k]
  }
  return ''
}

function extractScore(text) {
  const cleaned = text.replace(/,/g, '')
  const regex = /\d{4,}/g
  const matches = cleaned.matchAll(regex)
  for (const m of matches) {
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

function extractGuide(text) {
  return /解説/.test(text)
}

async function extractFormation(text) {
  try {
    const file = path.join(__dirname, '..', 'data', 'students.json')
    const raw = await fs.readFile(file, 'utf-8')
    const students = JSON.parse(raw)
    const lines = text.split(/\r?\n/)
    const teams = []
    const ids = new Set()
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
    const rows = data || []
    const map = {}
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

async function loadRaidData() {
  const data = await fs.readFile(RAID_FILE, 'utf-8')
  return JSON.parse(data)
}

function guessSeason(snippet, seasons) {
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

async function fetchVideos(seasons) {
  if (!seasons?.length) return []
  const base =
    'https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=50&type=video&order=date'
  const results = []
  const seen = new Set()
  for (const s of seasons) {
    const armors = s.defenseArmors && s.defenseArmors.length > 0 ? s.defenseArmors : ['']
    for (const armor of armors) {
      const query = `${s.boss} ${s.terrain} ${armor}`.trim()
      for (const key of API_KEYS) {
        const res = await fetch(`${base}&q=${encodeURIComponent(query)}&key=${key}`)
        if (res.ok) {
          const data = await res.json()
          for (const item of data.items) {
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

async function fetchYouTubeSnippets(videoIds) {
  const out = {}
  if (!videoIds.length || API_KEYS.length === 0) return out

  const ids = Array.from(new Set(videoIds.filter((v) => typeof v === 'string' && v.length > 0)))
  if (ids.length === 0) return out

  const base = 'https://www.googleapis.com/youtube/v3/videos?part=snippet&maxResults=50'
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    if (chunk.length === 0) continue
    for (const key of API_KEYS) {
      const res = await fetch(`${base}&id=${chunk.join(',')}&key=${key}`)
      if (!res.ok) continue
      const data = await res.json()
      for (const item of data.items || []) {
        if (item?.id) out[item.id] = item.snippet || {}
      }
      break
    }
  }
  return out
}

async function ensureTables(seasons) {
  // DB テーブルは手動で作成済みであることを想定
  for (const s of seasons) {
    const table = `tl_${s.number.toLowerCase()}`
    await supabase.from(table).select('id').limit(1)
  }
  await supabase.from('tl_unknown').select('id').limit(1)
}

async function loadTimelines(seasons) {
  await ensureTables(seasons)
  const result = {}
  for (const s of seasons) {
    const table = `tl_${s.number.toLowerCase()}`
    const { data } = await supabase.from(table).select('*')
    result[table] = data || []
  }
  const { data: unknown } = await supabase.from('tl_unknown').select('*')
  result['tl_unknown'] = unknown || []
  return result
}

async function update() {
  const raid = await loadRaidData()
  const timelines = await loadTimelines(raid.seasons)
  const videos = await fetchVideos(raid.seasons)
  const ytIds = videos.map((info) => info?.id?.videoId).filter(Boolean)
  const ytSnippets = await fetchYouTubeSnippets(ytIds)

  for (const info of videos) {
    const vid = info.id.videoId
    const snippet = ytSnippets[vid] || info.snippet || {}
    const seasonNum = guessSeason(snippet, raid.seasons)
    const table = seasonNum ? `tl_${seasonNum.toLowerCase()}` : 'tl_unknown'
    const { data: exist } = await supabase
      .from(table)
      .select('*')
      .eq('videoid', vid)
      .maybeSingle()

    const arr = timelines[table] || []
    const maxId = arr.reduce((a, c) => Math.max(a, c.id || 0), 0)
    const text = `${snippet.title || ''}\n${snippet.description || ''}`
    const armor = extractArmor(text)
    const difficulty = extractDifficulty(text)
    const score = extractScore(text)
    const formation = await extractFormation(text)
    const guide = extractGuide(text)
    const formationStatus = formation && formation !== '[]' ? 'auto' : 'none'
    const entry = {
      id: maxId + 1,
      armor,
      difficulty,
      videoid: vid,
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
        if (!timelines[table]) timelines[table] = []
        timelines[table].push(entry)
      }
    } else {
      const update = {}
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
        await supabase.from(table).update(update).eq('id', exist.id)
      }
    }
  }
}

async function main() {
  await update()
  const runOnce = process.env.RUN_ONCE === 'true' || process.env.RUN_ONCE === '1'
  if (runOnce) return
  setInterval(update, 5 * 60 * 1000)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
