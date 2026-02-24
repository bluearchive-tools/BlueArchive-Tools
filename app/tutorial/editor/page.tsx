'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

const CUSTOM_TUTORIAL_KEY = 'app:siteTutorialCustom'
const PREVIEW_RETURN_KEY = 'app:siteTutorialPreviewReturnTo'
const PICK_RESULT_KEY = 'app:siteTutorialPickResult'

type StepItem = { key: string; text: string; selector: string; title: string }
type PickerMessage = { type: 'tutorial-selector-picked'; selector: string }
type PickResult = { selector: string; pickedAt: number }

const defaultSteps: StepItem[] = [
  { key: 'step1', text: 'ホーム画面から、目的のツールやミニゲームを選択できます。', selector: '[data-tutorial="home-links"]', title: 'ホーム' },
  { key: 'step2', text: '各ツールは「計算ツール」セクションから選べます。', selector: '[data-tutorial="tools-links"]', title: '計算ツール' },
]

const toJsonMap = (steps: StepItem[]) => Object.fromEntries(steps.map((step) => [step.key, { text: step.text, selector: step.selector || undefined, title: step.title || undefined }]))

export default function TutorialEditorPage() {
  const [steps, setSteps] = useState<StepItem[]>(defaultSteps)
  const [status, setStatus] = useState('')
  const [previewStep, setPreviewStep] = useState(0)
  const [pickingIndex, setPickingIndex] = useState<number | null>(null)

  const applyPickedSelector = useCallback((selector: string) => {
    if (pickingIndex == null) return
    setSteps((prev) => prev.map((step, index) => (index === pickingIndex ? { ...step, selector } : step)))
    setStatus(`セレクタを設定しました: ${selector}`)
    setPickingIndex(null)
    setTimeout(() => setStatus(''), 2500)
  }, [pickingIndex])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_TUTORIAL_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, { text?: string; selector?: string; title?: string }>
      const restored = Object.entries(parsed).map(([key, value]) => ({ key, text: value?.text ?? '', selector: value?.selector ?? '', title: value?.title ?? '' }))
      if (restored.length) setSteps(restored)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const handler = (event: MessageEvent<PickerMessage>) => {
      if (event.data?.type !== 'tutorial-selector-picked') return
      applyPickedSelector(event.data.selector)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [applyPickedSelector])

  useEffect(() => {
    const readPickResult = () => {
      try {
        const raw = localStorage.getItem(PICK_RESULT_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as PickResult
        if (!parsed?.selector) return
        localStorage.removeItem(PICK_RESULT_KEY)
        applyPickedSelector(parsed.selector)
      } catch {
        // ignore
      }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === PICK_RESULT_KEY) readPickResult()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', readPickResult)
    readPickResult()
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', readPickResult)
    }
  }, [applyPickedSelector])

  const jsonCode = useMemo(() => JSON.stringify(toJsonMap(steps), null, 2), [steps])
  const currentPreview = steps[Math.max(0, Math.min(previewStep, steps.length - 1))]

  const updateStep = (index: number, patch: Partial<StepItem>) => setSteps((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  const addStep = () => setSteps((prev) => [...prev, { key: `step${prev.length + 1}`, text: '', selector: '', title: '' }])
  const removeStep = (index: number) => setSteps((prev) => prev.filter((_, i) => i !== index))

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

  const startHomePreview = () => {
    localStorage.setItem(CUSTOM_TUTORIAL_KEY, jsonCode)
    localStorage.setItem(PREVIEW_RETURN_KEY, '/tutorial/editor')
    window.location.href = '/?tutorial=preview'
  }

  const pickSelectorOnHome = (index: number) => {
    localStorage.setItem(CUSTOM_TUTORIAL_KEY, jsonCode)
    setPickingIndex(index)
    window.open('/?tutorial=pick', '_blank')
  }

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-bold">チュートリアル編集ページ</h1>
      <p className="text-sm text-gray-600">ステップ編集に加えて、下の「簡易プレビュー」で見た目確認、または「ホームで実動プレビュー」で実際に開始→完了→このページへ自動復帰できます。</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={addStep} className="px-3 py-2 rounded border text-sm">ステップ追加</button>
        <button type="button" onClick={save} className="px-3 py-2 rounded border bg-blue-600 text-white text-sm">保存</button>
        <button type="button" onClick={reset} className="px-3 py-2 rounded border text-sm">リセット</button>
        <button type="button" onClick={startHomePreview} className="px-3 py-2 rounded border bg-emerald-600 text-white text-sm">ホームで実動プレビュー</button>
      </div>
      {status && <p className="text-sm text-green-600">{status}</p>}

      <section className="space-y-2 border rounded p-3 bg-blue-50">
        <p className="font-semibold text-sm">簡易プレビュー（編集ページ内）</p>
        {currentPreview ? (
          <>
            <p className="text-xs text-gray-600">{previewStep + 1} / {steps.length}</p>
            <p className="font-semibold">{currentPreview.title || 'タイトル未設定'}</p>
            <p className="text-sm">{currentPreview.text || '説明文未設定'}</p>
            <p className="text-xs font-mono text-gray-600">selector: {currentPreview.selector || '(未設定)'}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPreviewStep((p) => Math.max(0, p - 1))} disabled={previewStep === 0} className="px-2 py-1 border rounded text-xs disabled:opacity-50">前へ</button>
              <button type="button" onClick={() => setPreviewStep((p) => Math.min(steps.length - 1, p + 1))} disabled={previewStep >= steps.length - 1} className="px-2 py-1 border rounded text-xs disabled:opacity-50">次へ</button>
            </div>
          </>
        ) : <p className="text-sm text-gray-500">ステップがありません。</p>}
      </section>

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
              <div className="flex gap-2">
                <input value={step.selector} onChange={(e) => updateStep(index, { selector: e.target.value })} placeholder="ハイライト対象のCSSセレクタ（任意）" className="w-full border rounded px-2 py-1 text-sm font-mono" />
                <button type="button" onClick={() => pickSelectorOnHome(index)} className="px-2 py-1 border rounded text-xs whitespace-nowrap">GUI選択</button>
              </div>
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
