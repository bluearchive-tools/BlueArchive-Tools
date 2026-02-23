'use client'

import { useEffect, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useTheme } from './ThemeProvider'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeart, faStar } from '@fortawesome/free-solid-svg-icons'
import EditValueModal from './EditValueModal'
import EditBondsModal from './EditBondsModal'
import SkillDetailModal from './SkillDetailModal'
import EquipmentDetailModal from './EquipmentDetailModal'
import UniqueWeaponDetailModal from './UniqueWeaponDetailModal'
import CalculationDetailModal from './CalculationDetailModal'
import { calculateStatFromBase, getStatCalculationFormula } from '../lib/student-status'

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

interface SkillEntry {
  label?: string
  skill: Skill
  related?: SkillEntry[]
}

type SkillDefinition = Skill | { variants: SkillEntry[] }

interface Student {
  id: string
  name: string
  image: string
  imageFull?: string
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
  hp?: number
  attack?: number
  defense?: number
  heal?: number
  range?: number
  skills?: Record<string, SkillDefinition>
  equipmentSlots?: Record<string, string[]>
  accessory?: { tiers: { tier: number; name: string; description: string }[] }
  uniqueWeapon?: UniqueWeapon
}

interface Skill {
  title: string
  text: string
  values: Record<string, number[]>
}

