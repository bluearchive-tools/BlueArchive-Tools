'use client'

import { useEffect, useState, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlus,
  faFileImport,
  faTimes,
  faCrosshairs,
} from '@fortawesome/free-solid-svg-icons'

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
}

interface SkillEvent {
  id: number
  row: number
  start: number
  end: number
  label: string
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

export default function TLMakerPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [rowStudents, setRowStudents] = useState<string[]>(['', '', '', '', '', ''])
  const [skills, setSkills] = useState<SkillEvent[]>([])
  const [markers, setMarkers] = useState<MarkerEvent[]>([])
  const [eventTemplates, setEventTemplates] = useState<EventTemplate[]>([])
  const [menuInfo, setMenuInfo] = useState<{ index: number; x: number; y: number } | null>(null)
  const [eventMenu, setEventMenu] = useState<{ type: 'skill' | 'marker'; id: number; x: number; y: number } | null>(null)
  const [row, setRow] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(1)
  const [label, setLabel] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [squads, setSquads] = useState<{ name: string; members: string[] }[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const [selectedType, setSelectedType] = useState<'skill' | 'event' | null>(null)
  const [timeScale, setTimeScale] = useState(20) // px per second
  const [zoomByPlayhead, setZoomByPlayhead] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const playheadTimer = useRef<NodeJS.Timeout | null>(null)
  const [playhead, setPlayhead] = useState(2)
  const [selected, setSelected] = useState<{ type: 'skill' | 'marker'; id: number } | null>(null)
  const [copied, setCopied] = useState<{ type: 'skill' | 'marker'; data: SkillEvent | MarkerEvent } | null>(null)
  const [showEditMenu, setShowEditMenu] = useState(false)
  const [dragging, setDragging] = useState(false)
  const scrollLock = useRef(0)
  const [playheadMenu, setPlayheadMenu] = useState<{ x: number; y: number } | null>(null)
  const [groups, setGroups] = useState<SquadGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<SquadGroup | null>(null)
  const [squadIndex, setSquadIndex] = useState(0)
  const [projectName, setProjectName] = useState('')
  const [showStartMenu, setShowStartMenu] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [hasCache, setHasCache] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [showTools, setShowTools] = useState(false)

  const hidePopups = () => {
    if (menuInfo) setMenuInfo(null)
    if (eventMenu) setEventMenu(null)
    setMarkers((prev) => prev.map((m) => (m.show ? { ...m, show: false } : m)))
    setSkills((prev) => prev.map((s) => (s.show ? { ...s, show: false } : s)))
    setShowEditMenu(false)
    setSelected(null)
    if (playheadMenu) setPlayheadMenu(null)
    setShowMenu(false)
    setShowTools(false)
  }

  const addRow = () => setRowStudents((prev) => [...prev, ''])

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
    applyMembers(members)
    setShowImport(false)
  }

  const switchSquad = (index: number) => {
    if (!selectedGroup) return
    const sq = selectedGroup.squads[index]
    if (!sq) return
    applyMembers([...sq.strikers, ...sq.specials])
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
    loadStudents()
    loadEvents()
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
    const saved = localStorage.getItem('tlMakerProject')
    if (saved) {
      try {
        const data = JSON.parse(saved) as {
          projectName: string
          groupId: string
          squadIndex: number
          rowStudents: string[]
          skills: SkillEvent[]
          markers: MarkerEvent[]
        }
        setProjectName(data.projectName)
        setSkills(data.skills || [])
        setMarkers(data.markers || [])
        applyMembers(data.rowStudents || [])
        const g = parsed.find((gr) => gr.id === data.groupId) || null
        setSelectedGroup(g)
        setSquadIndex(data.squadIndex || 0)
        setInitialized(true)
      } catch {
        setShowStartMenu(true)
      }
    } else {
      if (localStorage.getItem('tlMakerCache')) setHasCache(true)
      setShowStartMenu(true)
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
    if (!initialized) return
    const data = {
      projectName,
      groupId: selectedGroup?.id ?? '',
      squadIndex,
      rowStudents,
      skills,
      markers,
    }
    localStorage.setItem('tlMakerProject', JSON.stringify(data))
    localStorage.setItem('tlMakerCache', JSON.stringify(data))
  }, [initialized, projectName, selectedGroup, squadIndex, rowStudents, skills, markers])

