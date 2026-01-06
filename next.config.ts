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
}

export default nextConfig
