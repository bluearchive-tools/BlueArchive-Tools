'use client'

import { useEffect, useState } from 'react'
import { Timeline } from '../../../types/timeline'

interface RaidData {
  bosses: string[]
  terrains: string[]
  armors: string[]
  difficulties: string[]
  seasons: string[]
}

export default function TLSearchPage() {
  const [timelines, setTimelines] = useState<Timeline[]>([])
  const [raidData, setRaidData] = useState<RaidData | null>(null)
  const [boss, setBoss] = useState('')
  const [terrain, setTerrain] = useState('')
  const [armor, setArmor] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [seasons, setSeasons] = useState<string[]>([])

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
  const difficulties = raidData?.difficulties ?? []
  const seasonOptions = raidData?.seasons ?? []

  const toggleSeason = (v: string) => {
    setSeasons((prev) =>
      prev.includes(v) ? prev.filter((s) => s !== v) : [...prev, v]
    )
  }

  const filtered = timelines.filter((t) => {
    const bossOk = boss ? t.boss === boss : true
    const terrainOk = terrain ? t.terrain === terrain : true
    const armorOk = armor ? t.armor === armor : true
    const difficultyOk = difficulty ? t.difficulty === difficulty : true
    const seasonOk = seasons.length
      ? seasons.every((s) => t.seasons.includes(s))
      : true
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
          onChange={(e) => setArmor(e.target.value)}
          className="border rounded px-2 py-1 w-full"
        >
          <option value="">装甲を選択</option>
          {armors.map((a) => (
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
          <option value="">難易度を選択</option>
          {difficulties.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <div className="space-x-2">
          {seasonOptions.map((s) => (
            <label key={s} className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={seasons.includes(s)}
                onChange={() => toggleSeason(s)}
              />
              <span>{s}</span>
            </label>
          ))}
        </div>
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
