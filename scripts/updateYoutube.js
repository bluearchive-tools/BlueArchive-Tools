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
  const m = cleaned.match(/([0-9]{4,})/)
  if (!m) return ''
  const digits = m[1]
  if (digits.length === 4) return digits + '0000'
  return digits
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
    const result = []
    for (const line of lines) {
      const members = students.filter((s) => line.includes(s.name))
      if (members.length) {
        const get = (re) => {
          const m = line.match(re)
          return m ? Number(m[1]) : undefined
        }
        const gears = [...line.matchAll(/T(\d+)/gi)].map((m) => Number(m[1]))
        const info = {
          level: get(/Lv\.?\s*(\d+)/i),
          bond: get(/絆\s*(\d+)/),
          ex_skill: get(/EX(?:スキル)?\s*(\d+)/i),
          normal_skill: get(/NS(?:スキル)?\s*(\d+)/i),
          passive_skill: get(/PS(?:スキル)?\s*(\d+)/i),
          sub_skill: get(/SS(?:スキル)?\s*(\d+)/i),
          equip1: gears[0],
          equip2: gears[1],
          equip3: gears[2],
          item_tier: get(/(?:愛用品|UE)\s*T?(\d+)/i),
        }
        result.push(members.map((m) => Object.assign({}, m, info)))
      }
    }
    if (!result.length) {
      const names = students.filter((s) => text.includes(s.name))
      if (names.length) result.push(names.map((m) => Object.assign({}, m)))
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

  for (const info of videos) {
    const vid = info.id.videoId
    const seasonNum = guessSeason(info.snippet, raid.seasons)
    const table = seasonNum ? `tl_${seasonNum.toLowerCase()}` : 'tl_unknown'
    const { data: exist } = await supabase
      .from(table)
      .select('*')
      .eq('videoid', vid)
      .maybeSingle()

    const arr = timelines[table] || []
    const maxId = arr.reduce((a, c) => Math.max(a, c.id || 0), 0)
    const text = `${info.snippet.title || ''}\n${info.snippet.description || ''}`
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
      title: info.snippet.title || '',
      description: info.snippet.description || '',
      publishedAt: info.snippet.publishedAt,
    }

    if (!exist) {
      const { error } = await supabase.from(table).insert(entry)
      if (!error) {
        if (!timelines[table]) timelines[table] = []
        timelines[table].push(entry)
      }
    } else {
      const update = {}
      if (exist.armor !== armor) update.armor = armor
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
  setInterval(update, 5 * 60 * 1000)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
