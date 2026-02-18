'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useTranslations } from 'next-intl'
import BondCalcForm from '../../../components/BondCalcForm'
import BondCalcResult from '../../../components/BondCalcResult'
import PageHelpButton from '../../../components/PageHelpButton'
import { BOND_MAX_LEVEL, calculateBondPlan } from '../../../lib/bond-calc'

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
  exHitDelay?: number
  normalHitDelay?: number
}

const LS_GLOBAL = 'bond-calc.global.v1'
const LS_OWNED_PREFIX = 'bond-calc.owned.v1:'

function toNonNegativeInt(value: unknown, fallback = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.floor(value))
}

function clampBondLevel(value: number, fallback = 1) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(BOND_MAX_LEVEL, Math.max(1, Math.floor(value)))
}

function parseJson(raw: string | null) {
  if (!raw) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export default function BondCalcPage() {
  const tHome = useTranslations('home')
  const t = useTranslations('common.bondCalc')
  const session = useSession()
  const supabase = useSupabaseClient()

  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [currentBond, setCurrentBond] = useState<number>(1)
  const [targetBond, setTargetBond] = useState<number>(20)
  const [ownedMaterials, setOwnedMaterials] = useState<Record<string, number>>({
    basic: 0,
    advanced: 0,
    premium: 0,
  })

  useEffect(() => {
    const loadStudents = async () => {
      const res = await fetch('/api/students')
      if (!res.ok) return

      const json: unknown = await res.json()
      if (!Array.isArray(json)) return

      const list = json.map((item) => ({
        id: String(item.id ?? ''),
        name: String(item.name ?? ''),
        image: typeof item.image === 'string' ? item.image : '',
        imageFull: typeof item.imageFull === 'string' ? item.imageFull : undefined,
        attackType: typeof item.attackType === 'string' ? item.attackType : '',
        defenseType: typeof item.defenseType === 'string' ? item.defenseType : '',
        hasAccessory: typeof item.hasAccessory === 'boolean' ? item.hasAccessory : undefined,
        styleIds: Array.isArray(item.styleIds) ? (item.styleIds as string[]) : undefined,
        styleOf: typeof item.styleOf === 'string' ? item.styleOf : undefined,
        altIds: Array.isArray(item.altIds) ? (item.altIds as string[]) : undefined,
        altOf: typeof item.altOf === 'string' ? item.altOf : undefined,
        initialStars:
          typeof item.initialStars === 'number' && Number.isFinite(item.initialStars) ? item.initialStars : 1,
        role: typeof item.role === 'string' ? item.role : '',
        characterType: typeof item.characterType === 'string' ? item.characterType : '',
        position: typeof item.position === 'string' ? item.position : '',
        exHitDelay: typeof item.exHitDelay === 'number' && Number.isFinite(item.exHitDelay) ? item.exHitDelay : undefined,
        normalHitDelay:
          typeof item.normalHitDelay === 'number' && Number.isFinite(item.normalHitDelay) ? item.normalHitDelay : undefined,
      }))

      setStudents(list)
      if (list.length > 0 && !selectedStudentId) {
        setSelectedStudentId(list[0].id)
      }
    }

    loadStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const parsed = parseJson(localStorage.getItem(LS_GLOBAL))
    if (!parsed || typeof parsed !== 'object') return
    const state = parsed as { selectedStudentId?: unknown; targetBond?: unknown }
    if (typeof state.selectedStudentId === 'string') setSelectedStudentId(state.selectedStudentId)
    if (typeof state.targetBond === 'number') setTargetBond(clampBondLevel(state.targetBond, 20))
  }, [])

  useEffect(() => {
    localStorage.setItem(
      LS_GLOBAL,
      JSON.stringify({
        selectedStudentId,
        targetBond: clampBondLevel(targetBond, 20),
      })
    )
  }, [selectedStudentId, targetBond])

  const loadCurrentBond = useCallback(
    async (studentId: string) => {
      if (!studentId) return

      const applyBondValue = (row: Record<string, unknown>) => {
        if (typeof row.bond === 'number' && Number.isFinite(row.bond)) {
          setCurrentBond(clampBondLevel(row.bond, 1))
        }
      }

      if (session) {
        const { data } = await supabase
          .from('user_students')
          .select('bond')
          .eq('user_id', session.user.id)
          .eq('student_id', studentId)
          .maybeSingle()

        if (data && typeof data === 'object') {
          applyBondValue(data as Record<string, unknown>)
          return
        }
      }

      const raw = localStorage.getItem(`userStudent:${studentId}`)
      const parsed = parseJson(raw)
      if (parsed && typeof parsed === 'object') {
        applyBondValue(parsed as Record<string, unknown>)
      }
    },
    [session, supabase]
  )

  useEffect(() => {
    if (!selectedStudentId) return

    loadCurrentBond(selectedStudentId)

    const parsed = parseJson(localStorage.getItem(LS_OWNED_PREFIX + selectedStudentId))
    if (parsed && typeof parsed === 'object') {
      const o = parsed as Record<string, unknown>
      setOwnedMaterials({
        basic: toNonNegativeInt(o.basic),
        advanced: toNonNegativeInt(o.advanced),
        premium: toNonNegativeInt(o.premium),
      })
      return
    }

    setOwnedMaterials({ basic: 0, advanced: 0, premium: 0 })
  }, [selectedStudentId, loadCurrentBond])

  useEffect(() => {
    if (!selectedStudentId) return
    localStorage.setItem(
      LS_OWNED_PREFIX + selectedStudentId,
      JSON.stringify({
        basic: toNonNegativeInt(ownedMaterials.basic),
        advanced: toNonNegativeInt(ownedMaterials.advanced),
        premium: toNonNegativeInt(ownedMaterials.premium),
      })
    )
  }, [selectedStudentId, ownedMaterials])

  const result = useMemo(
    () =>
      calculateBondPlan({
        currentBond: clampBondLevel(currentBond, 1),
        targetBond: clampBondLevel(targetBond, 20),
        ownedMaterials: {
          basic: toNonNegativeInt(ownedMaterials.basic),
          advanced: toNonNegativeInt(ownedMaterials.advanced),
          premium: toNonNegativeInt(ownedMaterials.premium),
        },
      }),
    [currentBond, ownedMaterials, targetBond]
  )

  return (
    <main className="space-y-4 p-4">
      <div className="mb-2 flex items-center gap-2">
        <h1 className="text-lg font-bold">{tHome('sections.tools.actions.bondCalc.title')}</h1>
        <PageHelpButton pageKey="tools-bond-calc" />
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300">{t('description')}</p>

      <BondCalcForm
        students={students}
        selectedStudentId={selectedStudentId}
        onStudentChange={setSelectedStudentId}
        currentBond={currentBond}
        targetBond={targetBond}
        ownedMaterials={ownedMaterials}
        onCurrentBondChange={(value) => setCurrentBond(clampBondLevel(value, 1))}
        onTargetBondChange={(value) => setTargetBond(clampBondLevel(value, 20))}
        onOwnedMaterialChange={(materialId, value) => {
          setOwnedMaterials((prev) => ({ ...prev, [materialId]: toNonNegativeInt(value) }))
        }}
      />

      <BondCalcResult result={result} />
    </main>
  )
}
