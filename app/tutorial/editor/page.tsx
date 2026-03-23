'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { getDefaultTutorialStepItems } from '../../../lib/site-tutorial'
import { type Locale } from '../../../lib/i18n/config'

const CUSTOM_TUTORIAL_KEY = 'app:siteTutorialCustom'
const PREVIEW_RETURN_KEY = 'app:siteTutorialPreviewReturnTo'
const PICK_RESULT_KEY = 'app:siteTutorialPickResult'

type StepItem = { key: string; text: string; selector: string; title: string }
type PickerMessage = { type: 'tutorial-selector-picked'; selector: string }
type PickResult = { selector: string; pickedAt: number }

const toJsonMap = (steps: StepItem[]) =>
  Object.fromEntries(steps.map((step) => [step.key, { text: step.text, selector: step.selector || undefined, title: step.title || undefined }]))

export default function TutorialEditorPage() {
  const locale = (useLocale() as Locale) || 'ja'
  const t = useTranslations('tutorial-editor')
  const defaultSteps = useMemo(
    () => getDefaultTutorialStepItems(locale).map((step) => ({ key: step.key, text: step.text, selector: step.selector ?? '', title: step.title ?? '' })),
    [locale]
  )
  const [steps, setSteps] = useState<StepItem[]>(defaultSteps)
  const [status, setStatus] = useState('')
  const [previewStep, setPreviewStep] = useState(0)
  const [pickingIndex, setPickingIndex] = useState<number | null>(null)

  const applyPickedSelector = useCallback(
    (selector: string) => {
      if (pickingIndex == null) return
      setSteps((prev) => prev.map((step, index) => (index === pickingIndex ? { ...step, selector } : step)))
      setStatus(t('setSelector', { selector }))
      setPickingIndex(null)
      setTimeout(() => setStatus(''), 2500)
    },
    [pickingIndex, t]
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
        if (!parsed.selector) return
        localStorage.removeItem(PICK_RESULT_KEY)
        applyPickedSelector(parsed.selector)
      } catch {
        // ignore
      }
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === PICK_RESULT_KEY) readPickResult()
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

  const updateStep = (index: number, patch: Partial<StepItem>) => setSteps((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  const addStep = () => setSteps((prev) => [...prev, { key: `step${prev.length + 1}`, text: '', selector: '', title: '' }])
  const removeStep = (index: number) => setSteps((prev) => prev.filter((_, itemIndex) => itemIndex !== index))

  const showStatus = (message: string) => {
    setStatus(message)
    setTimeout(() => setStatus(''), 2000)
  }

  const save = () => {
    try {
      localStorage.setItem(CUSTOM_TUTORIAL_KEY, jsonCode)
      showStatus(t('saved'))
    } catch {
      showStatus(t('saveFailed'))
    }
  }

  const reset = () => {
    localStorage.removeItem(CUSTOM_TUTORIAL_KEY)
    setSteps(defaultSteps)
    showStatus(t('resetDone'))
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
      <h1 className="text-xl font-bold">{t('title')}</h1>
      <p className="text-sm text-gray-600">{t('description')}</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={addStep} className="px-3 py-2 rounded border text-sm">{t('addStep')}</button>
        <button type="button" onClick={save} className="px-3 py-2 rounded border bg-blue-600 text-white text-sm">{t('save')}</button>
        <button type="button" onClick={reset} className="px-3 py-2 rounded border text-sm">{t('reset')}</button>
        <button type="button" onClick={startHomePreview} className="px-3 py-2 rounded border bg-emerald-600 text-white text-sm">{t('previewOnHome')}</button>
      </div>
      {status && <p className="text-sm text-green-600">{status}</p>}

      <section className="space-y-2 border rounded p-3 bg-blue-50">
        <p className="font-semibold text-sm">{t('previewTitle')}</p>
        {currentPreview ? (
          <>
            <p className="text-xs text-gray-600">{previewStep + 1} / {steps.length}</p>
            <p className="font-semibold">{currentPreview.title || t('unsetTitle')}</p>
            <p className="text-sm">{currentPreview.text || t('unsetText')}</p>
            <p className="text-xs font-mono text-gray-600">selector: {currentPreview.selector || t('unsetSelector')}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPreviewStep((prev) => Math.max(0, prev - 1))} disabled={previewStep === 0} className="px-2 py-1 border rounded text-xs disabled:opacity-50">{t('prev')}</button>
              <button type="button" onClick={() => setPreviewStep((prev) => Math.min(steps.length - 1, prev + 1))} disabled={previewStep >= steps.length - 1} className="px-2 py-1 border rounded text-xs disabled:opacity-50">{t('next')}</button>
            </div>
          </>
        ) : <p className="text-sm text-gray-500">{t('noStep')}</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          {steps.map((step, index) => (
            <div key={`${step.key}-${index}`} className="border rounded p-3 space-y-2">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-sm">{t('step')} {index + 1}</p>
                <button type="button" onClick={() => removeStep(index)} className="text-xs text-red-600">{t('remove')}</button>
              </div>
              <input value={step.key} onChange={(event) => updateStep(index, { key: event.target.value })} placeholder={t('keyPlaceholder')} className="w-full border rounded px-2 py-1 text-sm" />
              <input value={step.title} onChange={(event) => updateStep(index, { title: event.target.value })} placeholder={t('titlePlaceholder')} className="w-full border rounded px-2 py-1 text-sm" />
              <textarea value={step.text} onChange={(event) => updateStep(index, { text: event.target.value })} placeholder={t('textPlaceholder')} className="w-full h-20 border rounded px-2 py-1 text-sm" />
              <div className="flex gap-2">
                <input value={step.selector} onChange={(event) => updateStep(index, { selector: event.target.value })} placeholder={t('selectorPlaceholder')} className="w-full border rounded px-2 py-1 text-sm font-mono" />
                <button type="button" onClick={() => pickSelectorOnHome(index)} className="px-2 py-1 border rounded text-xs whitespace-nowrap">{t('guiPick')}</button>
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-2 border rounded p-3 bg-gray-50">
          <p className="font-semibold text-sm">{t('generatedCode')}</p>
          <pre className="text-xs overflow-auto whitespace-pre-wrap break-all bg-white border rounded p-2">{jsonCode}</pre>
        </section>
      </div>
    </main>
  )
}
