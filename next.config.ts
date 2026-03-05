import type { NextConfig } from 'next'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './lib/i18n/config'

const nextConfig: NextConfig = {
  i18n: {
    locales: SUPPORTED_LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    localeDetection: false,
  },
  async rewrites() {
    const url = process.env.SUPABASE_URL
    if (!url) {
      return []
    }
    return [
      {
        source: '/api/auth/:path*',
        destination: `${url}/auth/v1/:path*`,
      },
      // 他にもREST APIやストレージをプロキシしたい場合は追加
      // {
      //   source: '/api/rest/:path*',
      //   destination: `${url}/rest/v1/:path*`
      // }
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; img-src 'self' data: https: blob:; media-src 'self' https: blob:; style-src 'self' 'unsafe-inline' https://accounts.google.com https://morisawafonts.net; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://static.cloudflareinsights.com https://vercel.live; connect-src 'self' https: wss:; font-src 'self' data: https:; frame-src 'self' https://accounts.google.com https://www.youtube.com https://player.bilibili.com https://vercel.live; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
          },
        ],
      },
    ]
  },
}

export default nextConfig
