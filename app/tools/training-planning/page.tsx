'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import PageHelpButton from '../../../components/PageHelpButton'

export default function TrainingPlanningPage() {
  const tHome = useTranslations('home')
  const t = useTranslations('common.trainingPlanning')

  return (
    <main className="space-y-4 p-4">
      <div className="mb-2 flex items-center gap-2">
        <h1 className="text-lg font-bold">{tHome('sections.tools.actions.trainingPlanning.title')}</h1>
        <PageHelpButton pageKey="tools-training-planning" />
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300">{t('description')}</p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Link
          href="/tools/divine-calc"
          className="rounded border p-4 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          <p className="text-sm font-semibold">{t('starCalcTitle')}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('starCalcDescription')}</p>
        </Link>
        <Link
          href="/tools/bond-calc"
          className="rounded border p-4 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          <p className="text-sm font-semibold">{t('bondCalcTitle')}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('bondCalcDescription')}</p>
        </Link>
        <Link
          href="/tools/level-calc"
          className="rounded border p-4 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          <p className="text-sm font-semibold">{t('levelCalcTitle')}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('levelCalcDescription')}</p>
        </Link>
      </div>
    </main>
  )
}
