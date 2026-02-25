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

type ClosingMotion = {
  translateX: number
  translateY: number
}

const getMotionToTopRight = (element: HTMLElement): ClosingMotion => {
  const rect = element.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const targetX = window.innerWidth - 24
  const targetY = 20
  return {
    translateX: targetX - centerX,
    translateY: targetY - centerY,
  }
}

export default function LoginPopup() {
  const t = useTranslations('common')
  const session = useSession()
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closingMotion, setClosingMotion] = useState<ClosingMotion>({ translateX: 0, translateY: 0 })
  const closeTimerRef = useRef<number | null>(null)
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

    const card = cardRef.current
    if (card) {
      setClosingMotion(getMotionToTopRight(card))
    }

    setOpen(false)
    setClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      setVisible(false)
      setClosing(false)
      setClosingMotion({ translateX: 0, translateY: 0 })
    }, CLOSE_ANIMATION_MS)
  }

  if (session || !visible) return null

  const cardTransform = closing
    ? `translate(${closingMotion.translateX}px, ${closingMotion.translateY}px) scaleX(0.06) scaleY(0.86)`
    : open
      ? 'translateY(0) scale(1)'
      : 'translateY(-16px) scale(1)'

  const cardOpacity = closing ? 0.22 : open ? 1 : 0

  return (
    <div className="fixed top-20 inset-x-0 flex justify-center pointer-events-none z-5">
      <div
        ref={cardRef}
        style={{ transform: cardTransform, opacity: cardOpacity, transformOrigin: '100% 50%' }}
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
