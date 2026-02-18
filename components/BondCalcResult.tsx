'use client'

import { useTranslations } from 'next-intl'
import type { BondCalculationResult } from '../lib/bond-calc'

type Props = {
  result: BondCalculationResult
}

export default function BondCalcResult({ result }: Props) {
  const t = useTranslations('common.bondCalc')

  return (
    <section className="space-y-4 rounded border p-4 dark:border-gray-700 dark:bg-gray-900">
      <h2 className="text-base font-bold">{t('resultTitle')}</h2>

      <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
        <p>{t('requiredBondPoint', { value: result.requiredBondPoint })}</p>
        <p>{t('ownedBondPoint', { value: result.ownedBondPoint })}</p>
        <p>{t('shortageBondPoint', { value: result.shortageBondPoint })}</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t('materialBreakdownTitle')}</h3>
        <ul className="space-y-2 text-sm">
          {result.materials.map((row) => (
            <li key={row.material.id} className="rounded border p-2 dark:border-gray-700">
              <p className="font-medium">{t(row.material.labelKey)}</p>
              <p>{t('requiredCount', { value: row.requiredCount })}</p>
              <p>{t('shortageCount', { value: row.shortageCount })}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t('runRecommendationTitle')}</h3>
        <ul className="space-y-1 text-sm">
          {result.recommendedRuns.map((run) => (
            <li key={run.materialId}>
              {t('runLine', {
                material: t(`materials.${run.materialId}`),
                stage: run.stage,
                runs: run.runs,
              })}
            </li>
          ))}
        </ul>
        {result.bestRunPlan && (
          <p className="text-sm font-medium text-blue-600 dark:text-blue-300">
            {t('bestRunPlan', {
              material: t(`materials.${result.bestRunPlan.materialId}`),
              stage: result.bestRunPlan.stage,
              runs: result.bestRunPlan.runs,
            })}
          </p>
        )}
      </div>
    </section>
  )
}
