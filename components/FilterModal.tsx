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
  reset: () => void
  close: () => void
}

export default function FilterModal({
  attackTypes,
  defenseTypes,
  selectedAttacks,
  selectedDefenses,
  toggleAttack,
  toggleDefense,
  reset,
  close,
}: FilterModalProps) {
  const { dark } = useTheme()
  return (
    <div
      className={`fixed inset-0 z-20 flex items-center justify-center ${dark ? 'bg-black/50' : 'bg-black/20'}`}
      onClick={close}
    >
      <div
        className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 rounded space-y-4 w-80 relative`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={reset}
          className="absolute right-2 top-2 text-sm underline"
          type="button"
        >
          リセット
        </button>
        <h3 className="font-bold text-lg">絞り込み</h3>
        <div className="space-y-2">
          <p className="font-semibold">攻撃属性</p>
          <div className="flex flex-wrap gap-2">
            {attackTypes.map((at) => {
              const checked = selectedAttacks.includes(at)
              return (
                <button
                  type="button"
                  key={at}
                  onClick={() => toggleAttack(at)}
                  className="flex items-center gap-1 cursor-pointer select-none"
                >
                  <span
                    className={`w-4 h-4 border flex items-center justify-center text-xs ${checked ? (dark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') : ''}`}
                    aria-pressed={checked}
                  >
                    {checked && <FontAwesomeIcon icon={faCheck} />}
                  </span>
                  <span className="text-sm">{at}</span>
                </button>
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
                <button
                  type="button"
                  key={dt}
                  onClick={() => toggleDefense(dt)}
                  className="flex items-center gap-1 cursor-pointer select-none"
                >
                  <span
                    className={`w-4 h-4 border flex items-center justify-center text-xs ${checked ? (dark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') : ''}`}
                    aria-pressed={checked}
                  >
                    {checked && <FontAwesomeIcon icon={faCheck} />}
                  </span>
                  <span className="text-sm">{dt}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
