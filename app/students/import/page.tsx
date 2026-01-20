'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import Link from 'next/link'
import PageHelpButton from '../../../components/PageHelpButton'

interface Student {
  id: string
  name: string
}

interface ExtractedStudent {
  studentId: string
  name: string
  level: number | null
  star: number | null
  hp: number | null
  attack: number | null
  defense: number | null
  heal: number | null
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

const parseNumber = (line: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = line.match(pattern)
    if (match) return Number(match[1])
  }
  return null
}

const normalizeText = (text: string) =>
  text.replace(/\s+/g, '').replace(/[^\p{L}\p{N}★⭐]/gu, '')

const parseStatNumber = (value: string | undefined) => {
  if (!value) return null
  const num = Number(value.replace(/,/g, ''))
  return Number.isNaN(num) ? null : num
}

const parseSkillLevel = (text: string, pattern: RegExp, maxLevel: number) => {
  const match = text.match(pattern)
  if (!match) return null
  if (match[1] === 'MAX') return maxLevel
  return parseStatNumber(match[2])
}

const parseWeaponLevel = (text: string) => {
  const match = text.match(/(SMG|AR|HG|SG|MG|SR|GL|RL)[^\n]*?Lv\.?\s*(\d+)/i)
  return parseStatNumber(match?.[2])
}

const parseWeaponStar = (text: string) => {
  const starMatch = text.match(/固有武器[^\n]*?(★+)/)
  if (starMatch) return starMatch[1].length
  const altMatch = text.match(/固有武器[^\n]*?星\s*([1-5])/)
  return parseStatNumber(altMatch?.[1])
}

