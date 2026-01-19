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
  text.replace(/\s+/g, '').replace(/[^\p{L}\p{N}★]/gu, '')

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
  const stars = text.match(/★+/)
  if (stars) return stars[0].length
  return null
}

const parseEntries = (text: string, students: Student[]) => {
  const normalized = normalizeText(text)
  const results: ExtractedStudent[] = []
  const seen = new Set<string>()

  const candidates = students
    .map((s) => ({
      ...s,
      normalizedName: normalizeText(s.name),
    }))
    .sort((a, b) => b.normalizedName.length - a.normalizedName.length)

  for (const student of candidates) {
    if (!student.normalizedName) continue
    if (!normalized.includes(student.normalizedName)) continue
    if (seen.has(student.id)) continue
    const nearText = extractNearText(text, student.name)
    const level = extractLevel(nearText)
    const star = extractStar(nearText)
    results.push({
      studentId: student.id,
      name: student.name,
      level,
      star,
      source: nearText.trim(),
    })
    seen.add(student.id)
  }

  return results
}

const preprocessImage = async (file: File) => {
  const bitmap = await createImageBitmap(file)
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width * scale
  canvas.height = bitmap.height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
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

export default function StudentImportPage() {
  const session = useSession()
  const supabase = useSupabaseClient()
  const [students, setStudents] = useState<Student[]>([])
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [rawTexts, setRawTexts] = useState<string[]>([])
  const [entries, setEntries] = useState<ExtractedStudent[]>([])
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
          tessedit_pageseg_mode: '6',
          preserve_interword_spaces: '1',
        })

        try {
          for (let i = 0; i < fileList.length; i += 1) {
            currentIndex = i
            const file = fileList[i]
            const image = await preprocessImage(file)
            const result = await worker.recognize(image)
            const text = result.data.text ?? ''
            nextTexts.push(text)
            nextEntries.push(...parseEntries(text, students))
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
    [students]
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
          level: entry.level ?? 0,
          star: entry.star ?? 0,
          ...emptyStats,
        }))
        const { error: saveError } = await supabase.from('user_students').upsert(payload)
        if (saveError) {
          setError(saveError.message)
          return
        }
      } else {
        entries.forEach((entry) => {
          const obj = {
            level: entry.level ?? 0,
            star: entry.star ?? 0,
            ...emptyStats,
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
      </div>
      <div className="border rounded p-4 space-y-3">
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
