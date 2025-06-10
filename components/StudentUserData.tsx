'use client'

import { useEffect, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'

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
  const baseId = student?.altOf || studentId
  const base = students.find((s) => s.id === baseId)
  let otherIds: string[] = []
  if (student && base) {
    if (student.altOf) {
      otherIds = [
        baseId,
        ...(base.altIds?.filter((id) => id !== studentId) || []),
      ]
    } else {
      otherIds = (base.altIds || []).filter((id) => id !== studentId)
    }
  }

  if (!session) return null

  if (!data) return <p>未登録</p>

  const altBonds = data.alt_bonds || {}

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
      <div className="flex flex-col items-start justify-end space-y-1">
        <div>
          絆 {data.bond} {student?.name} 星 {data.star} ({student?.role})
        </div>
        {otherIds.map((id) => {
          const name = students.find((s) => s.id === id)?.name || id
          return (
            <div key={id}>
              絆({name}): {altBonds[id] ?? 0}
            </div>
          )
        })}
        <div>レベル: {data.level}</div>
        <div className="flex gap-2">
          <div>クラス: {student?.characterType}</div>
          <div>攻撃属性: {student?.attackType}</div>
        </div>
        <div>防御属性: {student?.defenseType}</div>
      </div>
      <div className="md:col-span-2 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            HP: {data.hp} ({data.hp_wb})
          </div>
          <div>
            攻撃力: {data.attack} ({data.attack_wb})
          </div>
          <div>防御力: {data.defense}</div>
          <div>
            治癒力: {data.heal} ({data.heal_wb})
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div>EXスキル: {data.ex_skill}</div>
          <div>ノーマルスキル: {data.normal_skill}</div>
          <div>パッシブスキル: {data.passive_skill}</div>
          <div>サブスキル: {data.sub_skill}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>固有武器Lv: {data.unique_level}</div>
          <div>固有武器星: {data.unique_star}</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>装備1Tier: {data.equip1}</div>
          <div>装備2Tier: {data.equip2}</div>
          <div>装備3Tier: {data.equip3}</div>
        </div>
      </div>
    </div>
  )
}
