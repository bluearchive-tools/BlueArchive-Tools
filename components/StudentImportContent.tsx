'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'

interface Student {
  id: string
  name: string
  importid?: string
}

interface MatchedStudent extends Student {
  normalizedName: string
  normalizedNameNoDigits: string
}

interface ExtractedStudent {
  studentId: string
  name: string
  level: number | null
  star: number | null
  bond: number | null
  hp: number | null
  hpWb: number | null
  attack: number | null
  attackWb: number | null
  defense: number | null
  heal: number | null
  healWb: number | null
  exSkill: number | null
  normalSkill: number | null
  passiveSkill: number | null
  subSkill: number | null
  weaponLevel: number | null
  weaponStar: number | null
  equip1: number | null
  equip2: number | null
  equip3: number | null
  loveTier: number | null
  source: string
}

const emptyStats = {
  unique_star: 0,
  unique_level: 0,
  bond: 0,
  hp: 0,
  hp_wb: 0,
  attack: 0,
  attack_wb: 0,
  defense: 0,
  heal: 0,
  heal_wb: 0,
  ex_skill: 0,
  normal_skill: 0,
  passive_skill: 0,
  sub_skill: 0,
  equip1: 0,
  equip2: 0,
  equip3: 0,
  item_tier: 0,
  alt_bonds: {},
}

type SchaleStudentRecord = Record<string, number | boolean | null>

type SchalePayload = Record<string, SchaleStudentRecord>

const decodeSchalePayload = (raw: string): SchalePayload => {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('文字列を入力してください。')

  try {
    return JSON.parse(trimmed) as SchalePayload
  } catch {
    // base64 fallback
  }

  const normalized = trimmed.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const decoded = atob(padded)
  return JSON.parse(decoded) as SchalePayload
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const toSchaleEntry = (
  student: Student,
  sourceId: string,
  row: SchaleStudentRecord
): ExtractedStudent => ({
  studentId: student.id,
  name: student.name,
  level: Number(row.l ?? 1),
  star: Number(row.s ?? 1),
  bond: Number(row.b ?? 0),
  hp: null,
  hpWb: Number(row.pm ?? 0),
  attack: null,
  attackWb: Number(row.pa ?? 0),
  defense: null,
  heal: null,
  healWb: Number(row.ph ?? 0),
  exSkill: Number(row.s1 ?? 1),
  normalSkill: Number(row.s2 ?? 1),
  passiveSkill: Number(row.s3 ?? 1),
  subSkill: Number(row.s4 ?? 1),
  weaponLevel: Number(row.wl ?? 0),
  weaponStar: clamp(Number(row.ws ?? 0), 0, 5),
  equip1: Number(row.e1 ?? 1),
  equip2: Number(row.e2 ?? 1),
  equip3: Number(row.e3 ?? 1),
  loveTier: Number(row.e4 ?? 0),
  source: `SchaleDB:${sourceId}`,
})

const parseNumber = (line: string, patterns: RegExp[]) => {
  const normalized = normalizeOcrNumber(line)
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match) return Number(match[1])
  }
  return null
}

const normalizeText = (text: string) =>
  text.replace(/\s+/g, '').replace(/[^\p{L}\p{N}★⭐()]/gu, '')

const normalizeBrackets = (text: string) =>
  text.replace(/[（）]/g, (char) => (char === '（' ? '(' : ')'))

const normalizeOcrNameText = (text: string) => {
  const normalized = normalizeBrackets(text)
  return normalized.replace(
    /([^\s()\n]{1,12})\s*[\r\n]+\s*\(([^)\n]+)\)/g,
    '$1($2)'
  )
}

const extractBracketSuffixes = (text: string) =>
  [...text.matchAll(/\(([^)]+)\)/g)]
    .map((match) => normalizeText(match[1]))
    .filter(Boolean)

const normalizeOcrNumber = (value: string) =>
  value
    .replace(/[ＯO]/g, '0')
    .replace(/[ＩIl|]/g, '1')
    .replace(/[Ｂ]/g, '8')
    .replace(/[Ｓs]/g, '5')
    .replace(/[Ａ]/g, '4')

const parseStatNumber = (value: string | undefined) => {
  if (!value) return null
  const num = Number(normalizeOcrNumber(value).replace(/,/g, ''))
  return Number.isNaN(num) ? null : num
}

