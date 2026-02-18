'use client'

import { useTranslations } from 'next-intl'
import { LEVEL_MATERIALS, LEVEL_MAX } from '../lib/level-calc'

type Props = {
  currentLevel: number
  targetLevel: number
  ownedMaterials: Record<string, number>
  onCurrentLevelChange: (value: number) => void
  onTargetLevelChange: (value: number) => void
  onOwnedMaterialChange: (materialId: string, value: number) => void
}

export default function LevelCalcForm({
  currentLevel,
  targetLevel,
  ownedMaterials,
  onCurrentLevelChange,
  onTargetLevelChange,
  onOwnedMaterialChange,
}: Props) {
  const t = useTranslations('common.levelCalc')

  return (
    <section className="space-y-4 rounded border p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t('currentLevelLabel')}</span>
          <input
            type="number"
            min={1}
            max={LEVEL_MAX}
            value={currentLevel}
            onChange={(e) => onCurrentLevelChange(Number(e.target.value))}
            className="w-full rounded border p-2 dark:border-gray-700 dark:bg-gray-800"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">{t('targetLevelLabel')}</span>
          <input
            type="number"
            min={1}
            max={LEVEL_MAX}
            value={targetLevel}
            onChange={(e) => onTargetLevelChange(Number(e.target.value))}
            className="w-full rounded border p-2 dark:border-gray-700 dark:bg-gray-800"
          />
        </label>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">{t('ownedMaterialsLabel')}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {LEVEL_MATERIALS.map((material) => (
            <label key={material.id} className="space-y-1 text-sm">
              <span>{t(material.labelKey)}</span>
              <input
                type="number"
                min={0}
                value={ownedMaterials[material.id] ?? 0}
                onChange={(e) => onOwnedMaterialChange(material.id, Number(e.target.value))}
                className="w-full rounded border p-2 dark:border-gray-700 dark:bg-gray-800"
              />
            </label>
          ))}
        </div>
      </div>
    </section>
  )
}
