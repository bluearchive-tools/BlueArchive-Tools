'use client'

import { useEffect, useState, useRef, useCallback, useMemo, Fragment } from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlus,
  faFileImport,
  faTimes,
  faCrosshairs,
  faUndo,
  faRedo,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons'
import AddEnemyModal from '../../../components/AddEnemyModal'
import PageHelpButton from '../../../components/PageHelpButton'
import equipmentJson from '@/data/equipment.json'



type EquipmentSlotMap = Record<string, string>



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
  cost?: number
  exDuration?: number
  exMotionDuration?: number
  exHitDelay?: number
  normalDuration?: number
  normalMotionDuration?: number
  normalInterval?: number
  normalHitDelay?: number
  equipmentSlots?: EquipmentSlotMap
  skills?: {
    ex?: { title?: string; type?: string; text?: string; values?: Record<string, number[]> }
    normal?: { title?: string; type?: string; text?: string; values?: Record<string, number[]> }
    passive?: { title?: string; type?: string; text?: string; values?: Record<string, number[]> }
    passivePlus?: { title?: string; type?: string; text?: string; values?: Record<string, number[]> }
    sub?: { title?: string; type?: string; text?: string; values?: Record<string, number[]> }
  }
}

interface Enemy {
  id: string
  name: string
  level?: number
  armor?: string
  stats?: { hp?: number; attack?: number; defense?: number; critResist?: number }
  skills?: Record<string, { name: string; duration?: number }>
  attackOrder?: { time: number; skill: string }[]
}

interface UserStudent {
  level: number
  ex_skill: number
  normal_skill: number
  passive_skill: number
  sub_skill: number
  [key: string]: number | Record<string, number> | undefined
}

interface SkillEvent {
  id: number
  row: number
  start: number
  end: number
  label: string
  type?: string
  travel?: number
  motion?: number
  target?: number
  cost?: number
  costRecovery?: {
    amount: number
    duration: number
    trigger: number
    applyDurationBonus: boolean
  }
  show?: boolean
}

interface MarkerEvent {
  id: number
  time: number
  label: string
  duration: number
  skillable: boolean
  show?: boolean
}

interface EventTemplate {
  id: string
  label: string
  duration: number
  skillable: boolean
}

interface Squad {
  strikers: string[]
  specials: string[]
  memo?: string
}

interface SquadGroup {
  id: string
  name: string
  squads: Squad[]
}

interface ProjectSnapshot {
  projectName: string
  rowStudents: string[]
  skills: SkillEvent[]
  markers: MarkerEvent[]
  groupId: string
  squadIndex: number
}

const armorBonus: Record<string, Record<string, number>> = {
  '爆発': { '重装甲': 1, '軽装備': 2, '特殊装甲': 0.5, '弾力装甲': 0.5 },
  '貫通': { '弾力装甲': 1, '重装甲': 2, '軽装備': 0.5, '特殊装甲': 1 },
  '神秘': { '特殊装甲': 2, '弾力装甲': 1, '重装甲': 0.5, '軽装備': 1 },
  '振動': { '軽装備': 1, '特殊装甲': 1.5, '弾力装甲': 2, '重装甲': 0.5 },
}


export default function TLMakerPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [rowStudents, setRowStudents] = useState<string[]>(['', '', '', '', '', ''])
  const [skills, setSkills] = useState<SkillEvent[]>([])
  const [markers, setMarkers] = useState<MarkerEvent[]>([])
  const [eventTemplates, setEventTemplates] = useState<EventTemplate[]>([])
  const [menuInfo, setMenuInfo] = useState<{ index: number; x: number; y: number } | null>(null)
  const [eventMenu, setEventMenu] = useState<{ type: 'skill' | 'marker'; id: number; x: number; y: number } | null>(null)
  const [buffMenu, setBuffMenu] = useState<{ id: number; x: number; y: number } | null>(null)
  const [skillPopup, setSkillPopup] = useState<{
    id: number
    x: number
    y: number
    text: string
    target?: string
  } | null>(null)
  const [row, setRow] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(1)
  const [label, setLabel] = useState('')
  const [skillCost, setSkillCost] = useState(0)
  const [skillCostTouched, setSkillCostTouched] = useState(false)
  const [showCostDetails, setShowCostDetails] = useState(false)
  const [costRecoveryEnabled, setCostRecoveryEnabled] = useState(false)
  const [costRecoveryAmount, setCostRecoveryAmount] = useState(0)
  const [costRecoveryDuration, setCostRecoveryDuration] = useState(0)
  const [costRecoveryTrigger, setCostRecoveryTrigger] = useState(0)
  const [costRecoveryTriggerTouched, setCostRecoveryTriggerTouched] = useState(false)
  const [costRecoveryApplyBonus, setCostRecoveryApplyBonus] = useState(false)
  const [costRecoveryApplyBonusTouched, setCostRecoveryApplyBonusTouched] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [squads, setSquads] = useState<{ name: string; members: string[] }[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const [selectedType, setSelectedType] = useState<'skill' | 'event' | null>(null)
  const [skillKind, setSkillKind] = useState<'ex' | 'normal'>('ex')
  const [timeScale, setTimeScale] = useState(20) // px per second
  const [applyTravel, setApplyTravel] = useState(false)
  const [waitCost, setWaitCost] = useState(false)
  const [zoomByPlayhead, setZoomByPlayhead] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const playheadTimer = useRef<NodeJS.Timeout | null>(null)
  const [playhead, setPlayhead] = useState(2)
  const [totalSeconds, setTotalSeconds] = useState(240)
  const [selected, setSelected] = useState<{ type: 'skill' | 'marker'; id: number }[]>([])
  const [copied, setCopied] = useState<{ skills: SkillEvent[]; markers: MarkerEvent[] } | null>(null)
  const [showEditMenu, setShowEditMenu] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [movingSkill, setMovingSkill] = useState<{ id: number; offset: number } | null>(null)
  const [moveModeSkill, setMoveModeSkill] = useState<number | null>(null)
  const scrollLock = useRef(0)
  const [playheadMenu, setPlayheadMenu] = useState<{ x: number; y: number } | null>(null)
  const [groups, setGroups] = useState<SquadGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<SquadGroup | null>(null)
  const [squadIndex, setSquadIndex] = useState(0)
  const [projectName, setProjectName] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [hasCache, setHasCache] = useState(false)
  const [userStats, setUserStats] = useState<Record<string, UserStudent>>({})
  const [initialized, setInitialized] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [showSquadMenu, setShowSquadMenu] = useState(false)
  const [showFileMenu, setShowFileMenu] = useState(false)
  const [showGroupMenu, setShowGroupMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showTextTL, setShowTextTL] = useState(false)
  const [textTL, setTextTL] = useState('')
  const [showCostLines, setShowCostLines] = useState(false)
  const [showDamageCalc, setShowDamageCalc] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showEnemyModal, setShowEnemyModal] = useState(false)
  const [includeStats, setIncludeStats] = useState(false)
  const [enemies, setEnemies] = useState<Enemy[]>([])
  const [defaultTargets, setDefaultTargets] = useState({ attack: 0, debuff: 0 })
  const [tlStats, setTlStats] = useState<Record<string, UserStudent>>({})
  const [defaultLevels, setDefaultLevels] = useState({ ex: 5, normal: 10, passive: 10, sub: 10 })
  const [skillColors, setSkillColors] = useState({
    ex: {
      travel: { color: '#3b82f6', alpha: 0.5 },
      motion: { color: '#3b82f6', alpha: 0.9 },
      rest: { color: '#3b82f6', alpha: 0.5 },
    },
    normal: {
      travel: { color: '#10b981', alpha: 0.5 },
      motion: { color: '#10b981', alpha: 0.9 },
      rest: { color: '#10b981', alpha: 0.5 },
    },
  })
  const prevSnapshot = useRef<ProjectSnapshot | null>(null)
  const undoStack = useRef<ProjectSnapshot[]>([])
  const redoStack = useRef<ProjectSnapshot[]>([])
  const isRestoring = useRef(false)

