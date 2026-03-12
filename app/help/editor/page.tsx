'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import helpContent from '../../../data/pageHelp.json'
import type { Locale } from '../../../lib/i18n/config'

const CUSTOM_HELP_MD_STORAGE_KEY = 'customHelpMarkdown'
const SUPPORTED_LOCALES = ['ja', 'en', 'zh-CN', 'zh-TW'] as const

type UiText = {
  title: string
  description: string
  locale: string
  page: string
  save: string
  resetCurrent: string
  resetAll: string
  loading: string
  empty: string
  markdownInput: string
  preview: string
  saved: string
  saveFailed: string
  resetCurrentDone: string
  resetCurrentFailed: string
  resetAllDone: string
}

const UI_TEXT: Record<Locale, UiText> = {
  ja: {
    title: 'ヘルプモーダル用 Markdown エディタ',
    description: 'ここで編集した内容は localStorage に保存され、ヘルプモーダル（PageHelpButton）と About モーダルに即時反映されます。',
    locale: 'ロケール',
    page: 'ページ',
    save: '保存',
    resetCurrent: 'このページをリセット',
    resetAll: '全体リセット',
    loading: '読み込み中...',
    empty: '内容がありません。',
    markdownInput: 'Markdown入力',
    preview: 'プレビュー',
    saved: '保存しました（このブラウザのヘルプモーダルに即時反映されます）。',
    saveFailed: '保存に失敗しました。',
    resetCurrentDone: 'このページのカスタム内容をリセットしました。',
    resetCurrentFailed: 'リセットに失敗しました。',
    resetAllDone: 'すべてのカスタムヘルプをリセットしました。',
  },
  en: {
    title: 'Markdown editor for help modals',
    description: 'Edits are saved to localStorage and reflected immediately in PageHelpButton and About modal.',
    locale: 'Locale',
    page: 'Page',
    save: 'Save',
    resetCurrent: 'Reset this page',
    resetAll: 'Reset all',
    loading: 'Loading...',
    empty: 'No content.',
    markdownInput: 'Markdown input',
    preview: 'Preview',
    saved: 'Saved (reflected immediately in this browser).',
    saveFailed: 'Failed to save.',
    resetCurrentDone: 'Reset custom content for this page.',
    resetCurrentFailed: 'Failed to reset.',
    resetAllDone: 'Reset all custom help content.',
  },
  'zh-CN': {
    title: '帮助弹窗 Markdown 编辑器',
    description: '在这里编辑的内容会保存到 localStorage，并立即反映到帮助弹窗（PageHelpButton）和 About 弹窗。',
    locale: '语言',
    page: '页面',
    save: '保存',
    resetCurrent: '重置此页面',
    resetAll: '全部重置',
    loading: '加载中...',
    empty: '暂无内容。',
    markdownInput: 'Markdown 输入',
    preview: '预览',
    saved: '已保存（会立即反映到当前浏览器）。',
    saveFailed: '保存失败。',
    resetCurrentDone: '已重置此页面的自定义内容。',
    resetCurrentFailed: '重置失败。',
    resetAllDone: '已重置全部自定义帮助内容。',
  },
  'zh-TW': {
    title: '說明彈窗 Markdown 編輯器',
    description: '在此編輯的內容會儲存到 localStorage，並立即反映到說明彈窗（PageHelpButton）與 About 彈窗。',
    locale: '語言',
    page: '頁面',
    save: '儲存',
    resetCurrent: '重設此頁面',
    resetAll: '全部重設',
    loading: '載入中...',
    empty: '目前沒有內容。',
    markdownInput: 'Markdown 輸入',
    preview: '預覽',
    saved: '已儲存（會立即反映到目前瀏覽器）。',
    saveFailed: '儲存失敗。',
    resetCurrentDone: '已重設此頁面的自訂內容。',
    resetCurrentFailed: '重設失敗。',
    resetAllDone: '已重設全部自訂說明內容。',
  },
}

const markdownComponents = {
  img: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={alt ?? ''} className={`max-w-full h-auto ${props.className ?? ''}`} />
  ),
  a: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} target={props.target ?? '_blank'} rel={props.rel ?? 'noreferrer'}>
      {children}
    </a>
  ),
}

const pageKeys = [
  ...new Set([
    ...Object.keys((helpContent as Record<string, Record<string, unknown>>).ja ?? {}).filter((k) => k !== '_common'),
    ...Object.keys((helpContent as Record<string, Record<string, unknown>>).en ?? {}).filter((k) => k !== '_common'),
    'about',
    'html-tags-example',
  ]),
].sort((a, b) => a.localeCompare(b))

