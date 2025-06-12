'use client'

import { useEffect, useState } from 'react'
import { Timeline } from '../../../types/timeline'

interface Season {
  number: string
  boss: string
  terrain: string
  armor: string
  type: string
  defenseArmors: string[]
  maxDifficultyArmors?: string[]
  maxDifficulty: string
  startDate: string
  endDate: string
}

interface RaidData {
  bosses: string[]
  terrains: string[]
  armors: string[]
  types: string[]
  difficulties: string[]
  seasons: Season[]
}

export default function TLSearchPage() {
  const [timelines, setTimelines] = useState<Timeline[]>([])
  const [raidData, setRaidData] = useState<RaidData | null>(null)
  const [boss, setBoss] = useState('')
  const [terrain, setTerrain] = useState('')
  const [armor, setArmor] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [season, setSeason] = useState('')

  // 簡易的な難易度順
  const difficultyOrder = raidData?.difficulties ?? []

  useEffect(() => {
    const load = async () => {
      try {
        const tlRes = await fetch('/api/timelines')
        if (tlRes.ok) {
          setTimelines(await tlRes.json())
        }
        const raidRes = await fetch('/api/raids')
        if (raidRes.ok) {
          setRaidData(await raidRes.json())
        }
      } catch {
        // ignore
      }
    }
    load()
  }, [])

  const terrains = raidData?.terrains ?? []
  const armors = raidData?.armors ?? []
  const bosses = raidData?.bosses ?? []
  const selectedSeason = raidData?.seasons.find((s) => s.number === season)
  const armorOptions = selectedSeason ? selectedSeason.defenseArmors : armors

  let difficulties: string[] = raidData?.difficulties ?? []
  if (selectedSeason) {
    const maxIndex = difficultyOrder.indexOf(selectedSeason.maxDifficulty)
    let allowed = maxIndex
    if (selectedSeason.type === '大決戦' && armor) {
      const unlocked = selectedSeason.maxDifficultyArmors?.includes(armor)
      if (!unlocked) allowed = Math.max(0, allowed - 1)
    }
    difficulties = difficultyOrder.slice(0, allowed + 1)
  }
  const seasonOptions = raidData?.seasons ?? []
  const availableSeasons = seasonOptions.filter((s) => {
    if (boss && s.boss !== boss) return false
    if (terrain && s.terrain !== terrain) return false
    return true
  })

  const filtered = timelines.filter((t) => {
    const bossOk = boss ? t.boss === boss : true
    const terrainOk = terrain ? t.terrain === terrain : true
    const armorOk = armor ? t.armor === armor : true
    const difficultyOk = difficulty ? t.difficulty === difficulty : true
    const seasonOk = season ? t.seasons.includes(season) : true
    return bossOk && terrainOk && armorOk && difficultyOk && seasonOk
  })

  return (
    <main className="p-4 space-y-4">
      <h2 className="text-xl">TL検索</h2>
      <div className="space-y-2">
        <select
          value={boss}
          onChange={(e) => setBoss(e.target.value)}
          className="border rounded px-2 py-1 w-full"
        >
          <option value="">ボスを選択</option>
          {bosses.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          value={terrain}
          onChange={(e) => setTerrain(e.target.value)}
          className="border rounded px-2 py-1 w-full"
        >
          <option value="">地形を選択</option>
          {terrains.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={armor}
          onChange={(e) => {
            const value = e.target.value
            setArmor(value)
            if (selectedSeason) {
              const maxIndex = difficultyOrder.indexOf(selectedSeason.maxDifficulty)
              let allowed = maxIndex
              if (selectedSeason.type === '大決戦' && value) {
                const unlocked = selectedSeason.maxDifficultyArmors?.includes(value)
                if (!unlocked) allowed = Math.max(0, allowed - 1)
              }
              const allowedDiffs = difficultyOrder.slice(0, allowed + 1)
              if (!allowedDiffs.includes(difficulty)) {
                setDifficulty('')
              }
            }
          }}
          className="border rounded px-2 py-1 w-full"
        >
          <option value="">全て</option>
          {armorOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="border rounded px-2 py-1 w-full"
        >
          <option value="">全て</option>
          {difficulties.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={season}
          onChange={(e) => {
            const value = e.target.value
            setSeason(value)
            if (value === '') {
              setBoss('')
              setTerrain('')
              setArmor('')
              setDifficulty('')
            } else {
              const selected = seasonOptions.find((s) => s.number === value)
              if (selected) {
                if (!boss) setBoss(selected.boss)
                if (!terrain) setTerrain(selected.terrain)
                if (selected.type === '総力戦' && selected.defenseArmors.length === 1) {
                  setArmor(selected.defenseArmors[0])
                } else if (!selected.defenseArmors.includes(armor)) {
                  setArmor('')
                }
                const maxIndex = difficultyOrder.indexOf(selected.maxDifficulty)
                let allowed = maxIndex
                if (selected.type === '大決戦' && armor) {
                  const unlocked = selected.maxDifficultyArmors?.includes(armor)
                  if (!unlocked) allowed = Math.max(0, allowed - 1)
                }
                const allowedDiffs = difficultyOrder.slice(0, allowed + 1)
                if (!allowedDiffs.includes(difficulty)) {
                  setDifficulty('')
                }
              }
            }
          }}
          className="border rounded px-2 py-1 w-full"
        >
          <option value="">シーズンを選択</option>
          {availableSeasons.map((s) => (
            <option key={s.number} value={s.number}>
              {`シーズン${s.number} (${s.boss} ${s.terrain}) (${s.startDate}~${s.endDate})`}
            </option>
          ))}
        </select>
      </div>
      <ul className="space-y-2">
        {filtered.map((t) => (
          <li key={t.id} className="border rounded p-2 space-y-1">
            <p>
              {t.boss} / {t.terrain} / {t.armor} / {t.difficulty} /
              {t.seasons.join(', ')}
            </p>
            <a
              href={`https://www.youtube.com/watch?v=${t.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              動画を見る
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
