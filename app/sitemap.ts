import type { MetadataRoute } from 'next'

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/config'

const SITE_URL = 'https://bluearchive.tools'

const ROUTES = [
  '/',
  '/ba-memos',
  '/dev-memos',
  '/decorations',
  '/minigames/bgm-quiz',
  '/privacy-policy',
  '/quick-setup',
  '/squads',
  '/students',
  '/students/import',
  '/tl/maker',
  '/tl/search',
  '/tools/bgm-player',
  '/tools/event-schedule',
  '/tools/story-editor',
  '/tools/student-image',
  '/tools/training-planning',
] as const

const withLocale = (locale: Locale, route: string): string => {
  if (locale === DEFAULT_LOCALE) {
    return route
  }

  return route === '/' ? `/${locale}` : `/${locale}${route}`
}

export default function sitemap(): MetadataRoute.Sitemap {
  const updatedAt = new Date()

  return SUPPORTED_LOCALES.flatMap((locale) =>
    ROUTES.map((route) => ({
      url: new URL(withLocale(locale, route), SITE_URL).toString(),
      lastModified: updatedAt,
      changeFrequency: 'weekly' as const,
      priority: route === '/' ? 1 : 0.7,
    })),
  )
}
