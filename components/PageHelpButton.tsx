'use client'

import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from './ThemeProvider'
import { PAGE_HELP_BY_LOCALE, type PageHelpEntry, type PageHelpLocale } from '../lib/page-help'
import type { Locale } from '../lib/i18n/config'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

const CUSTOM_HELP_MD_STORAGE_KEY = 'customHelpMarkdown'

interface Props {
  pageKey: string
  className?: string
}

export default function PageHelpButton({ pageKey, className }: Props) {
  const locale = useLocale() as Locale
  const t = useTranslations('page-help')
  const { dark } = useTheme()
  const [visible, setVisible] = useState(false)
  const [active, setActive] = useState(false)
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [heading, setHeading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const content = useMemo(() => {
    const localeContent = PAGE_HELP_BY_LOCALE[locale] ?? PAGE_HELP_BY_LOCALE.en
    const fallbackContent = PAGE_HELP_BY_LOCALE.en
    const entry = (localeContent as Record<string, PageHelpEntry | undefined>)[pageKey] ?? (fallbackContent as Record<string, PageHelpEntry | undefined>)[pageKey]
    const buttonLabel =
      entry?.buttonLabel ??
      (localeContent as PageHelpLocale)._common?.buttonLabel ??
      (fallbackContent as PageHelpLocale)._common?.buttonLabel ??
      t('defaultButtonLabel')
    return entry ? { entry, buttonLabel } : null
  }, [locale, pageKey, t])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setMarkdown(null)
      setHeading(null)
      const locales: Locale[] = locale === 'en' ? ['en'] : [locale, 'en']
      for (const loc of locales) {
        try {
          const customRaw = localStorage.getItem(CUSTOM_HELP_MD_STORAGE_KEY)
          if (customRaw) {
            const parsed = JSON.parse(customRaw) as Record<string, string>
            const customMarkdown = parsed[`${loc}:${pageKey}`]
            if (customMarkdown) {
              const lines = customMarkdown.split(/\r?\n/)
              const firstHeadingIndex = lines.findIndex((line) => line.trim().startsWith('# '))
              if (firstHeadingIndex >= 0) {
                const nextHeading = lines[firstHeadingIndex]?.replace(/^#\s+/, '').trim() ?? ''
                setHeading(nextHeading || null)
                lines.splice(firstHeadingIndex, 1)
              }
              setMarkdown(lines.join('\n').trim() || customMarkdown)
              setLoading(false)
              return
            }
          }
        } catch {
          // fallback to file fetch
        }

        try {
          const res = await fetch(`/helps/${loc}/${pageKey}.md`)
          if (!res.ok) continue
          const text = await res.text()
          if (cancelled) return
          const lines = text.split(/\r?\n/)
          const firstHeadingIndex = lines.findIndex((line) => line.trim().startsWith('# '))
          if (firstHeadingIndex >= 0) {
            const nextHeading = lines[firstHeadingIndex]?.replace(/^#\s+/, '').trim() ?? ''
            setHeading(nextHeading || null)
            lines.splice(firstHeadingIndex, 1)
          }
          setMarkdown(lines.join('\n').trim() || text)
          setLoading(false)
          return
        } catch {
          // try next locale
        }
      }
      if (!cancelled) {
        setError(t('loadError'))
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [visible, locale, pageKey, t])

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => setActive(true), 20)
    return () => clearTimeout(timer)
  }, [visible])

  useEffect(() => {
    const openByShortcut = () => setVisible(true)
    window.addEventListener('page-help-shortcut', openByShortcut)
    return () => window.removeEventListener('page-help-shortcut', openByShortcut)
  }, [])

  if (!content) return null

  const { entry, buttonLabel } = content

  const close = () => {
    setActive(false)
    setTimeout(() => setVisible(false), 150)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setVisible(true)}
        aria-label={buttonLabel}
        className={`text-base ${className ?? ''}`.trim()}
      >
        <FontAwesomeIcon icon={faCircleQuestion} />
      </button>
      {visible && (
        <div
          className={`fixed inset-0 ${dark ? 'bg-black/50' : 'bg-black/20'} flex items-center justify-center z-[220] transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`}
          onClick={close}
        >
          <div
            className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 max-w-md w-full rounded-lg h-[70vh] max-h-[70vh] flex flex-col`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">{heading || entry.title}</h2>
              <button onClick={close} aria-label={buttonLabel} className="text-lg leading-none">
                ×
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto pr-1">
              {loading && <p className="text-sm text-gray-500 dark:text-gray-300">{t('loading')}</p>}
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
                    a: (props) => <a {...props} target={props.target ?? '_blank'} rel={props.rel ?? 'noreferrer'} />,
                  }}
                >
                  {markdown}
                </ReactMarkdown>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
