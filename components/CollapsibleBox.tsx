'use client'

import { useState } from 'react'
import { useTheme } from './ThemeProvider'

// 折りたたみ可能なボックス。展開時は内容部分もスムーズに表示する

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
    <div className={`rounded-lg border ${dark ? 'border-gray-700' : 'border-gray-300'} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full text-left p-4 ${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}
      >
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-sm">{description}</p>
      </button>
      <div
        className={`transition-all duration-300 ${dark ? 'bg-gray-700 text-white' : 'bg-white'} ${open ? 'max-h-[999px] p-4 opacity-100' : 'max-h-0 p-0 opacity-0'} overflow-hidden`}
      >
        {children}
      </div>
    </div>
  )
}
