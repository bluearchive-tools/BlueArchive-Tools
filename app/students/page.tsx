'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUp, faArrowDown, faPlus } from '@fortawesome/free-solid-svg-icons'
import FilterModal from '../../components/FilterModal'

interface Student {
  id: string
  name: string
  image: string
  attackType: string
  defenseType: string
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [sortKey, setSortKey] = useState<'id' | 'name' | 'attackType' | 'defenseType'>('id')
  const [asc, setAsc] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterAttacks, setFilterAttacks] = useState<string[]>([])
  const [filterDefenses, setFilterDefenses] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const importStudents = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data: Student[] = JSON.parse(text)
      setStudents((prev) => [...prev, ...data])
    } catch (err) {
      console.error(err)
    } finally {
      e.target.value = ''
    }
  }

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
  const defenseTypes = Array.from(new Set(students.map((s) => s.defenseType)))

  const resetFilters = () => {
    setFilterAttacks([])
    setFilterDefenses([])
  }

  const filtered = students.filter((s) => {
    const attackOk = filterAttacks.length ? filterAttacks.includes(s.attackType) : true
    const defenseOk = filterDefenses.length ? filterDefenses.includes(s.defenseType) : true
    return attackOk && defenseOk
  })

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortKey]
    const vb = b[sortKey]
    if (va < vb) return asc ? -1 : 1
    if (va > vb) return asc ? 1 : -1
    return 0
  })

  return (
    <main className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl">生徒データ確認</h2>
        <div>
          <input
            type="file"
            accept="application/json"
            ref={fileRef}
            onChange={importStudents}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="生徒データ登録"
            className="border rounded p-2"
            type="button"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={sortKey}
          onChange={(e) =>
            setSortKey(
              e.target.value as 'id' | 'name' | 'attackType' | 'defenseType'
            )
          }
          className="border rounded px-2 py-1"
        >
          <option value="id">ID</option>
          <option value="name">名前</option>
          <option value="attackType">攻撃属性</option>
          <option value="defenseType">防御属性</option>
        </select>
        <button
          onClick={() => setAsc(!asc)}
          aria-label={asc ? '降順に並び替え' : '昇順に並び替え'}
          className="border rounded px-2 py-1"
        >
          <FontAwesomeIcon icon={asc ? faArrowUp : faArrowDown} />
        </button>
        <button
          onClick={() => setFilterOpen(true)}
          className="border rounded px-2 py-1"
        >
          絞り込み
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {sorted.map((s) => (
          <Link
            href={`/students/${s.id}`}
            key={s.id}
            className="border rounded p-2 flex flex-col items-center hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <img src={s.image} alt={s.name} className="w-full h-auto rounded" />
            <p className="mt-2 text-center">{s.name}</p>
          </Link>
        ))}
      </div>
      {filterOpen && (
        <FilterModal
          attackTypes={attackTypes}
          defenseTypes={defenseTypes}
          selectedAttacks={filterAttacks}
          selectedDefenses={filterDefenses}
          toggleAttack={(v) =>
            setFilterAttacks((prev) =>
              prev.includes(v)
                ? prev.filter((x) => x !== v)
                : [...prev, v]
            )
          }
          toggleDefense={(v) =>
            setFilterDefenses((prev) =>
              prev.includes(v)
                ? prev.filter((x) => x !== v)
                : [...prev, v]
            )
          }
          reset={resetFilters}
          close={() => setFilterOpen(false)}
        />
      )}
    </main>
  )
}
