'use client'

import { useEffect, useState } from 'react'
import { useTheme } from './ThemeProvider'

export default function CalculationDetailModal({
  label,
  formula,
  lines,
  onClose,
}: {
  label: string
  formula: string
  lines: string[]
  onClose: () => void
}) {
  const { dark } = useTheme()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(true)
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  return (
    <div
      className={`fixed inset-0 z-20 flex items-center justify-center transition-opacity duration-200 ${dark ? 'bg-black/50' : 'bg-black/20'} ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div
        className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 rounded space-y-2 w-[min(90vw,32rem)] transform transition-all duration-200 ${visible ? 'scale-100' : 'scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-lg">{label} の計算詳細</h3>
        <p className="text-sm break-words">{formula}</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <button type="button" onClick={handleClose} className="underline text-sm block ml-auto">
          閉じる
        </button>
      </div>
    </div>
  )
}
