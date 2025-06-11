'use client'

import { useTheme } from './ThemeProvider'
import { useEffect, useState } from 'react'

interface Skill {
  title: string
  text: string
  values: Record<string, number[]>
}

export default function SkillDetailModal({
  skill,
  level,
  onClose,
}: {
  skill: Skill
  level: number
  onClose: () => void
}) {
  const { dark } = useTheme()
  const [visible, setVisible] = useState(false)
  useEffect(() => setVisible(true), [])

  const formatted = skill.text.replace(/\{(\w+)\}/g, (_, key) => {
    const arr = skill.values?.[key]
    return arr && arr[level - 1] !== undefined ? String(arr[level - 1]) : ''
  })

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
        className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 rounded space-y-2 w-64 transform transition-all duration-200 ${visible ? 'scale-100' : 'scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-lg">{skill.title}</h3>
        <p>{formatted}</p>
        <button type="button" onClick={handleClose} className="underline text-sm block ml-auto">
          閉じる
        </button>
      </div>
    </div>
  )
}
