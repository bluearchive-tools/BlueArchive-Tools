import fs from 'fs/promises'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { upsertTimelines, type TLSeason } from '../lib/tl-fetch'

type RaidData = {
  seasons: TLSeason[]
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase env vars are not set (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const RAID_FILE = path.join(process.cwd(), 'data', 'raid.json')

const toDateKey = (value: Date): string => value.toISOString().slice(0, 10)

const pickSeasonForWorkflow = (seasons: TLSeason[], todayKey: string): string | null => {
  const current = seasons
    .filter((season) => season.startDate <= todayKey && todayKey <= season.endDate)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]

  if (current) return current.number

  const latestEnded = seasons
    .filter((season) => season.endDate < todayKey)
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0]

  return latestEnded?.number ?? null
}

async function loadRaidData(): Promise<RaidData> {
  const raw = await fs.readFile(RAID_FILE, 'utf-8')
  return JSON.parse(raw) as RaidData
}

async function main() {
  const raid = await loadRaidData()
  const todayKey = toDateKey(new Date())
  const targetSeason = pickSeasonForWorkflow(raid.seasons, todayKey)

  if (!targetSeason) {
    console.log(`[cron] no eligible season found at ${todayKey}.`)
    return
  }

  console.log(`[cron] target season: ${targetSeason} (today=${todayKey})`)

  const result = await upsertTimelines({
    supabase,
    seasons: raid.seasons,
    season: targetSeason,
    platform: null,
    log: (message: string) => {
      console.log(`[cron] ${message}`)
    },
  })

  console.log(`[cron] done: ${JSON.stringify(result)}`)
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message)
  } else {
    console.error('unknown error')
  }
  process.exit(1)
})
