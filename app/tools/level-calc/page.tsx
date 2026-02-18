'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import LevelCalcForm from '../../../components/LevelCalcForm'
import LevelCalcResult from '../../../components/LevelCalcResult'
import PageHelpButton from '../../../components/PageHelpButton'
import { LEVEL_MAX, calculateLevelPlan } from '../../../lib/level-calc'

const LS_LEVEL_CALC = 'level-calc.v1'

function clampLevel(value: number, fallback = 1) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(LEVEL_MAX, Math.max(1, Math.floor(value)))
}

function toNonNegativeInt(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function parseJson(raw: string | null) {
  if (!raw) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export default function LevelCalcPage() {
  const tHome = useTranslations('home')
  const t = useTranslations('common.levelCalc')

  const [currentLevel, setCurrentLevel] = useState(1)
  const [targetLevel, setTargetLevel] = useState(30)
  const [ownedMaterials, setOwnedMaterials] = useState<Record<string, number>>({
    reportT1: 0,
    reportT2: 0,
    reportT3: 0,
    reportT4: 0,
  })

  useEffect(() => {
    const parsed = parseJson(localStorage.getItem(LS_LEVEL_CALC))
    if (!parsed || typeof parsed !== 'object') return

    const data = parsed as Record<string, unknown>
    if (typeof data.currentLevel === 'number') setCurrentLevel(clampLevel(data.currentLevel, 1))
    if (typeof data.targetLevel === 'number') setTargetLevel(clampLevel(data.targetLevel, 30))
    setOwnedMaterials({
      reportT1: toNonNegativeInt(data.reportT1),
      reportT2: toNonNegativeInt(data.reportT2),
      reportT3: toNonNegativeInt(data.reportT3),
      reportT4: toNonNegativeInt(data.reportT4),
    })
  }, [])

  useEffect(() => {
    localStorage.setItem(
      LS_LEVEL_CALC,
      JSON.stringify({
        currentLevel: clampLevel(currentLevel, 1),
        targetLevel: clampLevel(targetLevel, 30),
        reportT1: toNonNegativeInt(ownedMaterials.reportT1),
        reportT2: toNonNegativeInt(ownedMaterials.reportT2),
        reportT3: toNonNegativeInt(ownedMaterials.reportT3),
        reportT4: toNonNegativeInt(ownedMaterials.reportT4),
      })
    )
  }, [currentLevel, ownedMaterials, targetLevel])

  const result = useMemo(
    () =>
      calculateLevelPlan({
        currentLevel: clampLevel(currentLevel, 1),
        targetLevel: clampLevel(targetLevel, 30),
        ownedMaterials: {
          reportT1: toNonNegativeInt(ownedMaterials.reportT1),
          reportT2: toNonNegativeInt(ownedMaterials.reportT2),
          reportT3: toNonNegativeInt(ownedMaterials.reportT3),
          reportT4: toNonNegativeInt(ownedMaterials.reportT4),
        },
      }),
    [currentLevel, ownedMaterials, targetLevel]
  )

  return (
    <main className="space-y-4 p-4">
      <div className="mb-2 flex items-center gap-2">
        <h1 className="text-lg font-bold">{tHome('sections.tools.actions.levelCalc.title')}</h1>
        <PageHelpButton pageKey="tools-level-calc" />
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300">{t('description')}</p>
      <LevelCalcForm
        currentLevel={currentLevel}
        targetLevel={targetLevel}
        ownedMaterials={ownedMaterials}
        onCurrentLevelChange={(value) => setCurrentLevel(clampLevel(value, 1))}
        onTargetLevelChange={(value) => setTargetLevel(clampLevel(value, 30))}
        onOwnedMaterialChange={(materialId, value) => {
          setOwnedMaterials((prev) => ({ ...prev, [materialId]: toNonNegativeInt(value) }))
        }}
      />
      <LevelCalcResult result={result} />
    </main>
  )
}
