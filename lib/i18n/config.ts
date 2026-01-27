import type { AbstractIntlMessages } from 'next-intl'

import commonEn from '../../locales/en/common.json'
import footerEn from '../../locales/en/footer.json'
import headerEn from '../../locales/en/header.json'
import homeEn from '../../locales/en/home.json'
import bgmQuizEn from '../../locales/en/bgm-quiz.json'
import bgmPlayerEn from '../../locales/en/bgm-player.json'
import commonJa from '../../locales/ja/common.json'
import footerJa from '../../locales/ja/footer.json'
import headerJa from '../../locales/ja/header.json'
import homeJa from '../../locales/ja/home.json'
import bgmQuizJa from '../../locales/ja/bgm-quiz.json'
import bgmPlayerJa from '../../locales/ja/bgm-player.json'

export const SUPPORTED_LOCALES = ['ja', 'en'] as const
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
  },
  ja: {
    common: commonJa,
    header: headerJa,
    footer: footerJa,
    home: homeJa,
    'bgm-quiz': bgmQuizJa,
    'bgm-player': bgmPlayerJa,
  },
} as const satisfies Record<Locale, AbstractIntlMessages>

export type Messages = (typeof LOCALE_MESSAGES)[Locale]

export function parseLocale(locale?: string | null): Locale | undefined {
  if (!locale) return undefined
  const normalized = locale.split('-')[0]
  return SUPPORTED_LOCALES.find((value) => value === normalized)
}
