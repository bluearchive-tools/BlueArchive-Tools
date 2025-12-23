'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

interface EventItem {
  start: string
  end: string
  title: string
  description: string
}

const COLORS = [
  'bg-blue-200',
  'bg-green-200',
  'bg-pink-200',
  'bg-purple-200',
  'bg-yellow-200',
]

export default function EventSchedulePage() {
  interface DayEvent extends EventItem {
    color: string
    first: boolean
    last: boolean
  }

  const [events, setEvents] = useState<EventItem[]>([])
  const [selected, setSelected] = useState<DayEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [cellHeight, setCellHeight] = useState(0)
  const eventHeight = Math.max(16, Math.min(24, cellHeight / 3))
  const topRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/schedule')
        if (res.ok) setEvents(await res.json())
      } catch {
        /* ignore */
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (selected) {
      setVisible(true)
    }
  }, [selected])

  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = first.getDay()

  const dayCells: (Date | null)[] = []
  for (let i = 0; i < offset; i++) {
    dayCells.push(null)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    dayCells.push(new Date(year, month, d))
  }
  while (dayCells.length % 7 !== 0) {
    dayCells.push(null)
  }

  const rows = dayCells.length / 7

  useLayoutEffect(() => {
    const calc = () => {
      const header = tableRef.current?.querySelector('thead') as HTMLElement | null
      const top = (topRef.current?.offsetHeight ?? 0) + (header?.offsetHeight ?? 0)
      const available = window.innerHeight - top
      setCellHeight(available / rows)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [rows])

  const eventMap = useMemo(() => {
    const map: Record<string, DayEvent[]> = {}
    events.forEach((ev, idx) => {
      const color = COLORS[idx % COLORS.length]
      const start = new Date(ev.start)
      const end = new Date(ev.end)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`

        const day = new Date(d)
        day.setHours(0, 0, 0, 0)

        const first = day.getTime() === new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
        const last = day.getTime() === new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()

        if (!map[key]) map[key] = []
        map[key].push({ ...ev, color, first, last })
      }
    })
    return map
  }, [events])

  return (
    <main className="p-4 space-y-4">
      <div ref={topRef}>
        <h1 className="text-lg font-bold mb-2">{`${year}年${month + 1}月のイベント`}</h1>
      </div>
      <table ref={tableRef} className="w-full border-collapse table-fixed">
        <thead>
          <tr>
            {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
              <th key={d} className="border p-1 text-center text-sm">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: dayCells.length / 7 }).map((_, i) => (
            <tr key={i}>
              {dayCells.slice(i * 7, i * 7 + 7).map((date, j) => {
                const key = date
                  ? `${date.getFullYear()}-${(`${date.getMonth() + 1}`.padStart(
                      2,
                      '0'
                    ))}-${(`${date.getDate()}`.padStart(2, '0'))}`
                  : ''
                const evs = date ? eventMap[key] : null
                return (
                  <td
                    key={j}
                    className="border align-top text-sm p-1 cursor-pointer relative overflow-hidden"
                    style={{ height: cellHeight }}
                    onClick={() => evs && setSelected(evs[0])}
                  >
                    {date && (
                      <div className="h-full">
                        <div className="text-right text-xs">{date.getDate()}</div>
                        {evs?.map((e, idx) => (
                          <div
                            key={idx}
                            className={`absolute left-0 right-0 text-xs truncate ${e.color} px-1 ${e.first ? 'rounded-l' : ''} ${e.last ? 'rounded-r' : ''}`}
                            style={{
                              top: idx * (eventHeight + 2),
                              height: eventHeight,
                              marginLeft: e.first ? undefined : '-1px',
                              marginRight: e.last ? undefined : '-1px',
                            }}
                          >
                            {e.first ? e.title : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {selected && (
        <div
          className={`fixed inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => {
            setVisible(false)
            setTimeout(() => setSelected(null), 200)
          }}
        >
          <div
            className="bg-white p-4 rounded shadow space-y-1 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold">{selected.title}</h2>
            <p className="text-sm">{selected.description}</p>
          </div>
        </div>
      )}
    </main>
  )
}
