'use client'

import { useTheme } from '../../components/ThemeProvider'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons'

export default function Settings() {
  const { dark, toggle } = useTheme()

  return (
    <main className="p-4 space-y-4">
      <h2 className="text-xl">設定ページ</h2>
      <button
        onClick={toggle}
        className="px-4 py-2 border rounded flex items-center gap-2"
      >
        <FontAwesomeIcon icon={dark ? faSun : faMoon} />
        <span>{dark ? 'ライトモードに切替' : 'ダークモードに切替'}</span>
      </button>
    </main>
  )
}
