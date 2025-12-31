'use client'

import PageHelpButton from '../../../components/PageHelpButton'

export default function DamagePage() {
  return (
    <main className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-lg font-bold">ダメージ計算</h1>
        <PageHelpButton pageKey="tl-damage" />
      </div>
      <p>準備中...</p>
    </main>
  )
}
