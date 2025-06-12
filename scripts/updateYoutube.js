const fs = require('fs/promises')
const path = require('path')
const fetch = require('node-fetch')

const API_KEY = process.env.YOUTUBE_API_KEY
if (!API_KEY) {
  console.error('YOUTUBE_API_KEY is not set')
  process.exit(1)
}

const FILE_PATH = path.join(__dirname, '..', 'data', 'tl', 'unknown.json')

async function fetchVideos() {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=%E3%83%96%E3%83%AB%E3%83%BC%E3%82%A2%E3%83%BC%E3%82%AB%E3%82%A4%E3%83%96%20TL&key=${API_KEY}&type=video&order=date`
  )
  if (!res.ok) {
    throw new Error(`Failed: ${res.status}`)
  }
  const data = await res.json()
  return data.items.map((it) => it.id.videoId)
}

async function update() {
  let current = []
  try {
    current = JSON.parse(await fs.readFile(FILE_PATH, 'utf-8'))
  } catch {
    current = []
  }
  const videos = await fetchVideos()
  let maxId = current.reduce((a, c) => Math.max(a, c.id), 0)
  for (const vid of videos) {
    if (!current.some((t) => t.videoId === vid)) {
      maxId += 1
      current.push({
        id: maxId,
        boss: '',
        terrain: '',
        armor: '',
        difficulty: '',
        seasons: [],
        videoId: vid,
      })
    }
  }
  await fs.writeFile(FILE_PATH, JSON.stringify(current, null, 2))
}

async function main() {
  await update()
  setInterval(update, 5 * 60 * 1000)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