useEffect(() => {
  const loaded = loadUserStatsFromLocalStorage()
  setUserStats((prev) => ({ ...loaded, ...prev }))
}, [])




  useEffect(() => {
    if (showCreateModal && !selectedGroup && groups.length > 0) {
      setSelectedGroup(groups[0])
    }
  }, [showCreateModal, selectedGroup, groups])

  useEffect(() => {
    const raw = localStorage.getItem('tlLength')
    if (raw) {
      const n = parseInt(raw)
      if (!isNaN(n)) setTotalSeconds(n)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('tlLength', String(totalSeconds))
  }, [totalSeconds])

  useEffect(() => {
    const raw = localStorage.getItem('tlDefaultSkillLevels')
    if (raw) {
      try {
        setDefaultLevels(JSON.parse(raw))
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('tlDefaultSkillLevels', JSON.stringify(defaultLevels))
  }, [defaultLevels])

  useEffect(() => {
    const raw = localStorage.getItem('tlSkillColors')
    if (raw) {
      try {
        setSkillColors(JSON.parse(raw))
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('tlSkillColors', JSON.stringify(skillColors))
  }, [skillColors])

  useEffect(() => {
    const raw = localStorage.getItem('tlDefaultTargets')
    if (raw) {
      try {
        setDefaultTargets(JSON.parse(raw))
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('tlDefaultTargets', JSON.stringify(defaultTargets))
  }, [defaultTargets])

  useEffect(() => {
    const firstEnemy = rowStudents.findIndex((id) => id.startsWith('enemy:'))
    if (firstEnemy !== -1) {
      setDefaultTargets((prev) => {
        const attack =
          rowStudents[prev.attack]?.startsWith('enemy:') ? prev.attack : firstEnemy
        const debuff =
          rowStudents[prev.debuff]?.startsWith('enemy:') ? prev.debuff : firstEnemy
        if (attack === prev.attack && debuff === prev.debuff) return prev
        return { attack, debuff }
      })
    }
  }, [rowStudents])

  const getSnapshot = useCallback((): ProjectSnapshot => ({
    projectName,
    rowStudents: [...rowStudents],
    skills: skills.map((s) => ({ ...s })),
    markers: markers.map((m) => ({ ...m })),
    groupId: selectedGroup?.id ?? '',
    squadIndex,
  }), [projectName, rowStudents, skills, markers, selectedGroup, squadIndex])

  useEffect(() => {
    if (initialized) {
      prevSnapshot.current = getSnapshot()
    }
  }, [initialized, getSnapshot])

  useEffect(() => {
    if (!initialized || isRestoring.current) return
    const snap = getSnapshot()
    if (
      prevSnapshot.current &&
      JSON.stringify(prevSnapshot.current) !== JSON.stringify(snap)
    ) {
      undoStack.current.push(prevSnapshot.current)
      if (undoStack.current.length > 200) undoStack.current.shift()
      redoStack.current = []
    }
    prevSnapshot.current = snap
  }, [projectName, rowStudents, skills, markers, selectedGroup, squadIndex, initialized, getSnapshot])

  const hidePopups = () => {
    if (menuInfo) setMenuInfo(null)
    if (eventMenu) setEventMenu(null)
    setMarkers((prev) => prev.map((m) => (m.show ? { ...m, show: false } : m)))
    setSkills((prev) => prev.map((s) => (s.show ? { ...s, show: false } : s)))
    setShowEditMenu(false)
    setSelected([])
    if (playheadMenu) setPlayheadMenu(null)
    if (buffMenu) setBuffMenu(null)
    if (buffPopup) setBuffPopup(null)
    if (skillPopup) setSkillPopup(null)
    if (moveModeSkill !== null) setMoveModeSkill(null)
    setShowMenu(false)
    setShowTools(false)
    setShowSquadMenu(false)
    setShowGroupMenu(false)
    setShowSettings(false)
    setShowFileMenu(false)
  }

  const closeMenus = () => {
    setShowMenu(false)
    setShowEditMenu(false)
    setShowTools(false)
    setShowFileMenu(false)
    setShowSquadMenu(false)
    setShowGroupMenu(false)
    setShowSettings(false)
    if (buffMenu) setBuffMenu(null)
    if (buffPopup) setBuffPopup(null)
    if (skillPopup) setSkillPopup(null)
    if (moveModeSkill !== null) setMoveModeSkill(null)
  }

  const addRow = () => setRowStudents((prev) => [...prev, ''])

  const addEnemyRow = (enemyId: string) => {
    const idx = rowStudents.length
    setRowStudents((prev) => [...prev, `enemy:${enemyId}`])
    const enemy = enemies.find((e) => e.id === enemyId)
    if (!enemy || !enemy.attackOrder) return
    const now = Date.now()
    const events = enemy.attackOrder.map((a, i) => {
      const info = enemy.skills?.[a.skill]
      const dur = info?.duration ?? 1
      const label = info?.name || a.skill
      return {
        id: now + i,
        row: idx,
        start: snapTime(a.time),
        end: snapTime(a.time + dur),
        label,
        type: 'attack',
      }
    })
    if (events.length) setSkills((prev) => [...prev, ...events])
  }

  const addNormalSkills = (members: string[]) => {
    const now = Date.now()
    const events: SkillEvent[] = []
    members.forEach((id, idx) => {
      const st = students.find((s) => s.id === id)
      if (!st || !st.normalInterval) return
      const interval = st.normalInterval
      const dur = st.normalDuration || 0
      const travel = st.normalHitDelay || 0
      const motion = st.normalMotionDuration || 0
      for (let t = interval; t < totalSeconds; t += interval) {
        let start = snapTime(t)
        let end = snapTime(t + dur)
        skills.forEach((ev) => {
          if (ev.row === idx && ev.type === 'ex') {
            const motionEnd = snapTime(
              ev.start + (ev.travel || 0) + (ev.motion || 0)
            )
            if (start >= ev.start && start < motionEnd) {
              const delta = motionEnd - start
              start = motionEnd
              end = snapTime(end + delta)
            }
          }
        })
        if (start >= totalSeconds) continue
        events.push({
          id: now + events.length,
          row: idx,
          start,
          end,
          label: st.skills?.normal?.title || 'NS',
          travel,
          motion,
          type: 'normal',
        })
      }
    })
    if (events.length) setSkills((prev) => [...prev, ...events])
  }

  const removeRow = (idx: number) => {
    setRowStudents((prev) => prev.filter((_, i) => i !== idx))
    setSkills((prev) =>
      prev
        .filter((ev) => ev.row !== idx)
        .map((ev) => ({ ...ev, row: ev.row > idx ? ev.row - 1 : ev.row }))
    )
  }

  const removeSkill = (id: number) => {
    setSkills((prev) => prev.filter((ev) => ev.id !== id))
  }

  const removeMarker = (id: number) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id))
  }

  const applyMembers = (members: string[]) => {
    setRowStudents(members.concat(Array(Math.max(0, 6 - members.length)).fill('')))
  }

  const importSquad = (members: string[]) => {
    setSkills([])
    setMarkers([])
    applyMembers(members)
    addNormalSkills(members)
    setShowImport(false)
  }

  const projectKey = (gid: string | null, idx: number) =>
    gid ? `tlMakerProject_${gid}_${idx}` : 'tlMakerProject_default'

  const loadProject = (
    gid: string | null,
    idx: number,
    fallbackMembers?: string[]
  ) => {
    const saved = localStorage.getItem(projectKey(gid, idx))
    if (!saved) {
      if (fallbackMembers) {
        applyMembers(fallbackMembers)
        setTlStats({})
      }
      return false
    }
    try {
      const data = JSON.parse(saved) as {
        projectName: string
        rowStudents: string[]
        skills: SkillEvent[]
        markers: MarkerEvent[]
      }
      setProjectName(data.projectName)
      setSkills(data.skills || [])
      setMarkers(data.markers || [])
      applyMembers(data.rowStudents || fallbackMembers || [])
      setTlStats({})
      return true
    } catch {
      if (fallbackMembers) applyMembers(fallbackMembers)
      return false
    }
  }

  const saveProject = () => {
    const key = projectKey(selectedGroup?.id ?? null, squadIndex)
    const data = {
      projectName,
      rowStudents,
      skills,
      markers,
    }
    localStorage.setItem(key, JSON.stringify(data))
    localStorage.setItem('tlMakerCache', JSON.stringify({
      projectName,
      groupId: selectedGroup?.id ?? '',
      squadIndex,
      rowStudents,
      skills,
      markers,
    }))
    localStorage.setItem('tlMakerLastKey', key)
  }

  const downloadProject = (withStats = false) => {
    const data: Record<string, unknown> = {
      projectName,
      rowStudents,
      skills,
      markers,
      groupId: selectedGroup?.id ?? '',
      squadIndex,
    }
    if (withStats) {
      const stats: Record<string, UserStudent> = {}
      rowStudents.forEach((id) => {
        if (!id || id.startsWith('enemy:')) return
        const st = students.find((s) => s.id === id)
        const base = st?.styleOf || st?.altOf || st?.id || id
        const stat = getStats(id)
        if (stat) stats[base] = stat
      })
      data.userStats = stats
    }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName || 'timeline'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const undo = () => {
    const snap = undoStack.current.pop()
    if (!snap) return
    redoStack.current.push(getSnapshot())
    restoreSnapshot(snap)
  }

  const redo = () => {
    const snap = redoStack.current.pop()
    if (!snap) return
    undoStack.current.push(getSnapshot())
    restoreSnapshot(snap)
  }

  const restoreSnapshot = (snap: ProjectSnapshot) => {
    isRestoring.current = true
    setProjectName(snap.projectName)
    setRowStudents([...snap.rowStudents])
    setSkills(snap.skills.map((s) => ({ ...s })))
    setMarkers(snap.markers.map((m) => ({ ...m })))
    const g = groups.find((gr) => gr.id === snap.groupId) || null
    setSelectedGroup(g)
    setSquadIndex(snap.squadIndex)
    prevSnapshot.current = snap
    setTimeout(() => {
      prevSnapshot.current = getSnapshot()
      isRestoring.current = false
    })
  }

  const switchSquad = (index: number) => {
  if (!selectedGroup) return

  const sq = selectedGroup.squads[index]
  if (!sq) return

  const members = [...sq.strikers, ...sq.specials]

  // 状態を一旦クリア
  setSkills([])
  setMarkers([])

  // 保存済みTLがあればロード、なければ初期化
  const loaded = loadProject(selectedGroup.id, index, members)
  if (!loaded) {
    addNormalSkills(members)
  }

  setSquadIndex(index)
}


  useEffect(() => {
    const loadStudents = async () => {
      try {
        const res = await fetch('/api/students')
        if (res.ok) setStudents(await res.json())
      } catch {
        /* ignore */
      }
    }
    const loadEvents = async () => {
      try {
        const res = await fetch('/api/events')
        if (res.ok) setEventTemplates(await res.json())
      } catch {
        /* ignore */
      }
    }
    const loadEnemies = async () => {
      try {
        const res = await fetch('/api/enemies')
        if (res.ok) setEnemies(await res.json())
      } catch {
        /* ignore */
      }
    }
    loadStudents()
    loadEvents()
    loadEnemies()
    const map: Record<string, UserStudent> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('userStudent:')) {
        const id = key.substring('userStudent:'.length)
        const val = localStorage.getItem(key)
        if (val) {
          try {
            map[id] = JSON.parse(val) as UserStudent
          } catch {
            /* ignore */
          }
        }
      }
    }
    setUserStats(map)
    const raw = localStorage.getItem('squadGroups')
    let parsed: SquadGroup[] = []
    if (raw) {
      try {
        parsed = JSON.parse(raw) as SquadGroup[]
        setGroups(parsed)
        const list: { name: string; members: string[] }[] = []
        parsed.forEach((g) => {
          g.squads.forEach((sq, idx) => {
            list.push({ name: `${g.name} #${idx + 1}`, members: [...sq.strikers, ...sq.specials] })
          })
        })
        setSquads(list)
      } catch {
        /* ignore */
      }
    }
    const lastKey = localStorage.getItem('tlMakerLastKey')
    if (lastKey) {
      const m = lastKey.match(/^tlMakerProject_(.+)_(\d+)$/)
      const gid = m ? m[1] : null
      const idx = m ? parseInt(m[2]) : 0
      const g = gid ? parsed.find((gr) => gr.id === gid) || null : null
      setSelectedGroup(g)
      setSquadIndex(idx)
      const members = g ? [...g.squads[idx].strikers, ...g.squads[idx].specials] : Array(6).fill('')
      const loaded = loadProject(gid, idx, members)
      if (!loaded) addNormalSkills(members)
      setInitialized(true)
    } else if (localStorage.getItem('tlMakerCache')) {
      setHasCache(true)
    }
  }, [])

  useEffect(() => {
    if (selectedType === 'event') {
      const tpl = eventTemplates.find((t) => t.id === templateId)
      if (tpl) {
        setLabel(tpl.label)
      }
    }
  }, [templateId, selectedType, eventTemplates])

  useEffect(() => {
    if (!initialized || !selectedGroup) return
    if (rowStudents.every((id) => id === '') && selectedGroup.squads.length > 0) {
      switchSquad(0)
    }
  }, [initialized, selectedGroup])

  useEffect(() => {
    if (selectedType !== 'skill') return
    const st = students.find((s) => s.id === rowStudents[row])
    if (!st) return
    const dur =
      skillKind === 'ex' ? st.exDuration : st.normalDuration
    if (dur !== undefined) {
      const travel =
        skillKind === 'ex'
          ? st.exHitDelay || 0
          : st.normalHitDelay || 0
      const extra = applyTravel ? 0 : travel
      setEnd(snapTime(start + dur + extra))
    }
  }, [row, start, selectedType, rowStudents, students, applyTravel, skillKind])

  useEffect(() => {
    if (selectedType !== 'skill') return
    const st = students.find((s) => s.id === rowStudents[row])
    if (!st) return
    if (!skillCostTouched) {
      setSkillCost(st.cost ?? 0)
    }
    const travel =
      skillKind === 'ex'
        ? st.exHitDelay || 0
        : st.normalHitDelay || 0
    const defaultTrigger = snapTime(start + travel)
    if (!costRecoveryTriggerTouched) {
      setCostRecoveryTrigger(defaultTrigger)
    }
    if (!costRecoveryApplyBonusTouched) {
      const stats = getStats(st.id)
      const uniqueStar = Number(stats?.unique_star ?? 0)
      setCostRecoveryApplyBonus(uniqueStar >= 2)
    }
  }, [
    selectedType,
    row,
    start,
    rowStudents,
    students,
    skillKind,
    skillCostTouched,
    costRecoveryTriggerTouched,
    costRecoveryApplyBonusTouched,
  ])

  useEffect(() => {
  if (!initialized || isRestoring.current) return
  saveProject()
}, [initialized, projectName, selectedGroup, squadIndex, rowStudents, skills, markers])


  const INITIAL_COST = 0
  const MAX_COST = 10
  const COST_RECOVERY_BASE = 700 * 6

  function calcCost(t: number) {
  // 🔒 初期化ガード
  if (!initialized || students.length === 0 || rowStudents.length === 0) {
    return 0
  }

  const members = rowStudents.filter(
    (id) => id && !id.startsWith('enemy:')
  ).length

  const recoveryStart = 2
  const baseRate = 0.07 * members
  let recovery = 0

  let specialMultiplier = 1
  rowStudents.forEach((id) => {
    if (!id || id.startsWith('enemy:')) return
    const st = students.find((s) => s.id === id)
    if (!st) return

    if (st.role === 'SPECIAL') {
      const val = st.skills?.sub?.values?.cost
      if (val) {
        const stats = getStats(id)
        const level = stats?.sub_skill ?? defaultLevels.sub
        const buff = val[level - 1]
        if (buff !== undefined) specialMultiplier *= 1 + buff / 100
      }
    }
  })

  const getRecoveryBonusAt = (time: number) => {
    let bonus = 0
    skills.forEach((ev) => {
      if (!ev.costRecovery) return
      const { amount, duration, trigger, applyDurationBonus } = ev.costRecovery
      if (amount === 0 || duration <= 0) return
      const adjustedDuration = applyDurationBonus ? duration * 1.19 : duration
      if (time >= trigger && time <= trigger + adjustedDuration) {
        bonus += (amount / COST_RECOVERY_BASE) * 100
      }
    })
    return bonus
  }

  if (t > recoveryStart) {
    const step = 0.1
    for (let time = recoveryStart; time < t; time = parseFloat((time + step).toFixed(3))) {
      const delta = Math.min(step, t - time)
      const bonus = getRecoveryBonusAt(time)
      const multiplier = specialMultiplier * (1 + bonus / 100)
      recovery += baseRate * delta * multiplier
    }
  }

  let spent = 0
  skills
    .filter((ev) => ev.type === 'ex' && ev.start <= t)
    .forEach((ev) => {
      const rowId = rowStudents[ev.row]
      if (!rowId || rowId.startsWith('enemy:')) return
      const st = students.find((s) => s.id === rowId)
      if (!st) return
      const costValue = ev.cost ?? st.cost ?? 0
      spent += costValue
    })

  return Math.min(MAX_COST, INITIAL_COST + recovery - spent)
}



  const addEvent = () => {
    const id = Date.now()
    if (selectedType === 'skill') {
      const st = students.find((s) => s.id === rowStudents[row])
      const travel =
        skillKind === 'ex'
          ? st?.exHitDelay || 0
          : st?.normalHitDelay || 0
      const duration = end - start
      let s = snapTime(applyTravel ? start - travel : start)
      let e = snapTime(start + duration)
      const motion =
        skillKind === 'ex'
          ? Math.max(0, (st?.exMotionDuration || 0) - travel)
          : Math.max(0, (st?.normalMotionDuration || 0) - travel)
      const costValue = skillCost
      if (skillKind === 'ex' && waitCost && costValue > 0) {
        let t = s
        if (calcCost(t) < costValue) {
          while (t <= totalSeconds) {
            if (calcCost(t) >= costValue) break
            t = snapTime(t + 0.1)
          }
          if (t !== s) {
            const delta = t - s
            s = t
            e = snapTime(e + delta)
          }
        } else {
          while (t >= 0) {
            const prev = snapTime(t - 0.1)
            if (prev < 0 || calcCost(prev) < costValue) break
            t = prev
          }
          if (t !== s) {
            const delta = s - t
            s = t
            e = snapTime(e - delta)
          }
        }
      }
      if (skillKind === 'normal') {
        skills.forEach((ev) => {
          if (ev.row === row && ev.type === 'ex') {
            const motionEnd = snapTime(
              ev.start + (ev.travel || 0) + (ev.motion || 0)
            )
            if (s >= ev.start && s < motionEnd) {
              const delta = motionEnd - s
              s = motionEnd
              e = snapTime(e + delta)
            }
          }
        })
      }
      if (e <= s) return
      const lbl =
        label ||
        (skillKind === 'ex'
          ? st?.skills?.ex?.title
          : st?.skills?.normal?.title) ||
        ''
      let target: number | undefined
      const skillType =
        skillKind === 'ex' ? st?.skills?.ex?.type : st?.skills?.normal?.type
      if (skillType === 'attack') target = defaultTargets.attack
      if (skillType === 'debuff') target = defaultTargets.debuff
      setSkills([
        ...skills,
        {
          id,
          row,
          start: s,
          end: e,
          label: lbl,
          travel,
          motion,
          type: skillKind,
          cost: skillCost,
          ...(costRecoveryEnabled && costRecoveryDuration > 0 && costRecoveryAmount !== 0
            ? {
                costRecovery: {
                  amount: costRecoveryAmount,
                  duration: costRecoveryDuration,
                  trigger: costRecoveryTrigger,
                  applyDurationBonus: costRecoveryApplyBonus,
                },
              }
            : {}),
          ...(target !== undefined ? { target } : {}),
        },
      ])
    } else if (selectedType === 'event') {
      const tpl = eventTemplates.find((t) => t.id === templateId)
      setMarkers([
        ...markers,
        {
          id,
          time: snapTime(start),
          label: label || tpl?.label || '',
          duration: tpl?.duration ?? 0,
          skillable: tpl?.skillable ?? false,
        },
      ])
    }
    setLabel('')
    setShowForm(false)
    setSelectedType(null)
  }

  const rowHeight = 42 // px
  const rows = rowStudents.length

  const currentCost = useMemo(() => {
  if (!initialized) return 0
  return calcCost(playhead)
}, [initialized, calcCost, playhead])


  const dangerSkills = useMemo(() => {
  if (!initialized) return new Set<number>()

  const set = new Set<number>()
  skills
    .filter((ev) => ev.type === 'ex')
    .forEach((ev) => {
      if (calcCost(ev.start) < 0) set.add(ev.id)
    })
  return set
}, [initialized, skills, calcCost])


  const formatRemain = (t: number) => {
    const clamped = Math.max(0, t)
    const m = Math.floor(clamped / 60)
    const s = clamped - m * 60
    const str = s.toFixed(3).padStart(6, '0')
    return `${m}:${str}`
  }

  const exTimelineText = useMemo(() => {
  if (!initialized) return []

  return skills
    .filter((ev) => ev.type === 'ex')
    .sort((a, b) => a.start - b.start)
    .map((ev) => {
      const rowId = rowStudents[ev.row]
      if (!rowId) return ''

      const st = students.find((s) => s.id === rowId)
      if (!st) return ''

      const baseCost = ev.cost ?? st.cost ?? 0
      const before = Math.min(MAX_COST, calcCost(ev.start) + baseCost)
      return `${formatRemain(ev.start)}(${before.toFixed(2)}cost) ${st.name}`
    })
}, [initialized, skills, students, rowStudents])

  const costDetailItems = useMemo(() => {
  if (!initialized) return []
  const entries: Array<{
    time: number
    kind: '消費' | '回復'
    detail: Record<string, string | number>
  }> = []

  skills
    .filter((ev) => ev.type === 'ex')
    .forEach((ev) => {
      const rowId = rowStudents[ev.row]
      if (!rowId) return
      const st = students.find((s) => s.id === rowId)
      if (!st) return
      const costValue = ev.cost ?? st.cost ?? 0
      entries.push({
        time: ev.start,
        kind: '消費',
        detail: {
          name: st.name,
          cost: parseFloat(costValue.toFixed(1)),
        },
      })
    })

  skills.forEach((ev) => {
    if (!ev.costRecovery) return
    const { amount, duration, trigger, applyDurationBonus } = ev.costRecovery
    if (amount === 0 || duration <= 0) return
    const adjustedDuration = applyDurationBonus ? duration * 1.19 : duration
    entries.push({
      time: trigger,
      kind: '回復',
      detail: {
        amount: parseFloat(amount.toFixed(1)),
        duration: parseFloat(duration.toFixed(2)),
        adjustedDuration: parseFloat(adjustedDuration.toFixed(2)),
        applyDurationBonus,
      },
    })
  })

  return entries.sort((a, b) => a.time - b.time)
}, [initialized, skills, students, rowStudents])


  useEffect(() => {
  if (!initialized) return
  if (showTextTL) setTextTL(exTimelineText.join('\n'))
}, [initialized, exTimelineText, showTextTL])


  const tickStep = timeScale >= 180 ? 0.1 : timeScale >= 40 ? 0.5 : 1
  const labelStep =
    tickStep < 1 ? tickStep : timeScale < 20 ? 5 : 1

  const snapTime = (t: number) => {
    const n = Math.round(t * 30)
    const group = Math.floor(n / 3)
    const offsetIndex = n % 3
    const offset = offsetIndex === 1 ? 0.033 : offsetIndex === 2 ? 0.066 : 0
    return parseFloat((group * 0.1 + offset).toFixed(3))
  }

  const toRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  function formatSkillText(
  skill: { text?: string; values?: Record<string, number[]> } | undefined,
  level: number
) {
  if (!skill?.text) return ''

  // {key} と {{key}} の両方を置換する
  return skill.text.replace(/\{\{?(\w+)\}?\}/g, (matched, key) => {
    const arr = skill.values?.[key]
    if (!Array.isArray(arr)) return matched

    const idx = Math.min(Math.max(level - 1, 0), arr.length - 1)
    const val = arr[idx]
    return val !== undefined ? String(val) : matched
  })
}



  function getSkillLevel(
  type: 'ex' | 'normal',
  stats: UserStudent | undefined
) {
  if (type === 'normal') return stats?.normal_skill ?? defaultLevels.normal
  return stats?.ex_skill ?? defaultLevels.ex
}


  function getStats(id: string): UserStudent | undefined {
  const st = students.find((s) => s.id === id)

  const candidates = [
    st?.id,        // ← まず「自分自身」
    st?.styleOf,   // ← 次に共有元
    st?.altOf,
    id,
  ].filter(Boolean) as string[]

  for (const key of candidates) {
    if (tlStats[key]) return tlStats[key]
    if (userStats[key]) return userStats[key]

    // 最終フォールバック：localStorage直読み
    try {
      const raw = localStorage.getItem(`userStudent:${key}`)
      if (raw) return JSON.parse(raw)
    } catch {}
  }

  return undefined
}


function loadUserStatsFromLocalStorage(): Record<string, UserStudent> {
  const result: Record<string, UserStudent> = {}

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith('userStudent:')) continue

    try {
      const id = key.replace('userStudent:', '')
      const data = JSON.parse(localStorage.getItem(key) || 'null')
      if (data) result[id] = data
    } catch {}
  }

  return result
}

function sumSpecialSub(
    rowStudents: string[],
    key: string
  ): number {
    let sum = 0

    rowStudents.forEach((id) => {
      if (!id || id.startsWith('enemy:')) return

      const st = students.find((s) => s.id === id)
      if (!st || st.role !== 'SPECIAL') return

      const userStat = getStats(st.id)
      const subLevel = userStat?.sub_skill
      if (!subLevel || subLevel <= 0) return

      const baseId = st.styleOf || st.altOf || st.id
      const base = students.find((s) => s.id === baseId)
      if (!base) return

      const arr = st.skills?.sub?.values?.[key]
    if (!Array.isArray(arr)) return

      const idx = Math.min(subLevel - 1, arr.length - 1)
      sum += Number(arr[idx])
    })

    return sum
  }
  const getTimeFromClientX = (x: number) => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const pos = x - rect.left + containerRef.current.scrollLeft
    const clamped = Math.max(0, Math.min(pos, totalSeconds * timeScale))
    const t = clamped / timeScale
    return snapTime(t)
  }

  const isBuffSkill = (ev: SkillEvent) => {
    const st = students.find((s) => s.id === rowStudents[ev.row])
    if (!st || !st.skills) return false
    if (ev.type === 'ex' && st.skills.ex) {
      return st.skills.ex.type === 'buff'
    }
    if (ev.type === 'normal' && st.skills.normal) {
      return st.skills.normal.type === 'buff'
    }
    if (st.skills.ex && st.skills.ex.title === ev.label) {
      return st.skills.ex.type === 'buff'
    }
    const normalTitle = st.skills.normal?.title || 'NS'
    if (ev.label === normalTitle) {
      return st.skills.normal?.type === 'buff'
    }
    return false
  }

  const getSkillType = (ev: SkillEvent): string | undefined => {
    const rowId = rowStudents[ev.row]
    if (rowId.startsWith('enemy:')) {
      return ev.type
    }
    const st = students.find((s) => s.id === rowId)
    if (!st || !st.skills) return undefined
    if (ev.type === 'ex') return st.skills.ex?.type
    if (ev.type === 'normal') return st.skills.normal?.type
    return ev.type
  }

  const isTargetableSkill = (ev: SkillEvent) => {
    const t = getSkillType(ev)
    return t === 'buff' || t === 'attack' || t === 'debuff'
  }

  const getEffectiveTarget = (ev: SkillEvent) => {
    if (ev.target !== undefined) return ev.target
    const t = getSkillType(ev)
    if (t === 'attack') return defaultTargets.attack
    if (t === 'debuff') return defaultTargets.debuff
    return ev.row
  }

  const getActiveBuffs = (rowIdx: number, t: number) => {
    return skills
      .filter((ev) => isBuffSkill(ev))
      .filter((ev) => {
        const target = getEffectiveTarget(ev)
        if (target !== rowIdx) return false
        const start = ev.start + (ev.travel || 0)
        return start <= t && t <= ev.end
      })
      .map((ev) => {
        const st = students.find((s) => s.id === rowStudents[ev.row])
        const stats = getStats(rowStudents[ev.row])
        const level = getSkillLevel(ev.type as 'ex' | 'normal', stats)
        const skill =
          ev.type === 'normal'
            ? st?.skills?.normal
            : st?.skills?.ex
        const text = formatSkillText(skill, level)
        return text ? `${ev.label}: ${text}` : ev.label
      })
  }

  const getExBuffMultiplier = (rowIdx: number, t: number) => {
    let bonus = 0
    skills
      .filter((ev) => isBuffSkill(ev))
      .forEach((ev) => {
        const target = getEffectiveTarget(ev)
        if (target !== rowIdx) return
        const start = ev.start + (ev.travel || 0)
        if (start <= t && t <= ev.end) {
          const st = students.find((s) => s.id === rowStudents[ev.row])
          const stats = getStats(rowStudents[ev.row])
          const level = getSkillLevel(ev.type as 'ex' | 'normal', stats)
          const skill =
            ev.type === 'normal'
              ? st?.skills?.normal
              : st?.skills?.ex
          const val = skill?.values?.ex?.[level - 1]
          if (val) bonus += Number(val)
        }
      })
    return (10000 + bonus * 100) / 10000
  }
  const getBuffBonus = (
  rowIdx: number,
  t: number,
  key: 'ex' | 'attack' | 'type' | 'critdamage'
) => {
  let bonus = 0

  skills
    .filter((ev) => isBuffSkill(ev))
    .forEach((ev) => {
      const target = getEffectiveTarget(ev)
      if (target !== rowIdx) return

      const start = ev.start + (ev.travel || 0)
      if (!(start <= t && t <= ev.end)) return

      const st = students.find((s) => s.id === rowStudents[ev.row])
      const stats = getStats(rowStudents[ev.row])
      const level = getSkillLevel(ev.type as 'ex' | 'normal', stats)

      const skill =
        ev.type === 'normal'
          ? st?.skills?.normal
          : st?.skills?.ex

      const arr = skill?.values?.[key]
      const val = arr?.[level - 1]

      if (val !== undefined) {
        bonus += Number(val)
      }
    })

  return bonus
}
type EquipBonus = {
  attackMul: number // %系（合計。例: 0.45 = 45%）
  attackAdd: number // 実数加算
  critDamage: number // 実数（いまの定義のまま）
}

