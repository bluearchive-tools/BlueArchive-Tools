import type { MetadataRoute } from 'next'

const SITE_URL = 'https://bluearchive.tools'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/'],
    },
    sitemap: new URL('/sitemap.xml', SITE_URL).toString(),
  }
}
