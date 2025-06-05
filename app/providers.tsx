// app/providers.tsx
'use client'

import { useState } from 'react'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { ThemeProvider } from '../components/ThemeProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  const [supabaseClient] = useState(() =>
    createPagesBrowserClient()
  )

  return (
    <SessionContextProvider supabaseClient={supabaseClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </SessionContextProvider>
  )
}
