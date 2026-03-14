'use client'

import { useEffect, useState } from 'react'
import { useTheme } from './ThemeProvider'

interface Gimmick {
  id: string
  name: string
  side: 'enemy' | 'ally'
}

interface AddGimmickModalProps {
  gimmicks: Gimmick[]
  addRow: (id: string) => void
  close: () => void
}

export default function AddGimmickModal({ gimmicks, addRow, close }: AddGimmickModalProps) {
  const { dark } = useTheme()
  const [visible, setVisible] = useState(false)
  const [selected, setSelected] = useState('')

  useEffect(() => {
    setVisible(true)
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(close, 200)
  }

  return (
    <div
      className={`fixed inset-0 z-20 flex items-center justify-center transition-opacity duration-200 ${dark ? 'bg-black/50' : 'bg-black/20'} ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div
        className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 rounded space-y-4 w-80 transform transition-all duration-200 ${visible ? 'scale-100' : 'scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <label className="block text-sm">
          <span className="mb-1 block">ギミック</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full border rounded p-1 text-black"
          >
            <option value="">選択してください</option>
            {gimmicks.map((gimmick) => (
              <option key={gimmick.id} value={gimmick.id}>
                {gimmick.name} ({gimmick.side === 'enemy' ? '敵' : '味方'})
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="border rounded px-2 py-1" onClick={handleClose}>
            キャンセル
          </button>
          <button
            type="button"
            className="border rounded px-2 py-1 disabled:opacity-50"
            disabled={!selected}
            onClick={() => {
              if (selected) addRow(selected)
              handleClose()
            }}
          >
            追加
          </button>
        </div>
      </div>
    </div>
  )
}
