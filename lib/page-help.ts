import pageHelpJa from '../data/pageHelp/ja.json'
import pageHelpEn from '../data/pageHelp/en.json'
import pageHelpZhCn from '../data/pageHelp/zh-CN.json'
import pageHelpZhTw from '../data/pageHelp/zh-TW.json'
import type { Locale } from './i18n/config'

export type PageHelpEntry = {
  title: string
  buttonLabel?: string
}

export type PageHelpLocale = Record<string, PageHelpEntry> & {
  _common?: {
    buttonLabel?: string
  }
}

export const PAGE_HELP_BY_LOCALE = {
  ja: pageHelpJa,
  en: pageHelpEn,
  'zh-CN': pageHelpZhCn,
  'zh-TW': pageHelpZhTw,
} as const satisfies Record<Locale, PageHelpLocale>

const EXTRA_PAGE_KEYS = ['about', 'html-tags-example'] as const

export const PAGE_HELP_PAGE_KEYS = [
  ...new Set([
    ...Object.values(PAGE_HELP_BY_LOCALE).flatMap((content) => Object.keys(content).filter((key) => key !== '_common')),
    ...EXTRA_PAGE_KEYS,
  ]),
].sort((a, b) => a.localeCompare(b))
