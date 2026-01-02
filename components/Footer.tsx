'use client'

import { useTranslations } from 'next-intl'

export default function Footer() {
  const t = useTranslations('footer')
  return (
    <footer className="fixed bottom-0 inset-x-0 border-t dark:bg-black dark:text-white dark:border-gray-700 transition-colors text-center p-4 h-16 flex items-center justify-center">
      <small>{t('copyright')}</small>
    </footer>
  )
}
