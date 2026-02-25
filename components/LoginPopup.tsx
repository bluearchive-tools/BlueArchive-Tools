'use client'

import { useEffect, useState } from 'react'
import GoogleSignInButton from './GoogleSignInButton'
import DiscordSignInButton from './DiscordSignInButton'
import { useSession } from '@supabase/auth-helpers-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useTranslations } from 'next-intl'

const DISMISSED_KEY = 'app:loginPromptDismissed'

export default function LoginPopup() {
  const t = useTranslations('common')
  const session = useSession()
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (session) return
    try {
      if (localStorage.getItem(DISMISSED_KEY) === '1') return
    } catch {
      /* ignore */
    }
    setVisible(true)
    const id = window.setTimeout(() => setOpen(true), 20)
    return () => window.clearTimeout(id)
  }, [session])

  const close = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
    window.setTimeout(() => setVisible(false), 220)
  }

  if (session || !visible) return null

  return (
    <div className={`fixed top-20 inset-x-0 flex justify-center pointer-events-none z-5 transition-all duration-200 ${open ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
      <div className="relative bg-yellow-200/80 text-black rounded shadow p-4 pointer-events-auto max-w-md w-full mx-4 flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <FontAwesomeIcon icon={faCircleExclamation} className="text-yellow-600 mt-1" />
          <p data-tutorial="login-prompt" className="flex-1 text-sm">{t('messages.loginPrompt')}</p>
          <button onClick={close} className="text-gray-700" aria-label={t('actions.close')}>
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <GoogleSignInButton width={220} theme="outline" size="medium" text="continue_with" className="sm:flex-1" />
          <DiscordSignInButton label={t('auth.loginWithDiscord')} className="sm:flex-1" />
        </div>
      </div>
    </div>
  )
}
