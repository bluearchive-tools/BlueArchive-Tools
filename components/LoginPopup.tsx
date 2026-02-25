'use client'

import { useEffect, useRef, useState } from 'react'
import GoogleSignInButton from './GoogleSignInButton'
import DiscordSignInButton from './DiscordSignInButton'
import { useSession } from '@supabase/auth-helpers-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useTranslations } from 'next-intl'

const DISMISSED_KEY = 'app:loginPromptDismissed'

type SinkStyle = {
  transform: string
  opacity: number
}

const getSinkTarget = () => {
  const mobileToggle = document.querySelector('[data-login-sink="mobile-tools"]')
  if (mobileToggle instanceof HTMLElement) {
    const style = window.getComputedStyle(mobileToggle)
    if (style.display !== 'none' && style.visibility !== 'hidden') return mobileToggle
  }
  const account = document.querySelector('[data-login-sink="account"]')
  if (account instanceof HTMLElement) return account
  return null
}

export default function LoginPopup() {
  const t = useTranslations('common')
  const session = useSession()
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const [sinkStyle, setSinkStyle] = useState<SinkStyle | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

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

    const card = cardRef.current
    const target = getSinkTarget()
    if (card && target) {
      const from = card.getBoundingClientRect()
      const to = target.getBoundingClientRect()
      const fromCenterX = from.left + from.width / 2
      const fromCenterY = from.top + from.height / 2
      const toCenterX = to.left + to.width / 2
      const toCenterY = to.top + to.height / 2
      setSinkStyle({
        transform: `translate(${toCenterX - fromCenterX}px, ${toCenterY - fromCenterY}px) scale(0.08)`,
        opacity: 0,
      })
      setOpen(false)
      window.setTimeout(() => setVisible(false), 260)
      return
    }

    setOpen(false)
    window.setTimeout(() => setVisible(false), 200)
  }

  if (session || !visible) return null

  const cardTransform = sinkStyle?.transform ?? (open ? 'translateY(0) scale(1)' : 'translateY(-16px) scale(1)')
  const cardOpacity = sinkStyle?.opacity ?? (open ? 1 : 0)

  return (
    <div className="fixed top-20 inset-x-0 flex justify-center pointer-events-none z-5">
      <div
        ref={cardRef}
        style={{ transform: cardTransform, opacity: cardOpacity }}
        className="relative bg-yellow-200/80 text-black rounded shadow p-4 pointer-events-auto max-w-md w-full mx-4 flex flex-col gap-3 transition-all duration-200"
      >
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
