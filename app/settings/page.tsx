'use client'

import { useTheme } from '../../components/ThemeProvider'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import PageHelpButton from '../../components/PageHelpButton'

export default function Settings() {
  const { dark, toggle } = useTheme()

  const [delUser, setDelUser] = useState(false)
  const [delTheme, setDelTheme] = useState(false)
  const [delNotice, setDelNotice] = useState(false)
  const [delOpts, setDelOpts] = useState(false)
  const [delSync, setDelSync] = useState(false)
  const [delSquad, setDelSquad] = useState(false)
  const [delTL, setDelTL] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmStep, setConfirmStep] = useState<'first' | 'second'>('first')
  const [status, setStatus] = useState<string | null>(null)

  const clearLocal = () => {
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
    if (delTL) {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (
          key &&
          (key.startsWith('tlMakerProject_') ||
            key === 'tlLength' ||
            key === 'tlDefaultSkillLevels' ||
            key === 'tlSkillColors' ||
            key === 'tlMakerCache' ||
            key === 'tlMakerLastKey')
        ) {
          keys.push(key)
        }
      }
      keys.forEach((k) => localStorage.removeItem(k))
    }
    setStatus('削除しました')
  }

  const openConfirm = () => {
    setStatus(null)
    setConfirmStep('first')
    setConfirmOpen(true)
  }

  const handleConfirmYes = () => {
    if (confirmStep === 'first') {
      setConfirmStep('second')
      return
    }
    clearLocal()
    setConfirmOpen(false)
  }

  const handleConfirmNo = () => {
    setConfirmOpen(false)
    setConfirmStep('first')
  }

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl">設定ページ</h2>
        <PageHelpButton pageKey="settings" />
      </div>
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
        <label className="block text-sm">
          <input
            type="checkbox"
            className="mr-1"
            checked={delTL}
            onChange={(e) => setDelTL(e.target.checked)}
          />
          TLデータ
        </label>
        <button onClick={openConfirm} className="mt-2 px-4 py-2 border rounded w-full">
          選択したデータを削除
        </button>
        {status && <p className="text-sm text-green-600 dark:text-green-400 mt-1">{status}</p>}
      </div>
      {confirmOpen && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 dark:bg-black/60"
          onClick={handleConfirmNo}
        >
          <div
            className={`${dark ? 'bg-gray-800 text-white' : 'bg-white'} rounded p-4 shadow max-w-sm w-[90%] space-y-3`}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-semibold">
              {confirmStep === 'first'
                ? '選択したデータを削除してもよろしいですか？'
                : '本当に削除してもよろしいですか？'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleConfirmNo}
                className="px-3 py-1 border rounded"
              >
                いいえ
              </button>
              <button
                type="button"
                onClick={handleConfirmYes}
                className="px-3 py-1 border rounded bg-red-600 text-white"
              >
                はい
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
