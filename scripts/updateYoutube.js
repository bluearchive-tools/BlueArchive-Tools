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
  if (/爆発|軽装備/.test(text)) return '軽装備'
  if (/貫通|重装甲/.test(text)) return '重装甲'
  if (/神秘|特殊装甲/.test(text)) return '特殊装甲'
  if (/振動|弾力装甲|弾力/.test(text)) return '弾力装甲'
  return ''
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
  const m = cleaned.match(/([0-9]{6,})/)
  return m ? m[1] : ''
}

async function extractFormation(text) {
  try {
    const file = path.join(__dirname, '..', 'data', 'students.json')
    const raw = await fs.readFile(file, 'utf-8')
    const students = JSON.parse(raw)
    const lines = text.split(/\r?\n/)
    const result = []
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

async function fetchVideos() {
  const base =
    'https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=50&q=%E3%83%96%E3%83%AB%E3%83%BC%E3%82%A2%E3%83%BC%E3%82%AB%E3%82%A4%E3%83%96%20TL&type=video&order=date'
  for (const key of API_KEYS) {
    const res = await fetch(`${base}&key=${key}`)
    if (res.ok) {
      const data = await res.json()
      return data.items
    }
  }
  throw new Error('All API keys failed')
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
  const videos = await fetchVideos()

  for (const info of videos) {
    const vid = info.id.videoId
    if (Object.values(timelines).some((arr) => arr.some((t) => t.videoid === vid))) {
      continue
    }
    const seasonNum = guessSeason(info.snippet, raid.seasons)
    const table = seasonNum ? `tl_${seasonNum.toLowerCase()}` : 'tl_unknown'
    const arr = timelines[table] || []
    const maxId = arr.reduce((a, c) => Math.max(a, c.id || 0), 0)
    const text = `${info.snippet.title || ''}\n${info.snippet.description || ''}`
    const entry = {
      id: maxId + 1,
      armor: extractArmor(text),
      difficulty: extractDifficulty(text),
      videoid: vid,
      score: extractScore(text),
      formation: await extractFormation(text),
      title: info.snippet.title || '',
      description: info.snippet.description || '',
    }
    const { error } = await supabase.from(table).insert(entry)
    if (!error) {
      if (!timelines[table]) timelines[table] = []
      timelines[table].push(entry)
    }
  }
}

async function main() {
  await update()
  setInterval(update, 5 * 60 * 1000)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
