'use client'

import { useEffect, useState } from 'react'

interface EventItem {
  date: string
  title: string
  description: string
}

export default function EventSchedulePage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [selected, setSelected] = useState<EventItem | null>(null)

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

  const eventMap: Record<string, EventItem> = {}
  for (const ev of events) {
    eventMap[ev.date] = ev
  }

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-lg font-bold mb-2">{`${year}年${month + 1}月のイベント`}</h1>
      <table className="w-full border-collapse">
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
                const ev = date ? eventMap[key] : null
                return (
                  <td
                    key={j}
                    className="border h-16 align-top text-sm p-1 cursor-pointer"
                    onClick={() => ev && setSelected(ev)}
                  >
                    {date && (
                      <div>
                        <div>{date.getDate()}</div>
                        {ev && (
                          <div className="text-xs text-blue-600 truncate">
                            {ev.title}
                          </div>
                        )}
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
