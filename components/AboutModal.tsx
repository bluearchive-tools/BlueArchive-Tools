'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from './ThemeProvider'
import { useLocale } from 'next-intl'
import aboutContent from '../data/about.json'

type AboutSection = {
  title: string
  body: string[]
  currentPathLabel?: string
  closeLabel?: string
  discordTitle?: string
  discordDescription?: string
  discordWidget?: {
    src: string
    width: number
    height: number
    title?: string
  }
}

type AboutContentMap = Record<string, AboutSection>

const aboutMap = aboutContent as AboutContentMap

interface Props {
  open: boolean
  onClose: () => void
  currentPath: string
}

export default function AboutModal({ open, onClose, currentPath }: Props) {
  const { dark } = useTheme()
  const locale = useLocale()
  const [visible, setVisible] = useState(open)
  const [active, setActive] = useState(open)

  const content = useMemo(() => aboutMap[locale] ?? aboutMap.en, [locale])

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

  if (!visible || !content) return null

  const pathLabel = content.currentPathLabel?.replace('{path}', currentPath)
  const closeLabel = content.closeLabel ?? 'Close'
  const discordWidget = content.discordWidget

  return (
    <div
      className={`fixed inset-0 ${dark ? 'bg-black/50' : 'bg-black/20'} flex items-center justify-center z-20 transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`${dark ? 'bg-gray-800 text-white' : 'bg-gray-100'} p-4 max-w-lg w-full rounded-lg h-[80vh] max-h-[80vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">{content.title}</h2>
          <button onClick={onClose} aria-label={closeLabel} className="text-lg leading-none">
            ×
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            {content.body.map((text, idx) => (
              <p key={idx} className="text-sm leading-relaxed">
                {text}
              </p>
            ))}
          </div>
          {pathLabel && <p className="text-xs text-gray-600 dark:text-gray-300">{pathLabel}</p>}
          {discordWidget && (
            <div className="space-y-2">
              {content.discordTitle && <h3 className="text-lg font-semibold">{content.discordTitle}</h3>}
              {content.discordDescription && <p className="text-sm leading-relaxed">{content.discordDescription}</p>}
              <div className="flex justify-center">
                <iframe
                  src={discordWidget.src}
                  width={discordWidget.width}
                  height={discordWidget.height}
                  title={discordWidget.title ?? content.discordTitle ?? 'Discord widget'}
                  allowTransparency
                  frameBorder="0"
                  sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                  className="rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700"
                ></iframe>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
