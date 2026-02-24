'use client'

import { useEffect, useMemo, useState } from 'react'

const CUSTOM_TUTORIAL_KEY = 'app:siteTutorialCustom'

type StepItem = {
  key: string
  text: string
  selector: string
  title: string
}

const defaultSteps: StepItem[] = [
  { key: 'step1', text: 'ホーム画面から、目的のツールやミニゲームを選択できます。', selector: '[data-tutorial="home-links"]', title: 'ホーム' },
  { key: 'step2', text: '各ツールは「計算ツール」セクションから選べます。', selector: '[data-tutorial="tools-links"]', title: '計算ツール' },
]

const toJsonMap = (steps: StepItem[]) =>
  Object.fromEntries(
    steps.map((step) => [step.key, { text: step.text, selector: step.selector || undefined, title: step.title || undefined }])
  )

export default function TutorialEditorPage() {
  const [steps, setSteps] = useState<StepItem[]>(defaultSteps)
  const [status, setStatus] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_TUTORIAL_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, { text?: string; selector?: string; title?: string }>
      const restored = Object.entries(parsed).map(([key, value]) => ({
        key,
        text: value?.text ?? '',
        selector: value?.selector ?? '',
        title: value?.title ?? '',
      }))
      if (restored.length) setSteps(restored)
    } catch {
      // ignore
    }
  }, [])

  const jsonCode = useMemo(() => JSON.stringify(toJsonMap(steps), null, 2), [steps])

  const updateStep = (index: number, patch: Partial<StepItem>) => {
    setSteps((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      { key: `step${prev.length + 1}`, text: '', selector: '', title: '' },
    ])
  }

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  const save = () => {
    try {
      localStorage.setItem(CUSTOM_TUTORIAL_KEY, jsonCode)
      setStatus('保存しました。SiteTutorial に即時反映されます。')
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus('保存に失敗しました。')
      setTimeout(() => setStatus(''), 2000)
    }
  }

  const reset = () => {
    localStorage.removeItem(CUSTOM_TUTORIAL_KEY)
    setSteps(defaultSteps)
    setStatus('カスタムチュートリアルをリセットしました。')
    setTimeout(() => setStatus(''), 2000)
  }

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-bold">チュートリアル編集ページ</h1>
      <p className="text-sm text-gray-600">各ステップの説明・ハイライト対象（CSS セレクタ）を編集できます。右側で JSON コードを確認できます。</p>

      <div className="flex gap-2">
        <button type="button" onClick={addStep} className="px-3 py-2 rounded border text-sm">ステップ追加</button>
        <button type="button" onClick={save} className="px-3 py-2 rounded border bg-blue-600 text-white text-sm">保存</button>
        <button type="button" onClick={reset} className="px-3 py-2 rounded border text-sm">リセット</button>
      </div>
      {status && <p className="text-sm text-green-600">{status}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          {steps.map((step, index) => (
            <div key={`${step.key}-${index}`} className="border rounded p-3 space-y-2">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-sm">Step {index + 1}</p>
                <button type="button" onClick={() => removeStep(index)} className="text-xs text-red-600">削除</button>
              </div>
              <input value={step.key} onChange={(e) => updateStep(index, { key: e.target.value })} placeholder="step key" className="w-full border rounded px-2 py-1 text-sm" />
              <input value={step.title} onChange={(e) => updateStep(index, { title: e.target.value })} placeholder="タイトル（任意）" className="w-full border rounded px-2 py-1 text-sm" />
              <textarea value={step.text} onChange={(e) => updateStep(index, { text: e.target.value })} placeholder="説明文" className="w-full h-20 border rounded px-2 py-1 text-sm" />
              <input value={step.selector} onChange={(e) => updateStep(index, { selector: e.target.value })} placeholder="ハイライト対象のCSSセレクタ（任意）" className="w-full border rounded px-2 py-1 text-sm font-mono" />
            </div>
          ))}
        </section>

        <section className="space-y-2 border rounded p-3 bg-gray-50">
          <p className="font-semibold text-sm">生成コード（SiteTutorial が読む JSON）</p>
          <pre className="text-xs overflow-auto whitespace-pre-wrap break-all bg-white border rounded p-2">{jsonCode}</pre>
        </section>
      </div>
    </main>
  )
}
