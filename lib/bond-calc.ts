export type BondMaterial = {
  id: 'basic' | 'advanced' | 'premium'
  labelKey: string
  bondPoint: number
  perRunDrop: number
  recommendedStage: string
}

export type BondCalculationInput = {
  currentBond: number
  targetBond: number
  ownedMaterials?: Partial<Record<BondMaterial['id'], number>>
}

export type BondMaterialResult = {
  material: BondMaterial
  requiredCount: number
  ownedCount: number
  shortageCount: number
}

export type BondCalculationResult = {
  requiredBondPoint: number
  ownedBondPoint: number
  shortageBondPoint: number
  materials: BondMaterialResult[]
  recommendedRuns: {
    materialId: BondMaterial['id']
    stage: string
    runs: number
  }[]
  bestRunPlan: {
    materialId: BondMaterial['id']
    stage: string
    runs: number
  } | null
}

export const BOND_MAX_LEVEL = 100

const BOND_LEVEL_EXP_TABLE = Array.from({ length: BOND_MAX_LEVEL + 1 }, (_, level) => {
  if (level <= 1) return 0
  return Math.floor(18 * (level - 1) + 12 * Math.pow(level - 1, 1.15))
})

export const BOND_MATERIALS: BondMaterial[] = [
  {
    id: 'basic',
    labelKey: 'materials.basic',
    bondPoint: 20,
    perRunDrop: 6,
    recommendedStage: 'B-1',
  },
  {
    id: 'advanced',
    labelKey: 'materials.advanced',
    bondPoint: 60,
    perRunDrop: 4,
    recommendedStage: 'B-2',
  },
  {
    id: 'premium',
    labelKey: 'materials.premium',
    bondPoint: 180,
    perRunDrop: 2,
    recommendedStage: 'B-3',
  },
]

function clampBondLevel(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(BOND_MAX_LEVEL, Math.max(1, Math.floor(value)))
}

function toNonNegativeInt(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function getRequiredBondPoint(currentBond: number, targetBond: number) {
  const from = clampBondLevel(currentBond)
  const to = clampBondLevel(targetBond)

  if (to <= from) return 0

  let total = 0
  for (let level = from; level < to; level++) {
    total += BOND_LEVEL_EXP_TABLE[level + 1]
  }
  return total
}

export function calculateBondPlan(input: BondCalculationInput): BondCalculationResult {
  const requiredBondPoint = getRequiredBondPoint(input.currentBond, input.targetBond)
  const ownedMap = input.ownedMaterials ?? {}

  const ownedBondPoint = BOND_MATERIALS.reduce((sum, material) => {
    const ownedCount = toNonNegativeInt(ownedMap[material.id])
    return sum + ownedCount * material.bondPoint
  }, 0)

  const shortageBondPoint = Math.max(0, requiredBondPoint - ownedBondPoint)

  const materials = BOND_MATERIALS.map((material) => {
    const requiredCount = Math.ceil(requiredBondPoint / material.bondPoint)
    const ownedCount = toNonNegativeInt(ownedMap[material.id])
    return {
      material,
      requiredCount,
      ownedCount,
      shortageCount: Math.max(0, requiredCount - ownedCount),
    }
  })

  const recommendedRuns = BOND_MATERIALS.map((material) => {
    const perRunPoint = material.bondPoint * material.perRunDrop
    return {
      materialId: material.id,
      stage: material.recommendedStage,
      runs: shortageBondPoint === 0 ? 0 : Math.ceil(shortageBondPoint / perRunPoint),
    }
  })

  const bestRunPlan =
    recommendedRuns.length === 0
      ? null
      : recommendedRuns.reduce((best, current) => {
          if (!best) return current
          return current.runs < best.runs ? current : best
        }, null as BondCalculationResult['bestRunPlan'])

  return {
    requiredBondPoint,
    ownedBondPoint,
    shortageBondPoint,
    materials,
    recommendedRuns,
    bestRunPlan,
  }
}
