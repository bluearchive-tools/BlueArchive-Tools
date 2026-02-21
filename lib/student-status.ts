export type StatType = 'hp' | 'attack' | 'defense' | 'heal'

const STAR_MULTIPLIERS = {
  hp: [1, 1.05, 1.12, 1.21, 1.35],
  attack: [1, 1.1, 1.22, 1.36, 1.53],
  defense: [1, 1, 1, 1, 1],
  heal: [1, 1.075, 1.175, 1.295, 1.445],
} as const

const LEVEL_GROWTH_MULTIPLIERS: Record<StatType, number> = {
  hp: 9,
  attack: 9,
  defense: 5,
  heal: 2,
}

const HP_RANGE_MULTIPLIERS: Record<number, number> = {
  350: 1.671,
  450: 1.386,
  550: 1.159,
  650: 1,
  750: 0.867,
  850: 0.765,
  1000: 0.747,
  1500: 0.7,
}

const getStarMultiplier = (type: StatType, star: number) => {
  const index = Math.max(1, Math.min(5, Math.floor(star || 1))) - 1
  return STAR_MULTIPLIERS[type][index]
}

const resolveStatCalculationBreakdown = ({
  base,
  statType,
  level,
  range = 550,
  star,
  initialStars,
}: {
  base: number
  statType: StatType
  level: number
  range?: number
  star: number
  initialStars: number
}) => {
  const currentLevel = Math.max(1, Math.floor(level || 1))
  const baseStar = Math.max(1, Math.min(5, Math.floor(initialStars || 1)))
  const currentStar = Math.max(1, Math.min(5, Math.floor(star || baseStar)))

  const baseMultiplier = getStarMultiplier(statType, baseStar)
  const currentMultiplier = getStarMultiplier(statType, currentStar)
  const adjustedBase = base * (currentMultiplier / baseMultiplier)

  const growth = LEVEL_GROWTH_MULTIPLIERS[statType]
  const hpRangeMultiplier =
    statType === 'hp' ? (HP_RANGE_MULTIPLIERS[range] ?? HP_RANGE_MULTIPLIERS[550]) : 1

  const growthTerm = ((adjustedBase * growth) / 99) * (currentLevel - 1) * hpRangeMultiplier
  const rawValue = adjustedBase + growthTerm

  return {
    base,
    currentLevel,
    baseStar,
    currentStar,
    baseMultiplier,
    currentMultiplier,
    adjustedBase,
    growth,
    hpRangeMultiplier,
    growthTerm,
    rawValue,
    roundedValue: Math.max(1, Math.round(rawValue)),
  }
}

export const calculateStatFromBase = ({
  base,
  statType,
  level,
  range = 550,
  star,
  initialStars,
}: {
  base: number
  statType: StatType
  level: number
  range?: number
  star: number
  initialStars: number
}) => {
  if (!Number.isFinite(base) || base <= 0) return 0
  return resolveStatCalculationBreakdown({
    base,
    statType,
    level,
    range,
    star,
    initialStars,
  }).roundedValue
}

export const getStatCalculationFormula = ({
  base,
  statType,
  level,
  range = 550,
  star,
  initialStars,
}: {
  base: number
  statType: StatType
  level: number
  range?: number
  star: number
  initialStars: number
}) => {
  if (!Number.isFinite(base) || base <= 0) {
    return {
      formula: '0',
      roundedValue: 0,
    }
  }

  const d = resolveStatCalculationBreakdown({
    base,
    statType,
    level,
    range,
    star,
    initialStars,
  })

  const adjustedBaseExpr = `${d.base}*(${d.currentMultiplier}/${d.baseMultiplier})`
  const growthExpr = `((${adjustedBaseExpr}*${d.growth})/99)*${d.currentLevel - 1}*${d.hpRangeMultiplier}`

  return {
    formula: `round(${adjustedBaseExpr}+${growthExpr})`,
    roundedValue: d.roundedValue,
  }
}
