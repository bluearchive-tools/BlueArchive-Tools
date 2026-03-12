import type { AbstractIntlMessages } from 'next-intl'

import commonEn from '../../locales/en/common.json'
import footerEn from '../../locales/en/footer.json'
import headerEn from '../../locales/en/header.json'
import homeEn from '../../locales/en/home.json'
import bgmQuizEn from '../../locales/en/bgm-quiz.json'
import bgmPlayerEn from '../../locales/en/bgm-player.json'
import bgmDjEn from '../../locales/en/bgm-dj.json'
import siteTutorialEn from '../../locales/en/site-tutorial.json'
import commonJa from '../../locales/ja/common.json'
import footerJa from '../../locales/ja/footer.json'
import headerJa from '../../locales/ja/header.json'
import homeJa from '../../locales/ja/home.json'
import bgmQuizJa from '../../locales/ja/bgm-quiz.json'
import bgmPlayerJa from '../../locales/ja/bgm-player.json'
import bgmDjJa from '../../locales/ja/bgm-dj.json'
import siteTutorialJa from '../../locales/ja/site-tutorial.json'
import commonZhCn from '../../locales/zh-CN/common.json'
import footerZhCn from '../../locales/zh-CN/footer.json'
import headerZhCn from '../../locales/zh-CN/header.json'
import homeZhCn from '../../locales/zh-CN/home.json'
import bgmQuizZhCn from '../../locales/zh-CN/bgm-quiz.json'
import bgmPlayerZhCn from '../../locales/zh-CN/bgm-player.json'
import bgmDjZhCn from '../../locales/zh-CN/bgm-dj.json'
import siteTutorialZhCn from '../../locales/zh-CN/site-tutorial.json'
import commonZhTw from '../../locales/zh-TW/common.json'
import footerZhTw from '../../locales/zh-TW/footer.json'
import headerZhTw from '../../locales/zh-TW/header.json'
import homeZhTw from '../../locales/zh-TW/home.json'
import bgmQuizZhTw from '../../locales/zh-TW/bgm-quiz.json'
import bgmPlayerZhTw from '../../locales/zh-TW/bgm-player.json'
import bgmDjZhTw from '../../locales/zh-TW/bgm-dj.json'
import siteTutorialZhTw from '../../locales/zh-TW/site-tutorial.json'

export const SUPPORTED_LOCALES = ['ja', 'en', 'zh-CN', 'zh-TW'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'ja'

export const LOCALE_MESSAGES = {
  en: {
    common: commonEn,
    header: headerEn,
    footer: footerEn,
    home: homeEn,
    'bgm-quiz': bgmQuizEn,
    'bgm-player': bgmPlayerEn,
    'bgm-dj': bgmDjEn,
    'site-tutorial': siteTutorialEn,
  },
  ja: {
    common: commonJa,
    header: headerJa,
    footer: footerJa,
    home: homeJa,
    'bgm-quiz': bgmQuizJa,
    'bgm-player': bgmPlayerJa,
    'bgm-dj': bgmDjJa,
    'site-tutorial': siteTutorialJa,
  },
  'zh-CN': {
    common: commonZhCn,
    header: headerZhCn,
    footer: footerZhCn,
    home: homeZhCn,
    'bgm-quiz': bgmQuizZhCn,
    'bgm-player': bgmPlayerZhCn,
    'bgm-dj': bgmDjZhCn,
    'site-tutorial': siteTutorialZhCn,
  },
  'zh-TW': {
    common: commonZhTw,
    header: headerZhTw,
    footer: footerZhTw,
    home: homeZhTw,
    'bgm-quiz': bgmQuizZhTw,
    'bgm-player': bgmPlayerZhTw,
    'bgm-dj': bgmDjZhTw,
    'site-tutorial': siteTutorialZhTw,
  },
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
