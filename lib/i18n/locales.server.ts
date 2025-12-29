import path from 'path'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, type Messages } from './config'

type GlobModule = { default: Messages }

const localeModules = import.meta.glob<GlobModule>('../../locales/*/*.json', { eager: true })

function buildMessages(): Record<Locale, Messages> {
  const result: Partial<Record<Locale, Messages>> = {}

  for (const [filePath, mod] of Object.entries(localeModules)) {
    const parsed = path.parse(filePath)
    const parts = parsed.dir.split(path.sep)
    const locale = parts.at(-1) as Locale | undefined
    if (!locale || !SUPPORTED_LOCALES.includes(locale)) continue

    const namespace = parsed.name
    if (!result[locale]) result[locale] = {}
    result[locale]![namespace] = mod.default
  }

  return result as Record<Locale, Messages>
}

const MESSAGES = buildMessages()

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale] ?? {}
}

export function getMessagesWithFallback(locale: Locale): Messages {
  const messages = getMessages(locale)
  if (Object.keys(messages).length > 0) return messages
  return getMessages(DEFAULT_LOCALE)
}
