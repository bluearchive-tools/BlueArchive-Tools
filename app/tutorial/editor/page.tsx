'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import type { Locale } from '../../../lib/i18n/config'
import tutorialSteps from '../../../data/site-tutorial-steps.json'

const CUSTOM_TUTORIAL_KEY = 'app:siteTutorialCustom'
const PREVIEW_RETURN_KEY = 'app:siteTutorialPreviewReturnTo'
const PICK_RESULT_KEY = 'app:siteTutorialPickResult'

type StepItem = { key: string; text: string; selector: string; title: string }
type PickerMessage = { type: 'tutorial-selector-picked'; selector: string }
type PickResult = { selector: string; pickedAt: number }
type LocaleKey = 'ja' | 'en' | 'zh-CN' | 'zh-TW'
type TutorialLocaleMap = Record<string, { text?: string; selector?: string; title?: string }>

type UiText = {
  title: string
  description: string
  addStep: string
  save: string
  reset: string
  previewOnHome: string
  setSelector: (selector: string) => string
  saved: string
  saveFailed: string
  resetDone: string
  previewTitle: string
  noStep: string
  prev: string
  next: string
  step: string
  remove: string
  keyPlaceholder: string
  titlePlaceholder: string
  textPlaceholder: string
  selectorPlaceholder: string
  guiPick: string
  generatedCode: string
  unsetTitle: string
  unsetText: string
  unsetSelector: string
}

const UI_TEXT: Record<Locale, UiText> = {
  ja: {
    title: 'チュートリアル編集ページ',
    description: '初期値は `data/site-tutorial-steps.json` から読み込みます。必要に応じて保存すると localStorage が優先されます。',
    addStep: 'ステップ追加',
    save: '保存',
    reset: 'リセット',
    previewOnHome: 'ホームで実動プレビュー',
    setSelector: (selector) => `セレクタを設定しました: ${selector}`,
    saved: '保存しました。SiteTutorial に即時反映されます。',
    saveFailed: '保存に失敗しました。',
    resetDone: 'JSONの初期チュートリアルにリセットしました。',
    previewTitle: '簡易プレビュー（編集ページ内）',
    noStep: 'ステップがありません。',
    prev: '前へ',
    next: '次へ',
    step: 'Step',
    remove: '削除',
    keyPlaceholder: 'step key',
    titlePlaceholder: 'タイトル（任意）',
    textPlaceholder: '説明文',
    selectorPlaceholder: 'ハイライト対象のCSSセレクタ（任意）',
    guiPick: 'GUI選択',
    generatedCode: '生成コード（SiteTutorial が読む JSON）',
    unsetTitle: 'タイトル未設定',
    unsetText: '説明文未設定',
    unsetSelector: '(未設定)',
  },
  en: {
    title: 'Tutorial editor',
    description: 'Default values are loaded from `data/site-tutorial-steps.json`. If saved, localStorage values take priority.',
    addStep: 'Add step',
    save: 'Save',
    reset: 'Reset',
    previewOnHome: 'Preview on home',
    setSelector: (selector) => `Selector set: ${selector}`,
    saved: 'Saved. Changes are reflected in SiteTutorial immediately.',
    saveFailed: 'Failed to save.',
    resetDone: 'Reset to default tutorial JSON.',
    previewTitle: 'Quick preview',
    noStep: 'No steps.',
    prev: 'Prev',
    next: 'Next',
    step: 'Step',
    remove: 'Remove',
    keyPlaceholder: 'step key',
    titlePlaceholder: 'Title (optional)',
    textPlaceholder: 'Description',
    selectorPlaceholder: 'CSS selector to highlight (optional)',
    guiPick: 'GUI pick',
    generatedCode: 'Generated code (JSON consumed by SiteTutorial)',
    unsetTitle: 'No title',
    unsetText: 'No description',
    unsetSelector: '(not set)',
  },
  'zh-CN': {
    title: '教程编辑页面',
    description: '默认值来自 `data/site-tutorial-steps.json`。保存后会优先使用 localStorage。',
    addStep: '新增步骤',
    save: '保存',
    reset: '重置',
    previewOnHome: '在首页预览',
    setSelector: (selector) => `已设置选择器：${selector}`,
    saved: '已保存，SiteTutorial 会立即生效。',
    saveFailed: '保存失败。',
    resetDone: '已重置为默认教程 JSON。',
    previewTitle: '简易预览',
    noStep: '没有步骤。',
    prev: '上一步',
    next: '下一步',
    step: '步骤',
    remove: '删除',
    keyPlaceholder: 'step key',
    titlePlaceholder: '标题（可选）',
    textPlaceholder: '说明文字',
    selectorPlaceholder: '高亮目标 CSS 选择器（可选）',
    guiPick: 'GUI选择',
    generatedCode: '生成代码（SiteTutorial 读取的 JSON）',
    unsetTitle: '未设置标题',
    unsetText: '未设置说明',
    unsetSelector: '(未设置)',
  },
  'zh-TW': {
    title: '教學編輯頁面',
    description: '預設值來自 `data/site-tutorial-steps.json`。儲存後會優先使用 localStorage。',
    addStep: '新增步驟',
    save: '儲存',
    reset: '重設',
    previewOnHome: '在首頁預覽',
    setSelector: (selector) => `已設定選擇器：${selector}`,
    saved: '已儲存，SiteTutorial 會立即套用。',
    saveFailed: '儲存失敗。',
    resetDone: '已重設為預設教學 JSON。',
    previewTitle: '簡易預覽',
    noStep: '沒有步驟。',
    prev: '上一步',
    next: '下一步',
    step: '步驟',
    remove: '刪除',
    keyPlaceholder: 'step key',
    titlePlaceholder: '標題（可選）',
    textPlaceholder: '說明文字',
    selectorPlaceholder: '要高亮的 CSS 選擇器（可選）',
    guiPick: 'GUI選取',
    generatedCode: '產生程式碼（SiteTutorial 讀取的 JSON）',
    unsetTitle: '未設定標題',
    unsetText: '未設定說明',
    unsetSelector: '(未設定)',
  },
}

