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
  const altIds = base?.altIds || []

  if (!session) return null

  if (!data) return <p>未登録</p>

  const altBonds = data.alt_bonds || {}

  return (
    <div className="space-y-1 text-sm">
      <p>レベル: {data.level}</p>
      <p>星: {data.star}</p>
      <p>固有武器星: {data.unique_star}</p>
      <p>固有武器レベル: {data.unique_level}</p>
      <p>絆: {data.bond}</p>
      {altIds.map((id) => {
        const name = students.find((s) => s.id === id)?.name || id
        return (
          <p key={id}>
            絆({name}): {altBonds[id] ?? 0}
          </p>
        )
      })}
      <p>HP: {data.hp} / {data.hp_wb}</p>
      <p>攻撃力: {data.attack} / {data.attack_wb}</p>
      <p>防御力: {data.defense}</p>
      <p>治癒力: {data.heal} / {data.heal_wb}</p>
      <p>EX: {data.ex_skill}</p>
      <p>ノーマル: {data.normal_skill}</p>
      <p>パッシブ: {data.passive_skill}</p>
      <p>サブ: {data.sub_skill}</p>
      <p>装備1: {data.equip1}</p>
      <p>装備2: {data.equip2}</p>
      <p>装備3: {data.equip3}</p>
      <p>愛用品Tier: {data.item_tier}</p>
    </div>
  )
}
