'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import PageHelpButton from '../../../components/PageHelpButton'

interface EventItem {
  start: string
  end: string
  title: string
  description: string
  color?: string
}

const COLORS = [
  'bg-blue-200',
  'bg-green-200',
  'bg-pink-200',
  'bg-purple-200',
  'bg-yellow-200',
]

function getDayRatio(ev: EventItem, day: Date) {
  const dayStart = new Date(day)
  dayStart.setHours(0, 0, 0, 0)

  const dayEnd = new Date(day)
  dayEnd.setDate(dayEnd.getDate() + 1) // ← 翌日の 0:00
  dayEnd.setHours(0, 0, 0, 0)

  const evStart = new Date(ev.start).getTime()
  const evEnd = new Date(ev.end).getTime()

  const start = Math.max(evStart, dayStart.getTime())
  const end = Math.min(evEnd, dayEnd.getTime())

  const total = dayEnd.getTime() - dayStart.getTime()
  const left = ((start - dayStart.getTime()) / total) * 100
  const width = ((end - start) / total) * 100

  return {
    left,
    width: Math.max(width, 1), // 見えなくならない最低保証
  }
}





export default function EventSchedulePage() {
  interface DayEvent extends EventItem {
    color: string
    first: boolean
    last: boolean
    day: Date
    left: number
    width: number
    row: number
  }

  const [events, setEvents] = useState<EventItem[]>([])
  const [selected, setSelected] = useState<DayEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [cellHeight, setCellHeight] = useState(0)
  const [currentMonth, setCurrentMonth] = useState(() => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
})
  const eventHeight = Math.max(16, Math.min(24, cellHeight / 3))
  const topRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const MAX_EVENTS_PER_DAY = 3


  function assignRows(events: DayEvent[]) {
  const rows: DayEvent[][] = []

  events.forEach((ev) => {
    let placed = false

    for (let r = 0; r < rows.length; r++) {
      const conflict = rows[r].some(
        (e) =>
          ev.left < e.left + e.width &&
          ev.left + ev.width > e.left
      )

      if (!conflict) {
        ev.row = r
        rows[r].push(ev)
        placed = true
        break
      }
    }

    if (!placed) {
      ev.row = rows.length
      rows.push([ev])
    }
  })
}

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

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const first = currentMonth
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
    const calc = () => {const table = tableRef.current
    const thead = table?.querySelector('thead') as HTMLElement | null
    if (!table || !thead) return
       const available =
        table.getBoundingClientRect().height -
        thead.getBoundingClientRect().height

      setCellHeight(Math.floor(available / rows))
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [rows])

  const eventMap = useMemo(() => {
  const map: Record<string, DayEvent[]> = {}

  events.forEach((ev, idx) => {
    const color = ev.color ?? COLORS[idx % COLORS.length]
    const start = new Date(ev.start)
    const end = new Date(ev.end)

    const startDay = new Date(start)
    startDay.setHours(0, 0, 0, 0)

    const endDay = new Date(end)
    endDay.setHours(0, 0, 0, 0)

    for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
      const day = new Date(d)
      const key = `${day.getFullYear()}-${`${day.getMonth() + 1}`.padStart(
        2,
        '0'
      )}-${`${day.getDate()}`.padStart(2, '0')}`

      const { left, width } = getDayRatio(ev, day)

      if (!map[key]) map[key] = []

      const isFirst =
  day.getTime() === startDay.getTime()

const isLast =
  day.getTime() === endDay.getTime()

map[key].push({
  ...ev,
  color,
  day,
  left,
  width,
  row: 0, // 仮
  first: isFirst,
  last: isLast,
})

    }
  })

  // ★ ここがポイント
  Object.values(map).forEach(assignRows)

  return map
}, [events])


  return (
    <main className="h-screen p-4 flex flex-col">
      <div
  ref={topRef}
    className="shrink-0 flex items-center justify-between mb-2"
>
  <button
    className="px-2 py-1 border rounded whitespace-nowrap"
    onClick={() =>
      setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    }
  >
    ◀
  </button>

  <div className="flex items-center gap-2 flex-1 justify-center">
    <h1 className="text-lg font-bold text-center">
      {year}年{month + 1}月のイベント
    </h1>
    <PageHelpButton pageKey="tools-event-schedule" />
  </div>

  <button
    className="px-2 py-1 border rounded whitespace-nowrap"
    onClick={() =>
      setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    }
  >
    ▶
  </button>
</div>

      <div className="flex-1 overflow-hidden">
      <table ref={tableRef} className="w-full h-full border-collapse table-fixed">
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
                    className="border align-top text-sm p-1 cursor-pointer relative overflow-auto"
                    style={{
  height: cellHeight,
  maxHeight: cellHeight,
}}

                  >
                    {date && (
                      <div className="h-full">
                        <div className="text-right text-xs">{date.getDate()}</div>
                        {evs && (() => {
  const visibleEvents = evs.slice(0, MAX_EVENTS_PER_DAY)
  const hiddenCount = evs.length - visibleEvents.length

  return (
    <>
      {visibleEvents.map((e, idx) => {
        const { left, width } = getDayRatio(e, e.day)

        return (
          <div
            key={idx}
            onClick={(ev) => {
              ev.stopPropagation()
              setSelected(e)
            }}
            className={`absolute text-xs truncate ${e.color} px-1 cursor-pointer`}
            style={{
              top: 18 + e.row * (eventHeight + 2),
              left: `${left}%`,
              width: `${Math.max(width, 2)}%`,
              height: eventHeight,
            }}
          >
            {(e.first || e.day.getDate() === 1) ? e.title : ''}
          </div>
        )
      })}

      {hiddenCount > 0 && (
        <div
          className="absolute left-1 right-1 text-xs text-gray-600 cursor-pointer bg-white/80 rounded px-1"
          style={{
            top: 18 + MAX_EVENTS_PER_DAY * (eventHeight + 2),
          }}
          onClick={(ev) => {
            ev.stopPropagation()
            setSelected({
              ...visibleEvents[0],
              title: `${hiddenCount}件のイベント`,
              description: evs.map((e) => `・${e.title}`).join('\n'),
            })
          }}
        >
          +{hiddenCount}件
        </div>
      )}
    </>
  )
})()}


                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
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
            <p className="text-sm whitespace-pre-line">
              {selected.description}
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
