'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from './ThemeProvider'
import { useLocale } from 'next-intl'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

interface Props {
  open: boolean
  onClose: () => void
  currentPath: string
}

const CUSTOM_HELP_MD_STORAGE_KEY = 'customHelpMarkdown'

export default function AboutModal({ open, onClose, currentPath }: Props) {
  const { dark } = useTheme()
  const locale = useLocale()
  const [visible, setVisible] = useState(open)
  const [active, setActive] = useState(open)
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [heading, setHeading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const closeLabel = useMemo(() => (locale === 'ja' ? '閉じる' : 'Close'), [locale])

  useEffect(() => {
    if (open) {
      setVisible(true)
      const timer = setTimeout(() => setActive(true), 20)
      return () => clearTimeout(timer)
    }
    setActive(false)
    const timer = setTimeout(() => setVisible(false), 200)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!visible) return
    let cancelled = false

    const readCustomMarkdown = (loc: string) => {
      try {
        const raw = localStorage.getItem(CUSTOM_HELP_MD_STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Record<string, string>
        return parsed[`${loc}:about`] ?? null
      } catch {
        return null
      }
    }

    const applyMarkdown = (text: string) => {
      const lines = text.split(/\r?\n/)
      const firstHeadingIndex = lines.findIndex((l) => l.trim().startsWith('# '))
      if (firstHeadingIndex >= 0) {
        const h = lines[firstHeadingIndex].replace(/^#\s+/, '').trim()
        setHeading(h || null)
        lines.splice(firstHeadingIndex, 1)
      } else {
        setHeading(null)
      }
      const body = lines.join('\n').trim() || text
      setMarkdown(body.replace(/\{\{\s*path\s*\}\}/gi, currentPath))
    }

    const load = async () => {
      setLoading(true)
      setError(null)
      setMarkdown(null)
      const locales = [locale, 'en']

      for (const loc of locales) {
        const custom = readCustomMarkdown(loc)
        if (custom) {
          if (cancelled) return
          applyMarkdown(custom)
          setLoading(false)
          return
        }

        try {
          const res = await fetch(`/helps/${loc}/about.md`)
          if (!res.ok) continue
          const text = await res.text()
          if (cancelled) return
          applyMarkdown(text)
          setLoading(false)
          return
        } catch {
          // try next locale
        }
      }

      if (!cancelled) {
        setError('コンテンツを読み込めませんでした。')
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [visible, locale, currentPath])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 ${dark ? 'bg-black/50' : 'bg-black/20'} flex items-center justify-center z-20 transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 max-w-md w-full rounded-lg h-[70vh] max-h-[70vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">{heading ?? (locale === 'ja' ? 'このページについて' : 'About this page')}</h2>
          <button onClick={onClose} aria-label={closeLabel} className="text-lg leading-none">
            ×
          </button>
        </div>
        <div className="space-y-2 overflow-y-auto pr-1">
          {loading && <p className="text-sm text-gray-500 dark:text-gray-300">読み込み中...</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!loading && !error && markdown && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h1:leading-tight prose-h2:text-lg prose-h2:mt-4 prose-p:leading-relaxed"
              components={{
                img: ({ alt, ...props }) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img {...props} alt={alt ?? ''} className={`max-w-full h-auto ${props.className ?? ''}`} />
                ),
                a: (props) => (
                  <a {...props} target={props.target ?? '_blank'} rel={props.rel ?? 'noreferrer'} />
                ),
              }}
            >
              {markdown}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  )
}
