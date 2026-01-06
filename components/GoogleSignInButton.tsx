'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

type GoogleCredentialResponse = {
  credential: string
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (args: {
            client_id: string
            callback: (res: GoogleCredentialResponse) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
            itp_support?: boolean
            prompt_parent_id?: string
          }) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

type Props = {
  /** Rendered button width in px (Google button API uses number) */
  width?: number
  /** Google button theme */
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  /** Google button size */
  size?: 'large' | 'medium' | 'small'
  /** Google button text */
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  /** Optional extra wrapper classes */
  className?: string
}

export default function GoogleSignInButton({
  width = 240,
  theme = 'outline',
  size = 'medium',
  text = 'continue_with',
  className
}: Props) {
  const supabase = useSupabaseClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const [initialized, setInitialized] = useState(false)

  const init = () => {
    if (initialized) return
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) {
      console.error('Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID')
      return
    }
    if (!window.google?.accounts?.id) return

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (res: GoogleCredentialResponse) => {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: res.credential
        })
        if (error) console.error(error.message)
      }
    })

    if (containerRef.current) {
      containerRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(containerRef.current, {
        theme,
        size,
        text,
        width
      })
      setInitialized(true)
    }
  }

  useEffect(() => {
    // In case the Script is already cached/loaded, try init once.
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={init} />
      <div ref={containerRef} className={className} />
    </>
  )
}
