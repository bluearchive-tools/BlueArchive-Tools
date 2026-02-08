'use client'

import { useTheme } from '../../components/ThemeProvider'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import PageHelpButton from '../../components/PageHelpButton'
import {
  defaultShortcuts,
  TL_MAKER_SHORTCUT_CATEGORIES,
  TL_MAKER_SHORTCUT_STORAGE_KEY,
  type TlMakerShortcutSettings,
} from '../../lib/tl-maker-shortcuts'

const detectIsMacPlatform = () => {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
}

const formatShortcutFromEvent = (event: ReactKeyboardEvent<HTMLInputElement>) => {
  const key = event.key
  if (key === 'Backspace' || key === 'Delete') return ''
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(key)) return null
  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.metaKey) parts.push('Cmd')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  const label =
    key.length === 1 ? key.toUpperCase() : `${key.slice(0, 1).toUpperCase()}${key.slice(1)}`
  parts.push(label)
  return parts.join('+')
}

export default function Settings() {
  const { dark, toggle } = useTheme()
  const isMacPlatform = useMemo(() => detectIsMacPlatform(), [])
  const [shortcutSettings, setShortcutSettings] = useState<TlMakerShortcutSettings>(() =>
    defaultShortcuts(detectIsMacPlatform())
  )
  const shortcutDefaults = useMemo(() => defaultShortcuts(isMacPlatform), [isMacPlatform])

  const [delUser, setDelUser] = useState(false)
  const [delTheme, setDelTheme] = useState(false)
  const [delNotice, setDelNotice] = useState(false)
  const [delOpts, setDelOpts] = useState(false)
  const [delSync, setDelSync] = useState(false)
  const [delSquad, setDelSquad] = useState(false)
  const [delTL, setDelTL] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)
  const [confirmActive, setConfirmActive] = useState(false)
  const [confirmStep, setConfirmStep] = useState<'first' | 'second'>('first')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TL_MAKER_SHORTCUT_STORAGE_KEY)
      if (!raw) {
        setShortcutSettings(defaultShortcuts(isMacPlatform))
        return
      }
      const parsed = JSON.parse(raw) as Partial<TlMakerShortcutSettings>
      setShortcutSettings((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(parsed).filter(([, value]) => typeof value === 'string')
        ),
      }))
    } catch {
      setShortcutSettings(defaultShortcuts(isMacPlatform))
    }
  }, [isMacPlatform])

  useEffect(() => {
    try {
      localStorage.setItem(TL_MAKER_SHORTCUT_STORAGE_KEY, JSON.stringify(shortcutSettings))
      window.dispatchEvent(new StorageEvent('storage', {
        key: TL_MAKER_SHORTCUT_STORAGE_KEY,
        newValue: JSON.stringify(shortcutSettings),
      }))
    } catch {
      /* ignore */
    }
  }, [shortcutSettings])

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

  const targets = [
    { key: 'delUser', label: '学生データ', value: delUser },
    { key: 'delTheme', label: 'テーマ設定', value: delTheme },
    { key: 'delNotice', label: 'お知らせ既読状態', value: delNotice },
    { key: 'delOpts', label: '学生一覧設定', value: delOpts },
    { key: 'delSync', label: '同期完了フラグ', value: delSync },
    { key: 'delSquad', label: '部隊データ', value: delSquad },
    { key: 'delTL', label: 'TLデータ', value: delTL },
  ]
  const selectedTargets = targets.filter((t) => t.value)

  const openConfirm = () => {
    setStatus(null)
    setConfirmStep('first')
    setConfirmVisible(true)
    requestAnimationFrame(() => setConfirmActive(true))
  }

  const handleConfirmYes = () => {
    if (confirmStep === 'first') {
      setConfirmStep('second')
      return
    }
    clearLocal()
    setConfirmActive(false)
    setTimeout(() => setConfirmVisible(false), 150)
  }

  const handleConfirmNo = () => {
    setConfirmActive(false)
    setTimeout(() => {
      setConfirmVisible(false)
      setConfirmStep('first')
    }, 150)
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
      <section className="border rounded p-3 space-y-3">
        <h3 className="font-bold">TLメーカーdev ショートカットキー</h3>
        {TL_MAKER_SHORTCUT_CATEGORIES.map((category) => (
          <div key={category.title} className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-500">{category.title}</h4>
            {category.items.map((item) => (
              <label key={item.key} className="flex items-center gap-2 text-sm">
                <span className="w-32">{item.label}</span>
                <input
                  type="text"
                  value={shortcutSettings[item.key]}
                  onKeyDown={(e) => {
                    e.preventDefault()
                    const next = formatShortcutFromEvent(e)
                    if (next === null) return
                    setShortcutSettings((prev) => ({ ...prev, [item.key]: next }))
                  }}
                  readOnly
                  className="border rounded p-1 flex-1"
                  placeholder={shortcutDefaults[item.key]}
                />
              </label>
            ))}
          </div>
        ))}
        <p className="text-xs text-gray-500">
          ここで変更した内容は TLメーカーdev にも即時反映されます。
        </p>
      </section>
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
      {confirmVisible && (
        <div
          className={`fixed inset-0 z-20 flex items-center justify-center bg-black/40 dark:bg-black/60 transition-opacity duration-200 ${confirmActive ? 'opacity-100' : 'opacity-0'}`}
          onClick={handleConfirmNo}
        >
          <div
            className={`${dark ? 'bg-gray-800 text-white' : 'bg-white'} rounded p-4 shadow max-w-sm w-[90%] space-y-3 transition-all duration-200 ${confirmActive ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-semibold">
              {confirmStep === 'first'
                ? '選択したデータを削除してもよろしいですか？'
                : '本当に削除してもよろしいですか？'}
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 text-sm space-y-1">
              <p className="font-semibold">対象</p>
              {selectedTargets.length ? (
                <ul className="list-disc pl-5 space-y-1">
                  {selectedTargets.map((t) => (
                    <li key={t.key}>{t.label}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600 dark:text-gray-300">選択なし</p>
              )}
            </div>
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
