'use client'

import { useEffect, useState, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faFileImport, faTimes } from '@fortawesome/free-solid-svg-icons'

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
  const containerRef = useRef<HTMLDivElement>(null)
  const playheadTimer = useRef<NodeJS.Timeout | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const [selected, setSelected] = useState<{ type: 'skill' | 'marker'; id: number } | null>(null)
  const [copied, setCopied] = useState<{ type: 'skill' | 'marker'; data: SkillEvent | MarkerEvent } | null>(null)
  const [showEditMenu, setShowEditMenu] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [playheadMenu, setPlayheadMenu] = useState<{ x: number; y: number } | null>(null)

  const hidePopups = () => {
    if (menuInfo) setMenuInfo(null)
    if (eventMenu) setEventMenu(null)
    setMarkers((prev) => prev.map((m) => (m.show ? { ...m, show: false } : m)))
    setShowEditMenu(false)
    setSelected(null)
    if (playheadMenu) setPlayheadMenu(null)
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

  const importSquad = (members: string[]) => {
    setRowStudents(members.concat(Array(Math.max(0, 6 - members.length)).fill('')))
    setShowImport(false)
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
    if (raw) {
      try {
        const groups: { id: string; name: string; squads: { strikers: string[]; specials: string[]; memo?: string }[] }[] = JSON.parse(raw)
        const list: { name: string; members: string[] }[] = []
        groups.forEach(g => {
          g.squads.forEach((sq, idx) => {
            list.push({ name: `${g.name} #${idx + 1}`, members: [...sq.strikers, ...sq.specials] })
          })
        })
        setSquads(list)
      } catch {
        /* ignore */
      }
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

  const addEvent = () => {
    const id = Date.now()
    if (selectedType === 'skill') {
      if (end <= start) return
      setSkills([...skills, { id, row, start, end, label }])
    } else if (selectedType === 'event') {
      const tpl = eventTemplates.find((t) => t.id === templateId)
      setMarkers([
        ...markers,
        {
          id,
          time: start,
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

  const getTimeFromClientX = (x: number) => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const pos = x - rect.left + containerRef.current.scrollLeft
    const clamped = Math.max(0, Math.min(pos, totalSeconds * timeScale))
    return clamped / timeScale
  }

  return (
    <main className="p-4 space-y-4 select-none overflow-y-hidden" onClick={hidePopups}>
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
                        { ...ev, id, start: playhead, end: playhead + duration },
                      ])
                    } else {
                      const mk = copied.data as MarkerEvent
                      setMarkers((prev) => [
                        ...prev,
                        { ...mk, id, time: playhead },
                      ])
                    }
                  }
                  setShowEditMenu(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-200"
              >
                ペースト
              </button>
            </div>
          )}
        </div>
        <button type="button" className="px-1">ツール</button>
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
            max="200"
            step="5"
            value={timeScale}
            onChange={(e) => {
              const newScale = parseInt(e.target.value)
              if (containerRef.current) {
                const { scrollLeft, clientWidth } = containerRef.current
                const center = (scrollLeft + clientWidth / 2) / timeScale
                setTimeScale(newScale)
                requestAnimationFrame(() => {
                  if (containerRef.current) {
                    containerRef.current.scrollLeft = center * newScale - clientWidth / 2
                  }
                })
              } else {
                setTimeScale(newScale)
              }
            }}
          />
          <span className="text-sm">{timeScale}px/s</span>
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
        <div ref={containerRef} className="overflow-x-auto w-full touch-pan-x">
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
                if (dragging) setPlayhead(getTimeFromClientX(e.clientX))
              }}
              onMouseUp={() => setDragging(false)}
              onMouseLeave={() => setDragging(false)}
              onTouchMove={(e) => {
                if (dragging) setPlayhead(getTimeFromClientX(e.touches[0].clientX))
              }}
              onTouchEnd={() => setDragging(false)}
              onTouchCancel={() => setDragging(false)}
            >
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                style={{ left: playhead * timeScale }}
              >
                <div
                  className="absolute -left-2 top-0 bottom-0 w-4 cursor-ew-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setDragging(true)
                    setPlayhead(getTimeFromClientX(e.clientX))
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setPlayheadMenu({ x: e.clientX, y: e.clientY })
                    setDragging(false)
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    const t = e.touches[0]
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
                      setSelected({ type: 'skill', id: ev.id })
                    }}
                    onTouchStart={startTouch}
                    onTouchEnd={clearTouch}
                    onTouchCancel={clearTouch}
                  >
                    {ev.label}
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
                    { ...ev, id, start: playhead, end: playhead + duration },
                  ])
                } else {
                  const mk = copied.data as MarkerEvent
                  setMarkers((prev) => [
                    ...prev,
                    { ...mk, id, time: playhead },
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
    </main>
  )
}
