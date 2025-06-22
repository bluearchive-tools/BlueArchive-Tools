'use client'

import { useState } from 'react'

interface TlEvent {
  id: number
  row: number
  start: number
  end: number
  label: string
}

export default function TLMakerPage() {
  const [events, setEvents] = useState<TlEvent[]>([])
  const [row, setRow] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(1)
  const [label, setLabel] = useState('')

  const addEvent = () => {
    if (end <= start) return
    const id = Date.now()
    setEvents([...events, { id, row, start, end, label }])
  }

  const timeScale = 20 // px per second
  const rowHeight = 40 // px
  const rows = 5
  const totalSeconds = 60

  return (
    <main className="p-4 space-y-4">
      <h2 className="text-xl font-bold">TLメーカー</h2>
      <div className="space-y-2">
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
        <label className="flex items-center gap-2">
          <span>ラベル:</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="border rounded p-1 flex-1"
          />
        </label>
        <button
          onClick={addEvent}
          className="border px-2 py-1 bg-blue-500 text-white rounded"
        >
          追加
        </button>
      </div>
      <div
        className="relative border bg-gray-900"
        style={{
          width: totalSeconds * timeScale,
          height: rows * rowHeight,
          backgroundImage:
            'repeating-linear-gradient(to right, #555 0, #555 1px, transparent 1px, transparent 20px), repeating-linear-gradient(to bottom, #555 0, #555 1px, transparent 1px, transparent 40px)',
        }}
      >
        {events.map((ev) => (
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
    </main>
  )
}
