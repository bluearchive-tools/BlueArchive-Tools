export const SUPPORTED_LOCALES = ['ja', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'ja'

export type Messages = import('next-intl').AbstractIntlMessages

export function parseLocale(locale?: string | null): Locale | undefined {
  if (!locale) return undefined
  const normalized = locale.split('-')[0]
  return SUPPORTED_LOCALES.find((value) => value === normalized)
}
