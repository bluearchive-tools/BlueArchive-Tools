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
    last: boolean
  }

  const [events, setEvents] = useState<EventItem[]>([])
  const [selected, setSelected] = useState<DayEvent | null>(null)
  const [visible, setVisible] = useState(false)

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
  const cellHeight = `calc((100vh - 8rem) / ${rows})`

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
      const last = d.getTime() === end.getTime()
      if (!eventMap[key]) eventMap[key] = []
      eventMap[key].push({ ...ev, color, first, last })
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
                    className="border align-top text-sm p-1 cursor-pointer"
                    style={{ height: cellHeight }}
                    onClick={() => evs && setSelected(evs[0])}
                  >
                    {date && (
                      <div>
                        <div>{date.getDate()}</div>
                        {evs?.map((e, idx) => (
                          <div
                            key={idx}
                            className={`text-xs truncate ${e.color} px-1 ${e.first ? 'rounded-l' : ''} ${e.last ? 'rounded-r' : ''}`}
                            style={{
                              marginLeft: e.first ? undefined : '-1px',
                              marginRight: e.last ? undefined : '-1px',
                            }}
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
