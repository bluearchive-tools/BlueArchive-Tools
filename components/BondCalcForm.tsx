'use client'

import StudentSelect from './StudentSelect'
import { BOND_MAX_LEVEL, BOND_MATERIALS } from '../lib/bond-calc'
import { useTranslations } from 'next-intl'

type Student = {
  id: string
  name: string
  image: string
  imageFull?: string
  attackType: string
  defenseType: string
  hasAccessory?: boolean
  styleIds?: string[]
  styleOf?: string
  altIds?: string[]
  altOf?: string
  initialStars: number
  role: string
  characterType: string
  position: string
  exHitDelay?: number
  normalHitDelay?: number
}

type Props = {
  students: Student[]
  selectedStudentId: string
  onStudentChange: (value: string) => void
  currentBond: number
  targetBond: number
  ownedMaterials: Record<string, number>
  onCurrentBondChange: (value: number) => void
  onTargetBondChange: (value: number) => void
  onOwnedMaterialChange: (materialId: string, value: number) => void
}

export default function BondCalcForm({
  students,
  selectedStudentId,
  onStudentChange,
  currentBond,
  targetBond,
  ownedMaterials,
  onCurrentBondChange,
  onTargetBondChange,
  onOwnedMaterialChange,
}: Props) {
  const t = useTranslations('common.bondCalc')

  return (
    <section className="space-y-4 rounded border p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="space-y-2">
        <label className="block text-sm font-medium">{t('studentLabel')}</label>
        <StudentSelect students={students} value={selectedStudentId} onChange={onStudentChange} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t('currentBondLabel')}</span>
          <input
            type="number"
            min={1}
            max={BOND_MAX_LEVEL}
            value={currentBond}
            onChange={(e) => onCurrentBondChange(Number(e.target.value))}
            className="w-full rounded border p-2 dark:border-gray-700 dark:bg-gray-800"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">{t('targetBondLabel')}</span>
          <input
            type="number"
            min={1}
            max={BOND_MAX_LEVEL}
            value={targetBond}
            onChange={(e) => onTargetBondChange(Number(e.target.value))}
            className="w-full rounded border p-2 dark:border-gray-700 dark:bg-gray-800"
          />
        </label>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">{t('ownedMaterialsLabel')}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {BOND_MATERIALS.map((material) => (
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