const parseEquipmentLevels = (text: string) => {
  const matches = [...text.matchAll(/T(\d{1,2})/g)]
  const levels = matches.map((match) => parseStatNumber(match[1])).filter((val) => val !== null)
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

const parseStudentDetails = (text: string) => {
  const hp = parseStatNumber(text.match(/HP\s*([0-9,]+)/i)?.[1])
  const attack = parseStatNumber(text.match(/攻撃力\s*([0-9,]+)/)?.[1])
  const defense = parseStatNumber(text.match(/防御力\s*([0-9,]+)/)?.[1])
  const heal = parseStatNumber(text.match(/治癒力\s*([0-9,]+)/)?.[1])
  const exSkill = parseSkillLevel(text, /EXスキル\s*(MAX|Lv\.?\s*(\d+))/i, 5)
  const normalSkill = parseSkillLevel(text, /ノーマルスキル\s*(MAX|Lv\.?\s*(\d+))/i, 10)
  const passiveSkill = parseSkillLevel(text, /(パッシブスキル\+?|パッシブ)\s*(MAX|Lv\.?\s*(\d+))/i, 10)
  const subSkill = parseSkillLevel(text, /サブスキル\s*(MAX|Lv\.?\s*(\d+))/i, 10)
  const weaponLevel = parseWeaponLevel(text)
  const weaponStar = parseWeaponStar(text)
  const equipment = parseEquipmentLevels(text)
  const loveTier = parseLoveTier(text)

  return {
    hp,
    attack,
    defense,
    heal,
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
  parseNumber(text, [/L[Vv]\.?\s*(\d{1,3})/, /レベル\s*(\d{1,3})/])

const extractStar = (text: string) => {
  const direct = parseNumber(text, [/★\s*([1-5])/, /星\s*([1-5])/])
  if (direct !== null) return direct
  const stars = text.match(/[★⭐]/g)
  if (stars) return stars.length
  return null
}

const findMatchedStudents = (text: string, students: Student[]) => {
  const normalized = normalizeText(text)
  const candidates = students
    .map((s) => ({
      ...s,
      normalizedName: normalizeText(s.name),
    }))
    .filter((s) => s.normalizedName && normalized.includes(s.normalizedName))

  return candidates.filter(
    (candidate) =>
      !candidates.some(
        (other) =>
          other.normalizedName.length > candidate.normalizedName.length &&
          other.normalizedName.includes(candidate.normalizedName)
      )
  )
}

const parseEntries = (text: string, students: Student[]) => {
  const normalized = normalizeText(text)
  const results: ExtractedStudent[] = []
  const seen = new Set<string>()
  const candidates = findMatchedStudents(text, students).sort(
    (a, b) => b.normalizedName.length - a.normalizedName.length
  )
  const singleMatch = candidates.length === 1

  for (const student of candidates) {
    if (!student.normalizedName) continue
    if (!normalized.includes(student.normalizedName)) continue
    if (seen.has(student.id)) continue
    const contextText = singleMatch ? text : extractNearText(text, student.name)
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

const preprocessCanvas = (source: HTMLCanvasElement) => {
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = source.width * scale
  canvas.height = source.height * scale
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
  const leftTop = cropCanvas(bitmap, 0, 0, leftWidth, leftTopHeight)
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

  return {
    leftCanvas,
    rightCanvas,
    nameStarCanvas: leftBottomUpper,
    statCanvases: [leftColumn1, leftColumn2, leftColumn3],
    previewCanvases: [leftCanvas, rightCanvas, leftTop],
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

const parseEntriesFromLeftRight = (leftText: string, rightText: string | null, students: Student[]) => {
  const entries = parseEntries(leftText, students)
  const weaponLevel = rightText ? extractWeaponLevelFromText(rightText) : null
  return entries.map((entry) => ({
    ...entry,
    weaponLevel: weaponLevel ?? entry.weaponLevel,
    source: [leftText, rightText].filter(Boolean).join('\n').trim(),
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

const fetchExternalOcrText = async (file: File) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const formData = new FormData()
      formData.append('image', file)
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

export default function StudentImportPage() {
  const session = useSession()
  const supabase = useSupabaseClient()
  const [students, setStudents] = useState<Student[]>([])
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [rawTexts, setRawTexts] = useState<string[]>([])
  const [entries, setEntries] = useState<ExtractedStudent[]>([])
  const [ocrMode, setOcrMode] = useState<'paddleocr' | 'tesseract'>('paddleocr')
  const [saving, setSaving] = useState(false)
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
        if (ocrMode === 'paddleocr') {
          const nextTexts: string[] = []
          const nextEntries: ExtractedStudent[] = []
          const concurrencyLimit = 2
          let completedSteps = 0
          let totalSteps = fileList.length * 2

          const updateProgress = () => {
            completedSteps += 1
            setProgress(Math.min(1, completedSteps / Math.max(totalSteps, 1)))
          }

          const tasks = fileList.map((file, i) => async () => {
            const segments = await splitStudentImage(file)
            const leftCanvas = preprocessCanvas(segments.leftCanvas)
            const rightCanvas = preprocessCanvas(segments.rightCanvas)
            const leftFile = await canvasToFile(leftCanvas, `left-${i}.png`)
            const rightFile = await canvasToFile(rightCanvas, `right-${i}.png`)
            const [leftText, rightText] = await Promise.all([
              fetchExternalOcrText(leftFile).finally(updateProgress),
              fetchExternalOcrText(rightFile).finally(updateProgress),
            ])

            if (leftText) {
              return {
                texts: [[leftText, rightText].filter(Boolean).join('\n')],
                entries: parseEntriesFromLeftRight(leftText, rightText, students),
              }
            }

            totalSteps += 1
            const fallbackText = await fetchExternalOcrText(file).finally(updateProgress)
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
    [ocrMode, students]
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
          hp: entry.hp ?? 0,
          attack: entry.attack ?? 0,
          defense: entry.defense ?? 0,
          heal: entry.heal ?? 0,
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
            hp: entry.hp ?? 0,
            attack: entry.attack ?? 0,
            defense: entry.defense ?? 0,
            heal: entry.heal ?? 0,
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
    } finally {
      setSaving(false)
    }
  }, [entries, session, supabase])

  const hasEntries = entries.length > 0
  const isProcessing = status === 'processing'

  const summary = useMemo(() => {
    if (!hasEntries) return null
    return `抽出結果: ${entries.length}件`
  }, [entries.length, hasEntries])

  return (
    <main className="p-4 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/students" className="text-blue-600 underline">
          生徒データ確認へ戻る
        </Link>
        <PageHelpButton pageKey="students-import" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">生徒データインポート</h2>
        <p className="text-sm text-gray-600">
          生徒データの画像をアップロードすると、OCRで生徒名と一部ステータスを抽出します。
        </p>
        <p className="text-xs text-gray-500">
          生徒詳細（基本情報）画面のスクリーンショットを推奨します。
        </p>
        <p className="text-xs text-gray-500">
          本機能は無料OCRのみを利用しており、結果は編集できます。
        </p>
        <p className="text-xs text-gray-500 whitespace-pre-line">{splitNote}</p>
      </div>
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
          </div>
          <p className="text-xs text-gray-500">
            PaddleOCRを選択した場合は、画像をそのまま送信して処理します。
          </p>
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
            <div className="text-xs text-gray-500">
              解析進捗: {(progress * 100).toFixed(0)}%
            </div>
            <div className="h-2 bg-gray-200 rounded">
              <div
                className="h-2 bg-blue-500 rounded"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {summary && <p className="text-sm text-gray-700">{summary}</p>}
      </div>

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
                  <th className="px-3 py-2 text-left">HP</th>
                  <th className="px-3 py-2 text-left">攻撃力</th>
                  <th className="px-3 py-2 text-left">防御力</th>
                  <th className="px-3 py-2 text-left">治癒力</th>
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
