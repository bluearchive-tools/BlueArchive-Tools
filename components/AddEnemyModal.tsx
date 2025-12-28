'use client'

import { useEffect, useState } from 'react'
import { useTheme } from './ThemeProvider'
import EnemySelect from './EnemySelect'

interface Enemy {
  id: string
  name: string
  armor?: string
}

interface AddEnemyModalProps {
  enemies: Enemy[]
  addRow: (id: string) => void
  close: () => void
}

export default function AddEnemyModal({ enemies, addRow, close }: AddEnemyModalProps) {
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
        className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 rounded space-y-4 w-72 transform transition-all duration-200 ${visible ? 'scale-100' : 'scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <EnemySelect enemies={enemies} value={selected} onChange={setSelected} />
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
