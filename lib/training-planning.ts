import { calculateBondPlan } from './bond-calc'
import { calculateLevelPlan } from './level-calc'

export type TrainingStatus = {
  star: number
  level: number
  bond: number
  equip1: number
  equip2: number
  equip3: number
  exSkill: number
  normalSkill: number
  passiveSkill: number
  subSkill: number
}

export type TrainingPlanResult = {
  level: ReturnType<typeof calculateLevelPlan>
  bond: ReturnType<typeof calculateBondPlan>
  star: {
    requiredEleph: number
  }
  skill: {
    totalExp: number
    t1: number
    t2: number
    t3: number
    t4: number
  }
  equipment: {
    totalExp: number
    t1: number
    t2: number
    t3: number
    t4: number
  }
}

const STAR_TOTAL_ELEPH: Record<number, number> = {
  1: 0,
  2: 30,
  3: 110,
  4: 210,
  5: 330,
}

const SKILL_EXP_PER_LEVEL: Record<number, number> = {
  1: 0,
  2: 120,
  3: 180,
  4: 260,
  5: 380,
  6: 520,
  7: 700,
  8: 920,
  9: 1180,
  10: 1500,
}

const EQUIP_EXP_PER_TIER: Record<number, number> = {
  1: 0,
  2: 80,
  3: 150,
  4: 260,
  5: 430,
  6: 680,
  7: 980,
  8: 1360,
  9: 1840,
  10: 2450,
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function cumulative(table: Record<number, number>, from: number, to: number) {
  if (to <= from) return 0
  let total = 0
  for (let lv = from + 1; lv <= to; lv++) {
    total += table[lv] ?? 0
  }
  return total
}

function splitByTier(totalExp: number, values: [number, number, number, number]) {
  const [v1, v2, v3, v4] = values
  let remain = Math.max(0, totalExp)
  const t4 = Math.floor(remain / v4)
  remain -= t4 * v4
  const t3 = Math.floor(remain / v3)
  remain -= t3 * v3
  const t2 = Math.floor(remain / v2)
  remain -= t2 * v2
  const t1 = Math.ceil(remain / v1)
  return { t1, t2, t3, t4 }
}

export function normalizeStatus(input: Partial<TrainingStatus>): TrainingStatus {
  return {
    star: clamp(input.star ?? 1, 1, 5),
    level: clamp(input.level ?? 1, 1, 90),
    bond: clamp(input.bond ?? 1, 1, 100),
    equip1: clamp(input.equip1 ?? 1, 1, 10),
    equip2: clamp(input.equip2 ?? 1, 1, 10),
    equip3: clamp(input.equip3 ?? 1, 1, 10),
    exSkill: clamp(input.exSkill ?? 1, 1, 5),
    normalSkill: clamp(input.normalSkill ?? 1, 1, 10),
    passiveSkill: clamp(input.passiveSkill ?? 1, 1, 10),
    subSkill: clamp(input.subSkill ?? 1, 1, 10),
  }
}

export function calculateTrainingPlan(currentRaw: Partial<TrainingStatus>, targetRaw: Partial<TrainingStatus>): TrainingPlanResult {
  const current = normalizeStatus(currentRaw)
  const target = normalizeStatus(targetRaw)

  const level = calculateLevelPlan({ currentLevel: current.level, targetLevel: target.level })
  const bond = calculateBondPlan({ currentBond: current.bond, targetBond: target.bond })

  const currentEleph = STAR_TOTAL_ELEPH[current.star] ?? 0
  const targetEleph = STAR_TOTAL_ELEPH[target.star] ?? 0

  const exExp = cumulative(SKILL_EXP_PER_LEVEL, current.exSkill, target.exSkill)
  const nExp = cumulative(SKILL_EXP_PER_LEVEL, current.normalSkill, target.normalSkill)
  const pExp = cumulative(SKILL_EXP_PER_LEVEL, current.passiveSkill, target.passiveSkill)
  const sExp = cumulative(SKILL_EXP_PER_LEVEL, current.subSkill, target.subSkill)
  const skillTotalExp = exExp + nExp + pExp + sExp

  const eq1 = cumulative(EQUIP_EXP_PER_TIER, current.equip1, target.equip1)
  const eq2 = cumulative(EQUIP_EXP_PER_TIER, current.equip2, target.equip2)
  const eq3 = cumulative(EQUIP_EXP_PER_TIER, current.equip3, target.equip3)
  const equipmentTotalExp = eq1 + eq2 + eq3

  return {
    level,
    bond,
    star: {
      requiredEleph: Math.max(0, targetEleph - currentEleph),
    },
    skill: {
      totalExp: skillTotalExp,
      ...splitByTier(skillTotalExp, [50, 200, 1000, 5000]),
    },
    equipment: {
      totalExp: equipmentTotalExp,
      ...splitByTier(equipmentTotalExp, [40, 160, 800, 3200]),
    },
  }
}
