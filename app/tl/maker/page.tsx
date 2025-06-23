'use client'

import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faFileImport, faCaretDown } from '@fortawesome/free-solid-svg-icons'

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
  show?: boolean
}

export default function TLMakerPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [rowStudents, setRowStudents] = useState<string[]>(['', '', '', '', '', ''])
  const [skills, setSkills] = useState<SkillEvent[]>([])
  const [markers, setMarkers] = useState<MarkerEvent[]>([])
  const [menuInfo, setMenuInfo] = useState<{ index: number; x: number; y: number } | null>(null)
  const [row, setRow] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(1)
  const [label, setLabel] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [squads, setSquads] = useState<{ name: string; members: string[] }[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const [selectedType, setSelectedType] = useState<'skill' | 'event' | null>(null)
  const [timeScale, setTimeScale] = useState(20) // px per second

  const hidePopups = () => {
    if (menuInfo) setMenuInfo(null)
    setMarkers((prev) => prev.map((m) => (m.show ? { ...m, show: false } : m)))
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
    loadStudents()
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

  const addEvent = () => {
    const id = Date.now()
    if (selectedType === 'skill') {
      if (end <= start) return
      setSkills([...skills, { id, row, start, end, label }])
    } else if (selectedType === 'event') {
      setMarkers([...markers, { id, time: start, label }])
    }
    setLabel('')
    setShowForm(false)
    setSelectedType(null)
  }

  const rowHeight = 42 // px
  const rows = rowStudents.length
  const totalSeconds = 240

  const tickStep = timeScale >= 40 ? 0.5 : 1
  const labelStep = timeScale < 20 ? 5 : 1

  return (
    <main className="p-4 space-y-4 select-none" onClick={hidePopups}>
      <h2 className="text-xl font-bold">TLメーカー</h2>
      <div className="flex gap-2 relative">
        <div>
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="border rounded p-1"
            aria-label="追加"
          >
            <FontAwesomeIcon icon={faPlus} />
            <FontAwesomeIcon icon={faCaretDown} className="ml-1" />
          </button>
          {showMenu && (
            <div className="absolute left-0 mt-1 border bg-white rounded shadow z-10 text-sm">
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
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="border rounded p-1"
          aria-label="部隊インポート"
        >
          <FontAwesomeIcon icon={faFileImport} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm">拡大</span>
        <input
          type="range"
          min="10"
          max="160"
          step="5"
          value={timeScale}
          onChange={(e) => setTimeScale(parseInt(e.target.value))}
        />
        <span className="text-sm">{timeScale}px/s</span>
      </div>

      {showForm && (
        <div className="space-y-2 border p-2 rounded select-text">
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
            <label className="flex items-center gap-2">
              <span>時間:</span>
              <input
                type="number"
                value={start}
                onChange={(e) => setStart(parseFloat(e.target.value))}
                className="border rounded p-1 w-24"
              />
            </label>
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
      )}

      {showImport && squads.length > 0 && (
        <div className="border rounded p-2 space-y-1 select-text">
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
        <div className="overflow-x-auto w-full">
          <div className="relative" style={{ width: totalSeconds * timeScale }}>
            <div className="flex text-xs h-5">
              {Array.from({ length: totalSeconds / tickStep + 1 }, (_, idx) => {
                const t = idx * tickStep
                const showLabel = Number.isInteger(t) && t % labelStep === 0
                return (
                  <div
                    key={idx}
                    className="border-l border-gray-500"
                    style={{ width: timeScale * tickStep }}
                  >
                    {showLabel ? t : ''}
                  </div>
                )
              })}
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
                  `, repeating-linear-gradient(to bottom, #555 0, #555 1px, transparent 1px, transparent ${rowHeight}px)`,
              }}
            >
              {markers.map((m) => (
                <div
                  key={m.id}
                  className="absolute bg-yellow-400 cursor-pointer"
                  style={{
                    left: m.time * timeScale - 2,
                    top: 0,
                    width: 4,
                    height: rows * rowHeight,
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMarkers((prev) =>
                      prev.map((mk) =>
                        mk.id === m.id ? { ...mk, show: !mk.show } : mk
                      )
                    )
                  }}
                >
                  {m.show && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-200 border px-1 rounded whitespace-nowrap text-xs">
                      {m.label}
                    </div>
                  )}
                </div>
              ))}
              {skills.map((ev) => (
                <div
                  key={ev.id}
                  className="absolute bg-blue-500 text-white text-xs px-1 overflow-hidden"
                  style={{
                    left: ev.start * timeScale,
                    top: ev.row * rowHeight,
                    width: (ev.end - ev.start) * timeScale,
                    height: rowHeight - 2,
                  }}
                >
                  {ev.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {menuInfo && (
        <div
          className="fixed bg-white border rounded shadow text-sm z-20"
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
    </main>
  )
}
