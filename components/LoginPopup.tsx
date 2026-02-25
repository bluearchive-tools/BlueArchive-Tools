'use client'

import { useEffect, useRef, useState } from 'react'
import GoogleSignInButton from './GoogleSignInButton'
import DiscordSignInButton from './DiscordSignInButton'
import { useSession } from '@supabase/auth-helpers-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useTranslations } from 'next-intl'

const DISMISSED_KEY = 'app:loginPromptDismissed'
const CLOSE_ANIMATION_MS = 420

type SinkTarget = {
  alignRatioX: number
}

const getSinkTarget = (): SinkTarget | null => {
  const mobileToggle = document.querySelector('[data-login-sink="mobile-tools"]')
  let target: HTMLElement | null = null
  if (mobileToggle instanceof HTMLElement) {
    const style = window.getComputedStyle(mobileToggle)
    if (style.display !== 'none' && style.visibility !== 'hidden') target = mobileToggle
  }
  if (!target) {
    const account = document.querySelector('[data-login-sink="account"]')
    if (account instanceof HTMLElement) target = account
  }
  if (!target) return null

  const rect = target.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, rect.left / Math.max(window.innerWidth, 1)))
  return { alignRatioX: ratio }
}

export default function LoginPopup() {
  const t = useTranslations('common')
  const session = useSession()
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [transformOrigin, setTransformOrigin] = useState('100% 50%')
  const closeTimerRef = useRef<number | null>(null)

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

  useEffect(() => {
    return () => {
      if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  const close = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      /* ignore */
    }

    const sink = getSinkTarget()
    if (sink) {
      setTransformOrigin(`${Math.round(sink.alignRatioX * 100)}% 50%`)
    }

    setOpen(false)
    setClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      setVisible(false)
      setClosing(false)
    }, CLOSE_ANIMATION_MS)
  }

  if (session || !visible) return null

  const cardTransform = closing
    ? 'scaleX(0.06) scaleY(0.86)'
    : open
      ? 'translateY(0) scale(1)'
      : 'translateY(-16px) scale(1)'

  const cardOpacity = closing ? 0.22 : open ? 1 : 0

  return (
    <div className="fixed top-20 inset-x-0 flex justify-center pointer-events-none z-5">
      <div
        style={{ transform: cardTransform, opacity: cardOpacity, transformOrigin }}
        className="relative bg-yellow-200/80 text-black rounded shadow p-4 pointer-events-auto max-w-md w-full mx-4 flex flex-col gap-3 transition-all duration-[420ms]"
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
