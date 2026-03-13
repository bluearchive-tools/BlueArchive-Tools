'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLink, faUser, faUserSlash } from '@fortawesome/free-solid-svg-icons'
import { faBilibili, faYoutube } from '@fortawesome/free-brands-svg-icons'
import { Timeline } from '../../../types/timeline'
import PageHelpButton from '../../../components/PageHelpButton'
import StudentSelect from '../../../components/StudentSelect'
import StudentImageStyleCard from '../../../components/StudentImageStyleCard'
import {
  compareTlCompatibility,
  parseTlFormation,
  type OwnedStudentStats,
} from '../../../lib/tl-compatibility'

interface Student {
  id: string
  name: string
  image: string
  attackType: string
  defenseType: string
  hasAccessory?: boolean
  styleIds?: string[]
  styleOf?: string
  altIds?: string[]
  altOf?: string
  initialStars: number
  role: string
  characterType: string
  position: string
  exHitDelay?: number
  normalHitDelay?: number
}

type FormationMember = {
  id: string
  name?: string
  level?: number
  star?: number
  unique_star?: number
}

const ATTACK_TYPE_RING_COLORS: Record<string, string> = {
  爆発: '#920b05',
  貫通: '#c08b0b',
  神秘: '#296c99',
  振動: '#b060aa',
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

type VideoVisibility = 'public' | 'restricted' | 'private'
type VideoSettings = {
  includeSquad?: boolean
  allowTl?: boolean
  tlLocked?: boolean
  visibility?: VideoVisibility
  allowedUserIds?: string[]
  ownerUserId?: string | null
  hideTlUntilYoutube?: boolean
}

type FormationCardStyle = 'student-image' | 'compact'

type EditSquad = {
  strikers: string[]
  specials: string[]
}

type VideoSettingsRow = {
  videoid: string
  include_squad?: boolean | null
  allow_tl?: boolean | null
  tl_locked?: boolean | null
  visibility?: VideoVisibility | null
  allowed_user_ids?: string[] | string | null
  owner_user_id?: string | null
  hide_tl_until_youtube?: boolean | null
}

type SocialLink = {
  service?: string
  verified?: boolean
  channelId?: string | null
  biliUid?: string | null
}

const isYouTubeNetworkBlocked = (err: unknown) => {
  if (err instanceof TypeError) return true
  if (err instanceof Error) {
    return /failed to fetch|networkerror|load failed|blocked/i.test(err.message)
  }
  return false
}

const parseSocialLinks = (raw: unknown): SocialLink[] => {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as SocialLink[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as SocialLink[]) : []
    } catch {
      return []
    }
  }
  return []
}

const parseAllowedIdentifiers = (raw: string) =>
  raw
    .split(/[\n,]+/)
    .map((v) => v.trim())
    .filter(Boolean)

const parseVideoRef = (videoid: string) => {
  if (videoid.startsWith('bili:')) {
    return { platform: 'bilibili' as const, id: videoid.replace(/^bili:/, '') }
  }
  return { platform: 'youtube' as const, id: videoid }
}

const toStoredVideoId = (platform: 'youtube' | 'bilibili', id: string) =>
  platform === 'bilibili' ? `bili:${id}` : id

const toFormationNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value
}