export default function HelpEditorPage() {
  const locale = useLocale() as Locale
  const ui = UI_TEXT[locale] ?? UI_TEXT.ja
  const [editorLocale, setEditorLocale] = useState<(typeof SUPPORTED_LOCALES)[number]>('ja')
  const [selectedPage, setSelectedPage] = useState<string>(pageKeys[0] ?? 'about')
  const [markdownText, setMarkdownText] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
      setEditorLocale(locale as (typeof SUPPORTED_LOCALES)[number])
    }
  }, [locale])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const savedRaw = localStorage.getItem(CUSTOM_HELP_MD_STORAGE_KEY)
        const saved = savedRaw ? (JSON.parse(savedRaw) as Record<string, string>) : {}
        const custom = saved[`${editorLocale}:${selectedPage}`]
        if (custom != null) {
          if (!cancelled) setMarkdownText(custom)
          return
        }

        const res = await fetch(`/helps/${editorLocale}/${selectedPage}.md`)
        if (res.ok) {
          const text = await res.text()
          if (!cancelled) setMarkdownText(text)
          return
        }

        if (!cancelled) setMarkdownText('')
      } catch {
        if (!cancelled) setMarkdownText('')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [editorLocale, selectedPage])

  const save = () => {
    try {
      const savedRaw = localStorage.getItem(CUSTOM_HELP_MD_STORAGE_KEY)
      const saved = savedRaw ? (JSON.parse(savedRaw) as Record<string, string>) : {}
      saved[`${editorLocale}:${selectedPage}`] = markdownText
      localStorage.setItem(CUSTOM_HELP_MD_STORAGE_KEY, JSON.stringify(saved))
      setStatus(ui.saved)
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus(ui.saveFailed)
      setTimeout(() => setStatus(''), 2000)
    }
  }

  const resetCurrent = async () => {
    try {
      const savedRaw = localStorage.getItem(CUSTOM_HELP_MD_STORAGE_KEY)
      const saved = savedRaw ? (JSON.parse(savedRaw) as Record<string, string>) : {}
      delete saved[`${editorLocale}:${selectedPage}`]
      localStorage.setItem(CUSTOM_HELP_MD_STORAGE_KEY, JSON.stringify(saved))

      const res = await fetch(`/helps/${editorLocale}/${selectedPage}.md`)
      if (res.ok) {
        setMarkdownText(await res.text())
      } else {
        setMarkdownText('')
      }

      setStatus(ui.resetCurrentDone)
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus(ui.resetCurrentFailed)
      setTimeout(() => setStatus(''), 2000)
    }
  }

  const resetAll = () => {
    localStorage.removeItem(CUSTOM_HELP_MD_STORAGE_KEY)
    setStatus(ui.resetAllDone)
    setTimeout(() => setStatus(''), 2000)
  }

  const preview = useMemo(() => {
    if (!markdownText.trim()) return <p className="text-sm text-gray-500">{ui.empty}</p>
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={markdownComponents}
        className="prose dark:prose-invert max-w-none"
      >
        {markdownText}
      </ReactMarkdown>
    )
  }, [markdownText, ui.empty])

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">{ui.title}</h1>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300">{ui.description}</p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          {ui.locale}:
          <select
            value={editorLocale}
            onChange={(e) => setEditorLocale(e.target.value as (typeof SUPPORTED_LOCALES)[number])}
            className="ml-2 border rounded px-2 py-1 text-sm"
          >
            {SUPPORTED_LOCALES.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          {ui.page}:
          <select
            value={selectedPage}
            onChange={(e) => setSelectedPage(e.target.value)}
            className="ml-2 border rounded px-2 py-1 text-sm"
          >
            {pageKeys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={save} className="px-3 py-2 rounded border bg-blue-600 text-white text-sm">
          {ui.save}
        </button>
        <button type="button" onClick={resetCurrent} className="px-3 py-2 rounded border text-sm">
          {ui.resetCurrent}
        </button>
        <button type="button" onClick={resetAll} className="px-3 py-2 rounded border text-sm">
          {ui.resetAll}
        </button>
      </div>

      {status && <p className="text-sm text-green-600 dark:text-green-400">{status}</p>}
      {loading && <p className="text-sm text-gray-500">{ui.loading}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="font-semibold text-sm">{ui.markdownInput}</p>
          <textarea
            value={markdownText}
            onChange={(e) => setMarkdownText(e.target.value)}
            className="w-full h-[60vh] border rounded p-2 text-sm font-mono"
          />
        </div>
        <div className="space-y-2 bg-white dark:bg-gray-800 border rounded p-3">
          <p className="font-semibold text-sm">{ui.preview}</p>
          {preview}
        </div>
      </div>
    </main>
  )
}
