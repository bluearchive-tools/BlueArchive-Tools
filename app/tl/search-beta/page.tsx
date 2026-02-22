'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Timeline } from '../../../types/timeline'
import { parseTlFormation } from '../../../lib/tl-compatibility'

type Season = {
  number: string
  boss: string
  terrain: string
  type: string
  defenseArmors: string[]
}

type RaidData = {
  bosses: string[]
  terrains: string[]
  armors: string[]
  types: string[]
  seasons: Season[]
}

type BetaRow = {
  id: string
  rank: number
  title: string
  totalScore: number
  videoid: string
  byArmor: Record<string, number>
  sourceByArmor: Record<string, Timeline>
  season: string
  type: string
  terrain: string
  difficulty: string
}

const splitSquads = (formation: string) => {
  const members = parseTlFormation(formation)
  const squads: string[][] = []
  for (let i = 0; i < members.length; i += 6) {
    squads.push(members.slice(i, i + 6).map((m) => m.name || m.id || '?'))
  }
  return squads.length ? squads : [[]]
}

export default function TLSearchBetaPage() {
  const [raidData, setRaidData] = useState<RaidData | null>(null)
  const [timelines, setTimelines] = useState<Timeline[]>([])
  const [boss, setBoss] = useState('')
  const [terrain, setTerrain] = useState('')
  const [season, setSeason] = useState('')
  const [openRow, setOpenRow] = useState<BetaRow | null>(null)
  const [openArmorTab, setOpenArmorTab] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const raidRes = await fetch('/api/raids')
        if (!raidRes.ok) throw new Error('raid fetch failed')
        const data: RaidData = await raidRes.json()
        data.seasons.sort((a, b) => Number(b.number) - Number(a.number))
        setRaidData(data)

        const latest = data.seasons[0]
        if (latest) {
          setSeason(latest.number)
          setBoss(latest.boss)
          setTerrain(latest.terrain)
          const tlRes = await fetch(`/api/timelines?season=${latest.number}`)
          if (!tlRes.ok) throw new Error('timelines fetch failed')
          const tlData: Timeline[] = await tlRes.json()
          setTimelines(tlData)
        }
      } catch {
        setError('データ取得に失敗しました。時間をおいて再度お試しください。')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const handleSearch = async () => {
    if (!season) {
      setError('シーズンを選択してください。')
      return
    }
    setLoading(true)
    setError('')
    try {
      const tlRes = await fetch(`/api/timelines?season=${season}`)
      if (!tlRes.ok) throw new Error('timelines fetch failed')
      const data: Timeline[] = await tlRes.json()
      setTimelines(data)
    } catch {
      setError('TLデータ取得に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const selectedSeason = useMemo(() => raidData?.seasons.find((s) => s.number === season), [raidData, season])

  const filtered = useMemo(() => {
    return timelines.filter((t) => {
      if (season && t.season !== season) return false
      if (boss && (selectedSeason?.boss ?? '') !== boss) return false
      if (terrain && (selectedSeason?.terrain ?? '') !== terrain) return false
      return true
    })
  }, [timelines, season, boss, terrain, selectedSeason])

  const rows = useMemo<BetaRow[]>(() => {
    const type = selectedSeason?.type ?? '総力戦'
    if (type !== '大決戦') {
      return filtered
        .slice()
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, 100)
        .map((t, idx) => ({
          id: `${t.videoid}-${t.id}`,
          rank: idx + 1,
          title: t.title,
          totalScore: Number(t.score || 0),
          videoid: t.videoid,
          byArmor: { [t.armor || '不明']: Number(t.score || 0) },
          sourceByArmor: { [t.armor || '不明']: t },
          season: t.season || '',
          type,
          terrain: selectedSeason?.terrain || '',
          difficulty: t.difficulty || '',
        }))
    }

    const grouped = new Map<string, BetaRow>()
    filtered.forEach((t) => {
      const key = t.videoid
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          rank: 0,
          title: t.title,
          totalScore: 0,
          videoid: t.videoid,
          byArmor: {},
          sourceByArmor: {},
          season: t.season || '',
          type,
          terrain: selectedSeason?.terrain || '',
          difficulty: t.difficulty || '',
        })
      }
      const row = grouped.get(key)!
      const armor = t.armor || '不明'
      row.byArmor[armor] = Math.max(row.byArmor[armor] || 0, Number(t.score || 0))
      row.sourceByArmor[armor] = t
      row.totalScore = Object.values(row.byArmor).reduce((a, b) => a + b, 0)
    })

    return Array.from(grouped.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 100)
      .map((r, idx) => ({ ...r, rank: idx + 1 }))
  }, [filtered, selectedSeason])

  const armorTabs = selectedSeason?.defenseArmors?.length ? selectedSeason.defenseArmors : ['軽装備', '重装甲', '特殊装甲']

  const currentDetailTimeline = useMemo(() => {
    if (!openRow) return null
    if (openRow.type === '大決戦') {
      return openRow.sourceByArmor[openArmorTab] ?? Object.values(openRow.sourceByArmor)[0] ?? null
    }
    return Object.values(openRow.sourceByArmor)[0] ?? null
  }, [openRow, openArmorTab])

  useEffect(() => {
    if (!openRow) return
    const first = Object.keys(openRow.byArmor)[0] || ''
    setOpenArmorTab(first)
  }, [openRow])

  return (
    <main className="p-4 space-y-4 bg-[#edf4fb] min-h-screen">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{selectedSeason?.type === '大決戦' ? '大決戦情報 β' : '総力戦情報 β'}</h2>
        <Link href="/tl/search" className="underline text-sm">通常版へ</Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <select className="border rounded px-2 py-2" value={season} onChange={(e) => {
          const nextSeason = e.target.value
          setSeason(nextSeason)
          const selected = raidData?.seasons.find((s) => s.number === nextSeason)
          if (selected) {
            setBoss(selected.boss)
            setTerrain(selected.terrain)
          }
        }}>
          <option value="">シーズン</option>
          {raidData?.seasons.map((s) => <option key={s.number} value={s.number}>{s.number}</option>)}
        </select>
        <select className="border rounded px-2 py-2" value={boss} onChange={(e) => setBoss(e.target.value)}>
          <option value="">ボス</option>
          {raidData?.bosses.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select className="border rounded px-2 py-2" value={terrain} onChange={(e) => setTerrain(e.target.value)}>
          <option value="">地形</option>
          {raidData?.terrains.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <button className="border rounded px-2 py-2 bg-cyan-100 font-semibold" onClick={handleSearch} disabled={loading}>
          {loading ? '取得中...' : '検索'}
        </button>
        <div className="rounded bg-white border px-2 py-2 text-sm">件数: {rows.length}</div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border bg-white overflow-hidden">
        {rows.slice(0, 30).map((row) => (
          <div key={row.id} className="border-b p-2 sm:p-3 flex items-center gap-3">
            <div className="w-16 text-center font-bold">{row.rank}位</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{row.title || row.videoid}</p>
              {row.type === '大決戦' ? (
                <div className="grid grid-cols-3 gap-1 text-xs mt-1">
                  {armorTabs.map((a) => (
                    <div key={a} className="rounded bg-gray-100 px-2 py-1 text-center">
                      <div>{a}</div>
                      <div className="font-semibold">{(row.byArmor[a] || 0).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xl font-bold mt-1">{row.totalScore.toLocaleString()}</p>
              )}
            </div>
            <button className="border rounded px-3 py-2" onClick={() => setOpenRow(row)}>詳細</button>
          </div>
        ))}
      </div>

      {openRow && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3" onClick={() => setOpenRow(null)}>
          <div className="bg-white w-[94vw] max-w-4xl h-[78vh] rounded-xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-bold text-xl">部隊情報</h3>
              <button className="text-2xl" onClick={() => setOpenRow(null)}>×</button>
            </div>

            {openRow.type === '大決戦' && (
              <div className="grid grid-cols-3 border-b text-center">
                {armorTabs.map((a) => (
                  <button
                    key={a}
                    className={`py-2 font-semibold ${openArmorTab === a ? 'bg-white text-yellow-700' : 'bg-sky-100 text-slate-700'}`}
                    onClick={() => setOpenArmorTab(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}

            <div className="p-3 overflow-y-auto space-y-3 flex-1 bg-[#eef5fb]">
              {(currentDetailTimeline ? splitSquads(currentDetailTimeline.formation) : [[]]).map((sq, i) => (
                <div key={i} className="rounded border bg-white p-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold">部隊{i + 1}</div>
                    <div className="text-sm text-gray-700">{sq.join(' / ') || '-'}</div>
                  </div>
                  <button className="rounded bg-cyan-300 px-4 py-2" onClick={() => navigator.clipboard?.writeText(sq.join(','))}>
                    コピー
                  </button>
                </div>
              ))}
            </div>

            <div className="p-3 border-t bg-white flex justify-center">
              <button className="rounded bg-cyan-300 px-10 py-2 text-2xl font-bold" onClick={() => setOpenRow(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