const compareStepKeys = (a: string, b: string) => {
  const partA = a.match(/^(.*?)(\d+)$/)
  const partB = b.match(/^(.*?)(\d+)$/)
  if (partA && partB && partA[1] === partB[1]) {
    const numDiff = Number(partA[2]) - Number(partB[2])
    if (numDiff !== 0) return numDiff
  }
  return a.localeCompare(b)
}

const getDefaultSteps = (locale: LocaleKey): StepItem[] => {
  const maps = tutorialSteps as Partial<Record<LocaleKey, TutorialLocaleMap>>
  const map = maps[locale] ?? maps.en ?? {}
  return Object.entries(map)
    .sort(([a], [b]) => compareStepKeys(a, b))
    .map(([key, value]) => ({ key, text: value.text ?? '', selector: value.selector ?? '', title: value.title ?? '' }))
}

const toJsonMap = (steps: StepItem[]) =>
  Object.fromEntries(steps.map((step) => [step.key, { text: step.text, selector: step.selector || undefined, title: step.title || undefined }]))

export default function TutorialEditorPage() {
  const locale = (useLocale() as Locale) || 'ja'
  const ui = UI_TEXT[locale] ?? UI_TEXT.ja
  const defaultSteps = useMemo(() => getDefaultSteps(locale as LocaleKey), [locale])
  const [steps, setSteps] = useState<StepItem[]>(defaultSteps)
  const [status, setStatus] = useState('')
  const [previewStep, setPreviewStep] = useState(0)
  const [pickingIndex, setPickingIndex] = useState<number | null>(null)

  const applyPickedSelector = useCallback(
    (selector: string) => {
      if (pickingIndex == null) return
      setSteps((prev) => prev.map((step, index) => (index === pickingIndex ? { ...step, selector } : step)))
      setStatus(ui.setSelector(selector))
      setPickingIndex(null)
      setTimeout(() => setStatus(''), 2500)
    },
    [pickingIndex, ui]
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_TUTORIAL_KEY)
      if (!raw) {
        setSteps(defaultSteps)
        return
      }
      const parsed = JSON.parse(raw) as Record<string, { text?: string; selector?: string; title?: string }>
      const restored = Object.entries(parsed).map(([key, value]) => ({ key, text: value?.text ?? '', selector: value?.selector ?? '', title: value?.title ?? '' }))
      if (restored.length) setSteps(restored)
    } catch {
      setSteps(defaultSteps)
    }
  }, [defaultSteps])

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
      setStatus(ui.saved)
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus(ui.saveFailed)
      setTimeout(() => setStatus(''), 2000)
    }
  }

  const reset = () => {
    localStorage.removeItem(CUSTOM_TUTORIAL_KEY)
    setSteps(defaultSteps)
    setStatus(ui.resetDone)
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
      <h1 className="text-xl font-bold">{ui.title}</h1>
      <p className="text-sm text-gray-600">{ui.description}</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={addStep} className="px-3 py-2 rounded border text-sm">{ui.addStep}</button>
        <button type="button" onClick={save} className="px-3 py-2 rounded border bg-blue-600 text-white text-sm">{ui.save}</button>
        <button type="button" onClick={reset} className="px-3 py-2 rounded border text-sm">{ui.reset}</button>
        <button type="button" onClick={startHomePreview} className="px-3 py-2 rounded border bg-emerald-600 text-white text-sm">{ui.previewOnHome}</button>
      </div>
      {status && <p className="text-sm text-green-600">{status}</p>}

      <section className="space-y-2 border rounded p-3 bg-blue-50">
        <p className="font-semibold text-sm">{ui.previewTitle}</p>
        {currentPreview ? (
          <>
            <p className="text-xs text-gray-600">{previewStep + 1} / {steps.length}</p>
            <p className="font-semibold">{currentPreview.title || ui.unsetTitle}</p>
            <p className="text-sm">{currentPreview.text || ui.unsetText}</p>
            <p className="text-xs font-mono text-gray-600">selector: {currentPreview.selector || ui.unsetSelector}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPreviewStep((p) => Math.max(0, p - 1))} disabled={previewStep === 0} className="px-2 py-1 border rounded text-xs disabled:opacity-50">{ui.prev}</button>
              <button type="button" onClick={() => setPreviewStep((p) => Math.min(steps.length - 1, p + 1))} disabled={previewStep >= steps.length - 1} className="px-2 py-1 border rounded text-xs disabled:opacity-50">{ui.next}</button>
            </div>
          </>
        ) : <p className="text-sm text-gray-500">{ui.noStep}</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          {steps.map((step, index) => (
            <div key={`${step.key}-${index}`} className="border rounded p-3 space-y-2">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-sm">{ui.step} {index + 1}</p>
                <button type="button" onClick={() => removeStep(index)} className="text-xs text-red-600">{ui.remove}</button>
              </div>
              <input value={step.key} onChange={(e) => updateStep(index, { key: e.target.value })} placeholder={ui.keyPlaceholder} className="w-full border rounded px-2 py-1 text-sm" />
              <input value={step.title} onChange={(e) => updateStep(index, { title: e.target.value })} placeholder={ui.titlePlaceholder} className="w-full border rounded px-2 py-1 text-sm" />
              <textarea value={step.text} onChange={(e) => updateStep(index, { text: e.target.value })} placeholder={ui.textPlaceholder} className="w-full h-20 border rounded px-2 py-1 text-sm" />
              <div className="flex gap-2">
                <input value={step.selector} onChange={(e) => updateStep(index, { selector: e.target.value })} placeholder={ui.selectorPlaceholder} className="w-full border rounded px-2 py-1 text-sm font-mono" />
                <button type="button" onClick={() => pickSelectorOnHome(index)} className="px-2 py-1 border rounded text-xs whitespace-nowrap">{ui.guiPick}</button>
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-2 border rounded p-3 bg-gray-50">
          <p className="font-semibold text-sm">{ui.generatedCode}</p>
          <pre className="text-xs overflow-auto whitespace-pre-wrap break-all bg-white border rounded p-2">{jsonCode}</pre>
        </section>
      </div>
    </main>
  )
}
