// app/page.tsx
'use client'

import CollapsibleBox from '../components/CollapsibleBox'

export default function Home() {
  return (
    <main className="p-4 space-y-4">
      <CollapsibleBox title="生徒管理" description="生徒のデータを確認、編集できます">
        <ul className="list-disc pl-5 space-y-1">
          <li>生徒データ確認　現在保存されている生徒のデータを表示します</li>
          <li>生徒データインポート　画像から生徒のデータをインポートできます</li>
          <li>部隊管理　部隊を構成できます</li>
        </ul>
      </CollapsibleBox>
      <CollapsibleBox title="TLツール(β)" description="TL作成に役立つツールです">
        <ul className="list-disc pl-5 space-y-1">
          <li>TLメーカー　TLを作成できます</li>
          <li>動画toTL　動画からTLを自動生成できます</li>
        </ul>
      </CollapsibleBox>
    </main>
  )
}