const parseSkillLevel = (text: string, levelPattern: RegExp, maxLevel: number) => {
  const normalized = text.replace(/\s+/g, '')
  if (/(MAX|I?TAX|\[?TAX)/i.test(normalized)) return maxLevel
  const match = text.match(levelPattern)
  if (!match) return null
  return parseStatNumber(match[1])
}

const parseWeaponLevel = (text: string) => {
  const match = text.match(
    /(SMG|AR|HG|SG|MG|SR|GL|RL)[^\n]*?(Lv|LV|L[Vv]|\bL[vyン])\.?\s*([0-9Oo]{1,3})/i
  )
  return parseStatNumber(match?.[3])
}

const parseWeaponStar = (text: string) => {
  const starMatch = text.match(/固有武器[^\n]*?([★⭐]+)/)
  if (starMatch) return starMatch[1].length
  const altMatch = text.match(/固有武器[^\n]*?星\s*([1-5])/)
  return parseStatNumber(altMatch?.[1])
}

const parseEquipmentLevels = (text: string) => {
  const equipmentText = normalizeOcrNumber(text).replace(/\b1(?=0{1,2}\b)/g, 'T')
  const matches = [...equipmentText.matchAll(/T([0-9IOOo]{1,2})/gi)]
  const levels = matches
    .map((match) => {
      const raw = normalizeOcrNumber(match[1])
      if (raw.length === 3 && raw.endsWith('10')) return 10
      return parseStatNumber(raw)
    })
    .filter((val) => val !== null && val <= 10)
  if (levels.length >= 3) {
    return {
      equip1: levels[0] ?? null,
      equip2: levels[1] ?? null,
      equip3: levels[2] ?? null,
    }
  }
  const fallbackMatch = equipmentText.match(
    /装備強化[\s\S]*?([0-9IOOo]{2,3})\s+([0-9IOOo]{2,3})\s+([0-9IOOo]{2,3})/i
  )
  if (fallbackMatch) {
    const fallbackLevels = fallbackMatch
      .slice(1, 4)
      .map((value) => {
        const normalized = normalizeOcrNumber(value)
        if (normalized.length === 3 && normalized.endsWith('10')) return 10
        return parseStatNumber(normalized)
      })
      .filter((val) => val !== null && val <= 10)
    return {
      equip1: fallbackLevels[0] ?? null,
      equip2: fallbackLevels[1] ?? null,
      equip3: fallbackLevels[2] ?? null,
    }
  }
  return {
    equip1: levels[0] ?? null,
    equip2: levels[1] ?? null,
    equip3: levels[2] ?? null,
  }
}

const parseLoveTier = (text: string) => {
  const match = text.match(/愛用品[^\n]*?T(\d{1,2})/i)
  return parseStatNumber(match?.[1])
}

const parseBond = (text: string) =>
  parseStatNumber(text.match(/日直\s*([0-9Oo]{1,3})/i)?.[1])

const parseWbLevel = (text: string, label: RegExp, requireWbMarker = true) => {
  const levelPattern = /(?:Lv|LV|L[uUvV]|\bL[uyン])\.?\s*([0-9Oo]{1,2})/i
  const matchIndex = text.search(label)
  if (matchIndex === -1) return null
  const windowText = text.slice(matchIndex, Math.min(text.length, matchIndex + 80))
  const labelMatch = windowText.match(label)
  if (!labelMatch || labelMatch.index === undefined) return null
  const afterLabel = windowText.slice(labelMatch.index + labelMatch[0].length)
  const wbIndex = afterLabel.search(/(W[ＢB]|Ｗ[ＢB]|\bWB\b)/i)
  if (wbIndex === -1 && requireWbMarker) return null
  const statBoundaryIndex = afterLabel.search(
    /(攻撃力|防御力|治癒力|EXスキル|ノーマルスキル|パッシブスキル|サブスキル)/i
  )
  const boundedText =
    statBoundaryIndex === -1 ? afterLabel : afterLabel.slice(0, statBoundaryIndex)
  const wbWindow =
    wbIndex === -1 ? boundedText : boundedText.slice(wbIndex, wbIndex + 40)
  const match = wbWindow.match(levelPattern)
  return parseStatNumber(match?.[1])
}

const parseStudentDetails = (text: string) => {
  const hp = parseStatNumber(text.match(/HP\s*([0-9O,]+)/i)?.[1])
  const hpWb = parseWbLevel(text, /HP/, false)
  const attack = parseStatNumber(text.match(/攻撃力\s*([0-9O,]+)/)?.[1])
  const attackWb = parseWbLevel(text, /攻撃力/, false)
  const defense = parseStatNumber(text.match(/防御力\s*([0-9O,]+)/)?.[1])
  const heal = parseStatNumber(text.match(/治癒力\s*([0-9O,]+)/)?.[1])
  const healWb = parseWbLevel(text, /治癒力/)
  const levelPattern = /(?:Lv|LV|L[uUvV]|\bL[uyン])\.?\s*([0-9Oo]{1,2})/i
  const exSkill = parseSkillLevel(
    text,
    new RegExp(`EXスキル\\s*${levelPattern.source}`, 'i'),
    5
  )
  const normalSkill = parseSkillLevel(
    text,
    new RegExp(`ノーマルスキル\\s*${levelPattern.source}`, 'i'),
    10
  )
  const passiveSkill = parseSkillLevel(
    text,
    new RegExp(`(パッシブスキル\\+?|パッシブ)\\s*${levelPattern.source}`, 'i'),
    10
  )
  const subSkill = parseSkillLevel(
    text,
    new RegExp(`サブスキル\\s*${levelPattern.source}`, 'i'),
    10
  )
  const weaponLevel = parseWeaponLevel(text)
  const weaponStar = parseWeaponStar(text)
  const equipment = parseEquipmentLevels(text)
  const loveTier = parseLoveTier(text)
  const bond = parseBond(text)

  return {
    bond,
    hp,
    hpWb,
    attack,
    attackWb,
    defense,
    heal,
    healWb,
    exSkill,
    normalSkill,
    passiveSkill,
    subSkill,
    weaponLevel,
    weaponStar,
    ...equipment,
    loveTier,
  }
}

const splitNote = [
  'tesseract.js は画像を左右に分割し、左を上下→下を上下と分割します。',
  'さらに左側を縦に3分割して各ステータスを抽出します。',
  'PaddleOCR は左右分割のみで処理します。',
].join('\n')

const extractNearText = (text: string, name: string) => {
  const index = text.indexOf(name)
  if (index === -1) return text
  const start = Math.max(0, index - 40)
  const end = Math.min(text.length, index + name.length + 80)
  return text.slice(start, end)
}

const extractLevel = (text: string) =>
  parseNumber(text, [/L[uUvV]\.?\s*(\d{1,3})/, /レベル\s*(\d{1,3})/])

const extractStar = (text: string) => {
  const direct = parseNumber(text, [/★\s*([1-5])/, /星\s*([1-5])/])
  if (direct !== null) return direct
  const stars = text.match(/[★⭐]/g)
  if (stars) return stars.length
  return null
}

const findMatchedStudents = (text: string, students: Student[]): MatchedStudent[] => {
  const mergedText = normalizeOcrNameText(text)
  const normalized = normalizeText(mergedText)
  const bracketSuffixes = extractBracketSuffixes(mergedText)
  const candidates = students
    .map((s) => ({
      ...s,
      normalizedName: normalizeText(s.name),
      normalizedNameNoDigits: normalizeText(s.name.replace(/\d+$/g, '')),
    }))
    .filter((s) => s.normalizedName && normalized.includes(s.normalizedName))
    .filter((s) => {
      if (!bracketSuffixes.length) return true
      return bracketSuffixes.some((suffix) => s.normalizedName.includes(suffix))
    })

  const filtered = candidates.filter(
    (candidate) =>
      !candidates.some(
        (other) =>
          other.normalizedName.length > candidate.normalizedName.length &&
          other.normalizedName.includes(candidate.normalizedName)
      )
  )

  if (!bracketSuffixes.length) return filtered

  const deduped = new Map<string, MatchedStudent>()
  filtered
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id))
    .forEach((candidate) => {
      const key = candidate.normalizedNameNoDigits || candidate.normalizedName
      if (!deduped.has(key)) deduped.set(key, candidate)
    })
  return Array.from(deduped.values())
}

