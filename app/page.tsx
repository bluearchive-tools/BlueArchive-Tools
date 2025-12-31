// app/page.tsx
'use client'

import CollapsibleBox from '../components/CollapsibleBox'
import FeatureItem from '../components/FeatureItem'
import Link from 'next/link'
import LoginPopup from '../components/LoginPopup'
import Footer from '../components/Footer'
import { useTranslations } from 'next-intl'

export default function Home() {
  const t = useTranslations('home.sections')
  const tHome = useTranslations('home')

  return (
    <>
    <main className="p-4 space-y-4 pb-16">
      <h1 className="text-xl font-bold">{tHome('pageTitle')}</h1>
      <LoginPopup />
      <CollapsibleBox
        title={t('students.title')}
        description={t('students.description')}
      >
        <div className="space-y-2">
          <Link href="/students">
            <FeatureItem
              title={t('students.actions.view.title')}
              description={t('students.actions.view.description')}
            />
          </Link>
          <div
  aria-disabled="true"
  className="opacity-50 grayscale cursor-not-allowed select-none"
>
  <div className="pointer-events-none">
    <FeatureItem
      title={t('students.actions.import.title')}
      description={t('students.actions.import.description')}
    />
  </div>
</div>

          <Link href="/squads">
            <FeatureItem
              title={t('students.actions.squads.title')}
              description={t('students.actions.squads.description')}
            />
          </Link>
        </div>
      </CollapsibleBox>
      <CollapsibleBox
        title={t('tlTools.title')}
        description={t('tlTools.description')}
      >
        <div className="space-y-2">
          <Link href="/tl/search">
            <FeatureItem
              title={t('tlTools.actions.search.title')}
              description={t('tlTools.actions.search.description')}
            />
          </Link>
          <Link href="/tl/maker">
            <FeatureItem
              title={t('tlTools.actions.maker.title')}
              description={t('tlTools.actions.maker.description')}
            />
          </Link>
          <Link href="/tl/maker-dev">
            <FeatureItem
              title={t('tlTools.actions.makerDev.title')}
              description={t('tlTools.actions.makerDev.description')}
            />
          </Link>
        </div>
        <div
  aria-disabled="true"
  className="opacity-50 grayscale cursor-not-allowed select-none"
>
  <div className="pointer-events-none">
    <FeatureItem
      title={t('tlTools.actions.videoToTl.title')}
      description={t('tlTools.actions.videoToTl.description')}
    />
  </div>
</div>
      </CollapsibleBox>

      <CollapsibleBox
        title={t('tools.title')}
        description={t('tools.description')}
      >
        <div className="space-y-2">
          <Link href="/tools/event-schedule">
            <FeatureItem
              title={t('tools.actions.eventSchedule.title')}
              description={t('tools.actions.eventSchedule.description')}
            />
          </Link>
          <Link href="/tools/divine-calc">
            <FeatureItem
              title={t('tools.actions.divineCalc.title')}
              description={t('tools.actions.divineCalc.description')}
            />
          </Link>
        </div>
        <div
  aria-disabled="true"
  className="opacity-50 grayscale cursor-not-allowed select-none"
>
  <div className="pointer-events-none">
    <FeatureItem
      title={t('tools.actions.bondCalc.title')}
      description={t('tools.actions.bondCalc.description')}
    />
  </div>
</div>
      </CollapsibleBox>
    </main>
    <Footer />
    </>
  )
}