type EquipPickMode = 'percent' | 'flat' | 'both'
type EquipmentTier = {
  tier: number
  attack?: number
  criticaldamage?: number
}

type EquipmentSlotDef = {
  tiers: EquipmentTier[]
}

type EquipmentJson = Record<string, EquipmentSlotDef>
const equipmentData: EquipmentJson = equipmentJson
type UserStatsWithEquip = UserStudent & {
  equipment?: Record<string, number>
} & LegacyEquipStats

type LegacyEquipStats = {
  equip1?: number
  equip2?: number
  equip3?: number
  equip4?: number
}


const getEquipTier = (
  stats: UserStatsWithEquip,
  slot: string
): number | undefined => {
  // 新形式
  if (stats.equipment?.[slot] !== undefined) {
    return stats.equipment[slot]
  }

  // 旧形式（完全型安全）
  switch (slot) {
    case 'slot1':
      return stats.equip1
    case 'slot2':
      return stats.equip2
    case 'slot3':
      return stats.equip3
    case 'accessory':
      return stats.equip4
    default:
      return undefined
  }
}

function typedEntries(
  obj: Record<string, string>
): Array<[string, string]> {
  return Object.entries(obj)
}



const getEquipmentBonus = (
  student: Student,
  stats: UserStatsWithEquip | undefined,
  mode: EquipPickMode = 'both'
): EquipBonus => {
  let attackMul = 0
  let attackAdd = 0
  let critDamage = 0

  const slots = student.equipmentSlots
if (!slots || !stats) {
  return { attackMul: 0, attackAdd: 0, critDamage: 0 }
}

typedEntries(slots).forEach(([slotKey, equipCategory]) => {
  const equipTier = getEquipTier(stats, slotKey)
  if (!equipTier) return

  const equipDef = equipmentData[equipCategory]
  if (!equipDef) return

  const tierDef = equipDef.tiers.find(t => t.tier === equipTier)
  if (!tierDef) return

  if (typeof tierDef.attack === 'number') {
    if (tierDef.attack < 10) {
      if (mode !== 'flat') attackMul += tierDef.attack
    } else {
      if (mode !== 'percent') attackAdd += tierDef.attack
    }
  }

  if (typeof tierDef.criticaldamage === 'number') {
    if (mode !== 'percent') critDamage += tierDef.criticaldamage
  }
})

  if (mode === 'percent') return { attackMul, attackAdd: 0, critDamage: 0 }
  if (mode === 'flat') return { attackMul: 0, attackAdd, critDamage }
  return { attackMul, attackAdd, critDamage }
}

