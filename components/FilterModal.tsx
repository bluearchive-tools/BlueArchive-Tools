'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { useTheme } from './ThemeProvider'

interface FilterModalProps {
  attackTypes: string[]
  defenseTypes: string[]
  selectedAttacks: string[]
  selectedDefenses: string[]
  toggleAttack: (value: string) => void
  toggleDefense: (value: string) => void
  close: () => void
}

export default function FilterModal({
  attackTypes,
  defenseTypes,
  selectedAttacks,
  selectedDefenses,
  toggleAttack,
  toggleDefense,
  close,
}: FilterModalProps) {
  const { dark } = useTheme()
  return (
    <div
      className={`fixed inset-0 z-20 flex items-center justify-center ${dark ? 'bg-black/50' : 'bg-black/20'}`}
      onClick={close}
    >
      <div
        className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 rounded space-y-4 w-80`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-lg">絞り込み</h3>
        <div className="space-y-2">
          <p className="font-semibold">攻撃属性</p>
          <div className="flex flex-wrap gap-2">
            {attackTypes.map((at) => {
              const checked = selectedAttacks.includes(at)
              return (
                <label key={at} className="flex items-center gap-1 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => toggleAttack(at)}
                    className={`w-4 h-4 border flex items-center justify-center text-xs ${checked ? (dark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') : ''}`}
                    aria-pressed={checked}
                  >
                    {checked && <FontAwesomeIcon icon={faCheck} />}
                  </button>
                  <span className="text-sm">{at}</span>
                </label>
              )
            })}
          </div>
        </div>
        <div className="space-y-2">
          <p className="font-semibold">防御属性</p>
          <div className="flex flex-wrap gap-2">
            {defenseTypes.map((dt) => {
              const checked = selectedDefenses.includes(dt)
              return (
                <label key={dt} className="flex items-center gap-1 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => toggleDefense(dt)}
                    className={`w-4 h-4 border flex items-center justify-center text-xs ${checked ? (dark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') : ''}`}
                    aria-pressed={checked}
                  >
                    {checked && <FontAwesomeIcon icon={faCheck} />}
                  </button>
                  <span className="text-sm">{dt}</span>
                </label>
              )
            })}
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={close} className="px-4 py-1 border rounded">閉じる</button>
        </div>
      </div>
    </div>
  )
}
