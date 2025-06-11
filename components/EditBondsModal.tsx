'use client'

import { useState, useEffect } from 'react'
import { useTheme } from './ThemeProvider'

interface Student {
  id: string
  name: string
}

interface EditBondsModalProps {
  bonds: Record<string, number>
  students: Student[]
  onSave: (bonds: Record<string, number>) => void
  onClose: () => void
}

export default function EditBondsModal({ bonds, students, onSave, onClose }: EditBondsModalProps) {
  const { dark } = useTheme()
  const [visible, setVisible] = useState(false)
  const [vals, setVals] = useState<Record<string, string>>({})

  useEffect(() => {
    setVals(Object.fromEntries(Object.entries(bonds).map(([k, v]) => [k, v.toString()])))
    setVisible(true)
  }, [bonds])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const handleSave = () => {
    const obj: Record<string, number> = {}
    for (const [k, v] of Object.entries(vals)) {
      obj[k] = Number(v) || 0
    }
    onSave(obj)
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
        <h3 className="font-bold text-lg">絆編集</h3>
        <div className="space-y-1">
          {Object.entries(vals).map(([id, v]) => (
            <label key={id} className="flex items-center gap-2">
              <span className="flex-1 truncate">{students.find((s) => s.id === id)?.name || id}</span>
              <input
                type="number"
                value={v}
                onChange={(e) => setVals({ ...vals, [id]: e.target.value })}
                className="border rounded p-1 w-20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              />
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={handleClose} className="border rounded px-2 py-1">キャンセル</button>
          <button type="button" onClick={handleSave} className="border rounded px-2 py-1">保存</button>
        </div>
      </div>
    </div>
  )
}
