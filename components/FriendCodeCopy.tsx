'use client'

import { useState } from 'react'

type Props = {
  code?: string | null
  disabled?: boolean
  className?: string
}

export default function FriendCodeCopy({ code, disabled, className }: Props) {
  const [copied, setCopied] = useState(false)
  const canCopy = !disabled && !!code

  const handleCopy = async () => {
    if (!canCopy) return
    try {
      await navigator.clipboard.writeText(code!)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!canCopy}
      className={`inline-flex items-center gap-2 underline-offset-2 ${
        canCopy ? 'hover:underline' : 'cursor-not-allowed text-gray-400'
      } ${className ?? ''}`}
      aria-label="フレンドコードをコピー"
    >
      <span>{code && !disabled ? code : '—'}</span>
      {copied && <span className="text-xs text-green-600">コピーしました</span>}
    </button>
  )
}
