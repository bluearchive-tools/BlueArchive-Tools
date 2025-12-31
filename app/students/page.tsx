'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import {
  faArrowUp,
  faArrowDown,
  faPlus,
  faList,
  faTableCells,
  faTableCellsLarge,
} from '@fortawesome/free-solid-svg-icons'
import FilterModal from '../../components/FilterModal'
import AddStudentModal from '../../components/AddStudentModal'
import PageHelpButton from '../../components/PageHelpButton'

interface Student {
  id: string
  name: string
  image: string
  attackType: string
  defenseType: string
  hasAccessory?: boolean
  styleIds?: string[]
  styleOf?: string
  altIds?: string[]
  altOf?: string
  initialStars: number
  role: string
  characterType: string
  position: string
  exHitDelay?: number
  normalHitDelay?: number
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
  const [asc, setAsc] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [filterAttacks, setFilterAttacks] = useState<string[]>([])
  const [filterDefenses, setFilterDefenses] = useState<string[]>([])
  const [filterStars, setFilterStars] = useState<number[]>([])
  const [filterRoles, setFilterRoles] = useState<string[]>([])
  const [filterTypes, setFilterTypes] = useState<string[]>([])
  const [grid, setGrid] = useState(1)

  useEffect(() => {
    const saved = localStorage.getItem('students_page_opts')
    if (saved) {
      try {
        const o = JSON.parse(saved)
        if (o.sortKey) setSortKey(o.sortKey)
        if (typeof o.asc === 'boolean') setAsc(o.asc)
        if (Array.isArray(o.filterAttacks)) setFilterAttacks(o.filterAttacks)
        if (Array.isArray(o.filterDefenses)) setFilterDefenses(o.filterDefenses)
        if (Array.isArray(o.filterStars)) setFilterStars(o.filterStars)
        if (Array.isArray(o.filterRoles)) setFilterRoles(o.filterRoles)
        if (Array.isArray(o.filterTypes)) setFilterTypes(o.filterTypes)
        if (typeof o.grid === 'number') setGrid(o.grid)
      } catch {
        // ignore
      }
    }
  }, [])

  const addStudents = (data: Student[]) => {
    setStudents((prev) => [...prev, ...data])
  }

  const addStudent = (s: Student) => {
    setStudents((prev) => [...prev, s])
  }

  const refreshUserStats = useCallback(async () => {
    if (session) {
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
    } else {
      const map: Record<string, UserStudent> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('userStudent:')) {
          const id = key.substring('userStudent:'.length)
          const val = localStorage.getItem(key)
          if (val) {
            try {
              map[id] = JSON.parse(val) as UserStudent
            } catch {
              /* ignore */
            }
          }
        }
      }
      setUserStats(map)
    }
  }, [session, supabase])

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
    refreshUserStats()
  }, [refreshUserStats])

  const attackTypes = Array.from(new Set(students.map((s) => s.attackType)))
  const defenseTypes = Array.from(new Set(students.map((s) => s.defenseType)))
  const starOptions = Array.from(new Set(students.map((s) => s.initialStars))).sort()
  const roleOptions = Array.from(new Set(students.map((s) => s.role)))
  const typeOptions = Array.from(new Set(students.map((s) => s.characterType)))
  const gridClasses = [
    'grid grid-cols-1 sm:grid-cols-2 gap-4',
    'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4',
    'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4',
  ]
  const gridIcons: IconDefinition[] = [faList, faTableCellsLarge, faTableCells]

  useEffect(() => {
    const opts = {
      sortKey,
      asc,
      filterAttacks,
      filterDefenses,
      filterStars,
      filterRoles,
      filterTypes,
      grid,
    }
    localStorage.setItem('students_page_opts', JSON.stringify(opts))
  }, [sortKey, asc, filterAttacks, filterDefenses, filterStars, filterRoles, filterTypes, grid])

  const resetFilters = () => {
    setFilterAttacks([])
    setFilterDefenses([])
    setFilterStars([])
    setFilterRoles([])
    setFilterTypes([])
  }

  const filtered = students.filter((s) => {
    const attackOk = filterAttacks.length ? filterAttacks.includes(s.attackType) : true
    const defenseOk = filterDefenses.length ? filterDefenses.includes(s.defenseType) : true
    const starOk = filterStars.length ? filterStars.includes(s.initialStars) : true
    const roleOk = filterRoles.length ? filterRoles.includes(s.role) : true
    const typeOk = filterTypes.length ? filterTypes.includes(s.characterType) : true
    return attackOk && defenseOk && starOk && roleOk && typeOk
  })

  const baseKeys = ['id', 'name', 'attackType', 'defenseType']

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'id') {
      const va = Number(a.id)
      const vb = Number(b.id)
      return asc ? va - vb : vb - va
    }
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
        <div className="flex items-center gap-2">
          <h2 className="text-xl">生徒データ確認</h2>
          <PageHelpButton pageKey="students" />
        </div>
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
        <div className="flex gap-1">
          {gridIcons.map((ic, i) => (
            <button
              key={i}
              onClick={() => setGrid(i)}
              aria-label={`表示${i + 1}`}
              className={`border rounded px-2 py-1 ${grid === i ? 'bg-blue-500 text-white' : ''}`}
              type="button"
            >
              <FontAwesomeIcon icon={ic} />
            </button>
          ))}
        </div>
      </div>
      <div className={gridClasses[grid]}>
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
          starOptions={starOptions}
          roles={roleOptions}
          characterTypes={typeOptions}
          selectedAttacks={filterAttacks}
          selectedDefenses={filterDefenses}
          selectedStars={filterStars}
          selectedRoles={filterRoles}
          selectedCharacterTypes={filterTypes}
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
          toggleStar={(v) =>
            setFilterStars((prev) =>
              prev.includes(v)
                ? prev.filter((x) => x !== v)
                : [...prev, v]
            )
          }
          toggleRole={(v) =>
            setFilterRoles((prev) =>
              prev.includes(v)
                ? prev.filter((x) => x !== v)
                : [...prev, v]
            )
          }
          toggleCharacterType={(v) =>
            setFilterTypes((prev) =>
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
          onAdded={refreshUserStats}
          close={() => setAddOpen(false)}
        />
      )}
    </main>
  )
}
