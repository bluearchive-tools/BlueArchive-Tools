'use client'

import { useState, useEffect } from 'react'
import { useTheme } from './ThemeProvider'

interface EditValueModalProps {
  label: string
  value: number
  min?: number
  max?: number
  onSave: (value: number) => void
  onClose: () => void
}

export default function EditValueModal({ label, value, min, max, onSave, onClose }: EditValueModalProps) {
  const { dark } = useTheme()
  const [visible, setVisible] = useState(false)
  const [val, setVal] = useState(value.toString())

  useEffect(() => {
    setVisible(true)
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const handleSave = () => {
    onSave(Number(val) || 0)
    handleClose()
  }

  return (
    <div
      className={`fixed inset-0 z-20 flex items-center justify-center transition-opacity duration-200 ${dark ? 'bg-black/50' : 'bg-black/20'} ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div
        className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 rounded space-y-2 w-64 transform transition-all duration-200 ${visible ? 'scale-100' : 'scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <label className="flex items-center gap-2">
          <span className="whitespace-nowrap">{label}:</span>
          <input
            type="number"
            value={val}
            min={min}
            max={max}
            onChange={(e) => setVal(e.target.value)}
            className="border rounded p-1 flex-1 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
          />
        </label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={handleClose} className="border rounded px-2 py-1">
            キャンセル
          </button>
          <button type="button" onClick={handleSave} className="border rounded px-2 py-1">
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
