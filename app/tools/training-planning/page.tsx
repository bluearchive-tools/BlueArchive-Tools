'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useTranslations } from 'next-intl'
import StudentSelect from '../../../components/StudentSelect'
import PageHelpButton from '../../../components/PageHelpButton'
import {
  calculateElephExchange,
  calculateTrainingPlan,
  maxTargetStatus,
  normalizeStatus,
  type TrainingStatus,
} from '../../../lib/training-planning'

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

type PlanRow = {
  studentId: string
  studentName: string
  current: TrainingStatus
  target: TrainingStatus
}

type DetailSetting = {
  ownedEleph: number
  rate: number
  remaining: number
}

const LS_KEY = 'training-planning.v1'
const LS_SETTINGS_KEY = 'training-planning.detail-settings.v1'

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

function toNonNegInt(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function statusFromRow(row: Record<string, unknown>): Partial<TrainingStatus> {
  return {
    star: toNumber(row.star, 1),
    uniqueStar: toNumber(row.unique_star, 0),
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
  { key: 'uniqueStar', min: 0, max: 4, label: 'uniqueStar' },
  { key: 'level', min: 1, max: 90, label: 'level' },
  { key: 'bond', min: 1, max: 100, label: 'bond' },
  { key: 'equip1', min: 1, max: 70, label: 'equip1' },
  { key: 'equip2', min: 1, max: 70, label: 'equip2' },
  { key: 'equip3', min: 1, max: 70, label: 'equip3' },
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
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailSettings, setDetailSettings] = useState<Record<string, DetailSetting>>({})

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId),
    [students, selectedStudentId]
  )

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
        const obj = saved as Record<string, unknown>
        if (typeof obj.selectedStudentId === 'string') setSelectedStudentId(obj.selectedStudentId)
        if (Array.isArray(obj.plans)) {
          const nextPlans: PlanRow[] = obj.plans
            .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
            .map((item) => ({
              studentId: String(item.studentId ?? ''),
              studentName: String(item.studentName ?? ''),
              current: normalizeStatus((item.current ?? {}) as Partial<TrainingStatus>),
              target: normalizeStatus((item.target ?? {}) as Partial<TrainingStatus>),
            }))
            .filter((item) => item.studentId)
          setPlans(nextPlans)
        }
      } else if (list[0]?.id) {
        setSelectedStudentId(list[0].id)
      }

      const settingsRaw = parseJson(localStorage.getItem(LS_SETTINGS_KEY))
      if (settingsRaw && typeof settingsRaw === 'object') {
        const mapped: Record<string, DetailSetting> = {}
        for (const [k, v] of Object.entries(settingsRaw as Record<string, unknown>)) {
          if (!v || typeof v !== 'object') continue
          const o = v as Record<string, unknown>
          mapped[k] = {
            ownedEleph: toNonNegInt(toNumber(o.ownedEleph, 0)),
            rate: Math.min(5, Math.max(1, toNonNegInt(toNumber(o.rate, 1)))),
            remaining: toNonNegInt(toNumber(o.remaining, 20)),
          }
        }
        setDetailSettings(mapped)
      }
    }
    run()
  }, [])

  const loadStudentData = useCallback(async (studentId: string) => {
    if (!studentId) return

    const apply = (row: Record<string, unknown>) => {
      const current = normalizeStatus(statusFromRow(row))
      setCurrentStatus(current)
      setTargetStatus(current)
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

    const fallback = normalizeStatus({ star: 1, uniqueStar: 0, level: 1, bond: 1 })
    setCurrentStatus(fallback)
    setTargetStatus(fallback)
  }, [session, supabase])

  useEffect(() => {
    if (!selectedStudentId) return
    loadStudentData(selectedStudentId)
  }, [loadStudentData, selectedStudentId])

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ selectedStudentId, plans }))
  }, [selectedStudentId, plans])

  useEffect(() => {
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(detailSettings))
  }, [detailSettings])

  const currentCalc = useMemo(() => calculateTrainingPlan(currentStatus, targetStatus), [currentStatus, targetStatus])

  const plansWithCalc = useMemo(
    () => plans.map((plan) => ({ ...plan, calc: calculateTrainingPlan(plan.current, plan.target) })),
    [plans]
  )

  const totalElephNeeded = useMemo(
    () => plansWithCalc.reduce((sum, plan) => sum + plan.calc.star.requiredTotalEleph, 0),
    [plansWithCalc]
  )

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
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">{t('targetStatusTitle')}</h2>
            <button
              type="button"
              onClick={(e) => setTargetStatus(maxTargetStatus(currentStatus, e.metaKey || e.ctrlKey))}
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              {t('setMaxButton')}
            </button>
          </div>
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
          <p>{t('starRequired', { value: currentCalc.star.requiredEleph })}</p>
          <p>{t('uniqueStarRequired', { value: currentCalc.star.requiredUniqueEleph })}</p>
          <p>{t('totalElephRequired', { value: currentCalc.star.requiredTotalEleph })}</p>
        </div>

        <div className="rounded border p-3 text-sm dark:border-gray-700">
          <h3 className="font-semibold">{t('sections.level')}</h3>
          <p>{t('levelRequiredExp', { value: currentCalc.level.requiredExp })}</p>
        </div>

        <div className="rounded border p-3 text-sm dark:border-gray-700">
          <h3 className="font-semibold">{t('sections.bond')}</h3>
          <p>{t('bondRequiredPoint', { value: currentCalc.bond.requiredBondPoint })}</p>
        </div>

        <div className="rounded border p-3 text-sm dark:border-gray-700">
          <h3 className="font-semibold">{t('sections.skill')}</h3>
          <p>{t('skillRequiredExp', { value: currentCalc.skill.totalExp })}</p>
          <p>{t('materialsLine', { t1: currentCalc.skill.t1, t2: currentCalc.skill.t2, t3: currentCalc.skill.t3, t4: currentCalc.skill.t4 })}</p>
        </div>

        <div className="rounded border p-3 text-sm dark:border-gray-700">
          <h3 className="font-semibold">{t('sections.equipment')}</h3>
          <p>{t('equipRequiredExp', { value: currentCalc.equipment.totalExp })}</p>
          <p>{t('materialsLine', { t1: currentCalc.equipment.t1, t2: currentCalc.equipment.t2, t3: currentCalc.equipment.t3, t4: currentCalc.equipment.t4 })}</p>
        </div>
      </section>

      <section className="space-y-3 rounded border p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">{t('multiPlanTitle')}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (!selectedStudentId || !selectedStudent) return
                setPlans((prev) => {
                  const next = prev.filter((p) => p.studentId !== selectedStudentId)
                  next.push({
                    studentId: selectedStudentId,
                    studentName: selectedStudent.name,
                    current: currentStatus,
                    target: targetStatus,
                  })
                  return next
                })
              }}
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              {t('addPlanButton')}
            </button>
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              {t('detailButton')}
            </button>
          </div>
        </div>

        <p className="text-sm font-medium">{t('multiPlanElephTotal', { value: totalElephNeeded })}</p>

        {plansWithCalc.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-300">{t('noPlan')}</p>
        ) : (
          <ul className="space-y-2">
            {plansWithCalc.map((plan) => (
              <li key={plan.studentId} className="flex items-center justify-between rounded border p-2 text-sm dark:border-gray-700">
                <div>
                  <p className="font-medium">{plan.studentName}</p>
                  <p>{t('totalElephRequired', { value: plan.calc.star.requiredTotalEleph })}</p>
                </div>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  onClick={() => setPlans((prev) => prev.filter((p) => p.studentId !== plan.studentId))}
                >
                  {t('removePlanButton')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded bg-white p-4 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">{t('detailModalTitle')}</h3>
              <button type="button" onClick={() => setDetailOpen(false)} className="rounded border px-2 py-1 text-xs">
                {t('close')}
              </button>
            </div>

            <div className="space-y-3">
              {plansWithCalc.map((plan) => {
                const setting = detailSettings[plan.studentId] ?? { ownedEleph: 0, rate: 1, remaining: 20 }
                const exchange = calculateElephExchange({
                  neededEleph: plan.calc.star.requiredTotalEleph,
                  ownedEleph: setting.ownedEleph,
                  rate: setting.rate,
                  remaining: setting.remaining,
                })

                return (
                  <div key={plan.studentId} className="rounded border p-3 text-sm dark:border-gray-700">
                    <p className="mb-2 font-semibold">{plan.studentName}</p>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <label className="space-y-1">
                        <span>{t('detailOwnedEleph')}</span>
                        <input
                          type="number"
                          min={0}
                          value={setting.ownedEleph}
                          onChange={(e) =>
                            setDetailSettings((prev) => ({
                              ...prev,
                              [plan.studentId]: {
                                ...setting,
                                ownedEleph: toNonNegInt(Number(e.target.value)),
                              },
                            }))
                          }
                          className="w-full rounded border p-1 dark:border-gray-700 dark:bg-gray-800"
                        />
                      </label>
                      <label className="space-y-1">
                        <span>{t('detailRate')}</span>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={setting.rate}
                          onChange={(e) =>
                            setDetailSettings((prev) => ({
                              ...prev,
                              [plan.studentId]: {
                                ...setting,
                                rate: Math.min(5, Math.max(1, toNonNegInt(Number(e.target.value)))),
                              },
                            }))
                          }
                          className="w-full rounded border p-1 dark:border-gray-700 dark:bg-gray-800"
                        />
                      </label>
                      <label className="space-y-1">
                        <span>{t('detailRemaining')}</span>
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={setting.remaining}
                          onChange={(e) =>
                            setDetailSettings((prev) => ({
                              ...prev,
                              [plan.studentId]: {
                                ...setting,
                                remaining: Math.min(200, Math.max(1, toNonNegInt(Number(e.target.value)))),
                              },
                            }))
                          }
                          className="w-full rounded border p-1 dark:border-gray-700 dark:bg-gray-800"
                        />
                      </label>
                    </div>
                    <div className="mt-2 space-y-1">
                      <p>{t('detailNeededEleph', { value: exchange.totalNeededEleph })}</p>
                      <p>{t('detailOwnedUsedEleph', { value: exchange.usableOwnedEleph })}</p>
                      <p>{t('detailExchangeNeededEleph', { value: exchange.exchangeNeededEleph })}</p>
                      <p>{t('detailRequiredDivine', { value: exchange.requiredDivine })}</p>
                      <p>{t('detailUnexchangeableEleph', { value: exchange.unexchangeableEleph })}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