interface UniqueWeapon {
  name: string
  hp: number
  attack: number
  heal: number
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
  previewMax,
  previewMode,
  previewData,
  onPreviewChange,
}: {
  studentId: string
  editMode: boolean
  previewMax?: boolean
  previewMode?: boolean
  previewData?: UserStudent | null
  onPreviewChange?: (next: Partial<UserStudent>) => void
}) {

  const session = useSession()
  const supabase = useSupabaseClient()
  const { dark } = useTheme()
  const [data, setData] = useState<UserStudent | null>(null)
  const [dataId, setDataId] = useState<string | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [showBonds, setShowBonds] = useState(false)
  const [editField, setEditField] = useState<
    | { field: string; label: string; value: number; min?: number; max?: number }
    | null
  >(null)
  const [editBonds, setEditBonds] = useState(false)
  const [equipment, setEquipment] = useState<Record<string, { tiers: { tier: number; name: string; description: string }[] }>>({})
  const [skillDetail, setSkillDetail] = useState<{ entries: SkillEntry[]; level: number } | null>(null)
  const [gearDetail, setGearDetail] = useState<{ type: string; tier: number; equipment?: Record<string, { tiers: { tier: number; name: string; description: string }[] }> } | null>(null)
  const [calcDetail, setCalcDetail] = useState<{ label: string; formula: string; lines: string[] } | null>(null)
  const [uniqueWeaponDetail, setUniqueWeaponDetail] = useState<UniqueWeapon | null>(null)

  const getSkillEntries = (target?: SkillDefinition): SkillEntry[] => {
    if (!target) return []
    if ('variants' in target) return target.variants
    return [{ skill: target }]
  }
  useEffect(() => {
    const loadStudents = async () => {
      try {
        const res = await fetch('/api/students', {
  cache: 'no-store',
})

        if (res.ok) setStudents(await res.json())
      } catch {
        /* ignore */
      }
    }
    const loadEquip = async () => {
      try {
        const res = await fetch('/api/equipment')
        if (res.ok) setEquipment(await res.json())
      } catch {
        /* ignore */
      }
    }
    loadStudents()
    loadEquip()
  }, [])
  const loadData = async () => {
    const student = students.find((s) => s.id === studentId)
    const mainId = student?.styleOf || studentId
    if (session) {
      let { data } = await supabase
        .from('user_students')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('student_id', studentId)
        .maybeSingle()
      if (!data && mainId !== studentId) {
        const { data: alt } = await supabase
          .from('user_students')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('student_id', mainId)
          .maybeSingle()
        data = alt || null
      }
      if (data) {
        setData(data as UserStudent)
        setDataId(data.student_id as string)
      } else {
        setDataId(null)
      }
    } else {
      let local = localStorage.getItem(`userStudent:${studentId}`)
      if (!local && mainId !== studentId) {
        local = localStorage.getItem(`userStudent:${mainId}`)
      }
      if (local) {
        try {
          setData(JSON.parse(local) as UserStudent)
          setDataId(
            mainId !== studentId && !localStorage.getItem(`userStudent:${studentId}`)
              ? mainId
              : studentId
          )
        } catch {
          /* ignore */
        }
      } else {
        setData(null)
        setDataId(null)
      }
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, supabase, studentId, students])

  const student = students.find((s) => s.id === studentId)

  const baseId = student?.styleOf || studentId

  const isRegistered = !!data
  const canEditDirect = (editMode && isRegistered) || !!previewMode

  const placeholderMin: UserStudent = {
    level: 1,
    star: Math.max(1, Math.min(5, student?.initialStars || 1)),
    unique_star: 0,
    unique_level: 0,
    bond: 0,
    hp: 0,
    hp_wb: 0,
    attack: 0,
    attack_wb: 0,
    defense: 0,
    heal: 0,
    heal_wb: 0,
    ex_skill: 1,
    normal_skill: 1,
    passive_skill: 1,
    sub_skill: 1,
    equip1: 1,
    equip2: 1,
    equip3: 1,
    item_tier: 0,
  }

  const placeholderMax: UserStudent = {
    level: 90,
    star: 5,
    unique_star: 4,
    unique_level: 60,
    bond: 100,
    hp: 0,
    hp_wb: 25,
    attack: 0,
    attack_wb: 25,
    defense: 0,
    heal: 0,
    heal_wb: 25,
    ex_skill: 5,
    normal_skill: 10,
    passive_skill: 10,
    sub_skill: 10,
    equip1: 10,
    equip2: 10,
    equip3: 9,
    item_tier: 2,
  }

  const display = data || (previewMode ? (previewData || placeholderMin) : (previewMax ? placeholderMax : placeholderMin))

  const resolveUniqueWeaponStat = (field: 'hp' | 'attack' | 'heal') => {
    if (!student?.uniqueWeapon) return 0
    if (display.unique_star < 1 || display.unique_level <= 0) return 0
    const base = student.uniqueWeapon[field]
    if (!base || base <= 0) return 0
    return calculateStatFromBase({
      base,
      statType: field,
      level: display.unique_level,
      star: 1,
      initialStars: 1,
    })
  }

  const resolveAbilityReleaseBonus = (
    field: 'hp' | 'attack' | 'heal',
    starOneValue: number
  ) => {
    const wbLevelRaw =
      field === 'hp' ? display.hp_wb : field === 'attack' ? display.attack_wb : display.heal_wb
    const wbLevel = Math.max(0, Math.min(25, Math.floor(wbLevelRaw || 0)))
    if (display.star < 5 || wbLevel <= 0) return 0
    return Math.round(starOneValue * wbLevel * 0.002)
  }

  const getStatCalculationDetail = (field: 'hp' | 'attack' | 'defense' | 'heal') => {
    const labelMap = {
      hp: 'HP',
      attack: '攻撃力',
      defense: '防御力',
      heal: '治癒力',
    } as const
    const label = labelMap[field]
    const raw = display[field]

    if (raw > 0) {
      return {
        label,
        total: raw,
        formula: `手動入力値: ${raw}`,
        hoverFormula: `${raw}`,
        lines: ['手動入力された値をそのまま表示しています。'],
      }
    }

    if (!student) {
      return {
        label,
        total: 0,
        formula: '生徒データ未読み込み',
        hoverFormula: '-',
        lines: ['生徒データの取得後に計算式を確認できます。'],
      }
    }

    const base = student[field]
    if (!base || base <= 0) {
      return {
        label,
        total: 0,
        formula: '基礎値なし',
        hoverFormula: '-',
        lines: ['この項目の基礎値が未設定です。'],
      }
    }

    const studentStatFormula = getStatCalculationFormula({
      base,
      statType: field,
      level: display.level,
      range: student.range,
      star: display.star,
      initialStars: student.initialStars,
    })
    const studentValue = studentStatFormula.roundedValue

    if (field === 'defense') {
      return {
        label,
        total: studentValue,
        formula: `${studentStatFormula.formula} = ${studentValue}`,
        hoverFormula: studentStatFormula.formula,
        lines: [
          `生徒本体: ${studentStatFormula.formula} = ${studentValue}`,
          '防御力には能力解放/固有武器の加算はありません。',
        ],
      }
    }

    const starOneStatFormula = getStatCalculationFormula({
      base,
      statType: field,
      level: display.level,
      range: student.range,
      star: 1,
      initialStars: student.initialStars,
    })
    const starOneValue = starOneStatFormula.roundedValue
    const abilityReleaseBonus = resolveAbilityReleaseBonus(field, starOneValue)
    const uniqueWeaponBonus = resolveUniqueWeaponStat(field)
    const total = studentValue + abilityReleaseBonus + uniqueWeaponBonus

    const wbLevel =
      field === 'hp' ? display.hp_wb : field === 'attack' ? display.attack_wb : display.heal_wb

    return {
      label,
      total,
      formula: `${studentStatFormula.formula} + round(${starOneStatFormula.formula}*${wbLevel}*0.002) + ${uniqueWeaponBonus} = ${total}`,
      hoverFormula: `${studentStatFormula.formula}+${abilityReleaseBonus}+${uniqueWeaponBonus}=${total}`,
      lines: [
        `生徒本体: ${studentStatFormula.formula} = ${studentValue}`,
        `能力解放: round(${starOneStatFormula.formula}*${wbLevel}*0.002) = ${abilityReleaseBonus}`,
        `固有武器: ${uniqueWeaponBonus}`,
        `合計: ${studentValue} + ${abilityReleaseBonus} + ${uniqueWeaponBonus} = ${total}`,
      ],
    }
  }

  const hpCalc = getStatCalculationDetail('hp')
  const attackCalc = getStatCalculationDetail('attack')
  const defenseCalc = getStatCalculationDetail('defense')
  const healCalc = getStatCalculationDetail('heal')

  const renderStatValue = (calc: {
    label: string
    total: number
    formula: string
    hoverFormula: string
    lines: string[]
  }) => (
    <span
      onClick={(e) => {
        e.stopPropagation()
        setCalcDetail({ label: calc.label, formula: calc.formula, lines: calc.lines })
      }}
      className="relative inline-flex items-center group"
    >
      <span className="underline decoration-dotted cursor-help">{calc.total > 0 ? calc.total : '-'}</span>
      <span
        className={`pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-xs ${dark ? 'bg-gray-900 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-300'} opacity-0 shadow transition-opacity group-hover:opacity-100`}
      >
        {calc.hoverFormula}
      </span>
    </span>
  )

  const bondEntries = Object.entries(
    (isRegistered ? data.alt_bonds ?? { [baseId]: data.bond } : { [baseId]: display.bond })
  )

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="relative h-[calc(100vh-130px)] flex items-center justify-center">
          {student && (
            <img
    src={student.imageFull || student.image}
    alt={student.name}
    className="h-full w-auto object-contain"
  />
        )}
        <div className="absolute inset-0 flex flex-col justify-end text-white p-2 space-y-1">
          <div className="flex flex-wrap gap-1 items-center bg-[#114073] bg-opacity-90 px-1">
            <button
              type="button"
              onClick={() => {
                if (editMode && isRegistered) {
                  setEditBonds(true)
                } else {
                  setShowBonds(true)
                }
              }}
              className={`relative text-pink-300${editMode && isRegistered ? ' edit-highlight' : ''}`}
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
                {display.bond}
              </span>
            </button>
            <span className="flex-1 text-left text-2xl">{student?.name}</span>
            <span className="flex items-center -space-x-1 justify-end">
              {Array.from({ length: display.star }).map((_, i) => (
                <FontAwesomeIcon key={i} icon={faStar} className="text-yellow-400" />
              ))}
            </span>
            <span
              className={`bg-white px-1 italic ${student?.role === 'STRIKER' ? 'text-red-500' : 'text-blue-500'}`}
            >
              {student?.role}
            </span>
          </div>
          <div
            className={`bg-[#114073] bg-opacity-90 px-1 inline-block w-20 text-center${
              canEditDirect ? ' edit-highlight cursor-pointer' : ''
            }`}
            onClick={() => {
              if (canEditDirect) {
                setEditField({
                  field: 'level',
                  label: 'レベル',
                  value: display.level,
                  min: 1,
                  max: 90,
                })
              }
            }}
          >
            Lv. {display.level}
          </div>
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
                canEditDirect && setEditField({ field: 'hp', label: 'HP', value: display.hp })
              }
              className={`cursor-pointer${canEditDirect ? ' edit-highlight' : ''}`}
            >
              HP {renderStatValue(hpCalc)}{' '}
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  if (canEditDirect) {
                    setEditField({ field: 'hp_wb', label: 'HPWB', value: display.hp_wb, min: 0, max: 25 })
                  }
                }}
                className={`bg-[#114073] px-1 text-white relative inline-block ml-1${
                  display.hp_wb >= 25 ? ' text-yellow-400' : ''
                }`}
              >
                Lv.{display.hp_wb}
                {display.hp_wb >= 25 && (
                  <span className="absolute -top-1 right-0 text-[10px] max-gradient">MAX</span>
                )}
              </span>
            </div>
            <div
              onClick={() =>
                canEditDirect && setEditField({ field: 'attack', label: '攻撃力', value: display.attack })
              }
              className={`cursor-pointer${canEditDirect ? ' edit-highlight' : ''}`}
            >
              攻撃力 {renderStatValue(attackCalc)}{' '}
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  if (canEditDirect) {
                    setEditField({
                      field: 'attack_wb',
                      label: '攻撃力WB',
                      value: display.attack_wb,
                      min: 0,
                      max: 25,
                    })
                  }
                }}
                className={`bg-[#114073] px-1 text-white relative inline-block ml-1${
                  display.attack_wb >= 25 ? ' text-yellow-400' : ''
                }`}
              >
                Lv.{display.attack_wb}
                {display.attack_wb >= 25 && (
                  <span className="absolute -top-1 right-0 text-[10px] max-gradient">MAX</span>
                )}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 pt-1">
            <div
              onClick={() =>
                canEditDirect && setEditField({ field: 'defense', label: '防御力', value: display.defense })
              }
              className={`cursor-pointer${canEditDirect ? ' edit-highlight' : ''}`}
            >
              防御力 {renderStatValue(defenseCalc)}
            </div>
            <div
              onClick={() =>
                canEditDirect && setEditField({ field: 'heal', label: '治癒力', value: display.heal })
              }
              className={`cursor-pointer${canEditDirect ? ' edit-highlight' : ''}`}
            >
              治癒力 {renderStatValue(healCalc)}{' '}
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  if (canEditDirect) {
                    setEditField({
                      field: 'heal_wb',
                      label: '治癒力WB',
                      value: display.heal_wb,
                      min: 0,
                      max: 25,
                    })
                  }
                }}
                className={`bg-[#114073] px-1 text-white relative inline-block ml-1${
                  display.heal_wb >= 25 ? ' text-yellow-400' : ''
                }`}
              >
                Lv.{display.heal_wb}
                {display.heal_wb >= 25 && (
                  <span className="absolute -top-1 right-0 text-[10px] max-gradient">MAX</span>
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1 text-center">
          {[
            { label: 'EXスキル', value: display.ex_skill, field: 'ex_skill', key: 'ex', ex: true, max: 5 },
            { label: display.item_tier >= 2 && student?.hasAccessory ? 'ノーマルスキル+' : 'ノーマルスキル', value: display.normal_skill, field: 'normal_skill', key: 'normal', max: 10 },
            { label: display.unique_star >= 2  ? "パッシブスキル+" : "パッシブスキル", value: display.passive_skill, field: "passive_skill", key: 'passive', max: 10 },
            { label: 'サブスキル', value: display.sub_skill, field: 'sub_skill', key: 'sub', max: 10 },
          ].map((skill, i) => (
            <div key={i} className="skew-x-12">
              <div
                className={`-skew-x-12 border rounded-md flex flex-col items-center justify-between h-28 w-full p-1 cursor-pointer${canEditDirect ? ' edit-highlight' : ''}`}
                onClick={() => {
                  if (canEditDirect) {
                    setEditField({
                      field: skill.field,
                      label: skill.label,
                      value: skill.value,
                      min: 1,
                      max: skill.max,
                    })
                  } else if (student) {
                    let key = skill.key
                    if (skill.key === 'normal' && display.item_tier >= 2) key = 'normalPlus'
                    if (skill.key === 'passive' && display.unique_star >= 2) key = 'passivePlus'
                    const sk = student.skills?.[key] || student.skills?.[skill.key]
                    const entries = getSkillEntries(sk)
                    if (entries.length > 0) setSkillDetail({ entries, level: skill.value })
                  }
                }}
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
              className={`-skew-x-12 border rounded-md flex flex-col items-center justify-between h-28 w-full p-1 space-y-1 cursor-pointer${canEditDirect ? ' edit-highlight' : ''}`}
              onClick={() => {
                if (canEditDirect) {
                  setEditField({ field: 'unique_level', label: '固有武器Lv', value: display.unique_level, min: 0, max: 60 })
                } else if (student?.uniqueWeapon) {
                  setUniqueWeaponDetail(student.uniqueWeapon)
                }
              }}
            >
              <span className="text-sm">固有武器</span>
              <span>Lv. {display.unique_level}</span>
              <div
                className={`space-x-px${canEditDirect ? ' edit-highlight cursor-pointer' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  if (canEditDirect) {
                    setEditField({ field: 'unique_star', label: '固有武器星', value: display.unique_star, min: 0, max: 4 })
                  }
                }}
              >
                {Array.from({ length: display.unique_star }).map((_, i) => (
                  <FontAwesomeIcon key={i} icon={faStar} className="text-sky-400" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1 text-center">
          {[
            { value: display.equip1, field: 'equip1', slot: 'slot1' },
            { value: display.equip2, field: 'equip2', slot: 'slot2' },
            { value: display.equip3, field: 'equip3', slot: 'slot3' },
            { value: student?.hasAccessory ? display.item_tier : 'EMPTY', field: 'item_tier', slot: 'accessory' },
          ].map((gear, i) => (
            <div key={i} className="skew-x-12">
              <div
                className={`-skew-x-12 rounded-lg border relative w-full aspect-square flex items-end justify-start ${
                  i === 3 && !student?.hasAccessory ? 'bg-gray-300 text-gray-500 border-black' : 'text-[#4298f5] border-black'
                } ${canEditDirect ? 'cursor-pointer edit-highlight' : ''}`}
                onClick={() => {
                  if (canEditDirect && (i < 3 || student?.hasAccessory)) {
                    setEditField({
                      field: gear.field,
                      label: i === 3 ? '愛用品Tier' : `装備${i + 1}Tier`,
                      value: gear.value === 'EMPTY' ? 0 : (gear.value as number),
                      min: 0,
                      max: 10,
                    })
                  } else if (!editMode && gear.value !== 'EMPTY' && student) {
                    if (gear.slot === 'accessory' && student.accessory) {
                      setGearDetail({
                        type: 'accessory',
                        tier: gear.value as number,
                        equipment: { accessory: student.accessory },
                      })
                    } else {
                      const types = student.equipmentSlots?.[gear.slot]
                      if (types && types.length) {
                        setGearDetail({ type: types[0], tier: gear.value as number })
                      }
                    }
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
            if (previewMode && !isRegistered) {
              onPreviewChange?.({ [editField.field]: v } as Partial<UserStudent>)
              setEditField(null)
              return
            }
            if (session) {
              await supabase
                .from('user_students')
                .update({ [editField.field]: v })
                .eq('user_id', session.user.id)
                .eq('student_id', dataId ?? baseId)
              setEditField(null)
              loadData()
            } else {
              const key = `userStudent:${dataId ?? baseId}`
              const local = localStorage.getItem(key)
              const obj: UserStudent = local ? JSON.parse(local) : { ...placeholderMin }
              const newObj = { ...obj, [editField.field]: v }
              localStorage.setItem(key, JSON.stringify(newObj))
              setEditField(null)
              setData(newObj)
            }
          }}
        />
      )}
      {editBonds && (
        <EditBondsModal
          bonds={{ [baseId]: display.bond, ...(data?.alt_bonds || {}) }}
          students={students}
          onClose={() => setEditBonds(false)}
          onSave={async (vals) => {
            const main = vals[baseId] || 0
            if (session) {
              await supabase
                .from('user_students')
                .update({ bond: main, alt_bonds: vals })
                .eq('user_id', session.user.id)
                .eq('student_id', dataId ?? baseId)
              setEditBonds(false)
              loadData()
            } else {
              const key = `userStudent:${dataId ?? baseId}`
              const local = localStorage.getItem(key)
              const obj: UserStudent = local ? JSON.parse(local) : { ...placeholderMin }
              const newObj = { ...obj, bond: main, alt_bonds: vals }
              localStorage.setItem(key, JSON.stringify(newObj))
              setEditBonds(false)
              setData(newObj)
            }
          }}
        />
      )}

      {calcDetail && (
        <CalculationDetailModal
          label={calcDetail.label}
          formula={calcDetail.formula}
          lines={calcDetail.lines}
          onClose={() => setCalcDetail(null)}
        />
      )}

      {skillDetail && (
        <SkillDetailModal
          entries={skillDetail.entries}
          level={skillDetail.level}
          onClose={() => setSkillDetail(null)}
        />
      )}
      {uniqueWeaponDetail && (
        <UniqueWeaponDetailModal
          weapon={uniqueWeaponDetail}
          level={display.unique_level}
          onClose={() => setUniqueWeaponDetail(null)}
        />
      )}

      {gearDetail && (
        <EquipmentDetailModal
          type={gearDetail.type}
          tier={gearDetail.tier}
          equipment={gearDetail.equipment || equipment}
          onClose={() => setGearDetail(null)}
        />
      )}
    </>
  )
}
