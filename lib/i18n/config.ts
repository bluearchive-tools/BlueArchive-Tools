import type { AbstractIntlMessages } from 'next-intl'

import aboutModalEn from '../../locales/en/about-modal.json'
import bgmDjEn from '../../locales/en/bgm-dj.json'
import bgmPlayerEn from '../../locales/en/bgm-player.json'
import bgmQuizEn from '../../locales/en/bgm-quiz.json'
import commonEn from '../../locales/en/common.json'
import footerEn from '../../locales/en/footer.json'
import headerEn from '../../locales/en/header.json'
import helpEditorEn from '../../locales/en/help-editor.json'
import homeEn from '../../locales/en/home.json'
import pageHelpEn from '../../locales/en/page-help.json'
import quickSetupEn from '../../locales/en/quick-setup.json'
import siteTutorialEn from '../../locales/en/site-tutorial.json'
import tutorialEditorEn from '../../locales/en/tutorial-editor.json'
import aboutModalJa from '../../locales/ja/about-modal.json'
import bgmDjJa from '../../locales/ja/bgm-dj.json'
import bgmPlayerJa from '../../locales/ja/bgm-player.json'
import bgmQuizJa from '../../locales/ja/bgm-quiz.json'
import commonJa from '../../locales/ja/common.json'
import footerJa from '../../locales/ja/footer.json'
import headerJa from '../../locales/ja/header.json'
import helpEditorJa from '../../locales/ja/help-editor.json'
import homeJa from '../../locales/ja/home.json'
import pageHelpJa from '../../locales/ja/page-help.json'
import quickSetupJa from '../../locales/ja/quick-setup.json'
import siteTutorialJa from '../../locales/ja/site-tutorial.json'
import tutorialEditorJa from '../../locales/ja/tutorial-editor.json'
import aboutModalZhCn from '../../locales/zh-CN/about-modal.json'
import bgmDjZhCn from '../../locales/zh-CN/bgm-dj.json'
import bgmPlayerZhCn from '../../locales/zh-CN/bgm-player.json'
import bgmQuizZhCn from '../../locales/zh-CN/bgm-quiz.json'
import commonZhCn from '../../locales/zh-CN/common.json'
import footerZhCn from '../../locales/zh-CN/footer.json'
import headerZhCn from '../../locales/zh-CN/header.json'
import helpEditorZhCn from '../../locales/zh-CN/help-editor.json'
import homeZhCn from '../../locales/zh-CN/home.json'
import pageHelpZhCn from '../../locales/zh-CN/page-help.json'
import quickSetupZhCn from '../../locales/zh-CN/quick-setup.json'
import siteTutorialZhCn from '../../locales/zh-CN/site-tutorial.json'
import tutorialEditorZhCn from '../../locales/zh-CN/tutorial-editor.json'
import aboutModalZhTw from '../../locales/zh-TW/about-modal.json'
import bgmDjZhTw from '../../locales/zh-TW/bgm-dj.json'
import bgmPlayerZhTw from '../../locales/zh-TW/bgm-player.json'
import bgmQuizZhTw from '../../locales/zh-TW/bgm-quiz.json'
import commonZhTw from '../../locales/zh-TW/common.json'
import footerZhTw from '../../locales/zh-TW/footer.json'
import headerZhTw from '../../locales/zh-TW/header.json'
import helpEditorZhTw from '../../locales/zh-TW/help-editor.json'
import homeZhTw from '../../locales/zh-TW/home.json'
import pageHelpZhTw from '../../locales/zh-TW/page-help.json'
import quickSetupZhTw from '../../locales/zh-TW/quick-setup.json'
import siteTutorialZhTw from '../../locales/zh-TW/site-tutorial.json'
import tutorialEditorZhTw from '../../locales/zh-TW/tutorial-editor.json'

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
    'about-modal': aboutModalEn,
    'page-help': pageHelpEn,
    'help-editor': helpEditorEn,
    'tutorial-editor': tutorialEditorEn,
    'quick-setup': quickSetupEn,
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
    'about-modal': aboutModalJa,
    'page-help': pageHelpJa,
    'help-editor': helpEditorJa,
    'tutorial-editor': tutorialEditorJa,
    'quick-setup': quickSetupJa,
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
    'about-modal': aboutModalZhCn,
    'page-help': pageHelpZhCn,
    'help-editor': helpEditorZhCn,
    'tutorial-editor': tutorialEditorZhCn,
    'quick-setup': quickSetupZhCn,
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
    'about-modal': aboutModalZhTw,
    'page-help': pageHelpZhTw,
    'help-editor': helpEditorZhTw,
    'tutorial-editor': tutorialEditorZhTw,
    'quick-setup': quickSetupZhTw,
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
