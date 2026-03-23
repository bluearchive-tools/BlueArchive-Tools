import tutorialStepsJa from '../data/site-tutorial-steps/ja.json'
import tutorialStepsEn from '../data/site-tutorial-steps/en.json'
import tutorialStepsZhCn from '../data/site-tutorial-steps/zh-CN.json'
import tutorialStepsZhTw from '../data/site-tutorial-steps/zh-TW.json'
import type { Locale } from './i18n/config'

export type TutorialStep = {
  text: string
  selector?: string
  title?: string
}

export type TutorialStepItem = TutorialStep & {
  key: string
}

export type TutorialLocaleEntry =
  | string
  | {
      text?: string
      selector?: string
      title?: string
    }

export type TutorialLocaleMap = Record<string, TutorialLocaleEntry>

export const SITE_TUTORIAL_BY_LOCALE = {
  ja: tutorialStepsJa,
  en: tutorialStepsEn,
  'zh-CN': tutorialStepsZhCn,
  'zh-TW': tutorialStepsZhTw,
} as const satisfies Record<Locale, TutorialLocaleMap>

export const compareStepKeys = (a: string, b: string) => {
  const partA = a.match(/^(.*?)(\d+)$/)
  const partB = b.match(/^(.*?)(\d+)$/)
  if (partA && partB && partA[1] === partB[1]) {
    const numDiff = Number(partA[2]) - Number(partB[2])
    if (numDiff !== 0) return numDiff
  }
  return a.localeCompare(b)
}

export const parseTutorialStepItems = (value: TutorialLocaleMap): TutorialStepItem[] =>
  Object.entries(value)
    .sort(([a], [b]) => compareStepKeys(a, b))
    .map(([key, item]) => {
      if (typeof item === 'string') return { key, text: item }
      if (typeof item.text !== 'string' || !item.text.trim()) return null
      return {
        key,
        text: item.text,
        selector: typeof item.selector === 'string' && item.selector.trim() ? item.selector : undefined,
        title: typeof item.title === 'string' && item.title.trim() ? item.title : undefined,
      }
    })
    .filter((step): step is TutorialStepItem => step !== null)

export const parseTutorialSteps = (value: TutorialLocaleMap): TutorialStep[] =>
  parseTutorialStepItems(value).map((step) => ({
    text: step.text,
    selector: step.selector,
    title: step.title,
  }))

export const getDefaultTutorialSteps = (locale: Locale): TutorialStep[] => {
  const current = SITE_TUTORIAL_BY_LOCALE[locale] ?? SITE_TUTORIAL_BY_LOCALE.ja
  return parseTutorialSteps(current)
}

export const getDefaultTutorialStepItems = (locale: Locale): TutorialStepItem[] => {
  const current = SITE_TUTORIAL_BY_LOCALE[locale] ?? SITE_TUTORIAL_BY_LOCALE.ja
  return parseTutorialStepItems(current)
}
