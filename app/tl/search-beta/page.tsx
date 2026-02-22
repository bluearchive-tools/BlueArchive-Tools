'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Timeline } from '../../../types/timeline'
import { parseTlFormation } from '../../../lib/tl-compatibility'

type Season = {
  number: string
  boss: string
  terrain: string
  type: string
  defenseArmors: string[]
  startDate: string
  endDate: string
}

type RaidData = {
  bosses: string[]
  terrains: string[]
  armors: string[]
  types: string[]
  seasons: Season[]
}

type Student = {
  id: string
  name: string
  image: string
}

type ProfileRow = {
  id: string
  username?: string | null
  nickname?: string | null
  icon_student_id?: string | null
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
    squads.push(members.slice(i, i + 6).map((m) => m.id || ''))
  }
  return squads.length ? squads : [[]]
}

export default function TLSearchBetaPage() {
  const [raidData, setRaidData] = useState<RaidData | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [timelines, setTimelines] = useState<Timeline[]>([])
  const [ownerMap, setOwnerMap] = useState<Record<string, ProfileRow>>({})
  const [ownerByVideo, setOwnerByVideo] = useState<Record<string, string>>({})
  const [boss, setBoss] = useState('')
  const [terrain, setTerrain] = useState('')
  const [season, setSeason] = useState('')
  const [openRow, setOpenRow] = useState<BetaRow | null>(null)
  const [openArmorTab, setOpenArmorTab] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [visibleCount, setVisibleCount] = useState(30)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const studentMap = useMemo(() => {
    const map: Record<string, Student> = {}
    students.forEach((s) => {
      map[s.id] = s
    })
    return map
  }, [students])

  const loadOwnerProfiles = useCallback(async (data: Timeline[]) => {
    const videoIds = Array.from(new Set(data.map((t) => t.videoid).filter(Boolean)))
    if (videoIds.length === 0) {
      setOwnerByVideo({})
      setOwnerMap({})
      return
    }

    try {
      const res = await fetch('/api/tl-owner-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds }),
      })
      if (!res.ok) throw new Error('owner profiles fetch failed')
      const json = (await res.json()) as {
        ownerByVideo?: Record<string, string>
        profiles?: Record<string, ProfileRow>
      }
      setOwnerByVideo(json.ownerByVideo ?? {})
      setOwnerMap(json.profiles ?? {})
    } catch {
      setOwnerByVideo({})
      setOwnerMap({})
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const [raidRes, stuRes] = await Promise.all([fetch('/api/raids'), fetch('/api/students')])
        if (!raidRes.ok) throw new Error('raid fetch failed')
        const data: RaidData = await raidRes.json()
        data.seasons.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
        setRaidData(data)
        if (stuRes.ok) {
          const stuData: Student[] = await stuRes.json()
          setStudents(stuData)
        }

        const latest = data.seasons[0]
        if (latest) {
          setSeason(latest.number)
          setBoss(latest.boss)
          setTerrain(latest.terrain)
          const tlRes = await fetch(`/api/timelines?season=${latest.number}`)
          if (!tlRes.ok) throw new Error('timelines fetch failed')
          const tlData: Timeline[] = await tlRes.json()
          setTimelines(tlData)
          setVisibleCount(30)
          await loadOwnerProfiles(tlData)
        }
      } catch {
        setError('データ取得に失敗しました。時間をおいて再度お試しください。')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [loadOwnerProfiles])

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
      setVisibleCount(30)
      await loadOwnerProfiles(data)
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
      const armorType = t.armor || '不明'
      row.byArmor[armorType] = Math.max(row.byArmor[armorType] || 0, Number(t.score || 0))
      row.sourceByArmor[armorType] = t
      row.totalScore = Object.values(row.byArmor).reduce((a, b) => a + b, 0)
    })

    return Array.from(grouped.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 100)
      .map((r, idx) => ({ ...r, rank: idx + 1 }))
  }, [filtered, selectedSeason])

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries
      if (entry?.isIntersecting) {
        setVisibleCount((prev) => Math.min(prev + 20, rows.length))
      }
    }, { rootMargin: '300px 0px' })

    const node = sentinelRef.current
    if (node) observer.observe(node)
    return () => observer.disconnect()
  }, [rows.length])

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

  const getDisplayTimeline = (row: BetaRow) => {
    if (row.type === '大決戦') {
      return Object.values(row.sourceByArmor).sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0]
    }
    return Object.values(row.sourceByArmor)[0]
  }

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
        {rows.slice(0, visibleCount).map((row) => {
          const timeline = getDisplayTimeline(row)
          const ownerId = ownerByVideo[row.videoid]
          const owner = ownerId ? ownerMap[ownerId] : null
          const ownerName = owner?.nickname || owner?.username || '投稿者不明'
          const iconStudent = owner?.icon_student_id ? studentMap[owner.icon_student_id] : null
          const lastSquad = timeline ? splitSquads(timeline.formation).slice(-1)[0] || [] : []
          return (
            <div key={row.id} className="border-b p-2 sm:p-3 flex items-center gap-3 bg-gradient-to-r from-slate-100 to-slate-50">
              <div className="w-14 text-center text-2xl font-bold">{row.rank}位</div>
              <div className="w-16 h-16 rounded-xl bg-white border overflow-hidden flex items-center justify-center shrink-0">
                {iconStudent?.image ? (
                  <img src={iconStudent.image} alt={ownerName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-500">ICON</span>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate">{ownerName}</p>
                  <p className="text-xs text-gray-500 truncate">{row.title || row.videoid}</p>
                </div>
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
                  <p className="text-2xl font-bold mt-1">{row.totalScore.toLocaleString()}</p>
                )}
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {lastSquad.map((studentId, i) => {
                    const member = studentMap[studentId]
                    return (
                      <div key={`${studentId}-${i}`} className="w-12 h-12 rounded-md border bg-white shrink-0 overflow-hidden">
                        {member?.image ? (
                          <img src={member.image} alt={member.name} className="w-full h-full object-cover" title={member.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">?</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <button className="border rounded px-3 py-2 bg-white" onClick={() => setOpenRow(row)}>詳細</button>
            </div>
          )
        })}
        <div ref={sentinelRef} className="h-8" />
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
                    <div className="text-sm text-gray-700">{sq.map((id) => studentMap[id]?.name || id || '?').join(' / ') || '-'}</div>
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
