const fs = require('fs/promises')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const API_KEY = process.env.YOUTUBE_API_KEY
if (!API_KEY) {
  console.error('YOUTUBE_API_KEY is not set')
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
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=%E3%83%96%E3%83%AB%E3%83%BC%E3%82%A2%E3%83%BC%E3%82%AB%E3%82%A4%E3%83%96%20TL&key=${API_KEY}&type=video&order=date`
  )
  if (!res.ok) {
    throw new Error(`Failed: ${res.status}`)
  }
  const data = await res.json()
  return data.items
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
    const entry = {
      id: maxId + 1,
      boss: '',
      terrain: '',
      armor: '',
      difficulty: '',
      seasons: seasonNum ? [seasonNum] : [],
      videoid: vid,
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
