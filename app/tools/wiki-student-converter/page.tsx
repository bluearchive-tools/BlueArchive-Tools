'use client'

import { useState } from 'react'
import PageHelpButton from '../../../components/PageHelpButton'

type ConvertResponse = {
  student: Record<string, unknown>
}

export default function WikiStudentConverterPage() {
  const [url, setUrl] = useState('https://bluearchive.wikiru.jp/?%E3%82%B3%E3%83%A6%E3%82%AD%EF%BC%88%E3%83%91%E3%82%B8%E3%83%A3%E3%83%9E%EF%BC%89')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onConvert = async () => {
    setLoading(true)
    setError('')
    setResult('')
    try {
      const response = await fetch('/api/wiki-student-convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const json = (await response.json()) as Partial<ConvertResponse> & { message?: string }
      if (!response.ok || !json.student) {
        setError(json.message ?? '変換に失敗しました')
        return
      }
      setResult(JSON.stringify(json.student, null, 2))
    } catch {
      setError('変換に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <header className="flex items-center gap-2">
        <h1 className="text-xl font-bold">Wikiru → students.json 変換</h1>
        <PageHelpButton pageKey="wiki-student-converter" />
      </header>

      <p className="text-sm text-gray-600">wikiru の生徒ページURLを貼ると students.json 形式の雛形を自動生成します。</p>

      <div className="space-y-2 rounded border bg-white p-4">
        <label className="block text-sm font-semibold">Wikiru URL</label>
        <input value={url} onChange={(event) => setUrl(event.target.value)} className="w-full rounded border px-3 py-2" placeholder="https://bluearchive.wikiru.jp/?..." />
        <button type="button" onClick={onConvert} disabled={loading} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          {loading ? '変換中...' : '変換する'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="space-y-2 rounded border bg-slate-50 p-4">
        <h2 className="text-base font-semibold">出力</h2>
        <textarea value={result} readOnly className="h-[420px] w-full rounded border bg-white p-3 font-mono text-xs" />
      </div>
    </main>
  )
}
