export interface TLFormationMember {
  id?: string
  name?: string
  level?: number | null
  ex_skill?: number | null
  normal_skill?: number | null
  passive_skill?: number | null
  sub_skill?: number | null
}

export interface OwnedStudentStats {
  level?: number | null
  ex_skill?: number | null
  normal_skill?: number | null
  passive_skill?: number | null
  sub_skill?: number | null
}

export interface CompatibilityMissingCharacter {
  id: string
  name: string
  searchUrl: string
}

export interface CompatibilityMissingTraining {
  id: string
  name: string
  shortages: string[]
  searchUrl: string
}

export interface TLCompatibilityResult {
  status: 'reproducible' | 'conditional' | 'impossible'
  matchRate: number
  missingCharacters: CompatibilityMissingCharacter[]
  missingTraining: CompatibilityMissingTraining[]
}

const normalizeNum = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

const buildStudentSearchUrl = (name: string) =>
  `/students?search=${encodeURIComponent(name)}`

export const parseTlFormation = (formation: string): TLFormationMember[] => {
  if (!formation || formation === '[]') return []
  try {
    const parsed = JSON.parse(formation)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((team) => {
      if (!Array.isArray(team)) return []
      return team
        .map((member) => {
          if (typeof member === 'string') {
            return { id: member, name: member } satisfies TLFormationMember
          }
          if (!member || typeof member !== 'object') return null
          return member as TLFormationMember
        })
        .filter((member): member is TLFormationMember => Boolean(member?.id))
    })
  } catch {
    return []
  }
}

export const compareTlCompatibility = (
  members: TLFormationMember[],
  ownedStudents: Record<string, OwnedStudentStats>,
  studentNames: Record<string, string>
): TLCompatibilityResult => {
  if (members.length === 0) {
    return {
      status: 'conditional',
      matchRate: 0,
      missingCharacters: [],
      missingTraining: [],
    }
  }

  let totalChecks = 0
  let passedChecks = 0
  const missingCharacters: CompatibilityMissingCharacter[] = []
  const missingTraining: CompatibilityMissingTraining[] = []

  members.forEach((member) => {
    const id = member.id ?? ''
    if (!id) return
    const name = studentNames[id] || member.name || id
    const owned = ownedStudents[id]

    totalChecks += 1
    if (!owned) {
      missingCharacters.push({ id, name, searchUrl: buildStudentSearchUrl(name) })
      return
    }
    passedChecks += 1

    const shortages: string[] = []
    const checkField = (
      label: string,
      requiredValue: number | null | undefined,
      ownedValue: number | null | undefined
    ) => {
      const required = normalizeNum(requiredValue)
      if (required <= 0) return
      totalChecks += 1
      const current = normalizeNum(ownedValue)
      if (current >= required) {
        passedChecks += 1
        return
      }
      shortages.push(`${label} ${current}/${required}`)
    }

    checkField('Lv', member.level, owned.level)
    checkField('EX', member.ex_skill, owned.ex_skill)
    checkField('NS', member.normal_skill, owned.normal_skill)
    checkField('PS', member.passive_skill, owned.passive_skill)
    checkField('SS', member.sub_skill, owned.sub_skill)

    if (shortages.length > 0) {
      missingTraining.push({ id, name, shortages, searchUrl: buildStudentSearchUrl(name) })
    }
  })

  const matchRate =
    totalChecks > 0 ? Math.round(Math.max(0, Math.min(1, passedChecks / totalChecks)) * 100) : 0

  const status: TLCompatibilityResult['status'] =
    matchRate === 100
      ? 'reproducible'
      : matchRate >= 60
        ? 'conditional'
        : 'impossible'

  return {
    status,
    matchRate,
    missingCharacters,
    missingTraining,
  }
}