const parseEntries = (text: string, students: Student[]) => {
  const mergedText = normalizeOcrNameText(text)
  const normalized = normalizeText(mergedText)
  const results: ExtractedStudent[] = []
  const seen = new Set<string>()
  const candidates = findMatchedStudents(mergedText, students).sort(
    (a, b) => b.normalizedName.length - a.normalizedName.length
  )
  const singleMatch = candidates.length === 1

  for (const student of candidates) {
    if (!student.normalizedName) continue
    if (!normalized.includes(student.normalizedName)) continue
    if (seen.has(student.id)) continue
    const contextText = singleMatch
      ? mergedText
      : extractNearText(mergedText, student.name)
    const level = extractLevel(contextText)
    const star = extractStar(contextText)
    const details = parseStudentDetails(contextText)
    results.push({
      studentId: student.id,
      name: student.name,
      level,
      star,
      ...details,
      source: contextText.trim(),
    })
    seen.add(student.id)
  }

  return results
}

const cropCanvas = (bitmap: ImageBitmap, sx: number, sy: number, sw: number, sh: number) => {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(sw))
  canvas.height = Math.max(1, Math.floor(sh))
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return canvas
}

const preprocessCanvas = (source: HTMLCanvasElement, scale = 2, maxSide = 2048) => {
  const maxDimension = Math.max(source.width, source.height)
  const boundedScale =
    maxSide > 0 && maxDimension * scale > maxSide ? maxSide / maxDimension : scale
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(source.width * boundedScale))
  canvas.height = Math.max(1, Math.floor(source.height * boundedScale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return source
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const contrast = 1.25
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    const value = Math.min(255, Math.max(0, (gray - 128) * contrast + 128))
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

const preprocessCanvasForPaddle = (source: HTMLCanvasElement) => preprocessCanvas(source, 1)

const splitStudentImage = async (file: File) => {
  const bitmap = await createImageBitmap(file)
  const width = bitmap.width
  const height = bitmap.height
  const leftWidth = Math.floor(width * 0.5)
  const rightWidth = width - leftWidth
  const leftTopHeight = Math.floor(height * 0.5)
  const leftBottomHeight = height - leftTopHeight
  const leftBottomUpperHeight = Math.floor(leftBottomHeight * 0.5)

  const leftCanvas = cropCanvas(bitmap, 0, 0, leftWidth, height)
  const rightCanvas = cropCanvas(bitmap, leftWidth, 0, rightWidth, height)
  const leftBottomUpper = cropCanvas(
    bitmap,
    0,
    leftTopHeight,
    leftWidth,
    leftBottomUpperHeight
  )
  const thirdWidth = Math.floor(leftWidth / 3)
  const leftColumn1 = cropCanvas(bitmap, 0, 0, thirdWidth, height)
  const leftColumn2 = cropCanvas(bitmap, thirdWidth, 0, thirdWidth, height)
  const leftColumn3 = cropCanvas(bitmap, thirdWidth * 2, 0, leftWidth - thirdWidth * 2, height)

  bitmap.close()

  return {
    leftCanvas,
    rightCanvas,
    nameStarCanvas: leftBottomUpper,
    statCanvases: [leftColumn1, leftColumn2, leftColumn3],
  }
}

const extractWeaponLevelFromText = (text: string) =>
  parseNumber(text, [/L[Vv]\.?\s*(\d{1,3})/, /レベル\s*(\d{1,3})/])

const parseEntriesFromSegments = (
  nameStarText: string,
  statTexts: string[],
  students: Student[],
  weaponLevelText?: string
) => {
  const matched = findMatchedStudents(nameStarText, students)
  if (!matched.length) return []
  const star = extractStar(nameStarText)
  const combinedStats = statTexts.join('\n')
  const level = extractLevel(combinedStats)
  const details = parseStudentDetails(combinedStats)
  const weaponLevel = weaponLevelText ? extractWeaponLevelFromText(weaponLevelText) : null

  return matched.map((student) => ({
    studentId: student.id,
    name: student.name,
    level,
    star,
    ...details,
    weaponLevel: weaponLevel ?? details.weaponLevel,
    source: [nameStarText, combinedStats, weaponLevelText]
      .filter(Boolean)
      .join('\n')
      .trim(),
  }))
}

const parseEntriesFromLeftRight = (
  leftText: string,
  rightText: string | null,
  students: Student[]
) => {
  const combinedText = [leftText, rightText].filter(Boolean).join('\n')
  const matched = findMatchedStudents(combinedText, students)
  if (!matched.length) return []
  const details = parseStudentDetails(combinedText)
  const level = extractLevel(combinedText)
  const star = extractStar(combinedText)
  const weaponLevel = rightText
    ? extractWeaponLevelFromText(rightText)
    : details.weaponLevel
  const source = combinedText.trim()

  return matched.map((student) => ({
    studentId: student.id,
    name: student.name,
    level,
    star,
    ...details,
    weaponLevel: weaponLevel ?? details.weaponLevel,
    source,
  }))
}

const extractExternalOcrText = (payload: unknown): string => {
  const texts: string[] = []

  const visit = (value: unknown) => {
    if (!value) return
    if (typeof value === 'string') {
      if (value.trim()) texts.push(value.trim())
      return
    }
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>
      if (typeof obj.text === 'string') {
        texts.push(obj.text.trim())
      }
      if (typeof obj.value === 'string') {
        texts.push(obj.value.trim())
      }
      if (typeof obj.ocr_text === 'string') {
        texts.push(obj.ocr_text.trim())
      }
      if (obj.words) visit(obj.words)
      if (obj.data) visit(obj.data)
      if (obj.result) visit(obj.result)
      if (obj.results) visit(obj.results)
    }
  }

  visit(payload)
  return texts.filter(Boolean).join('\n').trim()
}

const fetchExternalOcrText = async (file: File, engine?: string, model?: string) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const formData = new FormData()
      formData.append('image', file)
      if (engine) {
        formData.append('engine', engine)
      }
      if (model) {
        formData.append('model', model)
      }
      const res = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          continue
        }
        return null
      }
      const data = await res.json()
      return extractExternalOcrText(data?.data ?? data)
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        continue
      }
      return null
    }
  }
  return null
}

