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
          <div
  aria-disabled="true"
  className="opacity-50 grayscale cursor-not-allowed select-none"
>
  <div className="pointer-events-none">
    <FeatureItem
      title="生徒データインポート"
      description="画像から生徒のデータをインポートできます"
    />
  </div>
</div>

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
          <Link href="/tl/maker-dev">
            <FeatureItem title="TLメーカーdev" description="実験的機能を利用できます" />
          </Link>
        </div>
        <div
  aria-disabled="true"
  className="opacity-50 grayscale cursor-not-allowed select-none"
>
  <div className="pointer-events-none">
    <FeatureItem
      title="動画toTL"
      description="動画からTLを自動生成できます"
    />
  </div>
</div>
      </CollapsibleBox>

      <CollapsibleBox title="便利ツール" description="役立つツールをまとめています">
        <div className="space-y-2">
          <Link href="/tools/event-schedule">
            <FeatureItem title="イベントスケジュール表" description="イベントの開催予定を確認できます" />
          </Link>
          <Link href="/tools/divine-calc">
            <FeatureItem title="神名文字計算機" description="必要な神名文字数を計算します" />
          </Link>
        </div>
        <div
  aria-disabled="true"
  className="opacity-50 grayscale cursor-not-allowed select-none"
>
  <div className="pointer-events-none">
    <FeatureItem
      title="絆上げ計算機"
      description="絆レベル上げに必要なアイテム数を計算します"
    />
  </div>
</div>
      </CollapsibleBox>
    </main>
    <Footer />
    </>
  )
}
