'use client'

import { useEffect, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useTheme } from './ThemeProvider'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeart, faStar } from '@fortawesome/free-solid-svg-icons'

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
  position: string
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
  alt_bonds?: Record<string, number>
}

export default function StudentUserData({ studentId }: { studentId: string }) {
  const session = useSession()
  const supabase = useSupabaseClient()
  const { dark } = useTheme()
  const [data, setData] = useState<UserStudent | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [showBonds, setShowBonds] = useState(false)
  useEffect(() => {
    const loadStudents = async () => {
      try {
        const res = await fetch('/api/students')
        if (res.ok) setStudents(await res.json())
      } catch {
        /* ignore */
      }
    }
    loadStudents()
  }, [])
  useEffect(() => {
    const load = async () => {
      if (!session) return
      const { data } = await supabase
        .from('user_students')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('student_id', studentId)
        .maybeSingle()
      if (data) setData(data as UserStudent)
    }
    load()
  }, [session, supabase, studentId])

  const student = students.find((s) => s.id === studentId)

  if (!session) return null

  if (!data) return <p>未登録</p>

  const bondEntries = Object.entries(
    data.alt_bonds ?? { [studentId]: data.bond }
  )

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="relative">
          {student && (
            <img
              src={student.image}
              alt={student.name}
            className="w-full object-contain"
          />
        )}
        <div className="absolute inset-0 flex flex-col justify-end text-white p-2 space-y-1 bg-[#114073]/90 dark:bg-transparent">
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => setShowBonds(true)}
              className="text-pink-400 flex items-center gap-1"
            >
              <FontAwesomeIcon icon={faHeart} />
              {data.bond}
            </button>
            <span className="flex-1 text-left">{student?.name}</span>
            <span className="flex items-center gap-1 justify-end">
              {Array.from({ length: data.star }).map((_, i) => (
                <FontAwesomeIcon
                  key={i}
                  icon={faStar}
                  className="text-yellow-400"
                />
              ))}
              <span>{student?.role}</span>
            </span>
          </div>
          <div>Lv. {data.level}</div>
          <div>
            {student?.characterType} {student?.attackType}
          </div>
          <div>
            {student?.position} {student?.defenseType}
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-between space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>HP {data.hp} ({data.hp_wb})</div>
          <div>攻撃力 {data.attack} ({data.attack_wb})</div>
          <div>防御力 {data.defense}</div>
          <div>治癒力 {data.heal} ({data.heal_wb})</div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>{data.ex_skill}</div>
          <div>{data.normal_skill}</div>
          <div>{data.passive_skill}</div>
          <div>{data.sub_skill}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div>{data.unique_level}</div>
          <div className="space-x-1">
            {Array.from({ length: data.unique_star }).map((_, i) => (
              <FontAwesomeIcon
                key={i}
                icon={faStar}
                className="text-sky-400"
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>{data.equip1}</div>
          <div>{data.equip2}</div>
          <div>{data.equip3}</div>
        </div>
      </div>
    </div>
      {showBonds && (
        <div
          className={`fixed inset-0 z-20 flex items-center justify-center transition-opacity duration-200 ${dark ? 'bg-black/50' : 'bg-black/20'}`}
          onClick={() => setShowBonds(false)}
        >
          <div
            className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 rounded space-y-2 w-64 transform transition-all`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg">絆一覧</h3>
            <ul className="space-y-1">
              {bondEntries.map(([id, value]) => (
                <li key={id} className="flex justify-between">
                  <span>{students.find((s) => s.id === id)?.name || id}</span>
                  <span>{value}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowBonds(false)}
              className="underline text-sm block ml-auto"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  )
}