const runWithConcurrency = async <T,>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> => {
  const results: T[] = []
  let index = 0

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (index < tasks.length) {
      const current = index
      index += 1
      results[current] = await tasks[current]()
    }
  })

  await Promise.all(workers)
  return results
}

const canvasToFile = (canvas: HTMLCanvasElement, name: string) =>
  new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('blob作成に失敗しました'))
          return
        }
        resolve(new File([blob], name, { type: blob.type || 'image/png' }))
      },
      'image/png',
      0.92
    )
  })

interface StudentImportContentProps {
  mode?: 'full' | 'image' | 'schale'
  showHeader?: boolean
  onSaved?: () => void
}

export default function StudentImportContent({
  mode = 'full',
  showHeader = true,
  onSaved,
}: StudentImportContentProps) {
  const session = useSession()
  const supabase = useSupabaseClient()
  const [students, setStudents] = useState<Student[]>([])
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [rawTexts, setRawTexts] = useState<string[]>([])
  const [entries, setEntries] = useState<ExtractedStudent[]>([])
  const [ocrMode, setOcrMode] = useState<
    'paddleocr' | 'deepseek' | 'deepseek-vllm' | 'tesseract'
  >('paddleocr')
  const [ocrModel, setOcrModel] = useState<'standard' | 'high'>('standard')
  const [deepseekModel, setDeepseekModel] = useState<'deepseek-v1' | 'deepseek-v2'>(
    'deepseek-v1'
  )
  const [deepseekVllmModel, setDeepseekVllmModel] = useState<
    'deepseek-v1' | 'deepseek-v2'
  >('deepseek-v1')
  const [saving, setSaving] = useState(false)
  const [schaleInput, setSchaleInput] = useState('')
  const [schaleMessage, setSchaleMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/students')
        if (res.ok) {
          setStudents(await res.json())
        }
      } catch {
        // ignore
      }
    }
    load()
  }, [])

  const handleSchaleImport = useCallback(() => {
    if (students.length === 0) {
      setError('生徒データの読み込みが完了していません。少し待ってから再試行してください。')
      return
    }
    setError(null)
    setSchaleMessage(null)

    try {
      const payload = decodeSchalePayload(schaleInput)
      const byImportId = new Map(
        students
          .filter((student) => !!student.importid)
          .map((student) => [student.importid as string, student] as const)
      )

      const imported: ExtractedStudent[] = []
      let skipped = 0

      for (const [importId, row] of Object.entries(payload)) {
        const student = byImportId.get(importId)
        if (!student) {
          skipped += 1
          continue
        }
        imported.push(toSchaleEntry(student, importId, row))
      }

      if (imported.length === 0) {
        setError('一致する生徒が見つかりませんでした。importid を確認してください。')
        return
      }

      const dedup = new Map(imported.map((entry) => [entry.studentId, entry]))
      setEntries(Array.from(dedup.values()))
      setRawTexts([])
      setStatus('done')
      setProgress(0)
      setSchaleMessage(
        skipped > 0
          ? `SchaleDBデータを ${dedup.size} 件取り込みました（未対応ID ${skipped} 件をスキップ）。下の「保存」を押すと反映されます。`
          : `SchaleDBデータを ${dedup.size} 件取り込みました。下の「保存」を押すと反映されます。`
      )
    } catch {
      setError('SchaleDBの文字列を読み取れませんでした。JSONまたはBase64文字列を確認してください。')
    }
  }, [schaleInput, students])

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      if (students.length === 0) {
        setStatus('error')
        setError('生徒データの読み込みが完了していません。少し待ってから再試行してください。')
        return
      }
      setStatus('processing')
      setError(null)
      setProgress(0)
      setRawTexts([])
      setEntries([])
      const fileList = Array.from(files)

      try {
        if (ocrMode === 'paddleocr' || ocrMode === 'deepseek' || ocrMode === 'deepseek-vllm') {
          const nextTexts: string[] = []
          const nextEntries: ExtractedStudent[] = []
          const deviceMemory =
            typeof navigator !== 'undefined'
              ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
              : undefined
          const memoryLimit = deviceMemory && deviceMemory <= 1 ? 1 : Infinity
          const baseConcurrency = Math.max(
            1,
            Number(process.env.NEXT_PUBLIC_PADDLE_OCR_CONCURRENCY ?? 1)
          )
          const concurrencyLimit = Math.min(memoryLimit, baseConcurrency)
          let completedSteps = 0
          let totalSteps = fileList.length * 2

          const updateProgress = () => {
            completedSteps += 1
            setProgress(Math.min(1, completedSteps / Math.max(totalSteps, 1)))
          }

          const ocrEngine = ocrMode
          const selectedModel =
            ocrMode === 'deepseek'
              ? deepseekModel
              : ocrMode === 'deepseek-vllm'
                ? deepseekVllmModel
                : ocrModel
          const tasks = fileList.map((file, i) => async () => {
            const segments = await splitStudentImage(file)
            const leftCanvas = preprocessCanvasForPaddle(segments.leftCanvas)
            const rightCanvas = preprocessCanvasForPaddle(segments.rightCanvas)
            const leftFile = await canvasToFile(leftCanvas, `left-${i}.png`)
            const rightFile = await canvasToFile(rightCanvas, `right-${i}.png`)
            const [leftText, rightText] = await Promise.all([
              fetchExternalOcrText(leftFile, ocrEngine, selectedModel).finally(updateProgress),
              fetchExternalOcrText(rightFile, ocrEngine, selectedModel).finally(updateProgress),
            ])

            if (leftText) {
              return {
                texts: [[leftText, rightText].filter(Boolean).join('\n')],
                entries: parseEntriesFromLeftRight(leftText, rightText, students),
              }
            }

            totalSteps += 1
            const fallbackText = await fetchExternalOcrText(
              file,
              ocrEngine,
              selectedModel
            ).finally(updateProgress)
            if (fallbackText) {
              return {
                texts: [fallbackText],
                entries: parseEntries(fallbackText, students),
              }
            }
            return { texts: [], entries: [] }
          })

          const results = await runWithConcurrency(tasks, concurrencyLimit)
          results.forEach((result) => {
            nextTexts.push(...result.texts)
            nextEntries.push(...result.entries)
          })

          setRawTexts(nextTexts)
          setEntries(nextEntries)
          setStatus('done')
          return
        }

        const { createWorker } = await import('tesseract.js')
        const nextTexts: string[] = []
        const nextEntries: ExtractedStudent[] = []
        let currentIndex = 0
        const worker = await createWorker('jpn+eng', 1, {
          logger: (info: { progress?: number }) => {
            if (typeof info.progress !== 'number') return
            const base = currentIndex / fileList.length
            setProgress(Math.min(1, base + info.progress / fileList.length))
          },
        })
        await worker.setParameters({
          preserve_interword_spaces: '1',
        })

        try {
          for (let i = 0; i < fileList.length; i += 1) {
            currentIndex = i
            const file = fileList[i]
            const segments = await splitStudentImage(file)
            const nameStarCanvas = preprocessCanvas(segments.nameStarCanvas)
            const nameStarResult = await worker.recognize(nameStarCanvas)
            const nameStarText = nameStarResult.data.text ?? ''

            const statTexts: string[] = []
            for (const canvas of segments.statCanvases) {
              const processed = preprocessCanvas(canvas)
              const statResult = await worker.recognize(processed)
              statTexts.push(statResult.data.text ?? '')
            }

            const fullFallbackCanvas = preprocessCanvas(segments.rightCanvas)
            const fallbackResult = await worker.recognize(fullFallbackCanvas)
            const fallbackText = fallbackResult.data.text ?? ''
            const combinedText = [nameStarText, ...statTexts, fallbackText].join('\n')

            nextTexts.push(combinedText)
            const parsed = parseEntriesFromSegments(nameStarText, statTexts, students)
            const results = parsed.length ? parsed : parseEntries(combinedText, students)

            nextEntries.push(...results)
            setProgress((i + 1) / fileList.length)
          }
        } finally {
          await worker.terminate()
        }

        setRawTexts(nextTexts)
        setEntries(nextEntries)
        setStatus('done')
      } catch (err) {
        setStatus('error')
        setError('画像の解析に失敗しました。別の画像を試してください。')
        console.error(err)
      }
    },
    [deepseekModel, deepseekVllmModel, ocrMode, ocrModel, students]
  )

  const updateEntry = useCallback(
    (id: string, updates: Partial<ExtractedStudent>) => {
      setEntries((prev) =>
        prev.map((entry) =>
          entry.studentId === id ? { ...entry, ...updates } : entry
        )
      )
    },
    []
  )

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.studentId !== id))
  }, [])

  const handleSave = useCallback(async () => {
    if (!entries.length) return
    setSaving(true)
    try {
      if (session) {
        const payload = entries.map((entry) => ({
          user_id: session.user.id,
          student_id: entry.studentId,
          ...emptyStats,
          level: entry.level ?? 0,
          star: entry.star ?? 0,
          bond: entry.bond ?? 0,
          hp: entry.hp ?? 0,
          hp_wb: entry.hpWb ?? 0,
          attack: entry.attack ?? 0,
          attack_wb: entry.attackWb ?? 0,
          defense: entry.defense ?? 0,
          heal: entry.heal ?? 0,
          heal_wb: entry.healWb ?? 0,
          ex_skill: entry.exSkill ?? 0,
          normal_skill: entry.normalSkill ?? 0,
          passive_skill: entry.passiveSkill ?? 0,
          sub_skill: entry.subSkill ?? 0,
          equip1: entry.equip1 ?? 0,
          equip2: entry.equip2 ?? 0,
          equip3: entry.equip3 ?? 0,
          unique_level: entry.weaponLevel ?? 0,
          unique_star: entry.weaponStar ?? 0,
          item_tier: entry.loveTier ?? 0,
        }))
        const { error: saveError } = await supabase.from('user_students').upsert(payload)
        if (saveError) {
          setError(saveError.message)
          return
        }
      } else {
        entries.forEach((entry) => {
          const obj = {
            ...emptyStats,
            level: entry.level ?? 0,
            star: entry.star ?? 0,
            bond: entry.bond ?? 0,
            hp: entry.hp ?? 0,
            hp_wb: entry.hpWb ?? 0,
            attack: entry.attack ?? 0,
            attack_wb: entry.attackWb ?? 0,
            defense: entry.defense ?? 0,
            heal: entry.heal ?? 0,
            heal_wb: entry.healWb ?? 0,
            ex_skill: entry.exSkill ?? 0,
            normal_skill: entry.normalSkill ?? 0,
            passive_skill: entry.passiveSkill ?? 0,
            sub_skill: entry.subSkill ?? 0,
            equip1: entry.equip1 ?? 0,
            equip2: entry.equip2 ?? 0,
            equip3: entry.equip3 ?? 0,
            unique_level: entry.weaponLevel ?? 0,
            unique_star: entry.weaponStar ?? 0,
            item_tier: entry.loveTier ?? 0,
          }
          localStorage.setItem(`userStudent:${entry.studentId}`, JSON.stringify(obj))
        })
      }
      setStatus('idle')
      setEntries([])
      setRawTexts([])
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }, [entries, onSaved, session, supabase])

  const hasEntries = entries.length > 0
  const isProcessing = status === 'processing'

  const summary = useMemo(() => {
    if (!hasEntries) return null
    return `抽出結果: ${entries.length}件`
  }, [entries.length, hasEntries])

  return (
    <main className="space-y-6">
      {showHeader && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">生徒データインポート</h2>
          <p className="text-sm text-gray-600">
            生徒データの画像をアップロードすると、OCRで生徒名と一部ステータスを抽出します。
          </p>
          <p className="text-xs text-gray-500">生徒詳細（基本情報）画面のスクリーンショットを推奨します。</p>
          <p className="text-xs text-gray-500">本機能は無料OCRのみを利用しており、結果は編集できます。</p>
          <p className="text-xs text-gray-500 whitespace-pre-line">{splitNote}</p>
        </div>
      )}

      {(mode === 'full' || mode === 'schale') && (
        <div className="border rounded p-4 space-y-3">
          <h3 className="text-base font-semibold">SchaleDBインポート</h3>
          <p className="text-sm text-gray-600">
            SchaleDBのエクスポート文字列（JSONまたはBase64）を貼り付けると、生徒データへ変換して下の表に展開します。
          </p>
          <textarea
            value={schaleInput}
            onChange={(e) => setSchaleInput(e.target.value)}
            placeholder="ここにSchaleDBのエクスポート文字列を貼り付け"
            className="w-full min-h-28 border rounded p-2"
            disabled={isProcessing || saving}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSchaleImport}
              disabled={isProcessing || saving}
              className="border rounded px-3 py-1 bg-blue-600 text-white disabled:opacity-50"
            >
              SchaleDB文字列を取り込み
            </button>
            {schaleMessage && <span className="text-sm text-gray-600">{schaleMessage}</span>}
          </div>
        </div>
      )}

      {(mode === 'full' || mode === 'image') && (
        <div className="border rounded p-4 space-y-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">OCRエンジン</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="ocr-mode"
                  value="paddleocr"
                  checked={ocrMode === 'paddleocr'}
                  onChange={() => setOcrMode('paddleocr')}
                  disabled={isProcessing}
                />
                PaddleOCR（デフォルト）
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="ocr-mode"
                  value="tesseract"
                  checked={ocrMode === 'tesseract'}
                  onChange={() => setOcrMode('tesseract')}
                  disabled={isProcessing}
                />
                tesseract.js
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="ocr-mode"
                  value="deepseek"
                  checked={ocrMode === 'deepseek'}
                  onChange={() => setOcrMode('deepseek')}
                  disabled={isProcessing}
                />
                DeepSeek OCR
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="ocr-mode"
                  value="deepseek-vllm"
                  checked={ocrMode === 'deepseek-vllm'}
                  onChange={() => setOcrMode('deepseek-vllm')}
                  disabled={isProcessing}
                />
                DeepSeek OCR（vLLM）
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">PaddleOCRモデル</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="paddleocr-model"
                  value="standard"
                  checked={ocrModel === 'standard'}
                  onChange={() => setOcrModel('standard')}
                  disabled={isProcessing || ocrMode !== 'paddleocr'}
                />
                標準
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="paddleocr-model"
                  value="high"
                  checked={ocrModel === 'high'}
                  onChange={() => setOcrModel('high')}
                  disabled={isProcessing || ocrMode !== 'paddleocr'}
                />
                高精度
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">DeepSeekモデル</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="deepseek-model"
                  value="deepseek-v1"
                  checked={deepseekModel === 'deepseek-v1'}
                  onChange={() => setDeepseekModel('deepseek-v1')}
                  disabled={isProcessing || ocrMode !== 'deepseek'}
                />
                DeepSeek v1
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="deepseek-model"
                  value="deepseek-v2"
                  checked={deepseekModel === 'deepseek-v2'}
                  onChange={() => setDeepseekModel('deepseek-v2')}
                  disabled={isProcessing || ocrMode !== 'deepseek'}
                />
                DeepSeek v2
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">DeepSeek vLLMモデル</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="deepseek-vllm-model"
                  value="deepseek-v1"
                  checked={deepseekVllmModel === 'deepseek-v1'}
                  onChange={() => setDeepseekVllmModel('deepseek-v1')}
                  disabled={isProcessing || ocrMode !== 'deepseek-vllm'}
                />
                DeepSeek v1
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="deepseek-vllm-model"
                  value="deepseek-v2"
                  checked={deepseekVllmModel === 'deepseek-v2'}
                  onChange={() => setDeepseekVllmModel('deepseek-v2')}
                  disabled={isProcessing || ocrMode !== 'deepseek-vllm'}
                />
                DeepSeek v2
              </label>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="border rounded px-3 py-2"
            disabled={isProcessing}
          >
            {isProcessing ? '解析中...' : '画像を選択'}
          </button>
          {isProcessing && (
            <div className="space-y-1">
              <div className="text-xs text-gray-500">解析進捗: {(progress * 100).toFixed(0)}%</div>
              <div className="h-2 bg-gray-200 rounded">
                <div className="h-2 bg-blue-500 rounded" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {summary && <p className="text-sm text-gray-700">{summary}</p>}
        </div>
      )}

      {hasEntries && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">抽出データ</h3>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="border rounded px-3 py-1 bg-blue-600 text-white disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">生徒</th>
                  <th className="px-3 py-2 text-left">レベル</th>
                  <th className="px-3 py-2 text-left">星</th>
                  <th className="px-3 py-2 text-left">絆</th>
                  <th className="px-3 py-2 text-left">HP</th>
                  <th className="px-3 py-2 text-left">HP WB</th>
                  <th className="px-3 py-2 text-left">攻撃力</th>
                  <th className="px-3 py-2 text-left">攻撃力 WB</th>
                  <th className="px-3 py-2 text-left">防御力</th>
                  <th className="px-3 py-2 text-left">治癒力</th>
                  <th className="px-3 py-2 text-left">治癒力 WB</th>
                  <th className="px-3 py-2 text-left">EX</th>
                  <th className="px-3 py-2 text-left">NS</th>
                  <th className="px-3 py-2 text-left">PS</th>
                  <th className="px-3 py-2 text-left">Sub</th>
                  <th className="px-3 py-2 text-left">武器Lv</th>
                  <th className="px-3 py-2 text-left">武器★</th>
                  <th className="px-3 py-2 text-left">装備1</th>
                  <th className="px-3 py-2 text-left">装備2</th>
                  <th className="px-3 py-2 text-left">装備3</th>
                  <th className="px-3 py-2 text-left">愛用品</th>
                  <th className="px-3 py-2 text-left">抽出元</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.studentId} className="border-t">
                    <td className="px-3 py-2">{entry.name}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={entry.level ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            level: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={entry.star ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            star: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-16"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.bond ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            bond: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-16"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.hp ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            hp: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-24"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.hpWb ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            hpWb: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.attack ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            attack: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-24"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.attackWb ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            attackWb: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.defense ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            defense: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.heal ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            heal: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-24"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.healWb ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            healWb: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={entry.exSkill ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            exSkill: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-16"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={entry.normalSkill ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            normalSkill: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-16"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={entry.passiveSkill ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            passiveSkill: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-16"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={entry.subSkill ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            subSkill: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-16"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.weaponLevel ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            weaponLevel: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={5}
                        value={entry.weaponStar ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            weaponStar: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-16"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.equip1 ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            equip1: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-16"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.equip2 ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            equip2: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-16"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.equip3 ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            equip3: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-16"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={entry.loveTier ?? ''}
                        onChange={(e) =>
                          updateEntry(entry.studentId, {
                            loveTier: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="border rounded px-2 py-1 w-16"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {entry.source}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeEntry(entry.studentId)}
                        className="text-red-600 text-xs"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!session && (
            <p className="text-xs text-gray-500">
              ログインしていないため、保存はローカルストレージに行われます。
            </p>
          )}
        </div>
      )}

      {rawTexts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">OCR抽出テキスト</h3>
          <div className="space-y-2">
            {rawTexts.map((text, idx) => (
              <pre
                key={idx}
                className="text-xs whitespace-pre-wrap bg-gray-100 rounded p-2"
              >
                {text}
              </pre>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}