import { DEFAULT_LOCALE, type Locale, type Messages } from './config'

// Turbopack/webpack共通でバンドルに含めるため、require.contextを使用してロケールJSONを一括インポートする
const localeModules = require.context('../../locales', true, /\.json$/)

function buildMessages(): Record<Locale, Messages> {
  const messages: Partial<Record<Locale, Messages>> = {}

  localeModules.keys().forEach((key: string) => {
    // key 例: "./ja/header.json"
    const normalized = key.replace(/^\.\//, '')
    const [locale, ...rest] = normalized.split('/')
    const namespace = rest.join('/').replace(/\.json$/, '')
    if (!locale || !namespace) return

    const localeKey = locale as Locale
    const mod = localeModules(key) as { default?: Messages } | Messages
    const data = (mod as { default?: Messages }).default ?? (mod as Messages)

    messages[localeKey] = {
      ...(messages[localeKey] ?? {}),
      [namespace]: data,
    }
  })

  return messages as Record<Locale, Messages>
}

const CACHE = buildMessages()

export function getMessages(locale: Locale): Messages {
  return CACHE[locale] ?? {}
}

export function getMessagesWithFallback(locale: Locale): Messages {
  const messages = getMessages(locale)
  if (Object.keys(messages).length > 0) return messages
  return getMessages(DEFAULT_LOCALE)
}
