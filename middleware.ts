import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, parseLocale, type Locale } from './lib/i18n/config'

function detectLocale(request: NextRequest): Locale {
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

function stripLocaleFromPath(pathname: string, locale: Locale) {
  if (pathname === `/${locale}`) return '/'
  const withoutLocale = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), '')
  return withoutLocale || '/'
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const pathLocale = parseLocale(pathname.split('/')[1])

  if (pathLocale) {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = stripLocaleFromPath(pathname, pathLocale)

    const response = NextResponse.rewrite(rewriteUrl)
    response.cookies.set('locale', pathLocale, { path: '/' })
    return response
  }

  const locale = detectLocale(request)
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = `/${locale}${pathname}`

  const response = NextResponse.redirect(redirectUrl)
  response.cookies.set('locale', locale, { path: '/' })
  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
