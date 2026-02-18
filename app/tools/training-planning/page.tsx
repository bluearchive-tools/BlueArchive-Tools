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

type DetailSetting = {
  ownedEleph: number
  rate: number
  remaining: number
}

type PlanRow = {
  id: string
  studentId: string
  studentName: string
  current: TrainingStatus
  target: TrainingStatus
  detail: DetailSetting
}

const LS_KEY = 'training-planning.v2'

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

function parseJson(raw: string | null) {
  if (!raw) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function toNum(v: unknown, fallback: number) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function toInt(v: number) {
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0
}

function statusFromRow(row: Record<string, unknown>): Partial<TrainingStatus> {
  return {
    star: toNum(row.star, 1),
    uniqueStar: toNum(row.unique_star, 0),
    level: toNum(row.level, 1),
    bond: toNum(row.bond, 1),
    equip1: toNum(row.equip1, 1),
    equip2: toNum(row.equip2, 1),
    equip3: toNum(row.equip3, 1),
    exSkill: toNum(row.ex_skill, 1),
    normalSkill: toNum(row.normal_skill, 1),
    passiveSkill: toNum(row.passive_skill, 1),
    subSkill: toNum(row.sub_skill, 1),
  }
}

export default function TrainingPlanningPage() {
  const tHome = useTranslations('home')
  const t = useTranslations('common.trainingPlanning')
  const session = useSession()
  const supabase = useSupabaseClient()

  const [students, setStudents] = useState<Student[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addingStudentId, setAddingStudentId] = useState('')

  const editingPlan = useMemo(() => plans.find((p) => p.id === editingPlanId) ?? null, [plans, editingPlanId])

  const loadStudentStatus = useCallback(
    async (studentId: string): Promise<TrainingStatus> => {
      const apply = (row: Record<string, unknown>) => normalizeStatus(statusFromRow(row))

      if (session) {
        const { data } = await supabase
          .from('user_students')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('student_id', studentId)
          .maybeSingle()
        if (data && typeof data === 'object') return apply(data as Record<string, unknown>)
      }

      const raw = parseJson(localStorage.getItem(`userStudent:${studentId}`))
      if (raw && typeof raw === 'object') return apply(raw as Record<string, unknown>)

      return normalizeStatus({ star: 1, uniqueStar: 0, level: 1, bond: 1 })
    },
    [session, supabase]
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
        const rawPlans = Array.isArray(obj.plans) ? obj.plans : []
        const restored: PlanRow[] = rawPlans
          .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
          .map((v) => ({
            id: String(v.id ?? crypto.randomUUID()),
            studentId: String(v.studentId ?? ''),
            studentName: String(v.studentName ?? ''),
            current: normalizeStatus((v.current ?? {}) as Partial<TrainingStatus>),
            target: normalizeStatus((v.target ?? {}) as Partial<TrainingStatus>),
            detail: {
              ownedEleph: toInt(toNum((v.detail as Record<string, unknown> | undefined)?.ownedEleph, 0)),
              rate: Math.min(5, Math.max(1, toInt(toNum((v.detail as Record<string, unknown> | undefined)?.rate, 1)))),
              remaining: Math.min(200, Math.max(1, toInt(toNum((v.detail as Record<string, unknown> | undefined)?.remaining, 20)))),
            },
          }))
          .filter((v) => v.studentId)
        setPlans(restored)
      }
    }
    run()
  }, [])

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ plans }))
  }, [plans])

  const plansWithCalc = useMemo(
    () => plans.map((plan) => ({ ...plan, calc: calculateTrainingPlan(plan.current, plan.target) })),
    [plans]
  )

  const totals = useMemo(() => {
    let totalEleph = 0
    let totalDivine = 0
    for (const p of plansWithCalc) {
      const ex = calculateElephExchange({
        neededEleph: p.calc.star.requiredTotalEleph,
        ownedEleph: p.detail.ownedEleph,
        rate: p.detail.rate,
        remaining: p.detail.remaining,
      })
      totalEleph += p.calc.star.requiredTotalEleph
      totalDivine += ex.requiredDivine
    }
    return { totalEleph, totalDivine }
  }, [plansWithCalc])

  const updatePlan = (id: string, patch: Partial<PlanRow>) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const createPlan = async () => {
    if (!addingStudentId) return
    const student = students.find((s) => s.id === addingStudentId)
    if (!student) return

    const existing = plans.find((p) => p.studentId === addingStudentId)
    if (existing) {
      setEditingPlanId(existing.id)
      setAddOpen(false)
      return
    }

    const current = await loadStudentStatus(addingStudentId)
    const row: PlanRow = {
      id: crypto.randomUUID(),
      studentId: addingStudentId,
      studentName: student.name,
      current,
      target: current,
      detail: { ownedEleph: 0, rate: 1, remaining: 20 },
    }
    setPlans((prev) => [...prev, row])
    setEditingPlanId(row.id)
    setAddOpen(false)
  }

  const renderInputs = (
    status: TrainingStatus,
    onChange: (next: TrainingStatus) => void,
    readOnly = false
  ) => (
    <div className="grid grid-cols-2 gap-2 text-sm">
      {INPUT_ROWS.map((row) => (
        <label key={row.key} className="space-y-1 rounded border p-2 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-300">{t(`labels.${row.label}`)}</span>
          {readOnly ? (
            <p className="font-semibold">{status[row.key]}</p>
          ) : (
            <input
              type="number"
              min={row.min}
              max={row.max}
              value={status[row.key]}
              onChange={(e) => onChange(normalizeStatus({ ...status, [row.key]: Number(e.target.value) }))}
              className="w-full rounded border p-1 dark:border-gray-700 dark:bg-gray-800"
            />
          )}
        </label>
      ))}
    </div>
  )

  return (
    <main className="space-y-4 p-4">
      <div className="mb-2 flex items-center gap-2">
        <h1 className="text-lg font-bold">{tHome('sections.tools.actions.trainingPlanning.title')}</h1>
        <PageHelpButton pageKey="tools-training-planning" />
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300">{t('description')}</p>

      {!editingPlan ? (
        <>
          <section className="space-y-2 rounded border p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">{t('dashboardTitle')}</h2>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="rounded border px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                ＋ {t('addPlanButton')}
              </button>
            </div>
            <p className="text-sm">{t('multiPlanElephTotal', { value: totals.totalEleph })}</p>
            <p className="text-sm">{t('dashboardTotalDivine', { value: totals.totalDivine })}</p>
          </section>

          <section className="space-y-2">
            {plansWithCalc.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-300">{t('noPlan')}</p>
            ) : (
              plansWithCalc.map((plan) => (
                <div key={plan.id} className="flex items-center justify-between rounded border p-3 text-sm dark:border-gray-700">
                  <div>
                    <p className="font-semibold">{plan.studentName}</p>
                    <p>{t('totalElephRequired', { value: plan.calc.star.requiredTotalEleph })}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPlanId(plan.id)}
                      className="rounded border px-2 py-1 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      {t('editPlanButton')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlans((prev) => prev.filter((x) => x.id !== plan.id))}
                      className="rounded border px-2 py-1 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      {t('removePlanButton')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      ) : (
        editingPlan && (
          <>
            <section className="rounded border p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-bold">{editingPlan.studentName}</h2>
                <button
                  type="button"
                  onClick={() => setEditingPlanId(null)}
                  className="rounded border px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  {t('backToDashboard')}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section>
                  <h3 className="mb-2 font-semibold">{t('currentStatusTitle')}</h3>
                  {renderInputs(editingPlan.current, (next) => updatePlan(editingPlan.id, { current: next }))}
                </section>
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold">{t('targetStatusTitle')}</h3>
                    <button
                      type="button"
                      onClick={(e) => updatePlan(editingPlan.id, { target: maxTargetStatus(editingPlan.current, e.metaKey || e.ctrlKey) })}
                      className="rounded border px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      {t('setMaxButton')}
                    </button>
                  </div>
                  {renderInputs(editingPlan.target, (next) => updatePlan(editingPlan.id, { target: next }))}
                </section>
              </div>
            </section>

            <section className="space-y-3 rounded border p-4 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="text-base font-bold">{t('resultTitle')}</h2>
              {(() => {
                const calc = calculateTrainingPlan(editingPlan.current, editingPlan.target)
                return (
                  <>
                    <div className="rounded border p-3 text-sm dark:border-gray-700">
                      <h3 className="font-semibold">{t('sections.star')}</h3>
                      <p>{t('totalElephRequired', { value: calc.star.requiredTotalEleph })}</p>
                      <button
                        type="button"
                        onClick={() => setDetailOpen(true)}
                        className="mt-2 rounded border px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        {t('detailButton')}
                      </button>
                    </div>
                    <div className="rounded border p-3 text-sm dark:border-gray-700">
                      <h3 className="font-semibold">{t('sections.level')}</h3>
                      <p>{t('levelRequiredExp', { value: calc.level.requiredExp })}</p>
                    </div>
                    <div className="rounded border p-3 text-sm dark:border-gray-700">
                      <h3 className="font-semibold">{t('sections.bond')}</h3>
                      <p>{t('bondRequiredPoint', { value: calc.bond.requiredBondPoint })}</p>
                    </div>
                  </>
                )
              })()}
            </section>
          </>
        )
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded bg-white p-4 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{t('addPlanModalTitle')}</h3>
              <button type="button" onClick={() => setAddOpen(false)} className="rounded border px-2 py-1 text-xs">
                {t('close')}
              </button>
            </div>
            <StudentSelect students={students} value={addingStudentId} onChange={setAddingStudentId} />
            <div className="mt-3 text-right">
              <button type="button" onClick={createPlan} className="rounded border px-3 py-1 text-sm">
                {t('addPlanButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailOpen && editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded bg-white p-4 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">{t('detailModalTitle')}</h3>
              <button type="button" onClick={() => setDetailOpen(false)} className="rounded border px-2 py-1 text-xs">
                {t('close')}
              </button>
            </div>

            {(() => {
              const calc = calculateTrainingPlan(editingPlan.current, editingPlan.target)
              const ex = calculateElephExchange({
                neededEleph: calc.star.requiredTotalEleph,
                ownedEleph: editingPlan.detail.ownedEleph,
                rate: editingPlan.detail.rate,
                remaining: editingPlan.detail.remaining,
              })
              return (
                <div className="rounded border p-3 text-sm dark:border-gray-700">
                  <p className="mb-2 font-semibold">{editingPlan.studentName}</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <label className="space-y-1">
                      <span>{t('detailOwnedEleph')}</span>
                      <input
                        type="number"
                        min={0}
                        value={editingPlan.detail.ownedEleph}
                        onChange={(e) =>
                          updatePlan(editingPlan.id, {
                            detail: { ...editingPlan.detail, ownedEleph: toInt(Number(e.target.value)) },
                          })
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
                        value={editingPlan.detail.rate}
                        onChange={(e) =>
                          updatePlan(editingPlan.id, {
                            detail: {
                              ...editingPlan.detail,
                              rate: Math.min(5, Math.max(1, toInt(Number(e.target.value)))),
                            },
                          })
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
                        value={editingPlan.detail.remaining}
                        onChange={(e) =>
                          updatePlan(editingPlan.id, {
                            detail: {
                              ...editingPlan.detail,
                              remaining: Math.min(200, Math.max(1, toInt(Number(e.target.value)))),
                            },
                          })
                        }
                        className="w-full rounded border p-1 dark:border-gray-700 dark:bg-gray-800"
                      />
                    </label>
                  </div>
                  <div className="mt-2 space-y-1">
                    <p>{t('detailNeededEleph', { value: ex.totalNeededEleph })}</p>
                    <p>{t('detailOwnedUsedEleph', { value: ex.usableOwnedEleph })}</p>
                    <p>{t('detailExchangeNeededEleph', { value: ex.exchangeNeededEleph })}</p>
                    <p>{t('detailRequiredDivine', { value: ex.requiredDivine })}</p>
                    <p>{t('detailUnexchangeableEleph', { value: ex.unexchangeableEleph })}</p>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </main>
  )
}
