'use client'

import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import helpContent from '../../../data/pageHelp.json'

const CUSTOM_HELP_MD_STORAGE_KEY = 'customHelpMarkdown'
const SUPPORTED_LOCALES = ['ja', 'en', 'zh-CN', 'zh-TW'] as const

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
  const [locale, setLocale] = useState<(typeof SUPPORTED_LOCALES)[number]>('ja')
  const [selectedPage, setSelectedPage] = useState<string>(pageKeys[0] ?? 'about')
  const [markdownText, setMarkdownText] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const savedRaw = localStorage.getItem(CUSTOM_HELP_MD_STORAGE_KEY)
        const saved = savedRaw ? (JSON.parse(savedRaw) as Record<string, string>) : {}
        const custom = saved[`${locale}:${selectedPage}`]
        if (custom != null) {
          if (!cancelled) setMarkdownText(custom)
          return
        }

        const res = await fetch(`/helps/${locale}/${selectedPage}.md`)
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
  }, [locale, selectedPage])

  const save = () => {
    try {
      const savedRaw = localStorage.getItem(CUSTOM_HELP_MD_STORAGE_KEY)
      const saved = savedRaw ? (JSON.parse(savedRaw) as Record<string, string>) : {}
      saved[`${locale}:${selectedPage}`] = markdownText
      localStorage.setItem(CUSTOM_HELP_MD_STORAGE_KEY, JSON.stringify(saved))
      setStatus('保存しました（このブラウザのヘルプモーダルに即時反映されます）。')
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus('保存に失敗しました。')
      setTimeout(() => setStatus(''), 2000)
    }
  }

  const resetCurrent = async () => {
    try {
      const savedRaw = localStorage.getItem(CUSTOM_HELP_MD_STORAGE_KEY)
      const saved = savedRaw ? (JSON.parse(savedRaw) as Record<string, string>) : {}
      delete saved[`${locale}:${selectedPage}`]
      localStorage.setItem(CUSTOM_HELP_MD_STORAGE_KEY, JSON.stringify(saved))

      const res = await fetch(`/helps/${locale}/${selectedPage}.md`)
      if (res.ok) {
        setMarkdownText(await res.text())
      } else {
        setMarkdownText('')
      }

      setStatus('このページのカスタム内容をリセットしました。')
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus('リセットに失敗しました。')
      setTimeout(() => setStatus(''), 2000)
    }
  }

  const resetAll = () => {
    localStorage.removeItem(CUSTOM_HELP_MD_STORAGE_KEY)
    setStatus('すべてのカスタムヘルプをリセットしました。')
    setTimeout(() => setStatus(''), 2000)
  }

  const preview = useMemo(() => {
    if (!markdownText.trim()) return <p className="text-sm text-gray-500">内容がありません。</p>
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
  }, [markdownText])

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">ヘルプモーダル用 Markdown エディタ</h1>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        ここで編集した内容は localStorage に保存され、ヘルプモーダル（PageHelpButton）と About モーダルに即時反映されます。
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          ロケール:
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as (typeof SUPPORTED_LOCALES)[number])}
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
          ページ:
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
          保存
        </button>
        <button type="button" onClick={resetCurrent} className="px-3 py-2 rounded border text-sm">
          このページをリセット
        </button>
        <button type="button" onClick={resetAll} className="px-3 py-2 rounded border text-sm">
          全体リセット
        </button>
      </div>

      {status && <p className="text-sm text-green-600 dark:text-green-400">{status}</p>}
      {loading && <p className="text-sm text-gray-500">読み込み中...</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="font-semibold text-sm">Markdown入力</p>
          <textarea
            value={markdownText}
            onChange={(e) => setMarkdownText(e.target.value)}
            className="w-full h-[60vh] border rounded p-2 text-sm font-mono"
          />
        </div>
        <div className="space-y-2 bg-white dark:bg-gray-800 border rounded p-3">
          <p className="font-semibold text-sm">プレビュー</p>
          {preview}
        </div>
      </div>
    </main>
  )
}
