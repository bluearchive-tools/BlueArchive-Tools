'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useTranslations } from 'next-intl'
import StudentSelect from '../../../components/StudentSelect'
import PageHelpButton from '../../../components/PageHelpButton'
import { calculateTrainingPlan, normalizeStatus, type TrainingStatus } from '../../../lib/training-planning'

type Student = {
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
}

const LS_KEY = 'training-planning.v1'

function parseJson(raw: string | null) {
  if (!raw) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function toNumber(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return value
}

function statusFromRow(row: Record<string, unknown>): Partial<TrainingStatus> {
  return {
    star: toNumber(row.star, 1),
    level: toNumber(row.level, 1),
    bond: toNumber(row.bond, 1),
    equip1: toNumber(row.equip1, 1),
    equip2: toNumber(row.equip2, 1),
    equip3: toNumber(row.equip3, 1),
    exSkill: toNumber(row.ex_skill, 1),
    normalSkill: toNumber(row.normal_skill, 1),
    passiveSkill: toNumber(row.passive_skill, 1),
    subSkill: toNumber(row.sub_skill, 1),
  }
}

const INPUT_ROWS: Array<{ key: keyof TrainingStatus; min: number; max: number; label: string }> = [
  { key: 'star', min: 1, max: 5, label: 'star' },
  { key: 'level', min: 1, max: 90, label: 'level' },
  { key: 'bond', min: 1, max: 100, label: 'bond' },
  { key: 'equip1', min: 1, max: 10, label: 'equip1' },
  { key: 'equip2', min: 1, max: 10, label: 'equip2' },
  { key: 'equip3', min: 1, max: 10, label: 'equip3' },
  { key: 'exSkill', min: 1, max: 5, label: 'exSkill' },
  { key: 'normalSkill', min: 1, max: 10, label: 'normalSkill' },
  { key: 'passiveSkill', min: 1, max: 10, label: 'passiveSkill' },
  { key: 'subSkill', min: 1, max: 10, label: 'subSkill' },
]

export default function TrainingPlanningPage() {
  const tHome = useTranslations('home')
  const t = useTranslations('common.trainingPlanning')
  const session = useSession()
  const supabase = useSupabaseClient()

  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [currentStatus, setCurrentStatus] = useState<TrainingStatus>(normalizeStatus({}))
  const [targetStatus, setTargetStatus] = useState<TrainingStatus>(normalizeStatus({ level: 30, bond: 20 }))

  useEffect(() => {
    const run = async () => {
      const res = await fetch('/api/students')
      if (!res.ok) return
      const json: unknown = await res.json()
      if (!Array.isArray(json)) return
      const list: Student[] = json.map((s) => ({
        id: String(s.id ?? ''),
        name: String(s.name ?? ''),
        image: typeof s.image === 'string' ? s.image : '',
        imageFull: typeof s.imageFull === 'string' ? s.imageFull : undefined,
        attackType: typeof s.attackType === 'string' ? s.attackType : '',
        defenseType: typeof s.defenseType === 'string' ? s.defenseType : '',
        hasAccessory: typeof s.hasAccessory === 'boolean' ? s.hasAccessory : undefined,
        styleIds: Array.isArray(s.styleIds) ? (s.styleIds as string[]) : undefined,
        styleOf: typeof s.styleOf === 'string' ? s.styleOf : undefined,
        altIds: Array.isArray(s.altIds) ? (s.altIds as string[]) : undefined,
        altOf: typeof s.altOf === 'string' ? s.altOf : undefined,
        initialStars: typeof s.initialStars === 'number' ? s.initialStars : 1,
        role: typeof s.role === 'string' ? s.role : '',
        characterType: typeof s.characterType === 'string' ? s.characterType : '',
        position: typeof s.position === 'string' ? s.position : '',
      }))
      setStudents(list)
      const saved = parseJson(localStorage.getItem(LS_KEY))
      if (saved && typeof saved === 'object') {
        const id = (saved as Record<string, unknown>).selectedStudentId
        if (typeof id === 'string') setSelectedStudentId(id)
      } else if (list[0]?.id) {
        setSelectedStudentId(list[0].id)
      }
    }
    run()
  }, [])

  const loadStudentData = useCallback(async (studentId: string) => {
    if (!studentId) return

    const apply = (row: Record<string, unknown>) => {
      const current = normalizeStatus(statusFromRow(row))
      setCurrentStatus(current)

      const saved = parseJson(localStorage.getItem(`${LS_KEY}:${studentId}`))
      if (saved && typeof saved === 'object') {
        setTargetStatus(normalizeStatus(saved as Partial<TrainingStatus>))
      } else {
        setTargetStatus(current)
      }
    }

    if (session) {
      const { data } = await supabase
        .from('user_students')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('student_id', studentId)
        .maybeSingle()
      if (data && typeof data === 'object') {
        apply(data as Record<string, unknown>)
        return
      }
    }

    const raw = parseJson(localStorage.getItem(`userStudent:${studentId}`))
    if (raw && typeof raw === 'object') {
      apply(raw as Record<string, unknown>)
      return
    }

    const fallback = normalizeStatus({ star: 1, level: 1, bond: 1 })
    setCurrentStatus(fallback)
    setTargetStatus(fallback)
  }, [session, supabase])

  useEffect(() => {
    if (!selectedStudentId) return
    localStorage.setItem(LS_KEY, JSON.stringify({ selectedStudentId }))
    loadStudentData(selectedStudentId)
  }, [loadStudentData, selectedStudentId])

  useEffect(() => {
    if (!selectedStudentId) return
    localStorage.setItem(`${LS_KEY}:${selectedStudentId}`, JSON.stringify(targetStatus))
  }, [selectedStudentId, targetStatus])

  const result = useMemo(() => calculateTrainingPlan(currentStatus, targetStatus), [currentStatus, targetStatus])

  return (
    <main className="space-y-4 p-4">
      <div className="mb-2 flex items-center gap-2">
        <h1 className="text-lg font-bold">{tHome('sections.tools.actions.trainingPlanning.title')}</h1>
        <PageHelpButton pageKey="tools-training-planning" />
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300">{t('description')}</p>

      <div className="space-y-2 rounded border p-4 dark:border-gray-700 dark:bg-gray-900">
        <label className="text-sm font-medium">{t('studentLabel')}</label>
        <StudentSelect students={students} value={selectedStudentId} onChange={setSelectedStudentId} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded border p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-3 text-base font-bold">{t('currentStatusTitle')}</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {INPUT_ROWS.map((row) => (
              <div key={row.key} className="rounded border p-2 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-300">{t(`labels.${row.label}`)}</p>
                <p className="font-semibold">{currentStatus[row.key]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded border p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-3 text-base font-bold">{t('targetStatusTitle')}</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {INPUT_ROWS.map((row) => (
              <label key={row.key} className="space-y-1 rounded border p-2 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-300">{t(`labels.${row.label}`)}</span>
                <input
                  type="number"
                  min={row.min}
                  max={row.max}
                  value={targetStatus[row.key]}
                  onChange={(e) => {
                    const next = normalizeStatus({ ...targetStatus, [row.key]: Number(e.target.value) })
                    setTargetStatus(next)
                  }}
                  className="w-full rounded border p-1 dark:border-gray-700 dark:bg-gray-800"
                />
              </label>
            ))}
          </div>
        </section>
      </div>

      <section className="space-y-3 rounded border p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-base font-bold">{t('resultTitle')}</h2>

        <div className="rounded border p-3 text-sm dark:border-gray-700">
          <h3 className="font-semibold">{t('sections.star')}</h3>
          <p>{t('starRequired', { value: result.star.requiredEleph })}</p>
        </div>

        <div className="rounded border p-3 text-sm dark:border-gray-700">
          <h3 className="font-semibold">{t('sections.level')}</h3>
          <p>{t('levelRequiredExp', { value: result.level.requiredExp })}</p>
          <p>{t('levelRuns', { value: result.level.bestRunPlan?.runs ?? 0, stage: result.level.bestRunPlan?.stage ?? '-' })}</p>
        </div>

        <div className="rounded border p-3 text-sm dark:border-gray-700">
          <h3 className="font-semibold">{t('sections.bond')}</h3>
          <p>{t('bondRequiredPoint', { value: result.bond.requiredBondPoint })}</p>
          <p>{t('bondRuns', { value: result.bond.bestRunPlan?.runs ?? 0, stage: result.bond.bestRunPlan?.stage ?? '-' })}</p>
        </div>

        <div className="rounded border p-3 text-sm dark:border-gray-700">
          <h3 className="font-semibold">{t('sections.skill')}</h3>
          <p>{t('skillRequiredExp', { value: result.skill.totalExp })}</p>
          <p>{t('materialsLine', { t1: result.skill.t1, t2: result.skill.t2, t3: result.skill.t3, t4: result.skill.t4 })}</p>
        </div>

        <div className="rounded border p-3 text-sm dark:border-gray-700">
          <h3 className="font-semibold">{t('sections.equipment')}</h3>
          <p>{t('equipRequiredExp', { value: result.equipment.totalExp })}</p>
          <p>{t('materialsLine', { t1: result.equipment.t1, t2: result.equipment.t2, t3: result.equipment.t3, t4: result.equipment.t4 })}</p>
        </div>
      </section>
    </main>
  )
}