  const addEvent = () => {
    const id = Date.now()
    if (selectedType === 'skill') {
      const s = snapTime(start)
      const e = snapTime(end)
      if (e <= s) return
      setSkills([...skills, { id, row, start: s, end: e, label }])
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
  const totalSeconds = 240

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

  const getTimeFromClientX = (x: number) => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const pos = x - rect.left + containerRef.current.scrollLeft
    const clamped = Math.max(0, Math.min(pos, totalSeconds * timeScale))
    const t = clamped / timeScale
    return snapTime(t)
  }

  return (
    <main className="p-4 space-y-4 select-none overflow-y-hidden" onClick={hidePopups}>
      {showStartMenu && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowStartMenu(false)}>
          <div className="bg-white border rounded p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="border px-4 py-1 rounded w-40" onClick={() => setShowCreateModal(true)}>
              TLを作成
            </button>
            <label className="border px-4 py-1 rounded w-40 text-center cursor-pointer">
              TLをインポート
              <input type="file" accept="application/json" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                file.text().then(txt => {
                  try {
                    const data = JSON.parse(txt)
                    setProjectName(data.projectName || '')
                    setSkills(data.skills || [])
                    setMarkers(data.markers || [])
                    applyMembers(data.rowStudents || [])
                    const g = groups.find(gr => gr.id === data.groupId) || null
                    setSelectedGroup(g)
                    setSquadIndex(data.squadIndex || 0)
                    setInitialized(true)
                    setShowStartMenu(false)
                  } catch {
                    /* ignore */
                  }
                })
              }} />
            </label>
            {hasCache && (
              <button type="button" className="border px-4 py-1 rounded w-40" onClick={() => {
                const raw = localStorage.getItem('tlMakerCache')
                if (!raw) return
                try {
                  const data = JSON.parse(raw)
                  setProjectName(data.projectName || '')
                  setSkills(data.skills || [])
                  setMarkers(data.markers || [])
                  applyMembers(data.rowStudents || [])
                  const g = groups.find(gr => gr.id === data.groupId) || null
                  setSelectedGroup(g)
                  setSquadIndex(data.squadIndex || 0)
                  setInitialized(true)
                  setShowStartMenu(false)
                } catch {
                  /* ignore */
                }
              }}>
                キャッシュから復元
              </button>
            )}
          </div>
        </div>
      )}
      {initialized && (
        <>
      <div className="sticky top-0 z-20 flex items-center gap-4 bg-gray-200 dark:bg-gray-700 p-2 text-sm">
        <button type="button" className="px-1">ファイル</button>
        <div className="relative">
          <button type="button" onClick={() => setShowMenu(!showMenu)} className="px-1">
            追加
          </button>
          {showMenu && (
            <div className="absolute left-0 mt-1 border bg-white rounded shadow z-10 text-sm w-32">
              <button
                type="button"
                onClick={() => {
                  setSelectedType('skill')
                  setStart(snapTime(playhead))
                  setEnd(snapTime(playhead + 1))
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
            </div>
          )}
        </div>
        <div className="relative">
          <button type="button" onClick={() => setShowEditMenu(!showEditMenu)} className="px-1">
            編集
          </button>
          {showEditMenu && (
            <div className="absolute left-0 mt-1 border bg-white rounded shadow z-10 text-sm w-32" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => {
                  if (selected) {
                    if (selected.type === 'skill') {
                      const ev = skills.find((s) => s.id === selected.id)
                      if (ev) {
                        setCopied({ type: 'skill', data: { ...ev } })
                        removeSkill(ev.id)
                        setSelected(null)
                      }
                    } else {
                      const mk = markers.find((m) => m.id === selected.id)
                      if (mk) {
                        setCopied({ type: 'marker', data: { ...mk } })
                        removeMarker(mk.id)
                        setSelected(null)
                      }
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
                  if (selected) {
                    if (selected.type === 'skill') {
                      const ev = skills.find((s) => s.id === selected.id)
                      if (ev) setCopied({ type: 'skill', data: { ...ev } })
                    } else {
                      const mk = markers.find((m) => m.id === selected.id)
                      if (mk) setCopied({ type: 'marker', data: { ...mk } })
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
                    const id = Date.now()
                    if (copied.type === 'skill') {
                      const ev = copied.data as SkillEvent
                      const duration = ev.end - ev.start
                      setSkills((prev) => [
                        ...prev,
                        {
                          ...ev,
                          id,
                          start: snapTime(playhead),
                          end: snapTime(playhead + duration),
                        },
                      ])
                    } else {
                      const mk = copied.data as MarkerEvent
                      setMarkers((prev) => [
                        ...prev,
                        { ...mk, id, time: snapTime(playhead) },
                      ])
                    }
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
                  if (selected) {
                    if (selected.type === 'skill') {
                      removeSkill(selected.id)
                    } else {
                      removeMarker(selected.id)
                    }
                    setSelected(null)
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
          <button type="button" onClick={() => setShowTools(!showTools)} className="px-1">ツール</button>
          {showTools && selectedGroup && selectedGroup.squads.length > 1 && (
            <div className="absolute left-0 mt-1 border bg-white rounded shadow z-10 text-sm w-40">
              {selectedGroup.squads.map((sq, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    switchSquad(idx)
                    setShowTools(false)
                  }}
                  className="block w-full text-left px-2 py-1 hover:bg-gray-200"
                >
                  {selectedGroup.name} #{idx + 1}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="px-1">再生</button>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="border rounded p-1 ml-2"
          aria-label="部隊インポート"
        >
          <FontAwesomeIcon icon={faFileImport} />
        </button>
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
                <span>行:</span>
                <input
                  type="number"
                  value={row}
                  onChange={(e) => setRow(parseInt(e.target.value))}
                  className="border rounded p-1 w-16"
                  min={0}
                  max={rows - 1}
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
                if (!selectedGroup) return
                switchSquad(0)
                setSquadIndex(0)
                setInitialized(true)
                setShowCreateModal(false)
                setShowStartMenu(false)
              }}
              className="border px-2 py-1 bg-blue-500 text-white rounded"
            >
              作成
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-0 max-h-96 overflow-y-hidden touch-pan-x overscroll-none select-none">
        <div className="flex flex-col">
          <div className="h-5" />
          {rowStudents.map((id, i) => {
            const st = students.find((s) => s.id === id)
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
                onTouchStart={handleTouchStart}
                onTouchEnd={clearTouch}
                onTouchCancel={clearTouch}
                className="border border-gray-500 overflow-hidden"
                style={{ width: rowHeight, height: rowHeight }}
              >
                {st && (
                  <img src={st.image} alt={st.name} className="w-full h-full object-cover" />
                )}
              </div>
            )
          })}
        </div>
        <div
          ref={containerRef}
          className="w-full"
          style={{
            overflowX: dragging ? 'hidden' : 'auto',
            touchAction: dragging ? 'none' : 'pan-x',
          }}
          onWheel={(e) => {
            if (dragging) e.preventDefault()
          }}
        >
          <div className="relative" style={{ width: totalSeconds * timeScale }}>
            <div className="flex text-xs h-5">
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
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30"
                style={{ left: playhead * timeScale }}
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
                    setSelected({ type: 'marker', id: m.id })
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
                      selected?.type === 'marker' && selected.id === m.id ? 'ring-2 ring-red-500' : ''
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
                      if (selected?.type === 'marker' && selected.id === m.id) {
                        setMarkers((prev) =>
                          prev.map((mk) => (mk.id === m.id ? { ...mk, show: !mk.show } : mk))
                        )
                      } else {
                        setSelected({ type: 'marker', id: m.id })
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
                const startTouch = (e: React.TouchEvent) => {
                  timer = setTimeout(() => {
                    const t = e.touches[0]
                    setSelected({ type: 'skill', id: ev.id })
                    if (ev.label) {
                      setSkills((prev) =>
                        prev.map((sk) => ({ ...sk, show: sk.id === ev.id }))
                      )
                    }
                    setEventMenu({ type: 'skill', id: ev.id, x: t.clientX, y: t.clientY })
                  }, 600)
                }
                const clearTouch = () => {
                  if (timer) clearTimeout(timer)
                }
                return (
                  <div
                    key={ev.id}
                    className={`absolute bg-blue-500 text-white text-xs px-1 overflow-hidden ${
                      selected?.type === 'skill' && selected.id === ev.id ? 'ring-2 ring-red-500' : ''
                    }`}
                    style={{
                      left: ev.start * timeScale,
                      top: ev.row * rowHeight,
                      width: (ev.end - ev.start) * timeScale,
                      height: rowHeight - 2,
                      touchAction: 'pan-x',
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setEventMenu({ type: 'skill', id: ev.id, x: e.clientX, y: e.clientY })
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (selected?.type === 'skill' && selected.id === ev.id) {
                        setSkills((prev) =>
                          prev.map((sk) =>
                            sk.id === ev.id ? { ...sk, show: !sk.show } : sk
                          )
                        )
                      } else {
                        setSelected({ type: 'skill', id: ev.id })
                        if (ev.label) {
                          setSkills((prev) =>
                            prev.map((sk) => ({ ...sk, show: sk.id === ev.id }))
                          )
                        }
                      }
                    }}
                    onTouchStart={startTouch}
                    onTouchEnd={clearTouch}
                    onTouchCancel={clearTouch}
                  >
                    {ev.label}
                    {ev.show && ev.label && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-200 border px-1 rounded whitespace-nowrap text-xs text-black">
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
          <button
            type="button"
            onClick={() => {
              if (eventMenu.type === 'skill') {
                const ev = skills.find((s) => s.id === eventMenu.id)
                if (ev) {
                  setCopied({ type: 'skill', data: { ...ev } })
                  removeSkill(ev.id)
                }
              } else {
                const mk = markers.find((m) => m.id === eventMenu.id)
                if (mk) {
                  setCopied({ type: 'marker', data: { ...mk } })
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
                if (ev) setCopied({ type: 'skill', data: { ...ev } })
              } else {
                const mk = markers.find((m) => m.id === eventMenu.id)
                if (mk) setCopied({ type: 'marker', data: { ...mk } })
              }
              setEventMenu(null)
            }}
            className="block w-full text-left px-2 py-1 hover:bg-gray-200"
          >
            コピー
          </button>
          {copied && (
            <button
              type="button"
              onClick={() => {
                const id = Date.now()
                if (copied.type === 'skill') {
                  const ev = copied.data as SkillEvent
                  const duration = ev.end - ev.start
                  setSkills((prev) => [
                    ...prev,
                    {
                      ...ev,
                      id,
                      start: snapTime(playhead),
                      end: snapTime(playhead + duration),
                    },
                  ])
                } else {
                  const mk = copied.data as MarkerEvent
                  setMarkers((prev) => [
                    ...prev,
                    { ...mk, id, time: snapTime(playhead) },
                  ])
                }
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
                const id = Date.now()
                if (copied.type === 'skill') {
                  const ev = copied.data as SkillEvent
                  const duration = ev.end - ev.start
                  setSkills((prev) => [
                    ...prev,
                    {
                      ...ev,
                      id,
                      start: snapTime(playhead),
                      end: snapTime(playhead + duration),
                    },
                  ])
                } else {
                  const mk = copied.data as MarkerEvent
                  setMarkers((prev) => [
                    ...prev,
                    { ...mk, id, time: snapTime(playhead) },
                  ])
                }
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
      </>
      )}
    </main>
  )
}
