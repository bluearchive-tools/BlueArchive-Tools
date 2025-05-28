// app/providers.tsx
'use client'

import { useState } from 'react'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'

export function Providers({ children }: { children: React.ReactNode }) {
  const [supabaseClient] = useState(() =>
    createPagesBrowserClient()
  )

  return (
    <SessionContextProvider supabaseClient={supabaseClient}>
      {children}
    </SessionContextProvider>
  )
}
