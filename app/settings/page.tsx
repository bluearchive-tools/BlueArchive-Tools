'use client'

import { useTheme } from '../../components/ThemeProvider'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'

export default function Settings() {
  const { dark, toggle } = useTheme()

  const [delUser, setDelUser] = useState(true)
  const [delTheme, setDelTheme] = useState(false)
  const [delNotice, setDelNotice] = useState(false)
  const [delOpts, setDelOpts] = useState(false)
  const [delSync, setDelSync] = useState(false)
  const [delSquad, setDelSquad] = useState(false)

  const clearLocal = () => {
    if (!confirm('選択したデータを削除しますか？')) return
    if (delUser) {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('userStudent:')) {
          keys.push(key)
        }
      }
      keys.forEach((k) => localStorage.removeItem(k))
    }
    if (delTheme) localStorage.removeItem('theme')
    if (delNotice) localStorage.removeItem('lastNoticeId')
    if (delOpts) localStorage.removeItem('students_page_opts')
    if (delSync) {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('sync_done_')) {
          keys.push(key)
        }
      }
      keys.forEach((k) => localStorage.removeItem(k))
    }
    if (delSquad) localStorage.removeItem('squadGroups')
    alert('削除しました')
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
      <div className="border rounded p-2 space-y-1">
        <p className="font-bold">削除するデータ</p>
        <label className="block text-sm">
          <input
            type="checkbox"
            className="mr-1"
            checked={delUser}
            onChange={(e) => setDelUser(e.target.checked)}
          />
          学生データ
        </label>
        <label className="block text-sm">
          <input
            type="checkbox"
            className="mr-1"
            checked={delTheme}
            onChange={(e) => setDelTheme(e.target.checked)}
          />
          テーマ設定
        </label>
        <label className="block text-sm">
          <input
            type="checkbox"
            className="mr-1"
            checked={delNotice}
            onChange={(e) => setDelNotice(e.target.checked)}
          />
          お知らせ既読状態
        </label>
        <label className="block text-sm">
          <input
            type="checkbox"
            className="mr-1"
            checked={delOpts}
            onChange={(e) => setDelOpts(e.target.checked)}
          />
          学生一覧設定
        </label>
        <label className="block text-sm">
          <input
            type="checkbox"
            className="mr-1"
            checked={delSync}
            onChange={(e) => setDelSync(e.target.checked)}
          />
          同期完了フラグ
        </label>
        <label className="block text-sm">
          <input
            type="checkbox"
            className="mr-1"
            checked={delSquad}
            onChange={(e) => setDelSquad(e.target.checked)}
          />
          部隊データ
        </label>
        <button onClick={clearLocal} className="mt-2 px-4 py-2 border rounded w-full">
          選択したデータを削除
        </button>
      </div>
    </main>
  )
}
