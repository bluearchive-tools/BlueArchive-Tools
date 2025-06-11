'use client'

import { useTheme } from './ThemeProvider'
import React, { useEffect, useState } from 'react'

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

  const formatText = () => {
    const regex = /\*\*(.+?)\*\*|\{(\w+)\}/g
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    for (const match of skill.text.matchAll(regex)) {
      if (match.index === undefined) continue
      if (match.index > lastIndex) {
        parts.push(skill.text.slice(lastIndex, match.index))
      }
      if (match[1]) {
        parts.push(<b key={parts.length}>{match[1]}</b>)
      } else if (match[2]) {
        const arr = skill.values?.[match[2]]
        const val = arr && arr[level - 1] !== undefined ? arr[level - 1] : ''
        parts.push(
          <span key={parts.length} className="text-sky-400 font-bold">
            {val}
          </span>
        )
      }
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < skill.text.length) {
      parts.push(skill.text.slice(lastIndex))
    }
    return parts
  }

  const formatted = formatText()

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
