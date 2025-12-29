import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, parseLocale, type Locale } from './lib/i18n/config'
import { stripLocaleFromPath } from './lib/i18n/utils'

function sanitizeLocaleParam(value: string | null): Locale | undefined {
  return parseLocale(value ?? undefined)
}

function detectLocale(request: NextRequest): Locale {
  const queryLocale = sanitizeLocaleParam(request.nextUrl.searchParams.get('lang'))
  if (queryLocale) return queryLocale

  const cookieLocale = parseLocale(request.cookies.get('locale')?.value)
  if (cookieLocale) return cookieLocale

  const acceptLanguage = request.headers.get('accept-language')
  if (acceptLanguage) {
    for (const language of acceptLanguage.split(',')) {
      const parsed = parseLocale(language.trim().split(';')[0])
      if (parsed) return parsed
    }
  }

  return DEFAULT_LOCALE
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const pathLocale = parseLocale(pathname.split('/')[1])
  const queryLocale = sanitizeLocaleParam(request.nextUrl.searchParams.get('lang'))
  const originalSearch = request.nextUrl.searchParams
  const filteredSearch = new URLSearchParams(originalSearch)
  filteredSearch.delete('lang')

  if (pathLocale) {
    const effectiveLocale = queryLocale ?? pathLocale
    if (queryLocale && queryLocale !== pathLocale) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = `/${effectiveLocale}${stripLocaleFromPath(pathname, pathLocale)}`
      redirectUrl.search = filteredSearch.toString()
      const response = NextResponse.redirect(redirectUrl)
      response.cookies.set('locale', effectiveLocale, { path: '/' })
      return response
    }

    // Remove ?lang from the URL while keeping the locale prefix as-is.
    if (originalSearch.has('lang')) {
      const cleanedUrl = request.nextUrl.clone()
      cleanedUrl.search = filteredSearch.toString()
      const response = NextResponse.redirect(cleanedUrl)
      response.cookies.set('locale', effectiveLocale, { path: '/' })
      return response
    }

    const response = NextResponse.next()
    response.cookies.set('locale', effectiveLocale, { path: '/' })
    return response
  }

  const locale = detectLocale(request)
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = `/${locale}${pathname}`
  redirectUrl.search = filteredSearch.toString()

  const response = NextResponse.redirect(redirectUrl)
  response.cookies.set('locale', locale, { path: '/' })
  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
