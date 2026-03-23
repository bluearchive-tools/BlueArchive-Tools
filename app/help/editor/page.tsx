'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { PAGE_HELP_PAGE_KEYS } from '../../../lib/page-help'
import { SUPPORTED_LOCALES, type Locale } from '../../../lib/i18n/config'

const CUSTOM_HELP_MD_STORAGE_KEY = 'customHelpMarkdown'

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

export default function HelpEditorPage() {
  const locale = useLocale() as Locale
  const t = useTranslations('help-editor')
  const [editorLocale, setEditorLocale] = useState<Locale>('ja')
  const [selectedPage, setSelectedPage] = useState<string>(PAGE_HELP_PAGE_KEYS[0] ?? 'about')
  const [markdownText, setMarkdownText] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (SUPPORTED_LOCALES.includes(locale)) {
      setEditorLocale(locale)
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
    void load()
    return () => {
      cancelled = true
    }
  }, [editorLocale, selectedPage])

  const showStatus = (message: string) => {
    setStatus(message)
    setTimeout(() => setStatus(''), 2000)
  }

  const save = () => {
    try {
      const savedRaw = localStorage.getItem(CUSTOM_HELP_MD_STORAGE_KEY)
      const saved = savedRaw ? (JSON.parse(savedRaw) as Record<string, string>) : {}
      saved[`${editorLocale}:${selectedPage}`] = markdownText
      localStorage.setItem(CUSTOM_HELP_MD_STORAGE_KEY, JSON.stringify(saved))
      showStatus(t('saved'))
    } catch {
      showStatus(t('saveFailed'))
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

      showStatus(t('resetCurrentDone'))
    } catch {
      showStatus(t('resetCurrentFailed'))
    }
  }

  const resetAll = () => {
    localStorage.removeItem(CUSTOM_HELP_MD_STORAGE_KEY)
    showStatus(t('resetAllDone'))
  }

  const preview = useMemo(() => {
    if (!markdownText.trim()) return <p className="text-sm text-gray-500">{t('empty')}</p>
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
  }, [markdownText, t])

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">{t('title')}</h1>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300">{t('description')}</p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          {t('locale')}:
          <select
            value={editorLocale}
            onChange={(event) => setEditorLocale(event.target.value as Locale)}
            className="ml-2 border rounded px-2 py-1 text-sm"
          >
            {SUPPORTED_LOCALES.map((supportedLocale) => (
              <option key={supportedLocale} value={supportedLocale}>
                {supportedLocale}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          {t('page')}:
          <select
            value={selectedPage}
            onChange={(event) => setSelectedPage(event.target.value)}
            className="ml-2 border rounded px-2 py-1 text-sm"
          >
            {PAGE_HELP_PAGE_KEYS.map((pageKey) => (
              <option key={pageKey} value={pageKey}>
                {pageKey}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={save} className="px-3 py-2 rounded border bg-blue-600 text-white text-sm">
          {t('save')}
        </button>
        <button type="button" onClick={resetCurrent} className="px-3 py-2 rounded border text-sm">
          {t('resetCurrent')}
        </button>
        <button type="button" onClick={resetAll} className="px-3 py-2 rounded border text-sm">
          {t('resetAll')}
        </button>
      </div>

      {status && <p className="text-sm text-green-600 dark:text-green-400">{status}</p>}
      {loading && <p className="text-sm text-gray-500">{t('loading')}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="font-semibold text-sm">{t('markdownInput')}</p>
          <textarea
            value={markdownText}
            onChange={(event) => setMarkdownText(event.target.value)}
            className="w-full h-[60vh] border rounded p-2 text-sm font-mono"
          />
        </div>
        <div className="space-y-2 bg-white dark:bg-gray-800 border rounded p-3">
          <p className="font-semibold text-sm">{t('preview')}</p>
          {preview}
        </div>
      </div>
    </main>
  )
}
