import type { AbstractIntlMessages } from 'next-intl'

import enMessages from '../../locales/messages/en.json'
import jaMessages from '../../locales/messages/ja.json'
import zhCnMessages from '../../locales/messages/zh-CN.json'
import zhTwMessages from '../../locales/messages/zh-TW.json'

export const SUPPORTED_LOCALES = ['ja', 'en', 'zh-CN', 'zh-TW'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'ja'

export const LOCALE_MESSAGES = {
  en: enMessages,
  ja: jaMessages,
  'zh-CN': zhCnMessages,
  'zh-TW': zhTwMessages,
} as const satisfies Record<Locale, AbstractIntlMessages>

export type Messages = (typeof LOCALE_MESSAGES)[Locale]

const LOCALE_ALIAS_MAP: Record<string, Locale> = {
  ja: 'ja',
  en: 'en',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-sg': 'zh-CN',
  'zh-hans': 'zh-CN',
  'zh-tw': 'zh-TW',
  'zh-hk': 'zh-TW',
  'zh-hant': 'zh-TW',
}

export function parseLocale(locale?: string | null): Locale | undefined {
  if (!locale) return undefined
  const normalized = locale.trim().toLowerCase()
  if (normalized in LOCALE_ALIAS_MAP) return LOCALE_ALIAS_MAP[normalized]

  const main = normalized.split(',')[0]?.split(';')[0]?.trim() ?? ''
  if (main in LOCALE_ALIAS_MAP) return LOCALE_ALIAS_MAP[main]

  return SUPPORTED_LOCALES.find((value) => value.toLowerCase() === main)
}
