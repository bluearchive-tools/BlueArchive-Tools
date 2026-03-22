'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function Footer() {
  const t = useTranslations('footer')

  return (
    <footer className="border-t bg-white/90 px-4 py-6 text-sm text-gray-700 dark:border-gray-800 dark:bg-black/80 dark:text-gray-300">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/privacy-policy" className="font-semibold text-blue-600 underline underline-offset-2 dark:text-blue-400">
            {t('privacyPolicy')}
          </Link>
          <Link href="/about" className="text-gray-600 underline underline-offset-2 dark:text-gray-300">
            {t('about')}
          </Link>
        </div>
        <p>{t('copyright')}</p>
      </div>
    </footer>
  )
}