const parseFormationTeams = (formation: string): FormationMember[][] => {
  if (!formation || formation === '[]') return []
  try {
    const parsed = JSON.parse(formation)
    if (!Array.isArray(parsed)) return []
    return parsed.map((team): FormationMember[] => {
      if (!Array.isArray(team)) return []
      return team
        .map((member) => {
          if (typeof member === 'string') {
            return { id: member }
          }
          if (!member || typeof member !== 'object') return null
          const record = member as Record<string, unknown>
          const memberId = typeof record.id === 'string' ? record.id : ''
          if (!memberId) return null
          return {
            id: memberId,
            name: typeof record.name === 'string' ? record.name : undefined,
            level: toFormationNumber(record.level),
            star: toFormationNumber(record.star),
            unique_star: toFormationNumber(record.unique_star),
          }
        })
        .filter((member): member is FormationMember => Boolean(member?.id))
    })
  } catch {
    return []
  }
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
  const [searchError, setSearchError] = useState('')
  const [openTl, setOpenTl] = useState<Timeline | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUsername, setCurrentUsername] = useState<string | null>(null)
  const [userTlDefaults, setUserTlDefaults] = useState<{
    includeSquad: boolean
    allowTl: boolean
    visibility: VideoVisibility
    allowedUserIds: string[]
    hideTlUntilYoutube: boolean
    formationCardStyle: FormationCardStyle
  } | null>(null)
  const [youtubeChannelId, setYoutubeChannelId] = useState<string | null>(null)
  const [bilibiliUid, setBilibiliUid] = useState<string | null>(null)
  const [videoChannelId, setVideoChannelId] = useState<string | null>(null)
  const [ownerCheckLoading, setOwnerCheckLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('overview')
  const [students, setStudents] = useState<Student[]>([])
  const [editTl, setEditTl] = useState<Timeline | null>(null)
  const [editScore, setEditScore] = useState('')
  const [editGuide, setEditGuide] = useState(false)
  const [editFormationStatus, setEditFormationStatus] = useState('none')
  const [editArmor, setEditArmor] = useState('')
  const [editDifficulty, setEditDifficulty] = useState('')
  const [editFormation, setEditFormation] = useState('')
  const [editSquads, setEditSquads] = useState<EditSquad[]>([])
  const [editSquadsDirty, setEditSquadsDirty] = useState(false)
  const [editFormationMemberMap, setEditFormationMemberMap] = useState<
    Record<string, Record<string, unknown>>
  >({})
  const [editStatsOpen, setEditStatsOpen] = useState(false)
  const [editTlSkipUpdate, setEditTlSkipUpdate] = useState(false)
  const [editTlSkipUpdateLoaded, setEditTlSkipUpdateLoaded] = useState(false)
  const [editTlSkipUpdateSaving, setEditTlSkipUpdateSaving] = useState(false)
  const [editPolicyError, setEditPolicyError] = useState('')
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
  const [tlJsonAuthorProfile, setTlJsonAuthorProfile] = useState<{
    id: string
    username: string | null
    nickname: string | null
  } | null>(null)
  const [tlJsonLoading, setTlJsonLoading] = useState(false)
  const [tlJsonSaving, setTlJsonSaving] = useState(false)
  const [tlJsonInput, setTlJsonInput] = useState('')
  const [tlJsonError, setTlJsonError] = useState('')
  const [tlInputMode, setTlInputMode] = useState<'json' | 'text'>('json')
  const [modalClosing, setModalClosing] = useState(false)
  const [tlRevealUnlocked, setTlRevealUnlocked] = useState<Record<string, boolean>>({})
  const [videoSettingsMap, setVideoSettingsMap] = useState<Record<string, VideoSettings>>({})
  const [openTlSettings, setOpenTlSettings] = useState<{
    includeSquad: boolean
    allowTl: boolean
    tlLocked: boolean
    visibility: VideoVisibility
    allowedUserIds: string[]
    ownerUserId: string | null
    hideTlUntilYoutube: boolean
  } | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [myVideosOpen, setMyVideosOpen] = useState(false)
  const [myVideosPlatform, setMyVideosPlatform] = useState<'youtube' | 'bilibili'>('youtube')
  const [myVideosLoading, setMyVideosLoading] = useState(false)
  const [myVideosError, setMyVideosError] = useState('')
  const [myVideos, setMyVideos] = useState<
    Array<{
      videoid: string
      title: string
      description: string
      publishedAt?: string
      thumbnail?: string
      platform: 'youtube' | 'bilibili'
    }>
  >([])
  const [ownedStudentStats, setOwnedStudentStats] = useState<Record<string, OwnedStudentStats>>({})

  const loadingToastCss = useMemo(
    () => `
      @keyframes tl-loading-progress {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(250%); }
      }
      .tl-loading-progress {
        animation: tl-loading-progress 1.2s linear infinite;
      }
    `,
    []
  )

  const formatScore = (value: string) => {
    const num = parseInt(value || '0')
    return num.toLocaleString()
  }

  const emptySquad = (): EditSquad => ({
    strikers: ['', '', '', ''],
    specials: ['', ''],
  })

  const parseFormationData = (value: string): {
    squads: EditSquad[]
    memberMap: Record<string, Record<string, unknown>>
  } => {
    if (!value) return { squads: [], memberMap: {} }
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) return { squads: [], memberMap: {} }
      const memberMap: Record<string, Record<string, unknown>> = {}
      const squads = parsed.map((team) => {
        const members = Array.isArray(team) ? team : []
        const ids = members
          .map((m) => {
            if (typeof m === 'string') return m
            if (m && typeof m === 'object' && 'id' in m && typeof m.id === 'string') {
              memberMap[m.id] = m as Record<string, unknown>
              return m.id
            }
            return ''
          })
          .filter(Boolean)
        return {
          strikers: [...ids.slice(0, 4), '', '', '', ''].slice(0, 4),
          specials: [...ids.slice(4, 6), '', ''].slice(0, 2),
        }
      })
      return { squads, memberMap }
    } catch {
      return { squads: [], memberMap: {} }
    }
  }

  const buildFormationJson = (squads: EditSquad[]) => {
    const teams = squads
      .map((squad) => [...squad.strikers, ...squad.specials].filter(Boolean))
      .filter((team) => team.length > 0)
      .map((team) =>
        team.map((id) => {
          const existing = editFormationMemberMap[id]
          if (existing) return existing
          const student = students.find((s) => s.id === id)
          return student ? { id: student.id, name: student.name } : { id }
        })
      )
    return JSON.stringify(teams)
  }

  const getVideoMeta = (videoid: string, thumbnail?: string) => {
    const { platform, id } = parseVideoRef(videoid)
    const url =
      platform === 'youtube'
        ? `https://www.youtube.com/watch?v=${id}`
        : `https://www.bilibili.com/video/${id}`
    const label = platform === 'youtube' ? 'YouTube' : 'Bilibili'
    const resolvedThumbnail =
      thumbnail ||
      (platform === 'youtube' ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null)
    const proxiedThumbnail =
      platform === 'bilibili' && resolvedThumbnail
        ? `/api/bilibili-thumbnail?url=${encodeURIComponent(resolvedThumbnail)}`
        : resolvedThumbnail
    return { platform, id, url, label, thumbnail: proxiedThumbnail }
  }

  const getPlatformIcon = (platform: 'youtube' | 'bilibili') =>
    platform === 'youtube' ? faYoutube : faBilibili

  const resolveInlineThumbnail = (
    platform: 'youtube' | 'bilibili',
    thumbnail?: string,
    id?: string
  ) => {
    if (platform === 'youtube') {
      return thumbnail ?? (id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null)
    }
    if (!thumbnail) return null
    return `/api/bilibili-thumbnail?url=${encodeURIComponent(thumbnail)}`
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

  const editStatFields: Array<{ key: string; label: string }> = [
    { key: 'level', label: 'Lv' },
    { key: 'star', label: '星' },
    { key: 'unique_star', label: '固有' },
    { key: 'unique_level', label: '固有Lv' },
    { key: 'bond', label: '絆' },
    { key: 'ex_skill', label: 'EX' },
    { key: 'normal_skill', label: 'NS' },
    { key: 'passive_skill', label: 'PS' },
    { key: 'sub_skill', label: 'SS' },
    { key: 'equip1', label: '装備1' },
    { key: 'equip2', label: '装備2' },
    { key: 'equip3', label: '装備3' },
    { key: 'item_tier', label: '装備Tier' },
  ]

  const updateFormationMemberStat = (id: string, key: string, rawValue: string) => {
    const value = rawValue === '' ? null : Number(rawValue)
    const student = students.find((s) => s.id === id)
    setEditFormationMemberMap((prev) => {
      const base = prev[id] ?? { id, name: student?.name }
      return {
        ...prev,
        [id]: {
          ...base,
          id,
          name: base.name ?? student?.name,
          [key]: value,
        },
      }
    })
    setEditSquadsDirty(true)
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
              if (data.length > 0) {
                const ids = data.map((t) => t.videoid)
                const { data: settingsData } = await supabase
                  .from('tl_video_settings')
                  .select(
                    'videoid, include_squad, allow_tl, tl_locked, visibility, allowed_user_ids, owner_user_id, hide_tl_until_youtube'
                  )
                  .in('videoid', ids)
                const settingsMap = ((settingsData ?? []) as VideoSettingsRow[]).reduce(
                  (acc: Record<string, VideoSettings>, row) => {
                    const rawAllowed = row.allowed_user_ids
                    const allowed =
                      Array.isArray(rawAllowed)
                        ? (rawAllowed as string[])
                        : typeof rawAllowed === 'string'
                          ? parseAllowedIdentifiers(rawAllowed)
                          : []
                    const allowTl = row.allow_tl !== false
                    acc[row.videoid as string] = {
                      includeSquad: Boolean(row.include_squad),
                      allowTl,
                      tlLocked: !allowTl,
                      visibility:
                        (row.visibility as 'public' | 'restricted' | 'private') ??
                        'public',
                      allowedUserIds: allowed,
                      ownerUserId:
                        typeof row.owner_user_id === 'string'
                          ? row.owner_user_id
                          : null,
                      hideTlUntilYoutube: row.hide_tl_until_youtube !== false,
                    }
                    return acc
                  },
                  {}
                )
                setVideoSettingsMap(settingsMap)
              } else {
                setVideoSettingsMap({})
              }
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
          .select('admin, social_links, username, tl_default_settings')
          .eq('id', session.user.id)
          .maybeSingle()
        setIsAdmin(Boolean(data?.admin))
        const links = parseSocialLinks(data?.social_links)
        const yt = links.find(
          (l) => l?.service === 'youtube' && l?.verified === true
        )
        const bili = links.find(
          (l) => l?.service === 'bilibili' && l?.verified === true
        )
        setYoutubeChannelId(
          typeof yt?.channelId === 'string' ? yt.channelId : null
        )
        setBilibiliUid(typeof bili?.biliUid === 'string' ? bili.biliUid : null)
        setCurrentUsername(typeof data?.username === 'string' ? data.username : null)
        const rawDefaults = data?.tl_default_settings
        if (rawDefaults && typeof rawDefaults === 'object') {
          const obj = rawDefaults as Record<string, unknown>
          setUserTlDefaults({
            includeSquad: typeof obj.includeSquad === 'boolean' ? obj.includeSquad : true,
            allowTl: typeof obj.allowTl === 'boolean' ? obj.allowTl : true,
            visibility:
              obj.visibility === 'public' || obj.visibility === 'restricted' || obj.visibility === 'private'
                ? obj.visibility
                : 'public',
            allowedUserIds: Array.isArray(obj.allowedUserIds)
              ? (obj.allowedUserIds as string[]).filter(Boolean)
              : [],
            hideTlUntilYoutube:
              typeof obj.hideTlUntilYoutube === 'boolean' ? obj.hideTlUntilYoutube : true,
            formationCardStyle:
              obj.formationCardStyle === 'compact' ? 'compact' : 'student-image',
          })
        } else {
          setUserTlDefaults({
            includeSquad: true,
            allowTl: true,
            visibility: 'public',
            allowedUserIds: [],
            hideTlUntilYoutube: true,
            formationCardStyle: 'student-image',
          })
        }
      }
    }
    checkAdmin()
  }, [session, supabase])

  useEffect(() => {
    const loadOwnedStudents = async () => {
      if (!openTl) {
        setOwnedStudentStats({})
        return
      }
      const members = parseTlFormation(openTl.formation)
      const ids = Array.from(new Set(members.map((member) => member.id).filter(Boolean))) as string[]
      if (ids.length === 0) {
        setOwnedStudentStats({})
        return
      }

      if (!session?.user) {
        const next: Record<string, OwnedStudentStats> = {}
        ids.forEach((id) => {
          const student = students.find((s) => s.id === id)
          const mainId = student?.styleOf || id
          const raw =
            localStorage.getItem(`userStudent:${id}`) ||
            (mainId !== id ? localStorage.getItem(`userStudent:${mainId}`) : null)
          if (!raw) return
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            next[id] = {
              level: Number(parsed.level ?? 0),
              ex_skill: Number(parsed.ex_skill ?? 0),
              normal_skill: Number(parsed.normal_skill ?? 0),
              passive_skill: Number(parsed.passive_skill ?? 0),
              sub_skill: Number(parsed.sub_skill ?? 0),
            }
          } catch {
            // ignore
          }
        })
        setOwnedStudentStats(next)
        return
      }

      const { data, error } = await supabase
        .from('user_students')
        .select('student_id, level, ex_skill, normal_skill, passive_skill, sub_skill')
        .eq('user_id', session.user.id)
        .in('student_id', ids)
      if (error || !data) {
        setOwnedStudentStats({})
        return
      }
      const next: Record<string, OwnedStudentStats> = {}
      data.forEach((row) => {
        next[row.student_id as string] = {
          level: row.level as number,
          ex_skill: row.ex_skill as number,
          normal_skill: row.normal_skill as number,
          passive_skill: row.passive_skill as number,
          sub_skill: row.sub_skill as number,
        }
      })
      setOwnedStudentStats(next)
    }
    loadOwnedStudents()
  }, [openTl, session, students, supabase])

  useEffect(() => {
    const loadSettings = async () => {
      if (!openTl || !session?.user) {
        setOpenTlSettings(null)
        return
      }
      setSettingsError('')
      const { data, error } = await supabase
        .from('tl_video_settings')
        .select(
          'include_squad, allow_tl, tl_locked, visibility, allowed_user_ids, owner_user_id, hide_tl_until_youtube'
        )
        .eq('videoid', openTl.videoid)
        .maybeSingle()
      if (error) {
        setSettingsError('管理設定の取得に失敗しました')
        setOpenTlSettings(null)
        return
      }
      if (!data) {
        const fallback = userTlDefaults ?? {
          includeSquad: true,
          allowTl: true,
          visibility: 'public' as VideoVisibility,
          allowedUserIds: [],
          hideTlUntilYoutube: true,
        }
        setOpenTlSettings({
          includeSquad: fallback.includeSquad,
          allowTl: fallback.allowTl,
          tlLocked: !fallback.allowTl,
          visibility: fallback.visibility,
          allowedUserIds: fallback.allowedUserIds,
          ownerUserId: session.user.id,
          hideTlUntilYoutube: fallback.hideTlUntilYoutube,
        })
        return
      }
      const rawAllowed = data?.allowed_user_ids
      const allowed =
        Array.isArray(rawAllowed)
          ? (rawAllowed as string[])
          : typeof rawAllowed === 'string'
            ? parseAllowedIdentifiers(rawAllowed)
            : []
      const allowTl = data?.allow_tl !== false
      setOpenTlSettings({
        includeSquad: Boolean(data?.include_squad),
        allowTl,
        tlLocked: !allowTl,
        visibility: (data?.visibility as 'public' | 'restricted' | 'private') ?? 'public',
        allowedUserIds: allowed,
        ownerUserId:
          typeof data?.owner_user_id === 'string' ? data.owner_user_id : session.user.id,
        hideTlUntilYoutube: data?.hide_tl_until_youtube !== false,
      })
    }
    void loadSettings()
  }, [openTl, session, supabase, userTlDefaults])


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
    const loadEditPolicy = async () => {
      if (!editTl || !isAdmin) return
      setEditPolicyError('')
      setEditTlSkipUpdateLoaded(false)
      try {
        const { data, error } = await supabase
          .from('tl_video_update_policy')
          .select('skip_update')
          .eq('videoid', editTl.videoid)
          .maybeSingle()
        if (error) throw error
        setEditTlSkipUpdate(Boolean(data?.skip_update))
      } catch {
        setEditTlSkipUpdate(false)
      } finally {
        setEditTlSkipUpdateLoaded(true)
      }
    }
    loadEditPolicy()
  }, [editTl, isAdmin, supabase])

  useEffect(() => {
    if (!editTl || !editSquadsDirty) return
    setEditFormation(buildFormationJson(editSquads))
  }, [editSquads, editTl, editFormationMemberMap, editSquadsDirty, students])

  useEffect(() => {
    const loadTlJsonLinks = async () => {
      if (!openTl) {
        setTlJsonValue('')
        setTlJsonTitle('')
        setTlJsonUpdatedAt(null)
        setTlJsonAuthor(null)
        setTlJsonAuthorProfile(null)
        setTlJsonError('')
        return
      }
      setTlJsonLoading(true)
      setTlJsonError('')
      setTlRevealUnlocked((prev) => ({
        ...prev,
        [openTl.videoid]: false,
      }))
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
        const authorId =
          typeof payload.tl_json_created_by === 'string' ? payload.tl_json_created_by : null
        setTlJsonAuthor(authorId)
        if (authorId) {
          const { data: authorProfile } = await supabase
            .from('profiles')
            .select('id, username, nickname')
            .eq('id', authorId)
            .maybeSingle()
          setTlJsonAuthorProfile(
            authorProfile
              ? {
                  id: authorProfile.id as string,
                  username: typeof authorProfile.username === 'string' ? authorProfile.username : null,
                  nickname: typeof authorProfile.nickname === 'string' ? authorProfile.nickname : null,
                }
              : null
          )
        } else {
          setTlJsonAuthorProfile(null)
        }
      } catch {
        setTlJsonError('TL JSONの取得に失敗しました')
      } finally {
        setTlJsonLoading(false)
      }
    }
    loadTlJsonLinks()
  }, [openTl, supabase])

  useEffect(() => {
    if (!openTl) {
      setVideoChannelId(null)
      return
    }
    setActiveSection('overview')
    setModalClosing(false)
    const loadVideoChannelId = async () => {
      const { platform, id } = parseVideoRef(openTl.videoid)
      if (platform !== 'youtube') {
        setVideoChannelId(null)
        return
      }
      setOwnerCheckLoading(true)
      try {
        const res = await fetch(`/api/youtube/video-owner?videoid=${id}`)
        if (!res.ok) {
          setVideoChannelId(null)
          return
        }
        const json = (await res.json()) as { channelId?: string }
        setVideoChannelId(typeof json.channelId === 'string' ? json.channelId : null)
      } catch {
        setVideoChannelId(null)
      } finally {
        setOwnerCheckLoading(false)
      }
    }
    void loadVideoChannelId()
  }, [openTl])

  useEffect(() => {
    if (!openTl) return
    document.body.classList.add('overflow-hidden')
    return () => {
      document.body.classList.remove('overflow-hidden')
    }
  }, [openTl])

  const closeModal = () => {
    if (modalClosing) return
    setModalClosing(true)
    window.setTimeout(() => {
      setOpenTl(null)
      setPolicyError('')
    }, 200)
  }

  const saveTlJsonLink = async () => {
    if (!openTl) return
    if (!session?.user) {
      setTlJsonError('ログインが必要です')
      return
    }
    if (!canEditTl && openTlSettings?.tlLocked) {
      setTlJsonError('この動画はTL変更がロックされています')
      return
    }
    if (!canEditTl && openTlSettings && openTlSettings.allowTl === false) {
      setTlJsonError('この動画はTL登録/変更が許可されていません')
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
      let title = ''
      if (tlInputMode === 'json') {
        const parsed = JSON.parse(raw) as { projectName?: string }
        title =
          parsed && typeof parsed.projectName === 'string' ? parsed.projectName : ''
      } else {
        title = 'text'
      }
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
      const { data: authorProfile } = await supabase
        .from('profiles')
        .select('id, username, nickname')
        .eq('id', session.user.id)
        .maybeSingle()
      setTlJsonAuthorProfile(
        authorProfile
          ? {
              id: authorProfile.id as string,
              username: typeof authorProfile.username === 'string' ? authorProfile.username : null,
              nickname: typeof authorProfile.nickname === 'string' ? authorProfile.nickname : null,
            }
          : null
      )
    } catch {
      setTlJsonError('JSONの保存に失敗しました（形式を確認してください）')
    } finally {
      setTlJsonSaving(false)
    }
  }

  const clearTlJsonLink = async () => {
    if (!openTl) return
    if (!session?.user) {
      setTlJsonError('ログインが必要です')
      return
    }
    if (!canEditTl) {
      setTlJsonError('このTLを削除する権限がありません')
      return
    }
    setTlJsonSaving(true)
    setTlJsonError('')
    try {
      const table = openTl.season
        ? `tl_${openTl.season.toLowerCase()}`
        : 'tl_unknown'
      const now = new Date().toISOString()
      const { error } = await supabase
        .from(table)
        .update({
          tl_json: null,
          tl_json_title: null,
          tl_json_updated_at: now,
          tl_json_created_by: null,
        })
        .eq('videoid', openTl.videoid)
      if (error) throw error
      setTlJsonValue('')
      setTlJsonTitle('')
      setTlJsonUpdatedAt(now)
      setTlJsonAuthor(null)
      setTlJsonAuthorProfile(null)
      setTlJsonInput('')
    } catch {
      setTlJsonError('TLの削除に失敗しました')
    } finally {
      setTlJsonSaving(false)
    }
  }

  const canManage =
    Boolean(session?.user) &&
    Boolean(youtubeChannelId) &&
    Boolean(videoChannelId) &&
    youtubeChannelId === videoChannelId
  const canEditTl = Boolean(
    session?.user &&
      (canManage || (tlJsonAuthor && session.user.id === tlJsonAuthor))
  )
  const tlEditLocked = Boolean(
    !canEditTl && (openTlSettings?.tlLocked || openTlSettings?.allowTl === false)
  )

  const setVideoSkipUpdate = async (videoid: string, next: boolean) => {
    if (!isAdmin) return
    setPolicyError('')
    setOpenTlSkipUpdateSaving(true)
    try {
      const res = await fetch('/api/tl-video-update-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoid, skipUpdate: next }),
      })
      if (!res.ok) throw new Error('update_failed')
      setOpenTlSkipUpdate(next)
    } catch {
      setPolicyError('保存に失敗しました（権限/RLS設定を確認してください）')
    } finally {
      setOpenTlSkipUpdateSaving(false)
    }
  }

  const setEditVideoSkipUpdate = async (videoid: string, next: boolean) => {
    if (!isAdmin) return
    setEditPolicyError('')
    setEditTlSkipUpdateSaving(true)
    try {
      const res = await fetch('/api/tl-video-update-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoid, skipUpdate: next }),
      })
      if (!res.ok) throw new Error('update_failed')
      setEditTlSkipUpdate(next)
    } catch {
      setEditPolicyError('保存に失敗しました（権限/RLS設定を確認してください）')
    } finally {
      setEditTlSkipUpdateSaving(false)
    }
  }

  const saveVideoSettings = async () => {
    if (!openTl || !session?.user || !openTlSettings) return
    setSettingsSaving(true)
    setSettingsError('')
    const payload = {
      videoid: openTl.videoid,
      include_squad: openTlSettings.includeSquad,
      allow_tl: openTlSettings.allowTl,
      tl_locked: !openTlSettings.allowTl,
      visibility: openTlSettings.visibility,
      allowed_user_ids: openTlSettings.allowedUserIds,
      owner_user_id: openTlSettings.ownerUserId ?? session.user.id,
      hide_tl_until_youtube: openTlSettings.hideTlUntilYoutube,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase
      .from('tl_video_settings')
      .upsert(payload, { onConflict: 'videoid' })
    setSettingsSaving(false)
    if (error) {
      setSettingsError('管理設定の保存に失敗しました')
      return
    }
    setVideoSettingsMap((prev) => ({
      ...prev,
      [openTl.videoid]: {
        includeSquad: openTlSettings.includeSquad,
        allowTl: openTlSettings.allowTl,
        tlLocked: !openTlSettings.allowTl,
        visibility: openTlSettings.visibility,
        allowedUserIds: openTlSettings.allowedUserIds,
        ownerUserId: openTlSettings.ownerUserId ?? session.user.id,
        hideTlUntilYoutube: openTlSettings.hideTlUntilYoutube,
      },
    }))
  }

  const openMyVideos = async (platform: 'youtube' | 'bilibili') => {
    setMyVideosPlatform(platform)
    setMyVideosOpen(true)
    setMyVideosLoading(true)
    setMyVideosError('')
    setMyVideos([])
    try {
      if (platform === 'youtube') {
        if (!youtubeChannelId) {
          setMyVideosError('YouTube連携が必要です（マイページで接続してください）')
          return
        }
        const { data } = await supabase.auth.getSession()
        const token = data.session?.provider_token
        if (!token) {
          setMyVideosError('YouTube連携が必要です（マイページで接続してください）')
          return
        }
        const params = new URLSearchParams({
          part: 'snippet',
          channelId: youtubeChannelId,
          q: 'ブルアカ',
          type: 'video',
          order: 'date',
          maxResults: '20',
        })
        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (!res.ok) {
          setMyVideosError('YouTubeの動画取得に失敗しました')
          return
        }
        const json = (await res.json()) as {
          items?: Array<{
            id?: { videoId?: string }
            snippet?: {
              title?: string
              description?: string
              publishedAt?: string
              thumbnails?: Record<string, { url?: string }>
            }
          }>
        }
        const items = (json.items ?? [])
          .map((item) => {
            const videoid = item.id?.videoId
            if (!videoid) return null
            const snippet = item.snippet ?? {}
            return {
              videoid,
              title: snippet.title ?? '',
              description: snippet.description ?? '',
              publishedAt: snippet.publishedAt,
              thumbnail: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? undefined,
              platform: 'youtube' as const,
            }
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .filter((item) => item.title.includes('ブルアカ'))
        setMyVideos(items)
        return
      }

      if (!bilibiliUid) {
        setMyVideosError('Bilibili連携が必要です（マイページで接続してください）')
        return
      }

      const params = new URLSearchParams({
        mid: bilibiliUid,
        ps: '20',
        pn: '1',
        order: 'pubdate',
      })
      const res = await fetch(`https://api.bilibili.com/x/space/arc/search?${params.toString()}`)
      if (!res.ok) {
        setMyVideosError('Bilibiliの動画取得に失敗しました')
        return
      }
      const json = (await res.json()) as {
        data?: { list?: { vlist?: Array<{ bvid?: string; title?: string; description?: string; pic?: string; created?: number }> } }
      }
      const items = (json.data?.list?.vlist ?? [])
        .map((item) => {
          if (!item?.bvid) return null
          return {
            videoid: item.bvid,
            title: item.title ?? '',
            description: item.description ?? '',
            publishedAt: item.created ? new Date(item.created * 1000).toISOString() : undefined,
            thumbnail: item.pic ? (item.pic.startsWith('//') ? `https:${item.pic}` : item.pic) : undefined,
            platform: 'bilibili' as const,
          }
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .filter((item) => item.title.includes('ブルアカ'))
      setMyVideos(items)
    } catch (err) {
      if (platform === 'youtube' && isYouTubeNetworkBlocked(err)) {
        setMyVideosError('YouTubeへの通信がブロックされています。ネットワークや拡張機能の設定をご確認ください。')
      } else {
        setMyVideosError(`${platform === 'youtube' ? 'YouTube' : 'Bilibili'}の動画取得に失敗しました`)
      }
    } finally {
      setMyVideosLoading(false)
    }
  }

  const addMyVideoToList = (
    video: {
      videoid: string
      title: string
      description: string
      publishedAt?: string
      thumbnail?: string
      platform: 'youtube' | 'bilibili'
    },
    openAfter: boolean
  ) => {
    const storedId = toStoredVideoId(video.platform, video.videoid)
    const timeline: Timeline = {
      id: Math.floor(Date.now() + Math.random() * 1000),
      armor: '',
      difficulty: '',
      videoid: storedId,
      platform: video.platform,
      score: '',
      formation: '[]',
      guide: false,
      formationStatus: 'none',
      title: video.title,
      description: video.description,
      publishedAt: video.publishedAt,
      season: '',
      thumbnail: video.thumbnail,
    }
    setTimelines((prev) => {
      if (prev.some((t) => t.videoid === storedId)) return prev
      return [timeline, ...prev]
    })
    if (openAfter) {
      setOpenTl(timeline)
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
    if (!season) {
      setSearchError('シーズンを選択してください')
      return
    }
    setSearchError('')
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
        if (data.length > 0) {
          const ids = data.map((t) => t.videoid)
          const { data: settingsData } = await supabase
            .from('tl_video_settings')
            .select(
              'videoid, include_squad, allow_tl, tl_locked, visibility, allowed_user_ids, owner_user_id'
            )
            .in('videoid', ids)
      const settingsMap = ((settingsData ?? []) as VideoSettingsRow[]).reduce(
        (acc: Record<string, VideoSettings>, row) => {
      const rawAllowed = row.allowed_user_ids
      const allowed =
        Array.isArray(rawAllowed)
          ? (rawAllowed as string[])
          : typeof rawAllowed === 'string'
            ? parseAllowedIdentifiers(rawAllowed)
            : []
      const allowTl = row.allow_tl !== false
      acc[row.videoid as string] = {
        includeSquad: Boolean(row.include_squad),
        allowTl,
        tlLocked: !allowTl,
        visibility:
          (row.visibility as 'public' | 'restricted' | 'private') ?? 'public',
        allowedUserIds: allowed,
        ownerUserId:
          typeof row.owner_user_id === 'string'
            ? row.owner_user_id
            : null,
        hideTlUntilYoutube: row.hide_tl_until_youtube !== false,
      }
              return acc
            },
            {}
          )
          setVideoSettingsMap(settingsMap)
        } else {
          setVideoSettingsMap({})
        }
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
          difficulty: editDifficulty,
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
                  difficulty: editDifficulty,
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
    setEditStatsOpen(false)
    setEditGuide(false)
    setEditFormationStatus('none')
    setEditArmor('')
    setEditDifficulty('')
    setEditFormation('')
    setEditSquads([])
    setEditSquadsDirty(false)
    setEditFormationMemberMap({})
    setEditTlSkipUpdate(false)
    setEditTlSkipUpdateLoaded(false)
    setEditTlSkipUpdateSaving(false)
    setEditPolicyError('')
  }
}

  const TimelineCard = ({ t }: { t: Timeline }) => {
    const meta = getVideoMeta(t.videoid, t.thumbnail)
    return (
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
              setEditStatsOpen(false)
              setEditScore(t.score)
              setEditGuide(Boolean(t.guide))
              setEditFormationStatus(t.formationStatus || 'none')
              setEditArmor(t.armor)
              setEditDifficulty(t.difficulty)
              setEditFormation(t.formation)
              const { squads, memberMap } = parseFormationData(t.formation)
              setEditSquads(squads)
              setEditFormationMemberMap(memberMap)
              setEditSquadsDirty(false)
            }}
          >
            編集
          </button>
        )}
        <div className="relative">
          {meta.thumbnail ? (
            <img
              src={meta.thumbnail}
              alt="thumbnail"
              className="w-full h-auto mb-1"
            />
          ) : (
            <div className="mb-1 flex h-32 w-full items-center justify-center rounded bg-gray-100 text-xs text-gray-500">
              {meta.label} thumbnail unavailable
            </div>
          )}
          <span className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1 rounded">
            <FontAwesomeIcon icon={getPlatformIcon(meta.platform)} />
          </span>
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

  const openTlMeta = openTl ? getVideoMeta(openTl.videoid, openTl.thumbnail) : null
  const editTlMeta = editTl ? getVideoMeta(editTl.videoid, editTl.thumbnail) : null
  const openTlThumbnail =
    openTlMeta?.platform === 'youtube'
      ? `https://i.ytimg.com/vi/${openTlMeta.id}/hqdefault.jpg`
      : openTlMeta?.thumbnail ?? null
  const editMemberIds = Array.from(
    new Set(
      editSquads
        .flatMap((squad) => [...squad.strikers, ...squad.specials])
        .filter(Boolean)
    )
  )
  const openTlFormationMembers = useMemo(
    () => (openTl ? parseTlFormation(openTl.formation) : []),
    [openTl]
  )
  const openTlFormationTeams = useMemo(
    () => (openTl ? parseFormationTeams(openTl.formation) : []),
    [openTl]
  )
  const studentNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    students.forEach((student) => {
      map[student.id] = student.name
    })
    return map
  }, [students])
  const tlCompatibility = useMemo(
    () => compareTlCompatibility(openTlFormationMembers, ownedStudentStats, studentNameMap),
    [openTlFormationMembers, ownedStudentStats, studentNameMap]
  )

  const formationCardStyle: FormationCardStyle = userTlDefaults?.formationCardStyle ?? 'student-image'

  const visibleTimelines = timelines.filter((t) => {
    const settings = videoSettingsMap[t.videoid]
    if (!settings) return true
    const visibility = settings.visibility ?? 'public'
    if (visibility === 'public') return true
    if (!session?.user?.id) return false
    const ownerId = settings.ownerUserId ?? null
    if (visibility === 'private') {
      return ownerId === session.user.id
    }
    const allowed = settings.allowedUserIds ?? []
    const normalizedAllowed = allowed.map((value) => value.toLowerCase())
    const currentId = session.user.id.toLowerCase()
    const currentName = currentUsername?.toLowerCase() ?? ''
    return (
      ownerId === session.user.id ||
      normalizedAllowed.includes(currentId) ||
      (currentName && normalizedAllowed.includes(currentName))
    )
  })

  const filtered = visibleTimelines.filter((t) => {
    const armorOk = armor ? t.armor === armor : true
    const difficultyOk = difficulty ? t.difficulty === difficulty : true
    const difficultyVisible = t.difficulty ? true : isAdmin
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
      difficultyVisible &&
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
      const key = t.armor || '不明'
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
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-xl">TL検索</h2>
        <PageHelpButton pageKey="tl-search" />
        {(youtubeChannelId || bilibiliUid) && (
          <div className="ml-auto flex flex-wrap gap-2">
            {youtubeChannelId && (
              <button
                type="button"
                onClick={() => openMyVideos('youtube')}
                className="inline-flex items-center gap-1 rounded border border-blue-300 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                ＋ 自分の動画を追加 (YouTube)
              </button>
            )}
            {bilibiliUid && (
              <button
                type="button"
                onClick={() => openMyVideos('bilibili')}
                className="inline-flex items-center gap-1 rounded border border-blue-300 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                ＋ 自分の動画を追加 (Bilibili)
              </button>
            )}
          </div>
        )}
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
            disabled={!season}
            className="border px-3 py-1 rounded bg-blue-500 text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            検索
          </button>
        </div>
        {searchError && <p className="text-sm text-red-600">{searchError}</p>}
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
      {loadingToastCss && <style jsx global>{loadingToastCss}</style>}
      {loadingMessage && (
        <div className="fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
          <div className="relative overflow-hidden rounded border border-blue-200 bg-blue-50 px-4 py-3 pb-4 text-sm text-blue-800 shadow-lg">
            <div>{loadingMessage}</div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-100">
              <div className="tl-loading-progress h-full w-2/5 bg-blue-400" />
            </div>
          </div>
        </div>
      )}
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
      {myVideosOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/50"
          onClick={() => setMyVideosOpen(false)}
        >
          <div
            className="bg-white rounded w-full max-w-3xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <h3 className="font-semibold">
                  自分の動画を追加 ({myVideosPlatform === 'youtube' ? 'YouTube' : 'Bilibili'})
                </h3>
                <p className="text-xs text-gray-500">
                  タイトルに「ブルアカ」を含む動画のみ表示しています。
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-800"
                onClick={() => setMyVideosOpen(false)}
              >
                閉じる
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[65vh] overflow-y-auto">
              {myVideosLoading && <p className="text-sm text-gray-500">読み込み中...</p>}
              {myVideosError && <p className="text-sm text-red-600">{myVideosError}</p>}
              {!myVideosLoading && !myVideosError && myVideos.length === 0 && (
                <p className="text-sm text-gray-500">対象の動画が見つかりませんでした。</p>
              )}
              {myVideos.map((video) => {
                const storedId = toStoredVideoId(video.platform, video.videoid)
                const alreadyAdded = timelines.some((t) => t.videoid === storedId)
                return (
                  <div
                    key={video.videoid}
                    className="flex flex-col sm:flex-row gap-3 border rounded p-3"
                  >
                    <div className="relative w-full sm:w-40">
                      {resolveInlineThumbnail(video.platform, video.thumbnail, video.videoid) ? (
                        <img
                          src={
                            resolveInlineThumbnail(
                              video.platform,
                              video.thumbnail,
                              video.videoid
                            ) ?? ''
                          }
                          alt="thumbnail"
                          className="w-full h-auto rounded"
                        />
                      ) : (
                        <div className="flex w-full items-center justify-center rounded bg-gray-100 text-xs text-gray-500">
                          Bilibili thumbnail unavailable
                        </div>
                      )}
                      <span className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1 rounded">
                        <FontAwesomeIcon icon={getPlatformIcon(video.platform)} />
                      </span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold">{video.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{video.description}</p>
                      {video.publishedAt && (
                        <p className="text-xs text-gray-400">
                          {new Date(video.publishedAt).toLocaleString()}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <button
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => addMyVideoToList(video, false)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-60"
                        >
                          {alreadyAdded ? '追加済み' : '追加'}
                        </button>
                        <button
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => {
                            addMyVideoToList(video, true)
                            setMyVideosOpen(false)
                          }}
                          className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 disabled:opacity-60"
                        >
                          追加して設定
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
      {openTl && (
        <div
          className={`fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-200 ${modalClosing ? 'opacity-0' : 'opacity-100'} bg-black/50`}
          onClick={closeModal}
        >
          <div
            className={`bg-white rounded-xl w-[92vw] max-w-5xl h-[72vh] sm:h-[80vh] max-h-[80vh] flex flex-col overflow-hidden transition-all duration-200 ${modalClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-3 top-3 z-10 rounded border border-gray-300 bg-white/90 px-2 py-1 text-sm"
              aria-label="閉じる"
            >
              ×
            </button>
            <div className="flex flex-col md:flex-row h-full">
              <div className="flex-1 min-h-0 md:flex-none md:w-5/12 border-b md:border-b-0 md:border-r p-4 space-y-3 overflow-y-auto">
                <a
                  href={openTlMeta?.url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block relative"
                  aria-label={`${openTlMeta?.label ?? '動画'}で動画を開く`}
                >
                  {openTlThumbnail ? (
                    <img
                      src={openTlThumbnail}
                      alt="thumbnail"
                      className="w-full h-auto rounded cursor-pointer"
                    />
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center rounded bg-gray-100 text-sm text-gray-500">
                      {openTlMeta?.label ?? '動画'} thumbnail unavailable
                    </div>
                  )}
                  {openTlMeta?.platform && (
                    <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      <FontAwesomeIcon icon={getPlatformIcon(openTlMeta.platform)} />
                    </span>
                  )}
                </a>
                <div>
                  <h3 className="font-bold text-base">{openTl.title}</h3>
                  <p className="text-xs text-gray-500 break-all">
                    videoid: {openTlMeta?.id ?? openTl.videoid}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={openTlMeta?.url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50"
                    aria-label={`${openTlMeta?.label ?? '動画'}で動画を開く`}
                  >
                    {openTlMeta?.platform ? (
                      <FontAwesomeIcon icon={getPlatformIcon(openTlMeta.platform)} />
                    ) : (
                      <FontAwesomeIcon icon={faLink} />
                    )}
                    {openTlMeta?.label ?? '動画'}
                  </a>
                </div>
                <nav className="rounded text-sm">
                  <ul className="divide-y divide-gray-200">
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSection('overview')
                          document.getElementById('section-overview')?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                        }}
                        className={`w-full text-left px-2 py-2 ${
                          activeSection === 'overview'
                            ? 'text-blue-700'
                            : 'text-gray-700 hover:text-blue-600'
                        }`}
                      >
                        概要欄
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSection('tl')
                          document.getElementById('section-tl')?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                        }}
                        className={`w-full text-left px-2 py-2 ${
                          activeSection === 'tl'
                            ? 'text-blue-700'
                            : 'text-gray-700 hover:text-blue-600'
                        }`}
                      >
                        TL
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSection('tl-add')
                          document.getElementById('section-tl-add')?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                        }}
                        className={`w-full text-left px-2 py-2 ${
                          activeSection === 'tl-add'
                            ? 'text-blue-700'
                            : 'text-gray-700 hover:text-blue-600'
                        }`}
                      >
                        TL追加
                      </button>
                    </li>
                    {canManage && (
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSection('manage')
                            document.getElementById('section-manage')?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'start',
                            })
                          }}
                          className={`w-full text-left px-2 py-2 ${
                            activeSection === 'manage'
                              ? 'text-blue-700'
                              : 'text-gray-700 hover:text-blue-600'
                          }`}
                        >
                          管理
                        </button>
                      </li>
                    )}
                    {isAdmin && (
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSection('developer')
                            document.getElementById('section-developer')?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'start',
                            })
                          }}
                          className={`w-full text-left px-2 py-2 ${
                            activeSection === 'developer'
                              ? 'text-blue-700'
                              : 'text-gray-700 hover:text-blue-600'
                          }`}
                        >
                          開発者向け
                        </button>
                      </li>
                    )}
                  </ul>
                </nav>
                {isAdmin && (
                  <p className="text-xs text-gray-500">
                    開発者向けの項目は「開発者向け」セクションにあります。
                  </p>
                )}
              </div>

              {/* 本文（スクロール） */}
              <div className="flex-1 min-h-0 md:w-7/12 overflow-y-auto p-4 pt-3 space-y-4">
                {activeSection === 'overview' && (
                  <div id="section-overview">
                    <h4 className="font-semibold text-sm">概要</h4>
                    <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3 space-y-2">
                      <h5 className="font-semibold text-xs text-gray-600">再現可否</h5>
                      {!session?.user && Object.keys(ownedStudentStats).length === 0 ? (
                        <p className="text-xs text-gray-600">手持ち未連携（ローカル保存データがある場合は判定されます）</p>
                      ) : openTlFormationMembers.length === 0 ? (
                        <p className="text-xs text-gray-600">編成情報がないため判定できません</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                tlCompatibility.status === 'reproducible'
                                  ? 'bg-green-100 text-green-700'
                                  : tlCompatibility.status === 'conditional'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {tlCompatibility.status === 'reproducible'
                                ? '再現可能'
                                : tlCompatibility.status === 'conditional'
                                  ? '条件付き'
                                  : '不可'}
                            </span>
                            <span className="text-xs text-gray-600">一致率: {tlCompatibility.matchRate}%</span>
                          </div>

                          {tlCompatibility.missingCharacters.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-gray-600">不足キャラ</p>
                              <ul className="space-y-1">
                                {tlCompatibility.missingCharacters.map((item) => (
                                  <li key={item.id} className="text-xs text-gray-700">
                                    {item.name}{' '}
                                    <a
                                      href={item.searchUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 underline"
                                    >
                                      代替候補を探す
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {tlCompatibility.missingTraining.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-gray-600">不足育成（Lv/スキル）</p>
                              <ul className="space-y-1">
                                {tlCompatibility.missingTraining.map((item) => (
                                  <li key={item.id} className="text-xs text-gray-700">
                                    {item.name}: {item.shortages.join(' / ')}{' '}
                                    <a
                                      href={item.searchUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 underline"
                                    >
                                      代替候補を探す
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {openTlFormationTeams.length > 0 &&
                      students.length > 0 && (
                        <div className="mt-2 space-y-1 text-sm">
                          <h5 className="font-semibold text-xs text-gray-600">編成</h5>
                          {openTlFormationTeams.map(
                            (team: FormationMember[], idx: number) => (
                              <div key={idx} className="space-y-1">
                                <p className="text-xs text-gray-500">部隊{idx + 1}</p>
                                <div className="flex flex-wrap gap-2">
                                {team.map((member, i: number) => {
                                  const id = member.id
                                  const student = students.find((s) => s.id === id)
                                  const level = member.level ?? undefined
                                  const star = member.star ?? student?.initialStars ?? 1
                                  const uniqueStar = member.unique_star ?? 0
                                  if (formationCardStyle === 'student-image') {
                                    return (
                                      <StudentImageStyleCard
                                        key={i}
                                        student={student}
                                        memberLevel={level}
                                        memberStar={star}
                                        memberUniqueStar={uniqueStar}
                                      />
                                    )
                                  }
                                  const ringColor = ATTACK_TYPE_RING_COLORS[student?.attackType ?? ''] ?? '#64748b'
                                  return (
                                    <div
                                      key={i}
                                      className="relative h-14 w-14 overflow-hidden rounded-md border-2 bg-gray-100"
                                      style={{ borderColor: ringColor }}
                                      title={student?.name ?? member.name ?? id}
                                    >
                                      {student?.image ? (
                                        <img
                                          src={student.image}
                                          alt={student.name}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="h-full w-full bg-gray-200" />
                                      )}
                                      <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-[1px] text-center text-[10px] font-semibold text-white">
                                        {typeof level === 'number' ? `Lv.${level}` : 'Lv.?'}
                                      </div>
                                      <div className="absolute left-0.5 top-0.5 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">
                                        ★{star}
                                      </div>
                                      {uniqueStar > 0 && (
                                        <div className="absolute right-0.5 top-0.5 rounded bg-sky-700/80 px-1 text-[10px] font-semibold text-white">
                                          UE{uniqueStar}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    <p className="whitespace-pre-wrap text-sm">{openTl.description}</p>
                  </div>
                )}

                {activeSection === 'tl' && (
                  <div id="section-tl" className="text-sm space-y-2">
                    <h4 className="font-semibold">TL</h4>
                    {tlJsonLoading ? (
                      <p className="text-xs text-gray-500">読み込み中...</p>
                    ) : (
                      <div className="space-y-2">
                        {openTlSettings?.hideTlUntilYoutube &&
                        !tlRevealUnlocked[openTl.videoid] ? (
                          <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 space-y-2">
                            <p>
                              再生数の公平性を守るため、動画を開くまでTLを表示しない設定になっています。
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setTlRevealUnlocked((prev) => ({
                                  ...prev,
                                  [openTl.videoid]: true,
                                }))
                                if (openTlMeta?.url) {
                                  window.open(openTlMeta.url, '_blank', 'noopener,noreferrer')
                                }
                              }}
                              className="inline-flex items-center gap-2 rounded border border-blue-300 px-3 py-1 text-xs text-blue-700 hover:bg-blue-50"
                            >
                              {openTlMeta?.label ?? '動画'}で開く
                            </button>
                          </div>
                        ) : tlJsonValue ? (
                          <details className="rounded border border-gray-200 p-2">
                            <summary className="cursor-pointer text-xs">
                              {tlJsonTitle || '無題'}
                              {tlJsonUpdatedAt
                                ? ` / ${new Date(tlJsonUpdatedAt).toLocaleString()}`
                                : ''}
                            </summary>
                            {tlJsonAuthor && (
                              <p className="mt-1 text-xs text-gray-500">
                                TL追加者:{' '}
                                {tlJsonAuthorProfile?.username ? (
                                  <a
                                    href={`/users/${tlJsonAuthorProfile.username}`}
                                    className="underline underline-offset-2"
                                  >
                                    {tlJsonAuthorProfile.nickname ||
                                      tlJsonAuthorProfile.username}
                                  </a>
                                ) : (
                                  tlJsonAuthor
                                )}
                              </p>
                            )}
                            <pre className="mt-2 whitespace-pre-wrap text-xs">{tlJsonValue}</pre>
                          </details>
                        ) : (
                          <p className="text-xs text-gray-500">まだ紐付けはありません。</p>
                        )}
                        {tlJsonValue && !openTlSettings?.hideTlUntilYoutube && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-60"
                              disabled={tlJsonSaving || !canEditTl}
                              onClick={clearTlJsonLink}
                            >
                              TLを削除
                            </button>
                            {!canEditTl && (
                              <span className="text-xs text-gray-500">
                                投稿者またはTL追加者のみ削除できます
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeSection === 'tl-add' && (
                  <div id="section-tl-add" className="text-sm space-y-2">
                    <h4 className="font-semibold">TL追加</h4>
                    <p className="text-xs text-gray-600">
                      TLメーカーJSONまたはテキスト形式のTLを紐付けできます（各動画で1件）。
                    </p>
                    <div className="flex flex-wrap gap-4 text-xs">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="tl-input-mode"
                          checked={tlInputMode === 'json'}
                          onChange={() => setTlInputMode('json')}
                        />
                        <span>TLメーカーJSON</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="tl-input-mode"
                          checked={tlInputMode === 'text'}
                          onChange={() => setTlInputMode('text')}
                        />
                        <span>テキスト形式</span>
                      </label>
                    </div>
                    {tlInputMode === 'json' ? (
                      <div className="space-y-2">
                        <textarea
                          value={tlJsonInput}
                          onChange={(e) => setTlJsonInput(e.target.value)}
                          placeholder="TLメーカーJSONを貼り付け"
                          className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono h-28"
                        />
                        <label className="block text-xs text-gray-600">
                          JSONファイルをアップロード
                          <input
                            type="file"
                            accept="application/json"
                            className="mt-1 block w-full text-xs"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              const reader = new FileReader()
                              reader.onload = () => {
                                const text = typeof reader.result === 'string' ? reader.result : ''
                                setTlJsonInput(text)
                              }
                              reader.readAsText(file)
                            }}
                          />
                        </label>
                      </div>
                    ) : (
                      <textarea
                        value={tlJsonInput}
                        onChange={(e) => setTlJsonInput(e.target.value)}
                        placeholder="TLテキストを入力"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono h-28"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 disabled:opacity-60"
                        disabled={tlJsonSaving || tlEditLocked}
                        onClick={saveTlJsonLink}
                      >
                        {tlJsonSaving ? '保存中...' : 'この動画に紐付ける'}
                      </button>
                      {tlJsonError && (
                        <span className="text-xs text-red-600">{tlJsonError}</span>
                      )}
                      {tlEditLocked && !tlJsonError && (
                        <span className="text-xs text-gray-500">この動画はTL変更が制限されています</span>
                      )}
                    </div>
                  </div>
                )}

                {activeSection === 'manage' && canManage && (
                  <div id="section-manage" className="text-sm space-y-2">
                    <h4 className="font-semibold">管理</h4>
                    <p className="text-xs text-gray-600">
                      YouTube本人確認済みの投稿者として管理できます。
                    </p>
                    {ownerCheckLoading && (
                      <p className="text-xs text-gray-500">確認中...</p>
                    )}
                    {openTlSettings && (
                      <div className="space-y-3">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={openTlSettings.includeSquad}
                            onChange={(e) =>
                              setOpenTlSettings((prev) =>
                                prev
                                  ? { ...prev, includeSquad: e.target.checked }
                                  : prev
                              )
                            }
                          />
                          <span>部隊のデータを含める</span>
                        </label>
                        <div className="space-y-2">
                          <p className="text-xs text-gray-600">TL登録/変更の設定</p>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="tl-edit-policy"
                              checked={openTlSettings.allowTl}
                              onChange={() =>
                                setOpenTlSettings((prev) =>
                                  prev ? { ...prev, allowTl: true, tlLocked: false } : prev
                                )
                              }
                            />
                            <span>変更を許可する</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="tl-edit-policy"
                              checked={!openTlSettings.allowTl}
                              onChange={() =>
                                setOpenTlSettings((prev) =>
                                  prev ? { ...prev, allowTl: false, tlLocked: true } : prev
                                )
                              }
                            />
                            <span>変更をロックする（許可しない）</span>
                          </label>
                        </div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={openTlSettings.hideTlUntilYoutube}
                            onChange={(e) =>
                              setOpenTlSettings((prev) =>
                                prev
                                  ? { ...prev, hideTlUntilYoutube: e.target.checked }
                                  : prev
                              )
                            }
                          />
                          <span>動画を開くまでTLを非表示にする</span>
                        </label>
                        <div className="space-y-2">
                          <p className="text-xs text-gray-600">TL検索の公開範囲</p>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="visibility"
                              checked={openTlSettings.visibility === 'public'}
                              onChange={() =>
                                setOpenTlSettings((prev) =>
                                  prev ? { ...prev, visibility: 'public' } : prev
                                )
                              }
                            />
                            <span>全体公開</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="visibility"
                              checked={openTlSettings.visibility === 'restricted'}
                              onChange={() =>
                                setOpenTlSettings((prev) =>
                                  prev ? { ...prev, visibility: 'restricted' } : prev
                                )
                              }
                            />
                            <span>特定ユーザーのみ（profilesのID指定）</span>
                          </label>
                          {openTlSettings.visibility === 'restricted' && (
                            <textarea
                              value={openTlSettings.allowedUserIds.join('\n')}
                              onChange={(e) =>
                                setOpenTlSettings((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        allowedUserIds: parseAllowedIdentifiers(e.target.value),
                                      }
                                    : prev
                                )
                              }
                              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                              rows={3}
                              placeholder="許可するprofilesのIDまたはユーザー名を改行/カンマで入力"
                            />
                          )}
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="visibility"
                              checked={openTlSettings.visibility === 'private'}
                              onChange={() =>
                                setOpenTlSettings((prev) =>
                                  prev ? { ...prev, visibility: 'private' } : prev
                                )
                              }
                            />
                            <span>非公開（自分だけ表示）</span>
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={saveVideoSettings}
                          disabled={settingsSaving}
                          className="rounded border border-blue-300 px-3 py-1 text-xs text-blue-700 disabled:opacity-60"
                        >
                          {settingsSaving ? '保存中...' : '設定を保存'}
                        </button>
                        {settingsError && (
                          <p className="text-xs text-red-600">{settingsError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeSection === 'developer' && isAdmin && (
                  <div id="section-developer" className="text-sm space-y-2">
                    <h4 className="font-semibold">開発者向け</h4>
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

              </div>
            </div>
          </div>
        </div>
      )}
      {editTl && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => {
            setEditTl(null)
            setEditStatsOpen(false)
            setEditGuide(false)
            setEditFormationStatus('none')
            setEditArmor('')
            setEditDifficulty('')
            setEditFormation('')
            setEditSquads([])
            setEditSquadsDirty(false)
            setEditFormationMemberMap({})
            setEditTlSkipUpdate(false)
            setEditTlSkipUpdateLoaded(false)
            setEditTlSkipUpdateSaving(false)
            setEditPolicyError('')
          }}
        >
          <div
            className={`bg-white rounded w-full ${
              editStatsOpen ? 'max-w-4xl' : 'max-w-lg'
            } h-[80vh] max-h-[80vh] overflow-hidden flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 space-y-3 text-sm overflow-y-auto">
              {editTlMeta && (
                <div className="flex items-center gap-3">
                  {editTlMeta.thumbnail ? (
                    <img
                      src={editTlMeta.thumbnail}
                      alt={`${editTlMeta.label} thumbnail`}
                      className="h-20 w-36 rounded object-cover"
                    />
                  ) : (
                    <div className="h-20 w-36 rounded bg-gray-100 text-xs text-gray-500 flex items-center justify-center text-center px-2">
                      {editTlMeta.label} thumbnail unavailable
                    </div>
                  )}
                  <a
                    href={editTlMeta.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline text-xs"
                  >
                    {editTlMeta.label}で開く
                  </a>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  スコア
                  <input
                    type="number"
                    value={editScore}
                    onChange={(e) => setEditScore(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                  />
                </label>
                <label className="block">
                  難易度
                  <select
                    value={editDifficulty}
                    onChange={(e) => setEditDifficulty(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                  >
                    <option value="">未設定</option>
                    {difficulties.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  装甲
                  <select
                    value={editArmor}
                    onChange={(e) => setEditArmor(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
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
                <label className="block">
                  編成状態
                  <select
                    value={editFormationStatus}
                    onChange={(e) => setEditFormationStatus(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                  >
                    <option value="none">none</option>
                    <option value="auto">auto</option>
                    <option value="manual">manual</option>
                  </select>
                </label>
              </div>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editGuide}
                  onChange={(e) => setEditGuide(e.target.checked)}
                />
                <span>解説付き</span>
              </label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">編成</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-xs text-blue-600 underline"
                      onClick={() => {
                        setEditSquads((prev) => [...prev, emptySquad()])
                        setEditSquadsDirty(true)
                      }}
                    >
                      部隊を追加
                    </button>
                    <button
                      type="button"
                      className="text-xs text-blue-600 underline"
                      onClick={() => setEditStatsOpen((prev) => !prev)}
                    >
                      {editStatsOpen ? 'ステータス編集を閉じる' : 'ステータス編集を開く'}
                    </button>
                  </div>
                </div>
                {editSquads.length === 0 ? (
                  <p className="text-xs text-gray-500">編成がありません。</p>
                ) : (
                  <div className="space-y-3">
                    {editSquads.map((squad, squadIndex) => (
                      <div key={squadIndex} className="rounded border border-gray-200 p-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">部隊{squadIndex + 1}</span>
                          <button
                            type="button"
                            className="text-xs text-red-600 underline"
                            onClick={() => {
                              setEditSquads((prev) => prev.filter((_, i) => i !== squadIndex))
                              setEditSquadsDirty(true)
                            }}
                          >
                            削除
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {squad.strikers.map((member, idx) => (
                            <div key={`striker-${idx}`} className="space-y-1">
                              <span className="text-xs text-gray-500">ストライカー{idx + 1}</span>
                              <StudentSelect
                                students={students}
                                value={member}
                                onChange={(value) => {
                                  setEditSquads((prev) =>
                                    prev.map((s, i) =>
                                      i !== squadIndex
                                        ? s
                                        : {
                                            ...s,
                                            strikers: s.strikers.map((m, mi) =>
                                              mi === idx ? value : m
                                            ),
                                          }
                                    )
                                  )
                                  setEditSquadsDirty(true)
                                }}
                              />
                            </div>
                          ))}
                          {squad.specials.map((member, idx) => (
                            <div key={`special-${idx}`} className="space-y-1">
                              <span className="text-xs text-gray-500">スペシャル{idx + 1}</span>
                              <StudentSelect
                                students={students}
                                value={member}
                                onChange={(value) => {
                                  setEditSquads((prev) =>
                                    prev.map((s, i) =>
                                      i !== squadIndex
                                        ? s
                                        : {
                                            ...s,
                                            specials: s.specials.map((m, mi) =>
                                              mi === idx ? value : m
                                            ),
                                          }
                                    )
                                  )
                                  setEditSquadsDirty(true)
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[...squad.strikers, ...squad.specials]
                            .filter(Boolean)
                            .map((id) => {
                              const student = students.find((s) => s.id === id)
                              return (
                                <div
                                  key={`${squadIndex}-${id}`}
                                  className="flex items-center gap-2 rounded border px-2 py-1"
                                >
                                  {student?.image ? (
                                    <img
                                      src={student.image}
                                      alt={student.name}
                                      className="h-5 w-5 rounded object-cover"
                                    />
                                  ) : (
                                    <div className="h-5 w-5 rounded bg-gray-200" />
                                  )}
                                  <span className="text-xs">{student?.name ?? id}</span>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <details className="rounded border border-gray-200 p-2">
                  <summary className="cursor-pointer text-xs text-gray-600">
                    JSONプレビュー
                  </summary>
                  <textarea
                    value={editFormation}
                    readOnly
                    className="mt-2 w-full rounded border border-gray-300 px-2 py-1 font-mono text-xs h-24"
                  />
                </details>
              </div>
              {editStatsOpen && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">生徒ステータス</h4>
                  {editMemberIds.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      編成に生徒が設定されていません。
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {editMemberIds.map((id) => {
                        const student = students.find((s) => s.id === id)
                        const member = editFormationMemberMap[id] ?? {}
                        const memberRecord = member as Record<string, unknown>
                        const memberName =
                          typeof memberRecord.name === 'string'
                            ? memberRecord.name
                            : student?.name ?? id
                        return (
                          <div key={id} className="rounded border border-gray-200 p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              {student?.image ? (
                                <img
                                  src={student.image}
                                  alt={memberName}
                                  className="h-8 w-8 rounded object-cover"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded bg-gray-200" />
                              )}
                              <div>
                                <p className="text-xs font-semibold">{memberName}</p>
                                <p className="text-xs text-gray-500">{id}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {editStatFields.map((field) => {
                                const rawValue = memberRecord[field.key]
                                const value = typeof rawValue === 'number' ? rawValue : ''
                                return (
                                  <label key={field.key} className="text-xs">
                                    <span>{field.label}</span>
                                    <input
                                      type="number"
                                      value={value}
                                      onChange={(e) =>
                                        updateFormationMemberStat(
                                          id,
                                          field.key,
                                          e.target.value
                                        )
                                      }
                                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                                    />
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              {isAdmin && editTl && (
                <div className="space-y-1">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editTlSkipUpdate}
                      disabled={!editTlSkipUpdateLoaded || editTlSkipUpdateSaving}
                      onChange={(e) =>
                        setEditVideoSkipUpdate(editTl.videoid, e.target.checked)
                      }
                    />
                    <span>同期時にこの動画を更新しない</span>
                  </label>
                  <p className="text-xs text-gray-600">
                    ONにすると、既にDBにあるこのvideoidは同期処理で上書きされません。
                  </p>
                  {editPolicyError && (
                    <p className="text-xs text-red-600">{editPolicyError}</p>
                  )}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setEditTl(null)
                    setEditStatsOpen(false)
                    setEditGuide(false)
                    setEditFormationStatus('none')
                    setEditArmor('')
                    setEditDifficulty('')
                    setEditFormation('')
                    setEditSquads([])
                    setEditSquadsDirty(false)
                    setEditFormationMemberMap({})
                    setEditTlSkipUpdate(false)
                    setEditTlSkipUpdateLoaded(false)
                    setEditTlSkipUpdateSaving(false)
                    setEditPolicyError('')
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
        </div>
      )}
    </main>
  )
}
