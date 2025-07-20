'use client'

import { useEffect, useState } from 'react'

interface EventItem {
  start: string
  end: string
  title: string
  description: string
}

export default function EventSchedulePage() {
  interface DayEvent extends EventItem {
    color: string
    first: boolean
  }

  const [events, setEvents] = useState<EventItem[]>([])
  const [selected, setSelected] = useState<DayEvent | null>(null)

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

  const colors = [
    'bg-blue-200',
    'bg-green-200',
    'bg-pink-200',
    'bg-purple-200',
    'bg-yellow-200',
  ]

  const eventMap: Record<string, DayEvent[]> = {}
  events.forEach((ev, idx) => {
    const color = colors[idx % colors.length]
    const start = new Date(ev.start)
    const end = new Date(ev.end)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`
      const first = d.getTime() === start.getTime()
      if (!eventMap[key]) eventMap[key] = []
      eventMap[key].push({ ...ev, color, first })
    }
  })

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-lg font-bold mb-2">{`${year}年${month + 1}月のイベント`}</h1>
      <table className="w-full border-collapse table-fixed">
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
                    className="border h-16 align-top text-sm p-1 cursor-pointer"
                    onClick={() => evs && setSelected(evs[0])}
                  >
                    {date && (
                      <div>
                        <div>{date.getDate()}</div>
                        {evs?.map((e, idx) => (
                          <div
                            key={idx}
                            className={`text-xs truncate ${e.color} rounded px-1`}
                          >
                            {e.first ? e.title : '\u00A0'}
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
        <div className="p-4 border rounded-lg bg-gray-100 space-y-1">
          <h2 className="font-bold">{selected.title}</h2>
          <p className="text-sm">{selected.description}</p>
          <button
            className="text-blue-500 underline text-sm"
            onClick={() => setSelected(null)}
          >
            閉じる
          </button>
        </div>
      )}
    </main>
  )
}
