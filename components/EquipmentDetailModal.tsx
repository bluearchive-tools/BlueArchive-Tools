'use client'

import { useTheme } from './ThemeProvider'
import { useEffect, useState } from 'react'

interface TierInfo {
  tier: number
  name: string
  values: Record<string, number>
}
interface EquipType {
  tiers: TierInfo[]
}
interface EquipmentData {
  [key: string]: EquipType
}

export default function EquipmentDetailModal({
  type,
  tier,
  equipment,
  onClose,
}: {
  type: string
  tier: number
  equipment: EquipmentData
  onClose: () => void
}) {
  const { dark } = useTheme()
  const [visible, setVisible] = useState(false)
  useEffect(() => setVisible(true), [])

  const data = equipment[type]
  const info = data?.tiers.find((t) => t.tier === tier)

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  if (!data) return null

  return (
    <div
      className={`fixed inset-0 z-20 flex items-center justify-center transition-opacity duration-200 ${dark ? 'bg-black/50' : 'bg-black/20'} ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div
        className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 rounded space-y-2 w-64 transform transition-all duration-200 ${visible ? 'scale-100' : 'scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-lg">{info?.name || `${type} T${tier}`}</h3>
        {info && (
          <ul className="list-disc pl-4">
            {Object.entries(info.values).map(([k, v]) => (
              <li key={k}>
                {k}: {v}
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={handleClose} className="underline text-sm block ml-auto">
          閉じる
        </button>
      </div>
    </div>
  )
}
