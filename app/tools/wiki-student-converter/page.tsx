'use client'

import { useState } from 'react'
import PageHelpButton from '../../../components/PageHelpButton'

type ConvertResponse = {
  student: Record<string, unknown>
  warning?: string
}

type InspectResponse = {
  structure: Record<string, unknown>
}

type MappingRule = {
  path: string
  selector: string
  attr?: string
  valueType?: 'text' | 'number' | 'json'
}

const DEFAULT_MAPPING_JSON = JSON.stringify(
  [
    { path: 'name', selector: 'meta[property="og:title"]', attr: 'content', valueType: 'text' },
    { path: 'range', selector: 'tr:has(th:contains("射程距離")) td', valueType: 'number' },
  ],
  null,
  2,
)

export default function WikiStudentConverterPage() {
  const [url, setUrl] = useState('https://bluearchive.wikiru.jp/?%E3%82%B3%E3%83%A6%E3%82%AD%EF%BC%88%E3%83%91%E3%82%B8%E3%83%A3%E3%83%9E%EF%BC%89')
  const [mappingJson, setMappingJson] = useState(DEFAULT_MAPPING_JSON)
  const [result, setResult] = useState('')
  const [structureResult, setStructureResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [inspectLoading, setInspectLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  const parseMappings = (): MappingRule[] => {
    const parsed = JSON.parse(mappingJson) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is MappingRule => {
      if (!item || typeof item !== 'object') return false
      const record = item as Record<string, unknown>
      return typeof record.path === 'string' && typeof record.selector === 'string'
    })
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
      setStructureResult(JSON.stringify(json.structure, null, 2))
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
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <header className="flex items-center gap-2">
        <h1 className="text-xl font-bold">Wikiru → students.json 変換</h1>
        <PageHelpButton pageKey="wiki-student-converter" />
      </header>

      <p className="text-sm text-gray-600">サイト構造を取得し、項目ごとに selector を指定して値を上書きできます。</p>

      <div className="space-y-2 rounded border bg-white p-4">
        <label className="block text-sm font-semibold">Wikiru URL</label>
        <input value={url} onChange={(event) => setUrl(event.target.value)} className="w-full rounded border px-3 py-2" placeholder="https://bluearchive.wikiru.jp/?..." />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onInspect} disabled={inspectLoading} className="rounded bg-slate-700 px-4 py-2 text-white disabled:opacity-50">
            {inspectLoading ? '構造取得中...' : 'サイト構造を取得'}
          </button>
          <button type="button" onClick={onConvert} disabled={loading} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
            {loading ? '変換中...' : '変換する'}
          </button>
        </div>
      </div>

      <section className="space-y-2 rounded border bg-slate-50 p-4">
        <h2 className="text-base font-semibold">カスタムマッピング(JSON配列)</h2>
        <p className="text-xs text-gray-600">各要素は {`{ path, selector, attr?, valueType? }`} を指定します。valueType は text/number/json。</p>
        <textarea value={mappingJson} onChange={(event) => setMappingJson(event.target.value)} className="h-44 w-full rounded border bg-white p-3 font-mono text-xs" />
      </section>

      <section className="space-y-2 rounded border bg-slate-50 p-4">
        <h2 className="text-base font-semibold">サイト構造（取得結果）</h2>
        <textarea value={structureResult} readOnly className="h-52 w-full rounded border bg-white p-3 font-mono text-xs" />
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
