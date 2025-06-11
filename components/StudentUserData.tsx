'use client'

import { useEffect, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useTheme } from './ThemeProvider'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeart, faStar } from '@fortawesome/free-solid-svg-icons'
import EditValueModal from './EditValueModal'
import EditBondsModal from './EditBondsModal'

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

export default function StudentUserData({
  studentId,
  editMode,
}: {
  studentId: string
  editMode: boolean
}) {
  const session = useSession()
  const supabase = useSupabaseClient()
  const { dark } = useTheme()
  const [data, setData] = useState<UserStudent | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [showBonds, setShowBonds] = useState(false)
  const [editField, setEditField] = useState<
    | { field: string; label: string; value: number; min?: number; max?: number }
    | null
  >(null)
  const [editBonds, setEditBonds] = useState(false)
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
  const loadData = async () => {
    if (!session) return
    const { data } = await supabase
      .from('user_students')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('student_id', studentId)
      .maybeSingle()
    if (data) setData(data as UserStudent)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <div className="flex flex-wrap gap-1 items-center bg-[#114073] bg-opacity-90 px-1">
            <button
              type="button"
              onClick={() => setShowBonds(true)}
              className={`relative text-pink-300${editMode ? ' edit-highlight' : ''}`}
            >
              <FontAwesomeIcon
                icon={faHeart}
                className="!w-8 !h-8 text-pink-400"
                style={{
                  width: '2rem',
                  height: '2rem',
                  color: '#f472b6',
                  stroke: '#f472b6',
                  strokeWidth: 2,
                }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-black text-sm font-bold drop-shadow-[0_0_2px_white]">
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
          <div className="bg-[#114073] bg-opacity-90 px-1 inline-block w-20 text-center">Lv. {data.level}</div>
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
      <div className="flex flex-col justify-between space-y-1">
        <div className="border rounded-md p-1">
          <div className="grid grid-cols-2 gap-1 pb-1 border-b border-gray-300">
            <div
              onClick={() =>
                editMode && setEditField({ field: 'hp', label: 'HP', value: data.hp })
              }
              className={`cursor-pointer${editMode ? ' edit-highlight' : ''}`}
            >
              HP {data.hp}{' '}
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  if (editMode) {
                    setEditField({ field: 'hp_wb', label: 'HPWB', value: data.hp_wb, min: 0, max: 25 })
                  }
                }}
                className={`bg-[#114073] px-1 text-white relative inline-block ml-1${
                  data.hp_wb >= 25 ? ' text-yellow-400' : ''
                }`}
              >
                Lv.{data.hp_wb}
                {data.hp_wb >= 25 && (
                  <span className="absolute -top-1 right-0 text-[10px] max-gradient">MAX</span>
                )}
              </span>
            </div>
            <div
              onClick={() =>
                editMode && setEditField({ field: 'attack', label: '攻撃力', value: data.attack })
              }
              className={`cursor-pointer${editMode ? ' edit-highlight' : ''}`}
            >
              攻撃力 {data.attack}{' '}
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  if (editMode) {
                    setEditField({
                      field: 'attack_wb',
                      label: '攻撃力WB',
                      value: data.attack_wb,
                      min: 0,
                      max: 25,
                    })
                  }
                }}
                className={`bg-[#114073] px-1 text-white relative inline-block ml-1${
                  data.attack_wb >= 25 ? ' text-yellow-400' : ''
                }`}
              >
                Lv.{data.attack_wb}
                {data.attack_wb >= 25 && (
                  <span className="absolute -top-1 right-0 text-[10px] max-gradient">MAX</span>
                )}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 pt-1">
            <div
              onClick={() =>
                editMode && setEditField({ field: 'defense', label: '防御力', value: data.defense })
              }
              className={`cursor-pointer${editMode ? ' edit-highlight' : ''}`}
            >
              防御力 {data.defense}
            </div>
            <div
              onClick={() =>
                editMode && setEditField({ field: 'heal', label: '治癒力', value: data.heal })
              }
              className={`cursor-pointer${editMode ? ' edit-highlight' : ''}`}
            >
              治癒力 {data.heal}{' '}
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  if (editMode) {
                    setEditField({
                      field: 'heal_wb',
                      label: '治癒力WB',
                      value: data.heal_wb,
                      min: 0,
                      max: 25,
                    })
                  }
                }}
                className={`bg-[#114073] px-1 text-white relative inline-block ml-1${
                  data.heal_wb >= 25 ? ' text-yellow-400' : ''
                }`}
              >
                Lv.{data.heal_wb}
                {data.heal_wb >= 25 && (
                  <span className="absolute -top-1 right-0 text-[10px] max-gradient">MAX</span>
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1 text-center">
          {[
            { label: 'EXスキル', value: data.ex_skill, field: 'ex_skill', ex: true, max: 5 },
            { label: 'ノーマルスキル', value: data.normal_skill, field: 'normal_skill', max: 10 },
            { label: 'パッシブスキル', value: data.passive_skill, field: 'passive_skill', max: 10 },
            { label: 'サブスキル', value: data.sub_skill, field: 'sub_skill', max: 10 },
          ].map((skill, i) => (
            <div key={i} className="skew-x-12">
              <div
                className={`-skew-x-12 border rounded-md flex flex-col items-center justify-between h-28 w-full p-1 cursor-pointer${editMode ? ' edit-highlight' : ''}`}
                onClick={() =>
                  editMode &&
                  setEditField({
                    field: skill.field,
                    label: skill.label,
                    value: skill.value,
                    min: 1,
                    max: skill.max,
                  })
                }
              >
                <span className="text-xs italic">{skill.label}</span>
                <div className="relative flex justify-center items-center my-1">
                  <div className={`${attrBg(student?.attackType)} hexagon w-10 h-10`}></div>
                  {skill.ex && (
                    <>
                      <div className="absolute hexagon w-12 h-12 border-2 border-black"></div>
                      <div className="absolute hexagon w-11 h-11 border-2 border-white"></div>
                      <div className="absolute w-16 h-16 rounded-full border-4 border-blue-300/50"></div>
                    </>
                  )}
                </div>
                <hr className="border-gray-300 w-full" />
                <span
                  className={`text-sm ${
                    (skill.ex ? skill.value >= 5 : skill.value >= 10) ? 'max-gradient' : ''
                  }`}
                >
                  {(
                    skill.ex ? (skill.value >= 5) : (skill.value >= 10)
                  )
                    ? 'MAX'
                    : `Lv.${skill.value}`}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-1 text-center">
          <div className="skew-x-12">
            <div
              className={`-skew-x-12 border rounded-md flex flex-col items-center justify-between h-28 w-full p-1 space-y-1 cursor-pointer${editMode ? ' edit-highlight' : ''}`}
              onClick={() =>
                editMode &&
                setEditField({ field: 'unique_level', label: '固有武器Lv', value: data.unique_level, min: 0 })
              }
            >
              <span className="text-sm">固有武器</span>
              <span>Lv. {data.unique_level}</span>
              <div
                className={`space-x-px${editMode ? ' edit-highlight cursor-pointer' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  if (editMode) {
                    setEditField({ field: 'unique_star', label: '固有武器星', value: data.unique_star, min: 0 })
                  }
                }}
              >
                {Array.from({ length: data.unique_star }).map((_, i) => (
                  <FontAwesomeIcon key={i} icon={faStar} className="text-sky-400" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1 text-center">
          {[
            { value: data.equip1, field: 'equip1' },
            { value: data.equip2, field: 'equip2' },
            { value: data.equip3, field: 'equip3' },
            { value: student?.hasAccessory ? data.item_tier : 'EMPTY', field: 'item_tier' },
          ].map((gear, i) => (
            <div key={i} className="skew-x-12">
              <div
                className={`-skew-x-12 rounded-lg border relative w-full aspect-square flex items-end justify-start ${
                  i === 3 && !student?.hasAccessory ? 'bg-gray-300 text-gray-500 border-black' : 'text-[#4298f5] border-black'
                } ${editMode ? 'cursor-pointer edit-highlight' : ''}`}
                onClick={() => {
                  if (editMode && (i < 3 || student?.hasAccessory)) {
                    setEditField({
                      field: gear.field,
                      label: i === 3 ? '愛用品Tier' : `装備${i + 1}Tier`,
                      value: gear.value === 'EMPTY' ? 0 : (gear.value as number),
                      min: 0,
                      max: 10,
                    })
                  }
                }}
              >
                {i === 3 && !student?.hasAccessory ? (
                  <span className="text-sm ml-1 mb-1">EMPTY</span>
                ) : (
                  <span className="text-sm ml-1 mb-1 border border-[#4298f5] rounded px-1 bg-white/80">T{gear.value}</span>
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
      {editField && (
        <EditValueModal
          label={editField.label}
          value={editField.value}
          min={editField.min}
          max={editField.max}
          onClose={() => setEditField(null)}
          onSave={async (v) => {
            await supabase
              .from('user_students')
              .update({ [editField.field]: v })
              .eq('user_id', session!.user.id)
              .eq('student_id', studentId)
            setEditField(null)
            loadData()
          }}
        />
      )}
      {editBonds && (
        <EditBondsModal
          bonds={{ [studentId]: data.bond, ...(data.alt_bonds || {}) }}
          students={students}
          onClose={() => setEditBonds(false)}
          onSave={async (vals) => {
            const main = vals[studentId] || 0
            await supabase
              .from('user_students')
              .update({ bond: main, alt_bonds: vals })
              .eq('user_id', session!.user.id)
              .eq('student_id', studentId)
            setEditBonds(false)
            loadData()
          }}
        />
      )}
    </>
  )
}
