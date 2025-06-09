'use client'

import { useEffect, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUp, faArrowDown, faPlus } from '@fortawesome/free-solid-svg-icons'
import FilterModal from '../../components/FilterModal'
import AddStudentModal from '../../components/AddStudentModal'

interface Student {
  id: string
  name: string
  image: string
  attackType: string
  defenseType: string
  hasAccessory?: boolean
  altIds?: string[]
  altOf?: string
}

interface UserStudent {
  level: number
  star: number
  unique_star: number
  unique_level: number
  bond: number
  hp: number
  hp_wb: number
  attack: number
  attack_wb: number
  defense: number
  heal: number
  heal_wb: number
  ex_skill: number
  normal_skill: number
  passive_skill: number
  sub_skill: number
  equip1: number
  equip2: number
  equip3: number
  item_tier: number
}

type SortKey =
  | 'id'
  | 'name'
  | 'attackType'
  | 'defenseType'
  | 'level'
  | 'star'
  | 'unique_star'
  | 'unique_level'
  | 'bond'
  | 'hp'
  | 'hp_wb'
  | 'attack'
  | 'attack_wb'
  | 'defense'
  | 'heal'
  | 'heal_wb'
  | 'ex_skill'
  | 'normal_skill'
  | 'passive_skill'
  | 'sub_skill'
  | 'equip1'
  | 'equip2'
  | 'equip3'
  | 'item_tier'

export default function StudentsPage() {
  const session = useSession()
  const supabase = useSupabaseClient()
  const [students, setStudents] = useState<Student[]>([])
  const [userStats, setUserStats] = useState<Record<string, UserStudent>>({})
  const [sortKey, setSortKey] = useState<SortKey>('id')
  const [asc, setAsc] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [filterAttacks, setFilterAttacks] = useState<string[]>([])
  const [filterDefenses, setFilterDefenses] = useState<string[]>([])

  const addStudents = (data: Student[]) => {
    setStudents((prev) => [...prev, ...data])
  }

  const addStudent = (s: Student) => {
    setStudents((prev) => [...prev, s])
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

  useEffect(() => {
    const loadStats = async () => {
      if (!session) return
      const { data } = await supabase
        .from('user_students')
        .select('*')
        .eq('user_id', session.user.id)
      if (data) {
        const map: Record<string, UserStudent> = {}
        for (const row of data) {
          map[row.student_id as string] = row as UserStudent
        }
        setUserStats(map)
      }
    }
    loadStats()
  }, [session, supabase])

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

  const baseKeys = ['id', 'name', 'attackType', 'defenseType']

  const sorted = [...filtered].sort((a, b) => {
    let va: number | string | undefined
    let vb: number | string | undefined
    if (baseKeys.includes(sortKey)) {
      va = a[sortKey as keyof Student] as number | string
      vb = b[sortKey as keyof Student] as number | string
    } else {
      va = userStats[a.id]?.[sortKey as keyof UserStudent]
      vb = userStats[b.id]?.[sortKey as keyof UserStudent]
      if (va === undefined) va = asc ? Infinity : -Infinity
      if (vb === undefined) vb = asc ? Infinity : -Infinity
    }
    if (va! < vb!) return asc ? -1 : 1
    if (va! > vb!) return asc ? 1 : -1
    return 0
  })

  return (
    <main className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl">生徒データ確認</h2>
        <div>
          <button
            onClick={() => setAddOpen(true)}
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
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="border rounded px-2 py-1"
        >
          <option value="id">ID</option>
          <option value="name">名前</option>
          <option value="attackType">攻撃属性</option>
          <option value="defenseType">防御属性</option>
          <option value="level">レベル</option>
          <option value="star">星</option>
          <option value="attack">攻撃力</option>
          <option value="defense">防御力</option>
          <option value="unique_star">固有武器星</option>
          <option value="unique_level">固有武器Lv</option>
          <option value="bond">絆</option>
          <option value="hp">HP</option>
          <option value="hp_wb">HPWB</option>
          <option value="attack_wb">攻撃力WB</option>
          <option value="heal">治癒力</option>
          <option value="heal_wb">治癒力WB</option>
          <option value="ex_skill">EX</option>
          <option value="normal_skill">ノーマル</option>
          <option value="passive_skill">パッシブ</option>
          <option value="sub_skill">サブ</option>
          <option value="equip1">装備1</option>
          <option value="equip2">装備2</option>
          <option value="equip3">装備3</option>
          <option value="item_tier">愛用品</option>
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
            {!baseKeys.includes(sortKey) && (
              <p className="text-sm">
                {userStats[s.id]?.[sortKey as keyof UserStudent] ?? '未登録'}
              </p>
            )}
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
      {addOpen && (
        <AddStudentModal
          addStudents={addStudents}
          addStudent={addStudent}
          close={() => setAddOpen(false)}
        />
      )}
    </main>
  )
}
