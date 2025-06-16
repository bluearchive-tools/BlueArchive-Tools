'use client'

import { useEffect, useState } from 'react'
import { Timeline } from '../../../types/timeline'

interface Season {
  number: string
  boss: string
  terrain: string
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
  const [loadingMessage, setLoadingMessage] = useState('')

  // 簡易的な難易度順
  const difficultyOrder = raidData?.difficulties ?? []

  useEffect(() => {
    const load = async () => {
      try {
        const raidRes = await fetch('/api/raids')
        if (raidRes.ok) {
          const data: RaidData = await raidRes.json()
          data.seasons.sort(
            (a, b) =>
              new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
          )
          setRaidData(data)
          const latest = data.seasons[0]
          if (latest) {
            setSeason(latest.number)
            setBoss(latest.boss)
            setTerrain(latest.terrain)
            if (latest.type === '総力戦' && latest.defenseArmors.length === 1) {
              setArmor(latest.defenseArmors[0])
            }
            setLoadingMessage(`(${latest.number})のデータを取得中...`)
            const res = await fetch(`/api/timelines?season=${latest.number}`)
            if (res.ok) {
              setTimelines(await res.json())
            }
            setLoadingMessage('')
          }
        }
      } catch {
        // ignore
      }
    }
    load()
  }, [])

  const handleSearch = async () => {
    try {
      const params = new URLSearchParams()
      let targets: string[] = []
      if (season) {
        params.append('season', season)
        targets = [season]
      } else if (
        availableSeasons.length &&
        raidData &&
        availableSeasons.length !== raidData.seasons.length
      ) {
        for (const s of availableSeasons) {
          params.append('season', s.number)
        }
        targets = availableSeasons.map((s) => s.number)
      }
      if (targets.length === 0 && raidData) {
        targets = raidData.seasons.map((s) => s.number)
      }
      const query = params.toString()
      setLoadingMessage(`(${targets.join(', ')})のデータを取得中...`)
      const tlRes = await fetch(`/api/timelines${query ? `?${query}` : ''}`)
      if (tlRes.ok) {
        setTimelines(await tlRes.json())
      }
      setLoadingMessage('')
    } catch {
      // ignore
      setLoadingMessage('')
    }
  }

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
  const seasonOptions = raidData?.seasons
    ? [...raidData.seasons].sort(
        (a, b) =>
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      )
    : []
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
        <button
          onClick={handleSearch}
          className="border px-4 py-1 rounded bg-blue-500 text-white"
        >
          検索
        </button>
      </div>
      {loadingMessage && <p>{loadingMessage}</p>}
      <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        {filtered.map((t) => (
          <li key={t.id} className="border rounded p-2 space-y-1 text-sm">
            <p>
              {t.boss} / {t.terrain} / {t.armor} / {t.difficulty} /
              {t.seasons.join(', ')}
            </p>
            <a
              href={`https://www.youtube.com/watch?v=${t.videoid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={`https://i.ytimg.com/vi/${t.videoid}/mqdefault.jpg`}
                alt="thumbnail"
                className="w-full h-auto mb-1"
              />
              <span className="text-blue-600 underline">動画を見る</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
