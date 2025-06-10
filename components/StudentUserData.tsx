'use client'

import { useEffect, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
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
  const [data, setData] = useState<UserStudent | null>(null)
  const [students, setStudents] = useState<Student[]>([])
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <div className="relative">
        {student && (
          <img
            src={student.image}
            alt={student.name}
            className="w-full object-contain"
          />
        )}
        <div className="absolute inset-0 flex flex-col justify-end text-white p-2 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-pink-400 flex items-center gap-1">
              <FontAwesomeIcon icon={faHeart} />
              {data.bond}
            </span>
            <span className="flex-1 text-center">{student?.name}</span>
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
  )
}
