'use client'

import { useTheme } from './ThemeProvider'
import React, { useEffect, useState } from 'react'

interface Skill {
  title: string
  text: string
  values: Record<string, number[]>
}

interface SkillEntry {
  label?: string
  skill: Skill
  related?: SkillEntry[]
}

export default function SkillDetailModal({
  entries,
  level,
  onClose,
}: {
  entries: SkillEntry[]
  level: number
  onClose: () => void
}) {
  const { dark } = useTheme()
  const [visible, setVisible] = useState(false)
  useEffect(() => setVisible(true), [])

  const formatText = (target: Skill) => {
    const regex = /\*\*(.+?)\*\*|\{(\w+)\}/g
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    for (const match of target.text.matchAll(regex)) {
      if (match.index === undefined) continue
      if (match.index > lastIndex) {
        parts.push(target.text.slice(lastIndex, match.index))
      }
      if (match[1]) {
        parts.push(<b key={parts.length}>{match[1]}</b>)
      } else if (match[2]) {
        const arr = target.values?.[match[2]]
        const val = arr && arr[level - 1] !== undefined ? arr[level - 1] : ''
        parts.push(
          <span key={parts.length} className="text-sky-400 font-bold">
            {val}
          </span>
        )
      }
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < target.text.length) {
      parts.push(target.text.slice(lastIndex))
    }
    return parts
  }

  const renderEntry = (entry: SkillEntry, depth = 0, index = 0) => (
    <div key={`${entry.skill.title}-${depth}-${index}`} className={depth > 0 ? 'ml-3 border-l border-gray-300 pl-3' : ''}>
      {entry.label && <div className="text-xs text-gray-500">{entry.label}</div>}
      <h4 className="font-semibold">{entry.skill.title}</h4>
      <p>{formatText(entry.skill)}</p>
      {entry.related?.length ? (
        <div className="space-y-2">
          {entry.related.map((child, childIdx) => renderEntry(child, depth + 1, childIdx))}
        </div>
      ) : null}
    </div>
  )

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
        <div className="space-y-3">
          {entries.map((entry, idx) => renderEntry(entry, 0, idx))}
        </div>
        <button type="button" onClick={handleClose} className="underline text-sm block ml-auto">
          閉じる
        </button>
      </div>
    </div>
  )
}
