'use client'

import { useEffect, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faUserSlash } from '@fortawesome/free-solid-svg-icons'
import { Timeline } from '../../../types/timeline'
import PageHelpButton from '../../../components/PageHelpButton'

interface Student {
  id: string
  name: string
}

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
  const [students, setStudents] = useState<Student[]>([])
  const [editTl, setEditTl] = useState<Timeline | null>(null)
  const [editScore, setEditScore] = useState('')
  const [editGuide, setEditGuide] = useState(false)
  const [editFormationStatus, setEditFormationStatus] = useState('none')
  const [editArmor, setEditArmor] = useState('')
  const [editFormation, setEditFormation] = useState('')
  const [filterGuide, setFilterGuide] = useState(false)
  const [filterFormationAdded, setFilterFormationAdded] = useState(false)
  const [filterFormationConfirmed, setFilterFormationConfirmed] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [seasonOpen, setSeasonOpen] = useState(false)

  // 動画単体の「同期時に更新しない」フラグ（管理者のみ）
  const [openTlSkipUpdate, setOpenTlSkipUpdate] = useState(false)
  const [openTlSkipUpdateLoaded, setOpenTlSkipUpdateLoaded] = useState(false)
  const [openTlSkipUpdateSaving, setOpenTlSkipUpdateSaving] = useState(false)
  const [policyError, setPolicyError] = useState('')
  const [tlJsonValue, setTlJsonValue] = useState('')
  const [tlJsonTitle, setTlJsonTitle] = useState('')
  const [tlJsonUpdatedAt, setTlJsonUpdatedAt] = useState<string | null>(null)
  const [tlJsonAuthor, setTlJsonAuthor] = useState<string | null>(null)
  const [tlJsonLoading, setTlJsonLoading] = useState(false)
  const [tlJsonSaving, setTlJsonSaving] = useState(false)
  const [tlJsonInput, setTlJsonInput] = useState('')
  const [tlJsonError, setTlJsonError] = useState('')

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
          const stuRes = await fetch('/api/students')
          if (stuRes.ok) {
            const stu: Student[] = await stuRes.json()
            setStudents(stu)
          }
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


  // モーダルで開いた動画のフラグ状態を読み込む
  useEffect(() => {
    const loadPolicy = async () => {
      if (!openTl || !isAdmin) return
      setPolicyError('')
      setOpenTlSkipUpdateLoaded(false)
      try {
        const { data, error } = await supabase
          .from('tl_video_update_policy')
          .select('skip_update')
          .eq('videoid', openTl.videoid)
          .maybeSingle()

        if (error) throw error
        setOpenTlSkipUpdate(Boolean(data?.skip_update))
      } catch {
        // 取得できない場合は「更新する(=skipしない)」扱いにする
        setOpenTlSkipUpdate(false)
      } finally {
        setOpenTlSkipUpdateLoaded(true)
      }
    }
    loadPolicy()
  }, [openTl, isAdmin, supabase])

  useEffect(() => {
    const loadTlJsonLinks = async () => {
      if (!openTl) {
        setTlJsonValue('')
        setTlJsonTitle('')
        setTlJsonUpdatedAt(null)
        setTlJsonAuthor(null)
        setTlJsonError('')
        return
      }
      setTlJsonLoading(true)
      setTlJsonError('')
      try {
        const table = openTl.season
          ? `tl_${openTl.season.toLowerCase()}`
          : 'tl_unknown'
        const { data, error } = await supabase
          .from(table)
          .select('tl_json, tl_json_title, tl_json_updated_at, tl_json_created_by')
          .eq('videoid', openTl.videoid)
          .maybeSingle()
        if (error) throw error
        const payload = (data ?? {}) as {
          tl_json?: unknown
          tl_json_title?: unknown
          tl_json_updated_at?: unknown
          tl_json_created_by?: unknown
        }
        setTlJsonValue(typeof payload.tl_json === 'string' ? payload.tl_json : '')
        setTlJsonTitle(typeof payload.tl_json_title === 'string' ? payload.tl_json_title : '')
        setTlJsonUpdatedAt(
          typeof payload.tl_json_updated_at === 'string' ? payload.tl_json_updated_at : null
        )
        setTlJsonAuthor(
          typeof payload.tl_json_created_by === 'string' ? payload.tl_json_created_by : null
        )
      } catch {
        setTlJsonError('TL JSONの取得に失敗しました')
      } finally {
        setTlJsonLoading(false)
      }
    }
    loadTlJsonLinks()
  }, [openTl, supabase])

  const saveTlJsonLink = async () => {
    if (!openTl) return
    if (!session?.user) {
      setTlJsonError('ログインが必要です')
      return
    }
    const raw = tlJsonInput.trim()
    if (!raw) {
      setTlJsonError('JSONを入力してください')
      return
    }
    setTlJsonSaving(true)
    setTlJsonError('')
    try {
      const parsed = JSON.parse(raw) as { projectName?: string }
      const title =
        parsed && typeof parsed.projectName === 'string' ? parsed.projectName : ''
      const table = openTl.season
        ? `tl_${openTl.season.toLowerCase()}`
        : 'tl_unknown'
      const now = new Date().toISOString()
      const { error } = await supabase
        .from(table)
        .update({
          tl_json: raw,
          tl_json_title: title,
          tl_json_updated_at: now,
          tl_json_created_by: session.user.id,
        })
        .eq('videoid', openTl.videoid)
      if (error) throw error
      setTlJsonInput('')
      setTlJsonValue(raw)
      setTlJsonTitle(title)
      setTlJsonUpdatedAt(now)
      setTlJsonAuthor(session.user.id)
    } catch {
      setTlJsonError('JSONの保存に失敗しました（形式を確認してください）')
    } finally {
      setTlJsonSaving(false)
    }
  }

  const setVideoSkipUpdate = async (videoid: string, next: boolean) => {
    if (!isAdmin) return
    setPolicyError('')
    setOpenTlSkipUpdateSaving(true)
    try {
      if (next) {
        const { error } = await supabase
          .from('tl_video_update_policy')
          .upsert(
            { videoid, skip_update: true, updated_at: new Date().toISOString() },
            { onConflict: 'videoid' }
          )
        if (error) throw error
      } else {
        // OFF の場合はレコードを消して「更新する」状態に戻す
        const { error } = await supabase
          .from('tl_video_update_policy')
          .delete()
          .eq('videoid', videoid)
        if (error) throw error
      }
      setOpenTlSkipUpdate(next)
    } catch {
      setPolicyError('保存に失敗しました（権限/RLS設定を確認してください）')
    } finally {
      setOpenTlSkipUpdateSaving(false)
    }
  }

  const handleSeasonSelect = (value: string) => {
    setSeason(value)
    setSeasonOpen(false)
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
  }

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

  const handleSaveEdit = async () => {
    if (!editTl) return
    try {
      const res = await fetch(`/api/timelines/${editTl.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season: editTl.season || '',
          score: editScore,
          guide: editGuide,
          formationStatus: editFormationStatus,
          armor: editArmor,
          formation: editFormation,
        }),
      })
      if (res.ok) {
        setTimelines((prev) =>
          prev.map((t) =>
            t.id === editTl.id
              ? {
                  ...t,
                  score: editScore,
                  guide: editGuide,
                  formationStatus: editFormationStatus,
                  armor: editArmor,
                  formation: editFormation,
                }
              : t
          )
        )
      }
  } catch {
    // ignore
  } finally {
    setEditTl(null)
    setEditGuide(false)
    setEditFormationStatus('none')
    setEditArmor('')
    setEditFormation('')
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
          className="absolute -top-2 right-1 bg-white/80 border text-xs px-1 rounded"
          onClick={(e) => {
            e.stopPropagation()
            setEditTl(t)
            setEditScore(t.score)
            setEditGuide(Boolean(t.guide))
            setEditFormationStatus(t.formationStatus || 'none')
            setEditArmor(t.armor)
            setEditFormation(t.formation)
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
          {t.guide && (
            <span className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1">
              解説付き
            </span>
          )}
        </div>
        <p className="text-xs">{t.title}</p>
        <p className="text-lg font-bold flex items-center">
          {formatScore(t.score)}
          {(!t.formation || t.formation === '[]') && (
            <FontAwesomeIcon icon={faUserSlash} className="text-red-500 ml-1" />
          )}
          {t.formation && t.formation !== '[]' && t.formationStatus !== 'manual' && (
            <FontAwesomeIcon icon={faUser} className="text-gray-500 ml-1" />
          )}
          {t.formationStatus === 'manual' && (
            <FontAwesomeIcon icon={faUser} className="text-green-500 ml-1" />
          )}
        </p>
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
    const guideOk = filterGuide ? Boolean(t.guide) : true
    const formationAddedOk = filterFormationAdded
      ? t.formation && t.formation !== '[]'
      : true
    const formationConfirmedOk = filterFormationConfirmed
      ? t.formationStatus === 'manual'
      : true
    return (
      armorOk &&
      difficultyOk &&
      guideOk &&
      formationAddedOk &&
      formationConfirmedOk
    )
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
      <div className="flex items-center gap-2">
        <h2 className="text-xl">TL検索</h2>
        <PageHelpButton pageKey="tl-search" />
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={boss}
            onChange={(e) => setBoss(e.target.value)}
            className="border rounded px-2 py-1 flex-1 min-w-[8rem]"
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
            className="border rounded px-2 py-1 flex-1 min-w-[8rem]"
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
          className="border rounded px-2 py-1 flex-1 min-w-[8rem]"
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
            className="border rounded px-2 py-1 flex-1 min-w-[8rem]"
        >
          <option value="">全て</option>
          {difficulties.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
          </select>
          <div className="relative flex-1 min-w-[8rem]">
            <button
              type="button"
              className="border rounded px-2 py-1 w-full text-left"
              onClick={() => setSeasonOpen((o) => !o)}
            >
              {season ? `シーズン${season}` : 'シーズンを選択'}
            </button>
            {seasonOpen && (
              <ul className="absolute z-10 bg-white border rounded mt-1 max-h-60 overflow-y-auto w-full text-sm">
                <li
                  className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                  onClick={() => handleSeasonSelect('')}
                >
                  全て
                </li>
                {availableSeasons.map((s) => (
                  <li
                    key={s.number}
                    className="px-2 py-1 hover:bg-gray-100 cursor-pointer whitespace-nowrap"
                    onClick={() => handleSeasonSelect(s.number)}
                  >
                    {`シーズン${s.number}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={handleSearch}
            className="border px-3 py-1 rounded bg-blue-500 text-white"
          >
            検索
          </button>
        </div>
        <div>
          <button
            className="border rounded px-2 py-1"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            詳細検索
          </button>
          {showAdvanced && (
            <div className="mt-2 space-y-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filterGuide}
                  onChange={(e) => setFilterGuide(e.target.checked)}
                />
                <span>解説ありのみ</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filterFormationAdded}
                  onChange={(e) => setFilterFormationAdded(e.target.checked)}
                />
                <span>編成追加のみ</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filterFormationConfirmed}
                  onChange={(e) => setFilterFormationConfirmed(e.target.checked)}
                />
                <span>編成確認済みのみ</span>
              </label>
            </div>
          )}
        </div>
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
          onClick={() => {
            setOpenTl(null)
            setPolicyError('')
          }}
        >
          <div
            className="bg-white rounded max-w-md w-full h-[80vh] max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* サムネ（固定・クリックで動画を開く） */}
            <div className="shrink-0 border-b p-4 pb-3">
              <a
                href={`https://www.youtube.com/watch?v=${openTl.videoid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
                aria-label="YouTubeで動画を開く"
              >
                <img
                  src={`https://i.ytimg.com/vi/${openTl.videoid}/hqdefault.jpg`}
                  alt="thumbnail"
                  className="w-full h-auto rounded cursor-pointer"
                />
              </a>
            </div>

            {/* 本文（スクロール） */}
            <div className="flex-1 overflow-y-auto p-4 pt-3">
              <h3 className="font-bold mb-2">{openTl.title}</h3>
              <p className="whitespace-pre-wrap text-sm">{openTl.description}</p>

              {isAdmin && (
                <div className="mt-3 border-t pt-3 text-sm space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={openTlSkipUpdate}
                      disabled={!openTlSkipUpdateLoaded || openTlSkipUpdateSaving}
                      onChange={(e) =>
                        setVideoSkipUpdate(openTl.videoid, e.target.checked)
                      }
                    />
                    <span>同期時にこの動画を更新しない</span>
                  </label>
                  <p className="text-xs text-gray-600">
                    ONにすると、既にDBにあるこのvideoidは同期処理で上書きされません（手動編集を保護）。
                  </p>
                  {policyError && (
                    <p className="text-xs text-red-600">{policyError}</p>
                  )}
                </div>
              )}

              <div className="mt-3 border-t pt-3 text-sm space-y-2">
                <h4 className="font-semibold">TLメーカーJSON</h4>
                <p className="text-xs text-gray-600">
                  TLメーカーから出力したJSONを動画に紐付けできます（各動画で1件）。
                </p>
                <textarea
                  value={tlJsonInput}
                  onChange={(e) => setTlJsonInput(e.target.value)}
                  placeholder="TLメーカーJSONを貼り付け"
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono h-28"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 disabled:opacity-60"
                    disabled={tlJsonSaving}
                    onClick={saveTlJsonLink}
                  >
                    {tlJsonSaving ? '保存中...' : 'この動画に紐付ける'}
                  </button>
                  {tlJsonError && (
                    <span className="text-xs text-red-600">{tlJsonError}</span>
                  )}
                </div>
                {tlJsonLoading ? (
                  <p className="text-xs text-gray-500">読み込み中...</p>
                ) : (
                  <div className="space-y-2">
                    {tlJsonValue ? (
                      <details className="rounded border border-gray-200 p-2">
                        <summary className="cursor-pointer text-xs">
                          {tlJsonTitle || '無題'}
                          {tlJsonUpdatedAt
                            ? ` / ${new Date(tlJsonUpdatedAt).toLocaleString()}`
                            : ''}
                        </summary>
                        {tlJsonAuthor && (
                          <p className="mt-1 text-xs text-gray-500">登録者: {tlJsonAuthor}</p>
                        )}
                        <pre className="mt-2 whitespace-pre-wrap text-xs">{tlJsonValue}</pre>
                      </details>
                    ) : (
                      <p className="text-xs text-gray-500">まだ紐付けはありません。</p>
                    )}
                  </div>
                )}
              </div>

              {openTl.formation &&
                openTl.formation !== '[]' &&
                students.length > 0 && (
                  <div className="mt-2 space-y-1 text-sm">
                    {JSON.parse(openTl.formation).map(
                      (team: unknown[], idx: number) => (
                        <div key={idx}>
                          {team.map((member: unknown, i: number) => {
                            const obj =
                              member as
                                | { id?: string; name?: string; level?: number }
                                | string
                            const id = typeof obj === 'string' ? obj : obj.id || ''
                            const name =
                              typeof obj === 'object' && obj && 'name' in obj
                                ? (obj as { name?: string }).name
                                : undefined
                            const lv =
                              typeof obj === 'object' &&
                              obj &&
                              'level' in obj &&
                              obj.level
                                ? ` Lv${obj.level}`
                                : ''
                            const student = students.find((s) => s.id === id)
                            return (
                              <p key={i}>
                                {student ? student.name : name || id}
                                {lv}
                              </p>
                            )
                          })}
                        </div>
                      )
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
{editTl && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => {
            setEditTl(null)
            setEditGuide(false)
            setEditFormationStatus('none')
          }}
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
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editGuide}
                onChange={(e) => setEditGuide(e.target.checked)}
              />
              <span>解説付き</span>
            </label>
            <label className="flex items-center gap-2">
              <span>編成状態:</span>
              <select
                value={editFormationStatus}
                onChange={(e) => setEditFormationStatus(e.target.value)}
                className="border rounded p-1 flex-1"
              >
                <option value="none">none</option>
                <option value="auto">auto</option>
                <option value="manual">manual</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span>装甲:</span>
              <select
                value={editArmor}
                onChange={(e) => setEditArmor(e.target.value)}
                className="border rounded p-1 flex-1"
              >
                <option value="">未設定</option>
                {armors.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
                <option value="不明">不明</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span>編成(JSON):</span>
              <textarea
                value={editFormation}
                onChange={(e) => setEditFormation(e.target.value)}
                className="border rounded p-1 text-sm h-24"
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setEditTl(null)
                  setEditGuide(false)
                  setEditFormationStatus('none')
                  setEditArmor('')
                  setEditFormation('')
                }}
                className="border px-2 py-1"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveEdit}
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