type BuffPopup = {
  row: number
  x: number
  y: number
  buffs: string[]
  info: string[]
  studentId: string            // ★追加
  values?: Record<string, number[]> // ★追加（crit / attack / type）
}

const [buffPopup, setBuffPopup] = useState<BuffPopup | null>(null)


function resolveBuffText(
  text: string,
  studentId: string,
  values?: Record<string, number[]>
): string {
  if (!values) return text

  const userStat = getStats(studentId)
  if (!userStat) return text

  return text.replace(/\{(\w+)\}/g, (_, key) => {
    const arr = values[key]
    if (!Array.isArray(arr)) return `{${key}}`

    // ★ key に応じて参照するレベルを切り替え
    let level: number | undefined
    if (key === 'crit' || key === 'type' || key === 'attack') {
      level = userStat.sub_skill
    } else {
      level = userStat.passive_skill
    }

    if (!level || level <= 0) return `{${key}}`

    const idx = Math.min(level - 1, arr.length - 1)
    return String(arr[idx])
  })
}







  return (
    <main className="p-4 space-y-4 select-none overflow-y-hidden" onClick={hidePopups}>
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold">TLメーカー</h1>
        <PageHelpButton pageKey="tl-maker" />
      </div>
      {!initialized && (
        <div className="flex flex-col items-center justify-center py-20 space-y-2">
          <button
            type="button"
            className="border px-4 py-1 rounded w-40"
            onClick={() => setShowCreateModal(true)}
          >
            TLを作成
          </button>
          <label className="border px-4 py-1 rounded w-40 text-center cursor-pointer">
            TLをインポート
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                file.text().then((txt) => {
                  try {
                    const data = JSON.parse(txt)
                    setProjectName(data.projectName || '')
                    setSkills(data.skills || [])
                    setMarkers(data.markers || [])
                    applyMembers(data.rowStudents || [])
                    const g = groups.find((gr) => gr.id === data.groupId) || null
                    setSelectedGroup(g)
                    setSquadIndex(data.squadIndex || 0)
                    if (data.userStats) {
                      const map: Record<string, UserStudent> = {}
                      Object.entries(data.userStats as Record<string, UserStudent>).forEach(
                        ([id, val]) => {
                          const st = students.find((s) => s.id === id)
                          const base = st?.styleOf || st?.altOf || st?.id || id
                          map[base] = val
                        }
                      )
                      setTlStats(map)
                    } else {
                      setTlStats({})
                    }
                    setInitialized(true)
                  } catch {
                    /* ignore */
                  }
                })
              }}
            />
          </label>
          {hasCache && (
            <button
              type="button"
              className="border px-4 py-1 rounded w-40"
              onClick={() => {
                const raw = localStorage.getItem('tlMakerCache')
                if (!raw) return
                try {
                  const data = JSON.parse(raw)
                  setProjectName(data.projectName || '')
                  setSkills(data.skills || [])
                  setMarkers(data.markers || [])
                  applyMembers(data.rowStudents || [])
                  const g = groups.find((gr) => gr.id === data.groupId) || null
                  setSelectedGroup(g)
                  setSquadIndex(data.squadIndex || 0)
                  setTlStats({})
                  setInitialized(true)
                } catch {
                  /* ignore */
                }
              }}
            >
              キャッシュから復元
            </button>
          )}
        </div>
      )}

      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="border rounded p-4 bg-white space-y-2 w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowSaveModal(false)}
              className="absolute top-1 right-1"
              aria-label="閉じる"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <div className="text-sm font-bold">保存オプション</div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeStats}
                onChange={(e) => setIncludeStats(e.target.checked)}
              />
              <span>育成データを含める</span>
            </label>
            <button
              type="button"
              onClick={() => {
                downloadProject(includeStats)
                setShowSaveModal(false)
              }}
              className="border px-2 py-1 bg-blue-500 text-white rounded"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {showEnemyModal && (
        <AddEnemyModal
          enemies={enemies}
          addRow={addEnemyRow}
          close={() => setShowEnemyModal(false)}
        />
      )}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="border rounded p-4 bg-white space-y-2 w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute top-1 right-1"
              aria-label="閉じる"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <div className="text-sm font-bold">TL作成</div>
            <label className="flex items-center gap-2">
              <span>名前:</span>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="border rounded p-1 flex-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>編成:</span>
              <select
                value={selectedGroup?.id || ''}
                onChange={(e) => {
                  const g = groups.find((gr) => gr.id === e.target.value) || null
                  setSelectedGroup(g)
                }}
                className="border rounded p-1 flex-1"
              >
                <option value="">--</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                if (selectedGroup) {
  const sq = selectedGroup.squads[0]
  const members = [...sq.strikers, ...sq.specials]

  applyMembers(members)
  setSkills([])
  setMarkers([])
  addNormalSkills(members)

  setSquadIndex(0)
} else {
  const empty = Array(6).fill('')
  applyMembers(empty)
  setSkills([])
  setMarkers([])
}

