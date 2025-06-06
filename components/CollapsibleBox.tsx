'use client'

import { useState } from 'react'
import { useTheme } from './ThemeProvider'

export default function CollapsibleBox({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const { dark } = useTheme()

  return (
    <div
      className={`rounded-lg border overflow-hidden ${dark ? 'border-gray-700' : 'border-gray-300'}`}
    >
      <button
        onClick={() => setOpen(!open)}
        className={`w-full text-left p-4 ${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}
      >
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-sm">{description}</p>
      </button>
      {open && (
        <div className={`p-4 ${dark ? 'bg-gray-700 text-white' : 'bg-white'}`}>{children}</div>
      )}
    </div>
  )
}
