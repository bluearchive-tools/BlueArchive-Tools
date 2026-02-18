import { calculateBondPlan } from './bond-calc'

export type TrainingStatus = {
  star: number
  uniqueStar: number
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
  level: {
    requiredExp: number
  }
  bond: ReturnType<typeof calculateBondPlan>
  star: {
    requiredEleph: number
    requiredUniqueEleph: number
    requiredTotalEleph: number
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

// 添付いただいた「生徒（キャラクター）経験値テーブル」の Total 列（Lv1..90）
const STUDENT_LEVEL_TOTAL_EXP = [
  0, 10, 35, 75, 130, 200, 275, 355, 445, 540,
  645, 760, 890, 1035, 1195, 1370, 1555, 1755, 1970, 2200,
  2585, 3010, 3490, 4025, 4605, 5240, 6025, 6870, 7765, 8690,
  9665, 10675, 11770, 12935, 14185, 15520, 16945, 18490, 20115, 21800,
  23535, 25335, 27310, 29475, 31845, 34430, 37245, 40310, 43650, 47295,
  51280, 55645, 60435, 65700, 71495, 77880, 84920, 92685, 101250, 110695,
  121105, 132570, 145185, 159050, 174270, 190955, 209220, 229185, 250975, 274720,
  300420, 328075, 357685, 389250, 422770, 458245, 495675, 535060, 574445, 613830,
  653215, 692600, 731985, 771370, 814665, 866930, 936130, 1020550, 1123540, 1249185,
]

// 添付いただいた「装備経験値テーブル」の Total 列（Lv1..70）
const EQUIPMENT_LEVEL_TOTAL_EXP = [
  0, 25, 52, 82, 116, 155, 200, 252, 312, 381,
  461, 553, 658, 777, 911, 1061, 1228, 1413, 1617, 1841,
  2087, 2356, 2649, 2967, 3311, 3682, 4081, 4509, 4967, 5456,
  5978, 6534, 7125, 7752, 8416, 9118, 9859, 10640, 11462, 12326,
  13234, 14187, 15186, 16232, 17326, 18469, 19662, 20906, 22202, 23551,
  24955, 26415, 27932, 29507, 31141, 32835, 34590, 36407, 38287, 40231,
  42241, 44318, 46463, 48677, 50961, 53316, 55743, 58243, 60817, 63466,
]

const STAR_TOTAL_ELEPH: Record<number, number> = {
  1: 0,
  2: 30,
  3: 110,
  4: 210,
  5: 330,
}

// 固有武器の星段階（0=未解放）に必要な神名文字累積（簡易モデル）
const UNIQUE_STAR_TOTAL_ELEPH: Record<number, number> = {
  0: 0,
  1: 120,
  2: 240,
  3: 360,
  4: 480,
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

function getTotalExpByLevel(table: number[], level: number) {
  const idx = clamp(level, 1, table.length)
  return table[idx - 1]
}

function getRequiredExp(table: number[], currentLevel: number, targetLevel: number) {
  const current = getTotalExpByLevel(table, currentLevel)
  const target = getTotalExpByLevel(table, targetLevel)
  return Math.max(0, target - current)
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
    uniqueStar: clamp(input.uniqueStar ?? 0, 0, 4),
    level: clamp(input.level ?? 1, 1, 90),
    bond: clamp(input.bond ?? 1, 1, 100),
    equip1: clamp(input.equip1 ?? 1, 1, 70),
    equip2: clamp(input.equip2 ?? 1, 1, 70),
    equip3: clamp(input.equip3 ?? 1, 1, 70),
    exSkill: clamp(input.exSkill ?? 1, 1, 5),
    normalSkill: clamp(input.normalSkill ?? 1, 1, 10),
    passiveSkill: clamp(input.passiveSkill ?? 1, 1, 10),
    subSkill: clamp(input.subSkill ?? 1, 1, 10),
  }
}

export function calculateTrainingPlan(currentRaw: Partial<TrainingStatus>, targetRaw: Partial<TrainingStatus>): TrainingPlanResult {
  const current = normalizeStatus(currentRaw)
  const target = normalizeStatus(targetRaw)

  const levelRequiredExp = getRequiredExp(STUDENT_LEVEL_TOTAL_EXP, current.level, target.level)
  const bond = calculateBondPlan({ currentBond: current.bond, targetBond: target.bond })

  const currentEleph = STAR_TOTAL_ELEPH[current.star] ?? 0
  const targetEleph = STAR_TOTAL_ELEPH[target.star] ?? 0

  const currentUniqueEleph = UNIQUE_STAR_TOTAL_ELEPH[current.uniqueStar] ?? 0
  const targetUniqueEleph = UNIQUE_STAR_TOTAL_ELEPH[target.uniqueStar] ?? 0

  const exExp = cumulative(SKILL_EXP_PER_LEVEL, current.exSkill, target.exSkill)
  const nExp = cumulative(SKILL_EXP_PER_LEVEL, current.normalSkill, target.normalSkill)
  const pExp = cumulative(SKILL_EXP_PER_LEVEL, current.passiveSkill, target.passiveSkill)
  const sExp = cumulative(SKILL_EXP_PER_LEVEL, current.subSkill, target.subSkill)
  const skillTotalExp = exExp + nExp + pExp + sExp

  const eq1 = getRequiredExp(EQUIPMENT_LEVEL_TOTAL_EXP, current.equip1, target.equip1)
  const eq2 = getRequiredExp(EQUIPMENT_LEVEL_TOTAL_EXP, current.equip2, target.equip2)
  const eq3 = getRequiredExp(EQUIPMENT_LEVEL_TOTAL_EXP, current.equip3, target.equip3)
  const equipmentTotalExp = eq1 + eq2 + eq3

  const requiredEleph = Math.max(0, targetEleph - currentEleph)
  const requiredUniqueEleph = Math.max(0, targetUniqueEleph - currentUniqueEleph)

  return {
    level: {
      requiredExp: levelRequiredExp,
    },
    bond,
    star: {
      requiredEleph,
      requiredUniqueEleph,
      requiredTotalEleph: requiredEleph + requiredUniqueEleph,
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
