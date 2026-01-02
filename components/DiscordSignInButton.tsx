'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDiscord } from '@fortawesome/free-brands-svg-icons'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

interface Props {
  label: string
  className?: string
}

export default function DiscordSignInButton({ label, className }: Props) {
  const supabase = useSupabaseClient()

  const handleSignIn = async () => {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo,
      },
    })

    if (error) {
      console.error(error.message)
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignIn}
      className={`flex items-center justify-center gap-2 rounded bg-[#5865F2] px-4 py-2 text-sm font-medium text-white shadow hover:bg-[#4752c4] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5865F2] dark:focus:ring-offset-gray-800 ${
        className ?? ''
      }`}
      aria-label={label}
    >
      <FontAwesomeIcon icon={faDiscord} />
      <span>{label}</span>
    </button>
  )
}
