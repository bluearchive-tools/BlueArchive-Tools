'use client'

import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons'

type Decoration = {
  id: string
  name: string
  emoji: string
  description?: string | null
  style?: string | null
}

type Props = {
  decorations: Decoration[]
}

export default function DecorationInfoButton({ decorations }: Props) {
  const [open, setOpen] = useState(false)

  if (!decorations || decorations.length === 0) return null

  return (
    <div className="absolute right-3 top-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white p-2 text-gray-700 shadow hover:bg-gray-50"
        aria-label="デコレーションの詳細"
      >
        <FontAwesomeIcon icon={faCircleQuestion} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">適用中のデコレーション</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {decorations.map((d) => (
                <div
                  key={d.id}
                  className="flex items-start gap-2 rounded border border-gray-200 bg-gray-50 p-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  <span className="text-lg" aria-hidden>
                    {d.emoji}
                  </span>
                  <div>
                    <p className="font-semibold">{d.name}</p>
                    {d.description && <p className="text-gray-600 dark:text-gray-300">{d.description}</p>}
                    {d.style === 'red-gradient' && (
                      <p className="text-xs text-rose-600">効果: 赤グラデーション枠</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
