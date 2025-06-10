'use client'

import { useEffect, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useTheme } from './ThemeProvider'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeart, faStar } from '@fortawesome/free-solid-svg-icons'

function attrBg(attr?: string) {
  switch (attr) {
    case '爆発':
    case '軽装備':
      return 'bg-red-500'
    case '貫通':
    case '重装甲':
      return 'bg-yellow-500'
    case '神秘':
    case '特殊装甲':
      return 'bg-blue-500'
    case '振動':
    case '弾力装甲':
      return 'bg-pink-500'
    default:
      return 'bg-gray-500'
  }
}

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
        <div className="absolute inset-0 flex flex-col justify-end text-white p-2 space-y-1">
          <div className={`flex flex-wrap gap-1 items-center ${!dark ? 'bg-[#114073] bg-opacity-90 px-1' : ''}`}>
            <button
              type="button"
              onClick={() => setShowBonds(true)}
              className="relative text-pink-400 w-8 h-8"
            >
              <FontAwesomeIcon icon={faHeart} className="w-8 h-8" />
              <span className="absolute inset-0 flex items-center justify-center text-black text-xs font-bold drop-shadow-[0_0_2px_white]">
                {data.bond}
              </span>
            </button>
            <span className="flex-1 text-left text-2xl">{student?.name}</span>
            <span className="flex items-center -space-x-1 justify-end">
              {Array.from({ length: data.star }).map((_, i) => (
                <FontAwesomeIcon key={i} icon={faStar} className="text-yellow-400" />
              ))}
            </span>
            <span
              className={`bg-white px-1 italic ${student?.role === 'STRIKER' ? 'text-red-500' : 'text-blue-500'}`}
            >
              {student?.role}
            </span>
          </div>
          <div className={`${!dark ? 'bg-[#114073] bg-opacity-90 px-1' : ''} inline-block w-20 text-center`}>Lv. {data.level}</div>
          <div className="flex gap-1">
            <span className="inline-block skew-x-12">
              <span className="-skew-x-12 bg-white text-[#114073] italic px-1 inline-block w-20 text-center">
                {student?.characterType}
              </span>
            </span>
            <span className="inline-block skew-x-12">
              <span className={`-skew-x-12 ${attrBg(student?.attackType)} text-white px-1 inline-block w-20 text-center`}>
                {student?.attackType}
              </span>
            </span>
          </div>
          <div className="flex gap-1">
            <span className="inline-block skew-x-12">
              <span className="-skew-x-12 bg-[#114073] text-white italic px-1 inline-block w-20 text-center">
                {student?.position}
              </span>
            </span>
            <span className="inline-block skew-x-12">
              <span className={`-skew-x-12 ${attrBg(student?.defenseType)} text-white px-1 inline-block w-20 text-center`}>
                {student?.defenseType}
              </span>
            </span>
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
          {[
            { label: 'EXスキル', value: data.ex_skill, ex: true },
            { label: 'ノーマル', value: data.normal_skill },
            { label: 'パッシブ', value: data.passive_skill },
            { label: 'サブ', value: data.sub_skill },
          ].map((skill, i) => (
            <div key={i} className="skew-x-12">
              <div className="-skew-x-12 border flex flex-col items-center justify-between h-24 w-full p-1">
                <span className="text-xs">{skill.label}</span>
                <div className="relative flex justify-center items-center my-1">
                  <div className={`${attrBg(student?.attackType)} hexagon w-8 h-8`}></div>
                  {skill.ex && (
                    <>
                      <div className="absolute hexagon w-8 h-8 border-2 border-black"></div>
                      <div className="absolute hexagon w-7 h-7 border-2 border-white"></div>
                      <div className="absolute w-10 h-10 rounded-full border border-blue-400/50"></div>
                    </>
                  )}
                </div>
                <hr className="border-gray-300 w-full" />
                <span className="text-sm">
                  {skill.ex
                    ? skill.value >= 5
                      ? 'MAX'
                      : skill.value
                    : skill.value >= 10
                    ? 'MAX'
                    : skill.value}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 text-center">
          <div className="skew-x-12">
            <div className="-skew-x-12 border flex flex-col items-center justify-between h-24 w-full p-1 space-y-1">
              <span className="text-sm">固有武器</span>
              <span>Lv. {data.unique_level}</span>
              <div className="space-x-px">
                {Array.from({ length: data.unique_star }).map((_, i) => (
                  <FontAwesomeIcon key={i} icon={faStar} className="text-sky-400" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[data.equip1, data.equip2, data.equip3, student?.hasAccessory ? data.item_tier : 'EMPTY'].map((tier, i) => (
            <div key={i} className="skew-x-12">
              <div
                className={`-skew-x-12 border relative h-12 w-full flex items-end justify-start ${i === 3 && !student?.hasAccessory ? 'bg-gray-300 text-gray-500' : ''}`}
              >
                {i === 3 && !student?.hasAccessory ? (
                  <span className="text-xs ml-1 mb-1">EMPTY</span>
                ) : (
                  <span className="text-xs ml-1 mb-1 text-[#4298f5]">T{tier}</span>
                )}
              </div>
            </div>
          ))}
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
