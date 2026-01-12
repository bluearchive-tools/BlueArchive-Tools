import fs from 'fs/promises'
import path from 'path'

type RaidSeason = {
  number: string
}

type RaidData = {
  seasons: RaidSeason[]
}

let cachedRaidData: RaidData | null = null

export async function loadRaidData(): Promise<RaidData> {
  if (cachedRaidData) return cachedRaidData
  const filePath = path.join(process.cwd(), 'data', 'raid.json')
  const raw = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(raw) as RaidData
  cachedRaidData = data
  return data
}

export async function isValidSeasonNumber(rawSeason: string): Promise<boolean> {
  const season = rawSeason.trim().toUpperCase()
  if (!season) return false
  const data = await loadRaidData()
  return data.seasons.some((s) => s.number.toUpperCase() === season)
}
