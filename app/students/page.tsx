'use client'

import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons'

interface Student {
  id: string
  name: string
  image: string
  attackType: string
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [sortKey, setSortKey] = useState<'id' | 'name' | 'attackType'>('id')
  const [asc, setAsc] = useState(true)
  const [filterAttack, setFilterAttack] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/students')
        if (res.ok) {
          setStudents(await res.json())
        }
      } catch {
        // ignore
      }
    }
    load()
  }, [])

  const attackTypes = Array.from(new Set(students.map((s) => s.attackType)))

  const filtered = students.filter((s) =>
    filterAttack ? s.attackType === filterAttack : true
  )

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortKey]
    const vb = b[sortKey]
    if (va < vb) return asc ? -1 : 1
    if (va > vb) return asc ? 1 : -1
    return 0
  })

  return (
    <main className="p-4 space-y-4">
      <h2 className="text-xl">生徒データ確認</h2>
      <div className="flex items-center gap-2">
        <select
          value={sortKey}
          onChange={(e) =>
            setSortKey(e.target.value as 'id' | 'name' | 'attackType')
          }
          className="border rounded px-2 py-1"
        >
          <option value="id">ID</option>
          <option value="name">名前</option>
          <option value="attackType">攻撃属性</option>
        </select>
        <button
          onClick={() => setAsc(!asc)}
          aria-label={asc ? '降順に並び替え' : '昇順に並び替え'}
          className="border rounded px-2 py-1"
        >
          <FontAwesomeIcon icon={asc ? faArrowUp : faArrowDown} />
        </button>
        <select
          value={filterAttack}
          onChange={(e) => setFilterAttack(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="">全て</option>
          {attackTypes.map((at) => (
            <option key={at} value={at}>
              {at}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {sorted.map((s) => (
          <div key={s.id} className="border rounded p-2 flex flex-col items-center">
            <img src={s.image} alt={s.name} className="w-full h-auto rounded" />
            <p className="mt-2 text-center">{s.name}</p>
            <p className="text-sm text-center text-gray-500">{s.attackType}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
