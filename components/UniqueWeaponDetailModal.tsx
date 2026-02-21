'use client'

import { useEffect, useState } from 'react'
import { useTheme } from './ThemeProvider'

interface UniqueWeapon {
  name: string
  hp: number
  attack: number
  heal: number
}

export default function UniqueWeaponDetailModal({
  weapon,
  level,
  onClose,
}: {
  weapon: UniqueWeapon
  level: number
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
        className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 rounded space-y-2 w-72 transform transition-all duration-200 ${visible ? 'scale-100' : 'scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-lg">固有武器詳細</h3>
        <p className="text-sm">名称: {weapon.name}</p>
        <p className="text-sm">現在Lv: {level}</p>
        <hr className="border-gray-400/40" />
        <p className="text-sm">基礎HP: {weapon.hp}</p>
        <p className="text-sm">基礎攻撃力: {weapon.attack}</p>
        <p className="text-sm">基礎治癒力: {weapon.heal}</p>
        <button type="button" onClick={handleClose} className="underline text-sm block ml-auto">
          閉じる
        </button>
      </div>
    </div>
  )
}
