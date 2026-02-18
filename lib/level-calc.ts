export const LEVEL_MAX = 90

export type LevelMaterial = {
  id: 'reportT1' | 'reportT2' | 'reportT3' | 'reportT4'
  labelKey: string
  exp: number
  recommendedStage: string
  perRunDrop: number
}

export type LevelCalcInput = {
  currentLevel: number
  targetLevel: number
  ownedMaterials?: Partial<Record<LevelMaterial['id'], number>>
}

export type LevelCalcResult = {
  requiredExp: number
  ownedExp: number
  shortageExp: number
  materials: Array<{
    material: LevelMaterial
    requiredCount: number
    ownedCount: number
    shortageCount: number
  }>
  runPlans: Array<{
    materialId: LevelMaterial['id']
    stage: string
    runs: number
  }>
  bestRunPlan: {
    materialId: LevelMaterial['id']
    stage: string
    runs: number
  } | null
}

const LEVEL_EXP_TABLE = Array.from({ length: LEVEL_MAX + 1 }, (_, level) => {
  if (level <= 1) return 0
  return Math.floor(35 * level + 22 * Math.pow(level, 1.22))
})

export const LEVEL_MATERIALS: LevelMaterial[] = [
  { id: 'reportT1', labelKey: 'materials.reportT1', exp: 50, recommendedStage: 'L-1', perRunDrop: 6 },
  { id: 'reportT2', labelKey: 'materials.reportT2', exp: 200, recommendedStage: 'L-2', perRunDrop: 5 },
  { id: 'reportT3', labelKey: 'materials.reportT3', exp: 1000, recommendedStage: 'L-3', perRunDrop: 4 },
  { id: 'reportT4', labelKey: 'materials.reportT4', exp: 5000, recommendedStage: 'L-4', perRunDrop: 3 },
]

function clampLevel(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(LEVEL_MAX, Math.max(1, Math.floor(value)))
}

function toNonNegativeInt(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function getRequiredExp(currentLevel: number, targetLevel: number) {
  const from = clampLevel(currentLevel)
  const to = clampLevel(targetLevel)
  if (to <= from) return 0

  let total = 0
  for (let level = from; level < to; level++) {
    total += LEVEL_EXP_TABLE[level + 1]
  }
  return total
}

export function calculateLevelPlan(input: LevelCalcInput): LevelCalcResult {
  const requiredExp = getRequiredExp(input.currentLevel, input.targetLevel)
  const ownedMap = input.ownedMaterials ?? {}

  const ownedExp = LEVEL_MATERIALS.reduce((sum, material) => {
    return sum + toNonNegativeInt(ownedMap[material.id]) * material.exp
  }, 0)

  const shortageExp = Math.max(0, requiredExp - ownedExp)

  const materials = LEVEL_MATERIALS.map((material) => {
    const requiredCount = Math.ceil(requiredExp / material.exp)
    const ownedCount = toNonNegativeInt(ownedMap[material.id])
    return {
      material,
      requiredCount,
      ownedCount,
      shortageCount: Math.max(0, requiredCount - ownedCount),
    }
  })

  const runPlans = LEVEL_MATERIALS.map((material) => {
    const expPerRun = material.exp * material.perRunDrop
    return {
      materialId: material.id,
      stage: material.recommendedStage,
      runs: shortageExp === 0 ? 0 : Math.ceil(shortageExp / expPerRun),
    }
  })

  const bestRunPlan = runPlans.reduce<LevelCalcResult['bestRunPlan']>((best, current) => {
    if (!best) return current
    return current.runs < best.runs ? current : best
  }, null)

  return {
    requiredExp,
    ownedExp,
    shortageExp,
    materials,
    runPlans,
    bestRunPlan,
  }
}
