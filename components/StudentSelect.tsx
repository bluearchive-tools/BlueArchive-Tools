'use client'

import { useEffect, useRef, useState } from 'react'
import { toKatakana } from 'wanakana'

interface Student {
  id: string
  name: string
  image: string
  attackType: string
  defenseType: string
  hasAccessory?: boolean
  altIds?: string[]
  altOf?: string
  initialStars: number
  role: string
  characterType: string
}

interface Props {
  students: Student[]
  value: string
  onChange: (value: string) => void
}

export default function StudentSelect({ students, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [attackFilter, setAttackFilter] = useState<string[]>([])
  const [defenseFilter, setDefenseFilter] = useState<string[]>([])
  const [starFilter, setStarFilter] = useState<number[]>([])
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const resetFilters = () => {
    setQuery('')
    setAttackFilter([])
    setDefenseFilter([])
    setStarFilter([])
    setRoleFilter([])
    setTypeFilter([])
  }

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handle)
    return () => document.removeEventListener('click', handle)
  }, [])

  const attackTypes = Array.from(new Set(students.map((s) => s.attackType)))
  const defenseTypes = Array.from(new Set(students.map((s) => s.defenseType)))
  const starOptions = Array.from(new Set(students.map((s) => s.initialStars))).sort()
  const roleOptions = Array.from(new Set(students.map((s) => s.role)))
  const typeOptions = Array.from(new Set(students.map((s) => s.characterType)))

  const filtered = students.filter((s) => {
    const q = toKatakana(query).toLowerCase()
    const nameOk = toKatakana(s.name).toLowerCase().includes(q)
    const attackOk = attackFilter.length ? attackFilter.includes(s.attackType) : true
    const defenseOk = defenseFilter.length ? defenseFilter.includes(s.defenseType) : true
    const starOk = starFilter.length ? starFilter.includes(s.initialStars) : true
    const roleOk = roleFilter.length ? roleFilter.includes(s.role) : true
    const typeOk = typeFilter.length ? typeFilter.includes(s.characterType) : true
    return nameOk && attackOk && defenseOk && starOk && roleOk && typeOk
  })

  const selected = students.find((s) => s.id === value)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border rounded w-full p-1 text-left dark:bg-gray-800 dark:border-gray-700 dark:text-white"
      >
        {selected ? selected.name : '生徒選択'}
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
              onClick={resetFilters}
              className="text-sm underline whitespace-nowrap"
            >
              リセット
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {attackTypes.map((at) => (
              <label key={at} className="text-sm flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={attackFilter.includes(at)}
                  onChange={() =>
                    setAttackFilter((prev) =>
                      prev.includes(at) ? prev.filter((x) => x !== at) : [...prev, at]
                    )
                  }
                />
                {at}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {defenseTypes.map((dt) => (
              <label key={dt} className="text-sm flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={defenseFilter.includes(dt)}
                  onChange={() =>
                    setDefenseFilter((prev) =>
                      prev.includes(dt) ? prev.filter((x) => x !== dt) : [...prev, dt]
                    )
                  }
                />
                {dt}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {starOptions.map((st) => (
              <label key={st} className="text-sm flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={starFilter.includes(st)}
                  onChange={() =>
                    setStarFilter((prev) =>
                      prev.includes(st) ? prev.filter((x) => x !== st) : [...prev, st]
                    )
                  }
                />
                {st}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {roleOptions.map((r) => (
              <label key={r} className="text-sm flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={roleFilter.includes(r)}
                  onChange={() =>
                    setRoleFilter((prev) =>
                      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
                    )
                  }
                />
                {r}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {typeOptions.map((t) => (
              <label key={t} className="text-sm flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={typeFilter.includes(t)}
                  onChange={() =>
                    setTypeFilter((prev) =>
                      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                    )
                  }
                />
                {t}
              </label>
            ))}
          </div>
          <ul className="border-t dark:border-gray-700 pt-2 space-y-1 max-h-40 overflow-y-auto">
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(s.id)
                    setOpen(false)
                  }}
                  className="w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1"
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
