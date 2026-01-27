// app/providers.tsx
'use client'

import { useState } from 'react'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { NextIntlClientProvider } from 'next-intl'
import { ThemeProvider } from '../components/ThemeProvider'
import type { Locale, Messages } from '../lib/i18n/config'

export function Providers({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode
  locale: Locale
  messages: Messages
}) {
  const [supabaseClient] = useState(() =>
    createPagesBrowserClient()
  )

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SessionContextProvider supabaseClient={supabaseClient}>
        <ThemeProvider>{children}</ThemeProvider>
      </SessionContextProvider>
    </NextIntlClientProvider>
  )
}
