// app/layout.tsx
import './globals.css'
import { Providers } from './providers'
import Header from '../components/Header'
import FloatingSearch from '../components/FloatingSearch'
import { M_PLUS_Rounded_1c } from 'next/font/google'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { config } from '@fortawesome/fontawesome-svg-core'
import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { createTranslator } from 'next-intl'
import { DEFAULT_LOCALE, LOCALE_MESSAGES, SUPPORTED_LOCALES, parseLocale, type Locale } from '../lib/i18n/config'

config.autoAddCss = false

const mplus = M_PLUS_Rounded_1c({
  weight: '500',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

async function resolveRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const cookieLocale = parseLocale(cookieStore.get('locale')?.value)
  if (cookieLocale) return cookieLocale

  const headerStore = await headers()
  const acceptLanguage = headerStore.get('accept-language')
  if (acceptLanguage) {
    for (const language of acceptLanguage.split(',')) {
      const parsed = parseLocale(language.trim().split(';')[0])
      if (parsed) return parsed
    }
  }

  return DEFAULT_LOCALE
}

function loadMessages(locale: Locale) {
  return LOCALE_MESSAGES[locale] ?? LOCALE_MESSAGES[DEFAULT_LOCALE]
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveRequestLocale()
  const translator = createTranslator({
    locale,
    messages: loadMessages(locale),
    namespace: 'common',
  })

  return {
    title: translator('appTitle'),
    alternates: {
      languages: {
        ...Object.fromEntries(SUPPORTED_LOCALES.map((localeCode) => [localeCode, `/${localeCode}`])),
      },
    },
    metadataBase: new URL('https://bluearchive-tools.vercel.app'),
    other: {
      locale,
    },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await resolveRequestLocale()
  const messages = loadMessages(locale)

  return (
    <html lang={locale}>
      <body className={`${mplus.variable} font-sans`}>
        {/* ここではあくまでサーバー→クライアントの橋渡しだけ */}
        <Providers locale={locale} messages={messages}>
          <Header />
          <FloatingSearch />
          <main className="pt-2 pb-8">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
