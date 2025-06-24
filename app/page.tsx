// app/page.tsx
'use client'

import CollapsibleBox from '../components/CollapsibleBox'
import FeatureItem from '../components/FeatureItem'
import Link from 'next/link'
import LoginPopup from '../components/LoginPopup'
import Footer from '../components/Footer'

export default function Home() {
  return (
    <>
    <main className="p-4 space-y-4 pb-16">
      <LoginPopup />
      <CollapsibleBox title="生徒管理" description="生徒のデータを確認、編集できます">
        <div className="space-y-2">
          <Link href="/students">
            <FeatureItem title="生徒データ確認" description="現在保存されている生徒のデータを表示します" />
          </Link>
          <FeatureItem title="生徒データインポート" description="画像から生徒のデータをインポートできます" />
          <Link href="/squads">
            <FeatureItem title="部隊管理" description="部隊を構成できます" />
          </Link>
        </div>
      </CollapsibleBox>
        <CollapsibleBox title="TLツール(β)" description="TL作成に役立つツールです">
          <div className="space-y-2">
            <Link href="/tl/search">
              <FeatureItem title="TL検索" description="既存のTLを検索できます" />
            </Link>
            <Link href="/tl/maker">
              <FeatureItem title="TLメーカー" description="TLを作成できます" />
            </Link>
            <FeatureItem title="動画toTL" description="動画からTLを自動生成できます" />
          </div>
        </CollapsibleBox>
    </main>
    <Footer />
    </>
  )
}
