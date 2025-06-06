// app/page.tsx
'use client'

import CollapsibleBox from '../components/CollapsibleBox'
import FeatureItem from '../components/FeatureItem'

export default function Home() {
  return (
    <main className="p-4 space-y-4">
      <CollapsibleBox title="生徒管理" description="生徒のデータを確認、編集できます">
        <div className="space-y-2">
          <FeatureItem>生徒データ確認　現在保存されている生徒のデータを表示します</FeatureItem>
          <FeatureItem>生徒データインポート　画像から生徒のデータをインポートできます</FeatureItem>
          <FeatureItem>部隊管理　部隊を構成できます</FeatureItem>
        </div>
      </CollapsibleBox>
      <CollapsibleBox title="TLツール(β)" description="TL作成に役立つツールです">
        <div className="space-y-2">
          <FeatureItem>TLメーカー　TLを作成できます</FeatureItem>
          <FeatureItem>動画toTL　動画からTLを自動生成できます</FeatureItem>
        </div>
      </CollapsibleBox>
    </main>
  )
}
