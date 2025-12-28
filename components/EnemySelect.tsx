'use client'

import { useEffect, useRef, useState } from 'react'
import { toKatakana } from 'wanakana'

interface Enemy {
  id: string
  name: string
  armor?: string
}

interface Props {
  enemies: Enemy[]
  value: string
  onChange: (id: string) => void
}

export default function EnemySelect({ enemies, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [armorFilter, setArmorFilter] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', handle)
    return () => document.removeEventListener('click', handle)
  }, [])

  const armors = Array.from(
    new Set(enemies.map((e) => e.armor).filter(Boolean))
  ) as string[]

  const filtered = enemies.filter((e) => {
    const q = toKatakana(query).toLowerCase()
    const nameOk = toKatakana(e.name).toLowerCase().includes(q)
    const armorOk = armorFilter.length ? armorFilter.includes(e.armor || '') : true
    return nameOk && armorOk
  })

  const selected = enemies.find((e) => e.id === value)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border rounded w-full p-1 text-left dark:bg-gray-800 dark:border-gray-700 dark:text-white"
      >
        {selected ? selected.name : '敵選択'}
      </button>
      {open && (
        <div className="absolute z-10 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded w-full p-2 space-y-2 max-h-96 overflow-y-auto">
          <div className="flex items-start gap-2">
            <input
              type="text"
              placeholder="検索"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border rounded p-1 flex-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
            />
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setArmorFilter([])
              }}
              className="text-sm underline whitespace-nowrap"
            >
              リセット
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {armors.map((a) => (
              <label key={a} className="text-sm flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={armorFilter.includes(a)}
                  onChange={() =>
                    setArmorFilter((prev) =>
                      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
                    )
                  }
                />
                {a}
              </label>
            ))}
          </div>
          <ul className="border-t dark:border-gray-700 pt-2 space-y-1 max-h-40 overflow-y-auto">
            {filtered.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(e.id)
                    setOpen(false)
                  }}
                  className="w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1"
                >
                  {e.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
