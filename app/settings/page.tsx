'use client'

import { useTheme } from '../../components/ThemeProvider'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons'

export default function Settings() {
  const { dark, toggle } = useTheme()

  const clearLocal = () => {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('userStudent:')) {
        keys.push(key)
      }
    }
    keys.forEach((k) => localStorage.removeItem(k))
    alert('ブラウザに保存されているデータを削除しました')
  }

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
      <button onClick={clearLocal} className="px-4 py-2 border rounded">
        ブラウザデータ削除
      </button>
    </main>
  )
}
