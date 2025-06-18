'use client'

import { useEffect, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
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
  const session = useSession()
  const supabase = useSupabaseClient()
  const [timelines, setTimelines] = useState<Timeline[]>([])
  const [raidData, setRaidData] = useState<RaidData | null>(null)
  const [boss, setBoss] = useState('')
  const [terrain, setTerrain] = useState('')
  const [armor, setArmor] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [season, setSeason] = useState('')
  const [loadingMessage, setLoadingMessage] = useState('')
  const [openTl, setOpenTl] = useState<Timeline | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editTl, setEditTl] = useState<Timeline | null>(null)
  const [editScore, setEditScore] = useState('')

  const formatScore = (value: string) => {
    const num = parseInt(value || '0')
    return num.toLocaleString()
  }

  const getDayText = (t: Timeline) => {
    if (!raidData || !t.publishedAt) return ''
    const seasonInfo = raidData.seasons.find((s) => s.number === t.season)
    if (!seasonInfo) return ''
    const start = new Date(`${seasonInfo.startDate}T00:00:00+09:00`)
    const pubUtc = new Date(t.publishedAt)
    const pub = new Date(pubUtc.getTime() + 9 * 60 * 60 * 1000)
    const cutoff = new Date(start.getTime() + 6 * 86400000 + 4 * 60 * 60 * 1000)
    if (pub >= cutoff) return '終了後'
    const diff = Math.floor((pub.getTime() - start.getTime()) / 86400000) + 1
    return `${diff}日目`
  }

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
              const data: Timeline[] = await res.json()
              data.sort((a, b) => {
                if (a.armor === '不明' && b.armor !== '不明') return 1
                if (a.armor !== '不明' && b.armor === '不明') return -1
                return parseInt(b.score || '0') - parseInt(a.score || '0')
              })
              setTimelines(data)
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

  useEffect(() => {
    const checkAdmin = async () => {
      if (session) {
        const { data } = await supabase
          .from('profiles')
          .select('admin')
          .eq('id', session.user.id)
          .maybeSingle()
        setIsAdmin(Boolean(data?.admin))
      }
    }
    checkAdmin()
  }, [session, supabase])

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
        const data: Timeline[] = await tlRes.json()
        data.sort((a, b) => {
          if (a.armor === '不明' && b.armor !== '不明') return 1
          if (a.armor !== '不明' && b.armor === '不明') return -1
          return parseInt(b.score || '0') - parseInt(a.score || '0')
        })
        setTimelines(data)
      }
      setLoadingMessage('')
    } catch {
      // ignore
      setLoadingMessage('')
    }
  }

  const handleSaveScore = async () => {
    if (!editTl) return
    try {
      const res = await fetch(`/api/timelines/${editTl.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: editTl.season || '', score: editScore }),
      })
      if (res.ok) {
        setTimelines((prev) =>
          prev.map((t) =>
            t.id === editTl.id ? { ...t, score: editScore } : t
          )
        )
      }
      setLoadingMessage('')
    } catch {
      // ignore
    } finally {
      setEditTl(null)
    }
  }

  const TimelineCard = ({ t }: { t: Timeline }) => (
    <li
      key={t.id}
      className="border rounded p-2 space-y-1 text-sm cursor-pointer relative"
      onClick={() => setOpenTl(t)}
    >
      {isAdmin && (
        <button
          className="absolute top-1 right-1 bg-white/80 border text-xs px-1 rounded"
          onClick={(e) => {
            e.stopPropagation()
            setEditTl(t)
            setEditScore(t.score)
          }}
        >
          編集
        </button>
      )}
      <div className="relative">
        <img
          src={`https://i.ytimg.com/vi/${t.videoid}/mqdefault.jpg`}
          alt="thumbnail"
          className="w-full h-auto mb-1"
        />
        <span className="absolute top-1 right-1 bg-black/50 text-white text-xs px-1">
          {getDayText(t)}
        </span>
      </div>
      <p className="text-xs">{t.title}</p>
      <p className="text-lg font-bold">{formatScore(t.score)}</p>
    </li>
  )

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
    const armorOk = armor ? t.armor === armor : true
    const difficultyOk = difficulty ? t.difficulty === difficulty : true
    return armorOk && difficultyOk
  })
  const filteredSorted = [...filtered].sort((a, b) => {
    if (a.armor === '不明' && b.armor !== '不明') return 1
    if (a.armor !== '不明' && b.armor === '不明') return -1
    return parseInt(b.score || '0') - parseInt(a.score || '0')
  })
  const highestEntries: Record<string, Timeline> = {}
  if (selectedSeason?.defenseArmors.length && armor === '') {
    for (const ar of selectedSeason.defenseArmors) {
      const found = filteredSorted.find((t) => t.armor === ar)
      if (found) highestEntries[ar] = found
    }
  }
  const highest = Object.keys(highestEntries).length
    ? null
    : filteredSorted.find((t) => t.armor !== '不明') || null

  let highestScoreText = ''
  if (selectedSeason?.type === '大決戦' && Object.keys(highestEntries).length) {
    const total = Object.values(highestEntries).reduce(
      (sum, t) => sum + parseInt(t.score || '0'),
      0
    )
    highestScoreText = formatScore(String(total))
  } else if (highest) {
    highestScoreText = formatScore(highest.score)
  }

  const grouped: Record<string, Timeline[]> = {}
  if (selectedSeason?.type === '大決戦' && armor === '') {
    for (const t of filteredSorted) {
      const key = t.armor || 'その他'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(t)
    }
    // "不明" を最後にするため並び替え
    const ordered: Record<string, Timeline[]> = {}
    Object.keys(grouped)
      .sort((a, b) => {
        if (a === '不明') return 1
        if (b === '不明') return -1
        return 0
      })
      .forEach((k) => {
        ordered[k] = grouped[k]
      })
    Object.assign(grouped, ordered)
  }

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
      {Object.keys(highestEntries).length === 0 && highest && (
        <div>
          <h3 className="font-bold">現在の最高スコア: {highestScoreText}</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-2">
            <TimelineCard t={highest} />
          </ul>
        </div>
      )}

      {Object.keys(highestEntries).length > 0 && (
        <div>
          <h3 className="font-bold">現在の最高スコア: {highestScoreText}</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-2">
            {Object.entries(highestEntries).map(([ar, t]) => (
              <TimelineCard key={ar} t={t} />
            ))}
          </ul>
        </div>
      )}
      {selectedSeason?.type === '大決戦' && armor === '' && Object.keys(grouped).length > 1 && (
        <div className="flex gap-2 flex-wrap mb-2">
          {Object.keys(grouped).map((ar) => (
            <button
              key={ar}
              className="text-blue-600 underline text-sm"
              onClick={() =>
                document.getElementById(`armor-${ar}`)?.scrollIntoView({
                  behavior: 'smooth',
                })
              }
            >
              {ar}へ
            </button>
          ))}
        </div>
      )}
      {selectedSeason?.type === '大決戦' && armor === '' ? (
        Object.entries(grouped).map(([ar, arr]) => (
          <div key={ar} id={`armor-${ar}`} className="mt-4">
            <h3 className="font-bold mb-1">{ar}</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {arr.map((t) => (
                <TimelineCard key={t.id} t={t} />
              ))}
            </ul>
          </div>
        ))
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {filteredSorted.map((t) => (
            <TimelineCard key={t.id} t={t} />
          ))}
        </ul>
      )}
      {openTl && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setOpenTl(null)}
        >
          <div
            className="bg-white p-4 rounded max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`https://i.ytimg.com/vi/${openTl.videoid}/hqdefault.jpg`}
              alt="thumbnail"
              className="w-full h-auto mb-2"
            />
            <h3 className="font-bold mb-2">{openTl.title}</h3>
            <p className="whitespace-pre-wrap text-sm">{openTl.description}</p>
          </div>
        </div>
      )}
      {editTl && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setEditTl(null)}
        >
          <div
            className="bg-white p-4 rounded space-y-2 w-64"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="flex items-center gap-2">
              <span>スコア:</span>
              <input
                type="number"
                value={editScore}
                onChange={(e) => setEditScore(e.target.value)}
                className="border rounded p-1 flex-1"
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditTl(null)} className="border px-2 py-1">
                キャンセル
              </button>
              <button
                onClick={handleSaveScore}
                className="border px-2 py-1 bg-blue-500 text-white"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
