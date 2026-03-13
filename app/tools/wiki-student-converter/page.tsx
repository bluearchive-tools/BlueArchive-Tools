'use client'

import { useMemo, useState } from 'react'
import PageHelpButton from '../../../components/PageHelpButton'

type ConvertResponse = {
  student: Record<string, unknown>
  warning?: string
}

type MappingRule = {
  path: string
  selector: string
  attr?: string
  valueType?: 'text' | 'number' | 'json'
}

type InspectField = {
  label: string
  selector: string
  value: string
  html: string
}

type InspectResponse = {
  structure: {
    title?: string
    fieldCount?: number
    fields?: InspectField[]
    rawHtml?: string
    rawText?: string
    headingLines?: string[]
    tableLines?: string[]
  }
}

const DEFAULT_MAPPING_JSON = JSON.stringify([], null, 2)

const COMMON_PATHS = [
  'name',
  'image',
  'attackType',
  'defenseType',
  'position',
  'cost',
  'hp',
  'attack',
  'defense',
  'heal',
  'range',
  'uniqueWeapon.name',
  'uniqueWeapon.attack',
  'uniqueWeapon.hp',
  'uniqueWeapon.heal',
]

export default function WikiStudentConverterPage() {
  const [url, setUrl] = useState('https://bluearchive.wikiru.jp/?%E3%82%B3%E3%83%A6%E3%82%AD%EF%BC%88%E3%83%91%E3%82%B8%E3%83%A3%E3%83%9E%EF%BC%89')
  const [mappingJson, setMappingJson] = useState(DEFAULT_MAPPING_JSON)
  const [selectedPath, setSelectedPath] = useState(COMMON_PATHS[0])
  const [customPath, setCustomPath] = useState('')
  const [result, setResult] = useState('')
  const [structureResult, setStructureResult] = useState<InspectResponse['structure'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [inspectLoading, setInspectLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  const fields = useMemo(() => structureResult?.fields ?? [], [structureResult])

  const parseMappings = (): MappingRule[] => {
    const parsed = JSON.parse(mappingJson) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is MappingRule => {
      if (!item || typeof item !== 'object') return false
      const record = item as Record<string, unknown>
      return typeof record.path === 'string' && typeof record.selector === 'string'
    })
  }

  const upsertMapping = (rule: MappingRule) => {
    let current: MappingRule[] = []
    try {
      current = parseMappings()
    } catch {
      current = []
    }
    const path = customPath.trim() || selectedPath
    const next = current.filter((item) => item.path !== path)
    next.push({ ...rule, path })
    setMappingJson(JSON.stringify(next, null, 2))
  }

  const onInspect = async () => {
    setInspectLoading(true)
    setError('')
    setWarning('')
    try {
      const response = await fetch('/api/wiki-student-convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode: 'inspect' }),
      })
      const json = (await response.json()) as Partial<InspectResponse> & { message?: string }
      if (!response.ok || !json.structure) {
        setError(json.message ?? '構造取得に失敗しました')
        return
      }
      setStructureResult(json.structure)
    } catch {
      setError('構造取得に失敗しました')
    } finally {
      setInspectLoading(false)
    }
  }

  const onConvert = async () => {
    setLoading(true)
    setError('')
    setWarning('')
    setResult('')

    let mappings: MappingRule[] = []
    try {
      mappings = parseMappings()
    } catch {
      setError('マッピングJSONの形式が不正です')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/wiki-student-convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode: 'convert', mappings }),
      })
      const json = (await response.json()) as Partial<ConvertResponse> & { message?: string }
      if (!response.ok || !json.student) {
        setError(json.message ?? '変換に失敗しました')
        return
      }
      if (json.warning) setWarning(json.warning)
      setResult(JSON.stringify(json.student, null, 2))
    } catch {
      setError('変換に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <header className="flex items-center gap-2">
        <h1 className="text-xl font-bold">Wikiru → students.json 変換</h1>
        <PageHelpButton pageKey="wiki-student-converter" />
      </header>

      <p className="text-sm text-gray-600">構造一覧の「この項目をマッピング」ボタンで、どこから値を取るかを指定できます。</p>

      <section className="space-y-2 rounded border bg-white p-4">
        <label className="block text-sm font-semibold">Wikiru URL</label>
        <input value={url} onChange={(event) => setUrl(event.target.value)} className="w-full rounded border px-3 py-2" placeholder="https://bluearchive.wikiru.jp/?..." />

        <div className="grid gap-2 md:grid-cols-[220px_1fr]">
          <select value={selectedPath} onChange={(event) => setSelectedPath(event.target.value)} className="rounded border px-3 py-2 text-sm">
            {COMMON_PATHS.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>
          <input value={customPath} onChange={(event) => setCustomPath(event.target.value)} className="rounded border px-3 py-2 text-sm" placeholder="または任意 path（例: skills.ex.text）" />
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onInspect} disabled={inspectLoading} className="rounded bg-slate-700 px-4 py-2 text-white disabled:opacity-50">
            {inspectLoading ? '構造取得中...' : 'サイト構造を取得'}
          </button>
          <button type="button" onClick={onConvert} disabled={loading} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
            {loading ? '変換中...' : '変換する'}
          </button>
        </div>
      </section>

      <section className="space-y-2 rounded border bg-slate-50 p-4">
        <h2 className="text-base font-semibold">カスタムマッピング(JSON配列)</h2>
        <p className="text-xs text-gray-600">ボタン操作で自動追記されます。手動編集も可能です。</p>
        <textarea value={mappingJson} onChange={(event) => setMappingJson(event.target.value)} className="h-44 w-full rounded border bg-white p-3 font-mono text-xs" />
      </section>

      <section className="space-y-2 rounded border bg-slate-50 p-4">
        <h2 className="text-base font-semibold">構造一覧（クリックでマッピング追加）</h2>
        <p className="text-xs text-gray-600">取得項目数: {structureResult?.fieldCount ?? 0}</p>
        <div className="max-h-[420px] overflow-auto rounded border bg-white">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                <th className="border px-2 py-1 text-left">ラベル</th>
                <th className="border px-2 py-1 text-left">値</th>
                <th className="border px-2 py-1 text-left">selector</th>
                <th className="border px-2 py-1">操作</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={`${field.label}-${field.selector}`}>
                  <td className="border px-2 py-1 align-top">{field.label}</td>
                  <td className="border px-2 py-1 align-top">{field.value}</td>
                  <td className="border px-2 py-1 align-top font-mono">{field.selector}</td>
                  <td className="border px-2 py-1 align-top text-center">
                    <button
                      type="button"
                      className="rounded bg-emerald-600 px-2 py-1 text-white"
                      onClick={() => upsertMapping({ path: customPath.trim() || selectedPath, selector: field.selector, valueType: 'text' })}
                    >
                      この項目をマッピング
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2 rounded border bg-slate-50 p-4">
        <h2 className="text-base font-semibold">構造詳細（生HTML / 生テキスト）</h2>
        <textarea value={structureResult?.rawHtml ?? structureResult?.rawText ?? ''} readOnly className="h-56 w-full rounded border bg-white p-3 font-mono text-xs" />
      </section>

      <section className="space-y-2 rounded border bg-slate-50 p-4">
        <h2 className="text-base font-semibold">変換出力</h2>
        <textarea value={result} readOnly className="h-[420px] w-full rounded border bg-white p-3 font-mono text-xs" />
      </section>

      {warning && <p className="text-sm text-amber-700">{warning}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </main>
  )
}
