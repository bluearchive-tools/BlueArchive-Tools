'use client'

import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons'
import { useLocale } from 'next-intl'
import { useTheme } from './ThemeProvider'
import helpContent from '../data/pageHelp.json'

type PageHelpEntry = {
  title: string
  body: string[]
  buttonLabel?: string
}

type PageHelpLocale = Record<string, PageHelpEntry> & {
  _common?: {
    buttonLabel?: string
  }
}

const helpMap = helpContent as Record<string, PageHelpLocale>

interface Props {
  pageKey: string
  className?: string
}

export default function PageHelpButton({ pageKey, className }: Props) {
  const locale = useLocale()
  const { dark } = useTheme()
  const [visible, setVisible] = useState(false)
  const [active, setActive] = useState(false)

  const content = useMemo(() => {
    const localeContent = helpMap[locale] ?? helpMap.en ?? {}
    const fallbackContent = helpMap.en ?? {}
    const entry = (localeContent as Record<string, PageHelpEntry | undefined>)[pageKey] ?? (fallbackContent as Record<string, PageHelpEntry | undefined>)[pageKey]
    const buttonLabel =
      entry?.buttonLabel ??
      (localeContent as { _common?: { buttonLabel?: string } })._common?.buttonLabel ??
      (fallbackContent as { _common?: { buttonLabel?: string } })._common?.buttonLabel ??
      'About this page'
    return entry ? { entry, buttonLabel } : null
  }, [locale, pageKey])

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => setActive(true), 20)
    return () => clearTimeout(timer)
  }, [visible])

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
          className={`fixed inset-0 ${dark ? 'bg-black/50' : 'bg-black/20'} flex items-center justify-center z-20 transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`}
          onClick={close}
        >
          <div
            className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 max-w-md w-full rounded-lg h-[70vh] max-h-[70vh] flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">{entry.title}</h2>
              <button onClick={close} aria-label={buttonLabel} className="text-lg leading-none">
                ×
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto pr-1">
              {entry.body.map((text, idx) => (
                <p key={idx} className="text-sm leading-relaxed">
                  {text}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