setInitialized(true)
setShowCreateModal(false)

              }}
              className="border px-2 py-1 bg-blue-500 text-white rounded"
            >
              作成
            </button>
          </div>
        </div>
      )}

      {initialized && (
        <Fragment>
      <div className="sticky top-0 z-20 flex items-center gap-4 bg-gray-200 dark:bg-gray-700 p-2 text-sm">
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              closeMenus()
              setShowFileMenu(!showFileMenu)
            }}
            className="px-1"
          >
            ファイル
          </button>
          {showFileMenu && (
            <div
              className="absolute left-0 mt-1 border bg-white rounded shadow z-10 text-sm w-32"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(true)
                  closeMenus()
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                TLを作成
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSaveModal(true)
                  closeMenus()
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                TLを保存
              </button>
              <label className="block w-full text-left px-2 py-1 hover:bg-gray-200 cursor-pointer">
                TLを読み込み
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      file.text().then((txt) => {
                        try {
                          const data = JSON.parse(txt)
                          setProjectName(data.projectName || '')
                          setSkills(data.skills || [])
                          setMarkers(data.markers || [])
                          applyMembers(data.rowStudents || [])
                          const g = groups.find((gr) => gr.id === data.groupId) || null
                          setSelectedGroup(g)
                          setSquadIndex(data.squadIndex || 0)
                          setInitialized(true)
                        } catch {
                          /* ignore */
                        }
                      })
                    }
                    e.target.value = ''
                    closeMenus()
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  closeMenus()
                  setShowSettings(true)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                設定
              </button>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              closeMenus()
              setShowMenu(!showMenu)
            }}
            className="px-1"
          >
            追加
          </button>
          {showMenu && (
            <div
              className="absolute left-0 mt-1 border bg-white rounded shadow z-10 text-sm w-32"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedType('skill')
                  setSkillKind('ex')
                  setRow(0)
                  const st = students.find((s) => s.id === rowStudents[0])
                  const dur = st?.exDuration ?? 1
                  const startTime = snapTime(playhead)
                  const travel = st?.exHitDelay || 0
                  const stats = st ? getStats(st.id) : undefined
                  setApplyTravel(false)
                  setStart(startTime)
                  setEnd(snapTime(startTime + dur))
                  setSkillCost(st?.cost ?? 0)
                  setSkillCostTouched(false)
                  setShowCostDetails(false)
                  setCostRecoveryEnabled(false)
                  setCostRecoveryAmount(0)
                  setCostRecoveryDuration(0)
                  setCostRecoveryTrigger(snapTime(startTime + travel))
                  setCostRecoveryTriggerTouched(false)
                  setCostRecoveryApplyBonus(Number(stats?.unique_star ?? 0) >= 2)
                  setCostRecoveryApplyBonusTouched(false)
                  setShowForm(true)
                  setShowMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                スキル追加
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedType('event')
                  setStart(snapTime(playhead))
                  setShowForm(true)
                  setShowMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                イベント追加
              </button>
              <button
                type="button"
                onClick={() => {
                  addRow()
                  setShowMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                行追加
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEnemyModal(true)
                  setShowMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                敵行追加
              </button>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              closeMenus()
              setShowEditMenu(!showEditMenu)
            }}
            className="px-1"
          >
            編集
          </button>
          {showEditMenu && (
            <div
              className="absolute left-0 mt-1 border bg-white rounded shadow z-10 text-sm w-32"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  if (selected.length) {
                    const cutSkills = skills.filter((s) =>
                      selected.some((sel) => sel.type === 'skill' && sel.id === s.id)
                    )
                    const cutMarkers = markers.filter((m) =>
                      selected.some((sel) => sel.type === 'marker' && sel.id === m.id)
                    )
                    if (cutSkills.length || cutMarkers.length) {
                      setCopied({
                        skills: cutSkills.map((s) => ({ ...s })),
                        markers: cutMarkers.map((m) => ({ ...m })),
                      })
                      setSkills((prev) => prev.filter((s) => !cutSkills.some((c) => c.id === s.id)))
                      setMarkers((prev) => prev.filter((m) => !cutMarkers.some((c) => c.id === m.id)))
                      setSelected([])
                    }
                  }
                  setShowEditMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                カット
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selected.length) {
                    const cpSkills = skills.filter((s) =>
                      selected.some((sel) => sel.type === 'skill' && sel.id === s.id)
                    )
                    const cpMarkers = markers.filter((m) =>
                      selected.some((sel) => sel.type === 'marker' && sel.id === m.id)
                    )
                    if (cpSkills.length || cpMarkers.length) {
                      setCopied({
                        skills: cpSkills.map((s) => ({ ...s })),
                        markers: cpMarkers.map((m) => ({ ...m })),
                      })
                    }
                  }
                  setShowEditMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                コピー
              </button>
              <button
                type="button"
                onClick={() => {
                  if (copied) {
                    const base = snapTime(playhead)
                    copied.skills.forEach((ev, idx) => {
                      const id = Date.now() + idx
                      const duration = ev.end - ev.start
                      const travel = ev.travel || 0
                      const motion = ev.motion
                      setSkills((prev) => [
                        ...prev,
                        {
                          ...ev,
                          id,
                          start: base,
                          end: snapTime(base + duration),
                          travel,
                          motion,
                          type: ev.type,
                        },
                      ])
                    })
                    copied.markers.forEach((mk, idx) => {
                      const id = Date.now() + copied.skills.length + idx
                      setMarkers((prev) => [
                        ...prev,
                        { ...mk, id, time: base },
                      ])
                    })
                  }
                  setShowEditMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                ペースト
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selected.length) {
                    setSkills((prev) =>
                      prev.filter((s) => !selected.some((sel) => sel.type === 'skill' && sel.id === s.id))
                    )
                    setMarkers((prev) =>
                      prev.filter((m) => !selected.some((sel) => sel.type === 'marker' && sel.id === m.id))
                    )
                    setSelected([])
                  }
                  setShowEditMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                削除
              </button>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              closeMenus()
              setShowTools(!showTools)
            }}
            className="px-3 w-20"
          >
            ツール
          </button>
          {showTools && (
            <div
              className="absolute left-0 mt-1 border bg-white rounded shadow z-10 text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowSquadMenu(!showSquadMenu)}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                部隊の変更
              </button>
              <button
                type="button"
                onClick={() => setShowGroupMenu(!showGroupMenu)}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                グループの変更
              </button>
              <Link
                href="/squads"
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
                onClick={() => closeMenus()}
              >
                部隊の編集
              </Link>
              <label className="flex items-center gap-1 px-2 py-1 hover:bg-gray-200">
                <input
                  type="checkbox"
                  checked={showDamageCalc}
                  onChange={(e) => setShowDamageCalc(e.target.checked)}
                />
                <span>ダメージ計算</span>
              </label>
              <label className="flex items-center gap-1 px-2 py-1 hover:bg-gray-200">
                <input
                  type="checkbox"
                  checked={showTextTL}
                  onChange={(e) => setShowTextTL(e.target.checked)}
                />
                <span>TLをテキスト表示</span>
              </label>
            </div>
          )}
          {showSquadMenu && selectedGroup && selectedGroup.squads.length > 1 && (
            <div
              className="absolute left-0 mt-1 border bg-white rounded shadow z-20 text-sm px-2 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-1">
                {selectedGroup.squads.map((sq, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      switchSquad(idx)
                      setShowSquadMenu(false)
                      setShowTools(false)
                    }}
                    className="px-2 py-1 hover:bg-gray-200 whitespace-nowrap"
                  >
                    {selectedGroup.name} #{idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
          {showGroupMenu && groups.length > 0 && (
            <div
              className="absolute left-0 mt-1 border bg-white rounded shadow z-20 text-sm px-2 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-1">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onMouseDown={() => {
                      setSelectedGroup(g)
                      switchSquad(0)
                      setShowGroupMenu(false)
                      setShowTools(false)
                    }}
                    className="px-2 py-1 hover:bg-gray-200 whitespace-nowrap"
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button type="button" className="px-1">再生</button>
        <button
          type="button"
          onClick={undo}
          className="border rounded p-1 ml-2"
          aria-label="元に戻す"
        >
          <FontAwesomeIcon icon={faUndo} />
        </button>
        <button
          type="button"
          onClick={redo}
          className="border rounded p-1 ml-1"
          aria-label="やり直す"
        >
          <FontAwesomeIcon icon={faRedo} />
        </button>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="border rounded p-1 ml-2"
          aria-label="部隊インポート"
        >
          <FontAwesomeIcon icon={faFileImport} />
        </button>
        <span className="ml-4 font-mono text-black">
          {formatRemain(totalSeconds - playhead)} ({currentCost.toFixed(2)})
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm">拡大</span>
          <input
            type="range"
            min="10"
            max="250"
            step="5"
            value={timeScale}
            onChange={(e) => {
              const newScale = parseInt(e.target.value)
              if (containerRef.current) {
                const { scrollLeft, clientWidth } = containerRef.current
                const pivot = zoomByPlayhead
                  ? playhead * timeScale - scrollLeft
                  : clientWidth / 2
                const centerTime =
                  zoomByPlayhead
                    ? playhead
                    : (scrollLeft + clientWidth / 2) / timeScale
                setTimeScale(newScale)
                requestAnimationFrame(() => {
                  if (containerRef.current) {
                    if (zoomByPlayhead) {
                      containerRef.current.scrollLeft = playhead * newScale - pivot
                    } else {
                      containerRef.current.scrollLeft = centerTime * newScale - clientWidth / 2
                    }
                  }
                })
              } else {
                setTimeScale(newScale)
              }
            }}
          />
          <span className="text-sm">{timeScale}px/s</span>
          <button
            type="button"
            onClick={() => setZoomByPlayhead(!zoomByPlayhead)}
            className="border rounded px-1"
          >
            <FontAwesomeIcon icon={faCrosshairs} className="mr-1" />
            {zoomByPlayhead ? '操作線' : '画面中心'}
          </button>
        </div>
      </div>
      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowForm(false)}
        >
          <div
            className="space-y-2 border p-4 rounded bg-white select-text relative w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="absolute top-1 right-1"
              aria-label="閉じる"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          {selectedType && (
            <div className="text-sm font-bold">{selectedType === 'skill' ? 'スキル' : 'イベント'}</div>
          )}
          {selectedType === 'skill' && (
            <>
              <label className="flex items-center gap-2">
                <span>生徒:</span>
                <select
                  value={row}
                  onChange={(e) => setRow(parseInt(e.target.value))}
                  className="border rounded p-1 w-24"
                >
                  {rowStudents.map((id, idx) => {
                    const st = students.find((s) => s.id === id)
                    return (
                      <option key={idx} value={idx}>
                        {st ? st.name : `行${idx + 1}`}
                      </option>
                    )
                  })}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span>種類:</span>
                <select
                  value={skillKind}
                  onChange={(e) => setSkillKind(e.target.value as 'ex' | 'normal')}
                  className="border rounded p-1 w-24"
                >
                  <option value="ex">EX</option>
                  <option value="normal">NS</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span>コスト:</span>
                <input
                  type="number"
                  value={skillCost}
                  onChange={(e) => {
                    setSkillCostTouched(true)
                    setSkillCost(parseFloat(e.target.value) || 0)
                  }}
                  className="border rounded p-1 w-24"
                />
              </label>
              <label className="flex items-center gap-2">
                <span>開始:</span>
                <input
                  type="number"
                  value={start}
                  onChange={(e) => setStart(parseFloat(e.target.value))}
                  className="border rounded p-1 w-24"
                />
              </label>
              <label className="flex items-center gap-2">
                <span>終了:</span>
                <input
                  type="number"
                  value={end}
                  onChange={(e) => setEnd(parseFloat(e.target.value))}
                  className="border rounded p-1 w-24"
                />
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={applyTravel}
                  onChange={(e) => setApplyTravel(e.target.checked)}
                />
                <span>着弾時間を考慮</span>
              </label>
              {skillKind === 'ex' && (
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={waitCost}
                    onChange={(e) => setWaitCost(e.target.checked)}
                  />
                  <span>コストが貯まったら</span>
                </label>
              )}
              <button
                type="button"
                className="text-xs text-blue-600 underline"
                onClick={() => setShowCostDetails((prev) => !prev)}
              >
                詳細設定{showCostDetails ? '（閉じる）' : '（開く）'}
              </button>
              {showCostDetails && (
                <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-2 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={costRecoveryEnabled}
                      onChange={(e) => setCostRecoveryEnabled(e.target.checked)}
                    />
                    <span>コスト回復力増加</span>
                  </label>
                  {costRecoveryEnabled && (
                    <>
                      <label className="flex items-center gap-2">
                        <span className="w-24">増加量(実数)</span>
                        <input
                          type="number"
                          value={costRecoveryAmount}
                          onChange={(e) => setCostRecoveryAmount(parseFloat(e.target.value) || 0)}
                          className="border rounded p-1 w-24"
                        />
                        <span className="text-[10px] text-gray-500">基礎値(700×6)に加算</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <span className="w-24">効果時間</span>
                        <input
                          type="number"
                          value={costRecoveryDuration}
                          onChange={(e) => setCostRecoveryDuration(parseFloat(e.target.value) || 0)}
                          className="border rounded p-1 w-24"
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span className="w-24">発動タイミング</span>
                        <input
                          type="number"
                          value={costRecoveryTrigger}
                          onChange={(e) => {
                            setCostRecoveryTriggerTouched(true)
                            setCostRecoveryTrigger(parseFloat(e.target.value) || 0)
                          }}
                          className="border rounded p-1 w-24"
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={costRecoveryApplyBonus}
                          onChange={(e) => {
                            setCostRecoveryApplyBonusTouched(true)
                            setCostRecoveryApplyBonus(e.target.checked)
                          }}
                        />
                        <span>バフ効果持続力を反映(×1.19)</span>
                      </label>
                    </>
                  )}
                </div>
              )}
            </>
          )}
          {selectedType === 'event' && (
            <>
              <label className="flex items-center gap-2">
                <span>テンプレ:</span>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="border rounded p-1 flex-1"
                >
                  <option value="">--</option>
                  {eventTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span>時間:</span>
                <input
                  type="number"
                  value={start}
                  onChange={(e) => setStart(parseFloat(e.target.value))}
                  className="border rounded p-1 w-24"
                />
              </label>
            </>
          )}
          <label className="flex items-center gap-2">
            <span>ラベル:</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="border rounded p-1 flex-1"
            />
          </label>
          <button onClick={addEvent} className="border px-2 py-1 bg-blue-500 text-white rounded">
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>
        </div>
      )}

      {showImport && squads.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowImport(false)}
        >
          <div
            className="border rounded p-2 space-y-1 bg-white relative w-60"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowImport(false)}
              className="absolute top-1 right-1"
              aria-label="閉じる"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
            {squads.map((sq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => importSquad(sq.members)}
                className="border rounded w-full text-left p-1"
              >
                {sq.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showSettings && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="border rounded p-4 bg-white space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="absolute top-1 right-1"
              aria-label="閉じる"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <div className="text-sm font-bold">デフォルトスキルレベル</div>
            <label className="flex items-center gap-2">
              <span>EX:</span>
              <input
                type="number"
                min="1"
                max="10"
                value={defaultLevels.ex}
                onChange={(e) =>
                  setDefaultLevels({ ...defaultLevels, ex: parseInt(e.target.value) || 1 })
                }
                className="border rounded p-1 w-16"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>NS:</span>
              <input
                type="number"
                min="1"
                max="10"
                value={defaultLevels.normal}
                onChange={(e) =>
                  setDefaultLevels({ ...defaultLevels, normal: parseInt(e.target.value) || 1 })
                }
                className="border rounded p-1 w-16"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>PS:</span>
              <input
                type="number"
                min="1"
                max="10"
                value={defaultLevels.passive}
                onChange={(e) =>
                  setDefaultLevels({ ...defaultLevels, passive: parseInt(e.target.value) || 1 })
                }
                className="border rounded p-1 w-16"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>SS:</span>
              <input
                type="number"
                min="1"
                max="10"
                value={defaultLevels.sub}
                onChange={(e) =>
                  setDefaultLevels({ ...defaultLevels, sub: parseInt(e.target.value) || 1 })
                }
                className="border rounded p-1 w-16"
              />
            </label>
            <div className="text-sm font-bold mt-2">TL長さ</div>
            <select
              value={totalSeconds}
              onChange={(e) => setTotalSeconds(parseInt(e.target.value))}
              className="border rounded p-1"
            >
              <option value={180}>3:00</option>
              <option value={240}>4:00</option>
              <option value={270}>4:30</option>
            </select>
            <div className="text-sm font-bold mt-2">オブジェクト色</div>
            <table className="text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left"></th>
                  <th className="px-1">着弾まで</th>
                  <th className="px-1">モーション終了まで</th>
                  <th className="px-1">スキル終了まで</th>
                </tr>
              </thead>
              <tbody>
                {(['ex', 'normal'] as const).map((t) => (
                  <tr key={t}>
                    <th className="text-left px-1">{t === 'ex' ? 'EX' : 'NS'}</th>
                    {(['travel', 'motion', 'rest'] as const).map((p) => (
                      <td key={p} className="px-1 space-x-1">
                        <input
                          type="color"
                          value={skillColors[t][p].color}
                          onChange={(e) =>
                            setSkillColors({
                              ...skillColors,
                              [t]: {
                                ...skillColors[t],
                                [p]: {
                                  ...skillColors[t][p],
                                  color: e.target.value,
                                },
                              },
                            })
                          }
                        />
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          value={skillColors[t][p].alpha}
                          onChange={(e) =>
                            setSkillColors({
                              ...skillColors,
                              [t]: {
                                ...skillColors[t],
                                [p]: {
                                  ...skillColors[t][p],
                                  alpha: parseFloat(e.target.value) || 0,
                                },
                              },
                            })
                          }
                          className="w-16 border rounded p-1"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rowStudents.some((id) => id.startsWith('enemy:')) && (
              <>
                <div className="text-sm font-bold mt-2">デフォルトターゲット</div>
                <label className="flex items-center gap-2">
                  <span>攻撃:</span>
                  <select
                    value={defaultTargets.attack}
                    onChange={(e) =>
                      setDefaultTargets({ ...defaultTargets, attack: parseInt(e.target.value) })
                    }
                    className="border rounded p-1 w-24"
                  >
                    {rowStudents.map((id, idx) => {
                      if (!id.startsWith('enemy:')) return null
                      const en = enemies.find((e) => `enemy:${e.id}` === id)
                      return (
                        <option key={idx} value={idx}>
                          {en ? en.name : `敵${idx + 1}`}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span>デバフ:</span>
                  <select
                    value={defaultTargets.debuff}
                    onChange={(e) =>
                      setDefaultTargets({ ...defaultTargets, debuff: parseInt(e.target.value) })
                    }
                    className="border rounded p-1 w-24"
                  >
                    {rowStudents.map((id, idx) => {
                      if (!id.startsWith('enemy:')) return null
                      const en = enemies.find((e) => `enemy:${e.id}` === id)
                      return (
                        <option key={idx} value={idx}>
                          {en ? en.name : `敵${idx + 1}`}
                        </option>
                      )
                    })}
                  </select>
                </label>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="border px-2 py-1 bg-blue-500 text-white rounded"
            >
              OK
            </button>
          </div>
        </div>
      )}


      <div className="flex">
        {showTextTL && (
          <div className="mr-2 flex flex-col gap-1">
            <textarea
              className="text-xs font-mono flex-shrink-0 border rounded p-1"
              rows={rows}
              value={textTL}
              onChange={(e) => setTextTL(e.target.value)}
            />
          </div>
        )}
        <div className="flex gap-0 max-h-96 overflow-y-hidden touch-pan-x overscroll-none select-none">
          <div className="flex flex-col">
            <div className="h-5" />
          {rowStudents.map((id, i) => {
            const st = students.find((s) => s.id === rowStudents[i])
if (!st) return
            const enemy = enemies.find((e) => `enemy:${e.id}` === id)
            const handleContext = (e: React.MouseEvent) => {
              e.preventDefault()
              setMenuInfo({ index: i, x: e.clientX, y: e.clientY })
            }
            let touchTimer: NodeJS.Timeout | null = null
            const handleTouchStart = (e: React.TouchEvent) => {
              touchTimer = setTimeout(() => {
                const t = e.touches[0]
                setMenuInfo({ index: i, x: t.clientX, y: t.clientY })
              }, 600)
            }
            const clearTouch = () => {
              if (touchTimer) clearTimeout(touchTimer)
            }
            return (
              <div
                key={i}
                onContextMenu={handleContext}
                onClick={(e) => {
                  e.stopPropagation()
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                  const buffs = getActiveBuffs(i, playhead)
                  const stats = st ? getStats(st.id) : undefined
                  const star = stats?.star ?? st?.initialStars
                  const unique = stats?.unique_star ?? 0
                  const info = st
  ? [
      st.name,
      `★${star}${unique ? `+${unique}` : ''}`,
      st.role,
    ]
  : enemy
  ? [enemy.name]
  : [`行${i + 1}`]
setBuffPopup({
  row: i,
  x: rect.right,
  y: rect.top,
  buffs,
  info,
  studentId: st.id,

  // ★ ここでは分岐しない
  values: st.skills?.sub?.values,
})
                }}
                onTouchStart={handleTouchStart}
                onTouchEnd={clearTouch}
                onTouchCancel={clearTouch}
                className="border border-gray-500 overflow-hidden"
                style={{ width: rowHeight, height: rowHeight }}
              >
                {st ? (
                  <img src={st.image} alt={st.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs">
                    {enemy ? enemy.name : ''}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div
          ref={containerRef}
          className="w-full"
          style={{
            overflowX: dragging || movingSkill ? 'hidden' : 'auto',
            touchAction: dragging || movingSkill ? 'none' : 'pan-x',
          }}
          onWheel={(e) => {
            if (dragging || movingSkill) e.preventDefault()
          }}
        >
          <div className="relative" style={{ width: totalSeconds * timeScale }}>
            <div className="flex text-xs h-5 relative">
              {Array.from({ length: totalSeconds / tickStep }, (_, idx) => {
                const t = +(idx * tickStep).toFixed(1)
                const ratio = t / labelStep
                const showLabel = Math.abs(ratio - Math.round(ratio)) < 1e-6
                const borderClass =
                  tickStep === 0.1 && idx % 5 !== 0
                    ? 'border-dotted border-gray-400'
                    : 'border-gray-500'
                return (
                  <div
                    key={idx}
                    className={`border-l ${borderClass}`}
                    style={{ width: timeScale * tickStep }}
                  >
                    {showLabel ? t : ''}
                  </div>
                )
              })}
              <div
                className="border-l border-gray-500"
                style={{ width: 0 }}
              >
                {totalSeconds}
              </div>
              {/* remaining time moved to toolbar */}
            </div>
            <div
              className="relative border bg-gray-900"
              style={{
                width: '100%',
                height: rows * rowHeight,
                backgroundImage:
                  `repeating-linear-gradient(to right, #555 0, #555 1px, transparent 1px, transparent ${timeScale}px)` +
                  (timeScale >= 40
                    ? `, repeating-linear-gradient(to right, rgba(85,85,85,0.5) 0, rgba(85,85,85,0.5) 1px, transparent 1px, transparent ${timeScale / 2}px)`
                    : '') +
                  (timeScale >= 180
                    ? `, repeating-linear-gradient(to right, transparent 0, transparent ${timeScale / 10}px, rgba(85,85,85,0.3) ${timeScale / 10}px, rgba(85,85,85,0.3) ${timeScale / 10 + 1}px)`
                    : '') +
                  `, repeating-linear-gradient(to bottom, #555 0, #555 1px, transparent 1px, transparent ${rowHeight}px)`,
              }}
              onMouseMove={(e) => {
                if (dragging) {
                  if (playheadTimer.current) {
                    clearTimeout(playheadTimer.current)
                    playheadTimer.current = null
                  }
                  setPlayhead(getTimeFromClientX(e.clientX))
                  if (containerRef.current) containerRef.current.scrollLeft = scrollLock.current
                } else if (movingSkill) {
                  if (containerRef.current) containerRef.current.scrollLeft = scrollLock.current
                }
              }}
              onMouseUp={() => {
                if (playheadTimer.current) {
                  clearTimeout(playheadTimer.current)
                  playheadTimer.current = null
                }
                setDragging(false)
              }}
              onMouseLeave={() => {
                if (playheadTimer.current) {
                  clearTimeout(playheadTimer.current)
                  playheadTimer.current = null
                }
                setDragging(false)
              }}
              onTouchMove={(e) => {
                if (dragging) {
                  if (playheadTimer.current) {
                    clearTimeout(playheadTimer.current)
                    playheadTimer.current = null
                  }
                  setPlayhead(getTimeFromClientX(e.touches[0].clientX))
                  if (containerRef.current) containerRef.current.scrollLeft = scrollLock.current
                } else if (movingSkill) {
                  if (containerRef.current) containerRef.current.scrollLeft = scrollLock.current
                }
              }}
              onTouchEnd={() => {
                if (playheadTimer.current) {
                  clearTimeout(playheadTimer.current)
                  playheadTimer.current = null
                }
                setDragging(false)
              }}
              onTouchCancel={() => {
                if (playheadTimer.current) {
                  clearTimeout(playheadTimer.current)
                  playheadTimer.current = null
                }
                setDragging(false)
              }}
            >
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                style={{ left: playhead * timeScale, zIndex: 15 }}
              >
                <div
                  className="absolute -left-2 top-0 bottom-0 w-4 cursor-ew-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    if (playheadTimer.current) {
                      clearTimeout(playheadTimer.current)
                      playheadTimer.current = null
                    }
                    setPlayheadMenu(null)
                    scrollLock.current = containerRef.current?.scrollLeft ?? 0
                    setDragging(true)
                    setPlayhead(getTimeFromClientX(e.clientX))
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (playheadTimer.current) {
                      clearTimeout(playheadTimer.current)
                      playheadTimer.current = null
                    }
                    setDragging(false)
                    setPlayheadMenu({ x: e.clientX, y: e.clientY })
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    const t = e.touches[0]
                    if (playheadTimer.current) {
                      clearTimeout(playheadTimer.current)
                      playheadTimer.current = null
                    }
                    setPlayheadMenu(null)
                    scrollLock.current = containerRef.current?.scrollLeft ?? 0
                    setDragging(true)
                    setPlayhead(getTimeFromClientX(t.clientX))
                    playheadTimer.current = setTimeout(() => {
                      setPlayheadMenu({ x: t.clientX, y: t.clientY })
                      setDragging(false)
                    }, 600)
                  }}
                  onTouchEnd={() => {
                    if (playheadTimer.current) {
                      clearTimeout(playheadTimer.current)
                      playheadTimer.current = null
                    }
                    setDragging(false)
                  }}
                  onTouchCancel={() => {
                    if (playheadTimer.current) {
                      clearTimeout(playheadTimer.current)
                      playheadTimer.current = null
                    }
                    setDragging(false)
                  }}
                />
              </div>
              {markers.map((m) => {
                let timer: NodeJS.Timeout | null = null
                const startTouch = (e: React.TouchEvent) => {
                  timer = setTimeout(() => {
                    const t = e.touches[0]
                    setSelected([{ type: 'marker', id: m.id }])
                    if (m.label) {
                      setMarkers((prev) =>
                        prev.map((mk) => ({ ...mk, show: mk.id === m.id }))
                      )
                    }
                    setEventMenu({ type: 'marker', id: m.id, x: t.clientX, y: t.clientY })
                  }, 600)
                }
                const clearTouch = () => {
                  if (timer) clearTimeout(timer)
                }
                return (
                  <div
                    key={m.id}
                    className={`absolute bg-yellow-400 cursor-pointer opacity-70 ${
                      selected.some((sel) => sel.type === 'marker' && sel.id === m.id)
                        ? 'ring-2 ring-red-500'
                        : ''
                    }`}
                    style={{
                      left: m.time * timeScale,
                      top: 0,
                      width: Math.max(m.duration * timeScale, 4),
                      height: rows * rowHeight,
                      touchAction: 'pan-x',
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (e.shiftKey) {
                        setSelected((prev) => {
                          const exists = prev.find((sel) => sel.type === 'marker' && sel.id === m.id)
                          if (exists) return prev.filter((sel) => !(sel.type === 'marker' && sel.id === m.id))
                          return [...prev, { type: 'marker', id: m.id }]
                        })
                      } else if (selected.length === 1 && selected[0].type === 'marker' && selected[0].id === m.id) {
                        setMarkers((prev) =>
                          prev.map((mk) => (mk.id === m.id ? { ...mk, show: !mk.show } : mk))
                        )
                      } else {
                        setSelected([{ type: 'marker', id: m.id }])
                        if (m.label) {
                          setMarkers((prev) =>
                            prev.map((mk) => ({ ...mk, show: mk.id === m.id }))
                          )
                        }
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setEventMenu({ type: 'marker', id: m.id, x: e.clientX, y: e.clientY })
                    }}
                    onTouchStart={startTouch}
                    onTouchEnd={clearTouch}
                    onTouchCancel={clearTouch}
                  >
                    {m.show && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-200 border px-1 rounded whitespace-nowrap text-xs">
                        {m.label}
                      </div>
                    )}
                  </div>
                )
              })}
              {skills.map((ev) => {
                let timer: NodeJS.Timeout | null = null
                let startX = 0
                let startY = 0
                let moved = false
                const startTouch = (e: React.TouchEvent) => {
                  startX = e.touches[0].clientX
                  startY = e.touches[0].clientY
                  moved = false
                  if (moveModeSkill === ev.id) {
                    scrollLock.current = containerRef.current?.scrollLeft ?? 0
                    setMovingSkill({ id: ev.id, offset: startX - ev.start * timeScale })
                  } else {
                    timer = setTimeout(() => {
                      if (!moved) {
                        setEventMenu({ type: 'skill', id: ev.id, x: startX, y: startY })
                      }
                    }, 600)
                  }
                }
                const moveTouch = (e: React.TouchEvent) => {
                  const clientX = e.touches[0].clientX
                  if (movingSkill && movingSkill.id === ev.id) {
                    const newStart = snapTime((clientX - movingSkill.offset) / timeScale)
                    const delta = newStart - ev.start
                    setSkills((prev) =>
                      prev.map((sk) =>
                        sk.id === ev.id ? { ...sk, start: newStart, end: sk.end + delta } : sk
                      )
                    )
                    if (containerRef.current) containerRef.current.scrollLeft = scrollLock.current
                  } else if (timer && Math.abs(clientX - startX) > 5) {
                    moved = true
                    clearTimeout(timer)
                    timer = null
                  }
                }
                const clearTouch = () => {
                  if (timer) {
                    clearTimeout(timer)
                    timer = null
                  }
                  if (movingSkill && movingSkill.id === ev.id) {
                    setMovingSkill(null)
                    setMoveModeSkill(null)
                    return
                  }
                  if (!moved) {
                    const rect = { right: startX, top: startY }
                    const st = students.find((s) => s.id === rowStudents[ev.row])
                    const stats = getStats(rowStudents[ev.row])
                    const level = getSkillLevel(ev.type as 'ex' | 'normal', stats)
                    const skill =
                      ev.type === 'normal'
                        ? st?.skills?.normal
                        : st?.skills?.ex
                    const text = formatSkillText(skill, level)
                    const targetId = getEffectiveTarget(ev)
                    const targetName = isTargetableSkill(ev)
                      ? (() => {
                          const id = rowStudents[targetId]
                          const st2 = students.find((s) => s.id === id)
                          const en = enemies.find((e) => `enemy:${e.id}` === id)
                          return st2 ? st2.name : en ? en.name : `行${targetId + 1}`
                        })()
                      : undefined
                    setSelected([{ type: 'skill', id: ev.id }])
                    if (ev.label) {
                      setSkills((prev) => prev.map((sk) => ({ ...sk, show: sk.id === ev.id })))
                    }
                    setSkillPopup({
                      id: ev.id,
                      x: rect.right,
                      y: rect.top,
                      text: text || '',
                      target: targetName,
                    })
                 }
               }
                return (
                  <div
                    key={ev.id}
                    className={`absolute text-white text-xs px-1 overflow-hidden z-10 ${
                      selected.some((sel) => sel.type === 'skill' && sel.id === ev.id)
                        ? 'ring-2 ring-red-500'
                        : ''
                    }`}
                    style={{
                      left: ev.start * timeScale,
                      top: ev.row * rowHeight,
                      width: (ev.end - ev.start) * timeScale,
                      height: rowHeight - 2,
                      touchAction: 'pan-x',
                    }}
                    onMouseDown={(e) => {
                      if (moveModeSkill === ev.id) {
                        scrollLock.current = containerRef.current?.scrollLeft ?? 0
                        setMovingSkill({ id: ev.id, offset: e.clientX - ev.start * timeScale })
                      }
                    }}
                    onMouseMove={(e) => {
                      if (movingSkill && movingSkill.id === ev.id) {
                        const newStart = snapTime((e.clientX - movingSkill.offset) / timeScale)
                        const delta = newStart - ev.start
                        setSkills((prev) =>
                          prev.map((sk) =>
                            sk.id === ev.id ? { ...sk, start: newStart, end: sk.end + delta } : sk
                          )
                        )
                        if (containerRef.current) containerRef.current.scrollLeft = scrollLock.current
                      }
                    }}
                    onMouseUp={() => {
                      if (movingSkill && movingSkill.id === ev.id) {
                        setMovingSkill(null)
                        setMoveModeSkill(null)
                      }
                    }}
                    onMouseLeave={() => {
                      if (movingSkill && movingSkill.id === ev.id) {
                        setMovingSkill(null)
                        setMoveModeSkill(null)
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setEventMenu({ type: 'skill', id: ev.id, x: e.clientX, y: e.clientY })
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      const rect = (
                        e.currentTarget as HTMLDivElement
                      ).getBoundingClientRect()
                      const st = students.find((s) => s.id === rowStudents[ev.row])
                      const stats = getStats(rowStudents[ev.row])
                      const level = getSkillLevel(ev.type as 'ex' | 'normal', stats)
                      const skill =
                        ev.type === 'normal'
                          ? st?.skills?.normal
                          : st?.skills?.ex
                      const text = formatSkillText(skill, level)
                      const targetId = getEffectiveTarget(ev)
                      const targetName = isTargetableSkill(ev)
                        ? (() => {
                            const id = rowStudents[targetId]
                            const st2 = students.find((s) => s.id === id)
                            const en = enemies.find((e) => `enemy:${e.id}` === id)
                            return st2 ? st2.name : en ? en.name : `行${targetId + 1}`
                          })()
                        : undefined
                      if (selected.some((sel) => sel.type === 'skill' && sel.id === ev.id)) {
                        const newShow = !ev.show
                        setSkills((prev) =>
                          prev.map((sk) =>
                            sk.id === ev.id ? { ...sk, show: newShow } : sk
                          )
                        )
                        if (newShow) {
                          setSkillPopup({
                            id: ev.id,
                            x: rect.right,
                            y: rect.top,
                            text: text || '',
                            target: targetName,
                          })
                        } else if (skillPopup && skillPopup.id === ev.id) {
                          setSkillPopup(null)
                        }
                      } else if (e.shiftKey) {
                        setSelected((prev) => {
                          const exists = prev.find((sel) => sel.type === 'skill' && sel.id === ev.id)
                          if (exists) return prev.filter((sel) => !(sel.type === 'skill' && sel.id === ev.id))
                          return [...prev, { type: 'skill', id: ev.id }]
                        })
                      } else {
                        setSelected([{ type: 'skill', id: ev.id }])
                        if (ev.label) {
                          setSkills((prev) =>
                            prev.map((sk) => ({ ...sk, show: sk.id === ev.id }))
                          )
                        }
                        setSkillPopup({
                          id: ev.id,
                          x: rect.right,
                          y: rect.top,
                          text: text || '',
                          target: targetName,
                        })
                      }
                    }}
                    onTouchStart={startTouch}
                    onTouchMove={moveTouch}
                    onTouchEnd={() => {
                      clearTouch()
                    }}
                    onTouchCancel={() => {
                      clearTouch()
                    }}
                  >
                    {(() => {
                      const colors =
                        ev.type === 'ex' ? skillColors.ex : skillColors.normal
                      const travelW = Math.min(ev.travel || 0, ev.end - ev.start)
                      const motionW = Math.min(
                        ev.motion || ev.end - ev.start - travelW,
                        ev.end - ev.start - travelW
                      )
                      const restW =
                        ev.end - ev.start - travelW - motionW
                      return (
                        <>
                          <div
                            className="absolute inset-y-0 left-0 z-0"
                            style={{
                              width: travelW * timeScale,
                              backgroundColor: toRgba(
                                colors.travel.color,
                                colors.travel.alpha,
                              ),
                            }}
                          />
                          <div
                            className="absolute inset-y-0 z-0"
                            style={{
                              left: travelW * timeScale,
                              width: motionW * timeScale,
                              backgroundColor: toRgba(
                                colors.motion.color,
                                colors.motion.alpha,
                              ),
                            }}
                          />
                          {restW > 0 && (
                            <div
                              className="absolute inset-y-0 z-0"
                              style={{
                                left: (travelW + motionW) * timeScale,
                                width: restW * timeScale,
                                backgroundColor: toRgba(
                                  colors.rest.color,
                                  colors.rest.alpha,
                                ),
                              }}
                            />
                          )}
                        </>
                      )
                    })()}
                    <span className="relative z-10 pointer-events-none">{ev.label}</span>
                    {dangerSkills.has(ev.id) && (
                      <span className="absolute -top-1 -right-1 text-red-600">
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                      </span>
                    )}
                    {ev.show && ev.label && (
                      <div
                        className={`absolute -top-6 left-1/2 -translate-x-1/2 ${
                          ev.type === 'ex' ? 'bg-blue-200' : 'bg-green-200'
                        } border px-1 rounded whitespace-nowrap text-xs text-black z-20`}
                      >
                        {ev.label}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      {costDetailItems.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            className="text-xs text-blue-600 underline text-left"
            onClick={() => setShowCostLines((prev) => !prev)}
          >
            {showCostLines ? 'コスト詳細を隠す' : 'コスト詳細を表示'}
          </button>
          {showCostLines && (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full border border-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-200 px-2 py-1 text-left">時間</th>
                    <th className="border border-gray-200 px-2 py-1 text-left">種類</th>
                    <th className="border border-gray-200 px-2 py-1 text-left">詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {costDetailItems.map((item, index) => (
                    <tr key={`${item.kind}-${item.time}-${index}`}>
                      <td className="border border-gray-200 px-2 py-1">
                        {formatRemain(item.time)}
                      </td>
                      <td className="border border-gray-200 px-2 py-1">{item.kind}</td>
                      <td className="border border-gray-200 px-2 py-1">
                        <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1">
                          {Object.entries(item.detail).map(([key, value]) => (
                            <Fragment key={key}>
                              <div className="text-gray-500">{key}</div>
                              <div className="break-all">{String(value)}</div>
                            </Fragment>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {menuInfo && (
        <div
          className="fixed bg-white border rounded shadow text-sm z-50"
          style={{ left: menuInfo.x, top: menuInfo.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              removeRow(menuInfo.index)
              setMenuInfo(null)
            }}
            className="block w-full text-left px-2 py-1 hover:bg-gray-200"
          >
            行削除
          </button>
        </div>
      )}
      {eventMenu && (
        <div
          className="fixed bg-white border rounded shadow text-sm z-50"
          style={{ left: eventMenu.x, top: eventMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {eventMenu.type === 'skill' && (() => {
            const ev = skills.find((s) => s.id === eventMenu.id)
            if (ev && isTargetableSkill(ev)) {
              return (
                <button
                  type="button"
                  onClick={() => {
                    setBuffMenu({ id: eventMenu.id, x: eventMenu.x, y: eventMenu.y })
                    setEventMenu(null)
                  }}
                  className="block w-full text-left px-2 py-1 hover:bg-gray-200"
                >
                  ターゲット設定
                </button>
              )
            }
            return null
          })()}
          <button
            type="button"
            onClick={() => {
              if (eventMenu.type === 'skill') {
                const ev = skills.find((s) => s.id === eventMenu.id)
                if (ev) {
                  setCopied({ skills: [{ ...ev }], markers: [] })
                  removeSkill(ev.id)
                }
              } else {
                const mk = markers.find((m) => m.id === eventMenu.id)
                if (mk) {
                  setCopied({ skills: [], markers: [{ ...mk }] })
                  removeMarker(mk.id)
                }
              }
              setEventMenu(null)
            }}
            className="block w-full text-left px-2 py-1 hover:bg-gray-200"
          >
            カット
          </button>
          <button
            type="button"
            onClick={() => {
              if (eventMenu.type === 'skill') {
                const ev = skills.find((s) => s.id === eventMenu.id)
                if (ev) setCopied({ skills: [{ ...ev }], markers: [] })
              } else {
                const mk = markers.find((m) => m.id === eventMenu.id)
                if (mk) setCopied({ skills: [], markers: [{ ...mk }] })
              }
              setEventMenu(null)
            }}
            className="block w-full text-left px-2 py-1 hover:bg-gray-200"
          >
            コピー
          </button>
          {eventMenu.type === 'skill' && (
            <button
              type="button"
              onClick={() => {
                setMoveModeSkill(eventMenu.id)
                setEventMenu(null)
              }}
              className="block w-full text-left px-2 py-1 hover:bg-gray-200"
            >
              移動モード
            </button>
          )}
          {copied && (
            <button
              type="button"
              onClick={() => {
                const base = snapTime(playhead)
                copied.skills.forEach((ev, idx) => {
                  const id = Date.now() + idx
                  const duration = ev.end - ev.start
                  const travel = ev.travel || 0
                  const motion = ev.motion
                  setSkills((prev) => [
                    ...prev,
                    {
                      ...ev,
                      id,
                      start: base,
                      end: snapTime(base + duration),
                      travel,
                      motion,
                      type: ev.type,
                    },
                  ])
                })
                copied.markers.forEach((mk, idx) => {
                  const id = Date.now() + copied.skills.length + idx
                  setMarkers((prev) => [
                    ...prev,
                    { ...mk, id, time: base },
                  ])
                })
                setEventMenu(null)
              }}
              className="block w-full text-left px-2 py-1 hover:bg-gray-200"
            >
              ペースト
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (eventMenu.type === 'skill') {
                removeSkill(eventMenu.id)
              } else {
                removeMarker(eventMenu.id)
              }
              setEventMenu(null)
            }}
            className="block w-full text-left px-2 py-1 hover:bg-gray-200"
          >
            削除
          </button>
        </div>
      )}
      {playheadMenu && (
        <div
          className="fixed bg-white border rounded shadow text-sm z-50"
          style={{ left: playheadMenu.x, top: playheadMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {copied && (
            <button
              type="button"
              onClick={() => {
                const base = snapTime(playhead)
                copied.skills.forEach((ev, idx) => {
                  const id = Date.now() + idx
                  const duration = ev.end - ev.start
                  const travel = ev.travel || 0
                  setSkills((prev) => [
                    ...prev,
                    {
                      ...ev,
                      id,
                      start: base,
                      end: snapTime(base + duration),
                      travel,
                      type: ev.type,
                    },
                  ])
                })
                copied.markers.forEach((mk, idx) => {
                  const id = Date.now() + copied.skills.length + idx
                  setMarkers((prev) => [
                    ...prev,
                    { ...mk, id, time: base },
                  ])
                })
                setPlayheadMenu(null)
              }}
              className="block w-full text-left px-2 py-1 hover:bg-gray-200"
            >
              ここにペースト
            </button>
          )}
          <button
            type="button"
            onClick={() => setPlayheadMenu(null)}
            className="block w-full text-left px-2 py-1 hover:bg-gray-200"
          >
          閉じる
        </button>
        </div>
      )}
      {buffMenu && (
        <div
          className="fixed bg-white border rounded shadow text-sm z-50"
          style={{ left: buffMenu.x, top: buffMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const sk = skills.find((s) => s.id === buffMenu.id)
            const t = sk ? getSkillType(sk) : undefined
            const enemiesOnly = t === 'attack' || t === 'debuff'
            return rowStudents.map((id, idx) => {
              if (enemiesOnly && !id.startsWith('enemy:')) return null
              const st = students.find((s) => s.id === id)
              const enemy = enemies.find((e) => `enemy:${e.id}` === id)
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSkills((prev) =>
                      prev.map((sk2) =>
                        sk2.id === buffMenu.id ? { ...sk2, target: idx } : sk2
                      )
                    )
                    setBuffMenu(null)
                  }}
                  className="block w-full text-left px-2 py-1 hover:bg-gray-200"
                >
                  {st ? st.name : enemy ? enemy.name : `行${idx + 1}`}
                </button>
              )
            })
          })()}
        </div>
      )}
      {buffPopup && (
        <div
          className="fixed bg-white border rounded shadow text-sm z-50 px-2 py-1"
          style={{ left: buffPopup.x, top: buffPopup.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b mb-1 pb-1">
            {buffPopup.info.map((inf, i) => (
              
              
    <div key={i}>
      {resolveBuffText(
        inf,
        buffPopup.studentId,
        buffPopup.values
      )}
    </div>
  ))}
          </div>
          {buffPopup.buffs.length ? (
            buffPopup.buffs.map((b, i) => <div key={i}>{b}</div>)
          ) : (
            <div>バフなし</div>
          )}
        </div>
      )}
      {skillPopup && (
        <div
          className="fixed bg-white border rounded shadow text-sm z-50 px-2 py-1"
          style={{ left: skillPopup.x, top: skillPopup.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="whitespace-pre-wrap mb-1">{skillPopup.text}</div>
          {skillPopup.target && <div>対象: {skillPopup.target}</div>}
        </div>
      )}
      </div>
      {showDamageCalc && selected.length === 1 && selected[0].type === 'skill' && (() => {
        const ev = skills.find((s) => s.id === selected[0].id)
        if (!ev || getSkillType(ev) !== 'attack') return null
        const attackerId = rowStudents[ev.row]
        if (attackerId.startsWith('enemy:')) return null
        const attacker = students.find((s) => s.id === attackerId)
        if (!attacker) return null
        const atkStats = getStats(attacker.id)
        if (!atkStats) {
          return <div className="mt-2 text-sm">ステータスが設定されていません！</div>
        }
        const specialRows = rowStudents.filter((id) => {
          if (!id || id.startsWith('enemy:')) return false
          const st = students.find((s) => s.id === id)
          return st?.role === 'SPECIAL'
        })
        const specials: number[] = []
        let missing = false
        specialRows.forEach((id) => {
          const st = students.find((s) => s.id === id)
          const base = st?.styleOf || st?.altOf || st?.id
          const stat = base ? getStats(st.id) : undefined
          if (!stat || stat.attack === undefined) missing = true
          else specials.push(Number(stat.attack))
        })
        if (missing) {
          return <div className="mt-2 text-sm">ステータスが設定されていません！</div>
        }

        const rawAtk = Number(atkStats.attack ?? 0)
        let specialSum = specials.reduce((a, b) => a + b, 0)
        let plusAdd = 0
        let passiveBuff = 0
        let critBuffnum = 0
        let critBuff = 0
        let typeBuff = 0
        const passiveLevel = atkStats.passive_skill ?? defaultLevels.passive
        const atkBuffArr = attacker.skills?.passive?.values?.attack
        const critBuffArr = attacker.skills?.passive?.values?.critdamage
        const typeArr = attacker.skills?.passive?.values?.type
        const typeArr_sub = attacker.skills?.sub?.values?.type
        if (atkBuffArr) {
          const val = atkBuffArr[passiveLevel - 1]
          if (val !== undefined) passiveBuff = Number(val)
        }
        if (Number(atkStats.unique_star ?? 0) >= 2) {
          const plusArr = attacker.skills?.passivePlus?.values?.attacknum
          if (plusArr) {
            const val = plusArr[passiveLevel - 1]
            if (val !== undefined) {
              plusAdd = Number(val)
              specialSum += plusAdd
            }
          }
        }
        if (critBuffArr) {
          const val = critBuffArr[passiveLevel - 1]
          if (val !== undefined) critBuff = Number(val)
        }
        if (Number(atkStats.unique_star ?? 0) >= 2) {
          const plusArr = attacker.skills?.passivePlus?.values?.critdamagenum
          if (plusArr) {
            const val = plusArr[passiveLevel - 1]
            if (val !== undefined) {
              critBuffnum = Number(val)
            }
          }
        }
        if (typeArr) {
          const val = typeArr[passiveLevel - 1]
          if (val !== undefined) typeBuff = Number(val)
        }
        if (typeArr_sub) {
          const val = typeArr_sub[passiveLevel - 1]
          if (val !== undefined) {
          typeBuff += Number(val)
          }
        }
        const t = ev.start + (ev.travel || 0)
        const equipPct = getEquipmentBonus(attacker, atkStats, 'percent')
        const equipFlat = getEquipmentBonus(attacker, atkStats, 'flat')
        const baseAtkBefore = rawAtk / ( 1 + equipPct.attackMul) + Math.floor(specialSum / 10) - equipFlat.attackAdd
        const attackBuff = getBuffBonus(ev.row, t, 'attack') // %の合計
        typeBuff += getBuffBonus(ev.row, t, 'type')
        const atkMul = (1+equipPct.attackMul) + passiveBuff / 100 + attackBuff / 100
        const battleAtk = (baseAtkBefore+equipFlat.attackAdd) * atkMul
        const skill = ev.type === 'ex' ? attacker.skills?.ex : attacker.skills?.normal
        const level = getSkillLevel(ev.type as 'ex' | 'normal', atkStats)
        const mult = Number(
          skill?.values?.damage?.[level - 1] ??
            skill?.values?.ex?.[level - 1] ??
            0
        )
        const targetIdx = getEffectiveTarget(ev)
        const targetRowId = rowStudents[targetIdx]
        const enemy = enemies.find((e) => `enemy:${e.id}` === targetRowId)
        const defense = Number(enemy?.stats?.defense ?? 0)
        const attackerLevel = Number(atkStats.level ?? 1)
        const enemyLevel = enemy?.level ?? attackerLevel
        const levelMul = (10000 - 200 * (attackerLevel - enemyLevel)) / 10000
        const baseTypeMul = armorBonus[attacker.attackType]?.[enemy?.armor || ''] ?? 1
        let typeMul = baseTypeMul === 2 ? baseTypeMul + typeBuff / 100 : baseTypeMul
        if (Number(atkStats.unique_star ?? 0) >= 4) {
          typeMul += 0.1
        }
        const exBuffMul = getExBuffMultiplier(ev.row, ev.start + (ev.travel || 0))
        const baseDmg =
          battleAtk *
          (mult / 100) *
          (10000 / (defense * 6 + 10000)) *
          levelMul *
          typeMul *
          exBuffMul
        const critResist = Number(enemy?.stats?.critResist ?? 0)
        const critMul = Math.max(10000, (20000 + equipFlat.critDamage + critBuffnum) * (1 + 1 * sumSpecialSub(rowStudents, 'crit') / 100 + equipPct.critDamage / 100 + critBuff / 100) - critResist) / 10000
        const dmg = baseDmg
        const crit = baseDmg * critMul
        const formula =
          `(((${rawAtk}/${equipPct.attackMul} + (${specialSum}${plusAdd ? `+${plusAdd}` : ''})/10) * (1+${equipPct.attackMul}+${passiveBuff}/100+${attackBuff}/100)) * (${mult}/100) * (10000/(${defense}*6+10000)) * ${levelMul.toFixed(2)} * ${typeMul.toFixed(3)} * ${exBuffMul.toFixed(3)})=${dmg}`
        const formula_crit = 
          `(((${rawAtk}/${equipPct.attackMul} + (${specialSum}${plusAdd ? `+${plusAdd}` : ''})/10) * (1+${equipPct.attackMul}+${passiveBuff}/100+${attackBuff}/100)) * (${mult}/100) * (10000/(${defense}*6+10000)) * ${levelMul.toFixed(2)} * ${typeMul.toFixed(3)} * ${exBuffMul.toFixed(3)} * ${critMul})=${crit}`

        const targetName = enemy
          ? enemy.name
          : students.find((s) => s.id === targetRowId)?.name ?? `行${targetIdx + 1}`

        return (
          <div className="mt-2 text-sm">
            <div>対象: {targetName}</div>
            <div>ダメージ: {dmg.toFixed(0)}</div>
            <div>会心ダメージ: {crit.toFixed(0)}</div>
            <div className="text-xs text-gray-600 break-all">計算式: {formula}</div>
            <div className="text-xs text-gray-600 break-all">計算式(会心): {formula_crit}</div>
          </div>
        )
      })()}
        </Fragment>
      )}
    </main>
  )
}
