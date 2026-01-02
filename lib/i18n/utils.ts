import { parseLocale, type Locale } from './config'

export function stripLocaleFromPath(pathname: string, locale: Locale) {
  if (pathname === `/${locale}`) return '/'
  const withoutLocale = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), '')
  return withoutLocale || '/'
}

export function stripLeadingLocale(pathname: string) {
  const maybeLocale = parseLocale(pathname.split('/')[1])
  if (!maybeLocale) return pathname
  return stripLocaleFromPath(pathname, maybeLocale)
}
