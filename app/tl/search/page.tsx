'use client'

import { useEffect, useState } from 'react'
import { Timeline } from '../../../types/timeline'

export default function TLSearchPage() {
  const [timelines, setTimelines] = useState<Timeline[]>([])
  const [boss, setBoss] = useState('')
  const [terrain, setTerrain] = useState('')
  const [armor, setArmor] = useState('')
  const [seasons, setSeasons] = useState<string[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/timelines')
        if (res.ok) {
          setTimelines(await res.json())
        }
      } catch {
        // ignore
      }
    }
    load()
  }, [])

  const terrains = Array.from(new Set(timelines.map((t) => t.terrain)))
  const armors = Array.from(new Set(timelines.map((t) => t.armor)))
  const seasonOptions = Array.from(new Set(timelines.flatMap((t) => t.seasons)))

  const toggleSeason = (v: string) => {
    setSeasons((prev) =>
      prev.includes(v) ? prev.filter((s) => s !== v) : [...prev, v]
    )
  }

  const filtered = timelines.filter((t) => {
    const bossOk = boss ? t.boss.includes(boss) : true
    const terrainOk = terrain ? t.terrain === terrain : true
    const armorOk = armor ? t.armor === armor : true
    const seasonOk = seasons.length
      ? seasons.every((s) => t.seasons.includes(s))
      : true
    return bossOk && terrainOk && armorOk && seasonOk
  })

  return (
    <main className="p-4 space-y-4">
      <h2 className="text-xl">TL検索</h2>
      <div className="space-y-2">
        <input
          type="text"
          value={boss}
          onChange={(e) => setBoss(e.target.value)}
          placeholder="ボス名"
          className="border rounded px-2 py-1 w-full"
        />
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
              {t.boss} / {t.terrain} / {t.armor} / {t.seasons.join(', ')}
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
