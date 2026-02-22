// app/page.tsx
'use client'

import CollapsibleBox from '../components/CollapsibleBox'
import FeatureItem from '../components/FeatureItem'
import Link from 'next/link'
import LoginPopup from '../components/LoginPopup'
import { useTranslations } from 'next-intl'

export default function Home() {
  const t = useTranslations('home.sections')

  return (
    <>
    <main className="p-4 space-y-4 pb-16">
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
          <Link href="/students/import">
            <FeatureItem
              title={t('students.actions.import.title')}
              description={t('students.actions.import.description')}
            />
          </Link>

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
          <Link href="/tl/search-beta">
            <FeatureItem
              title="TL検索β"
              description="β版の総力戦/大決戦検索UIです"
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
          <Link href="/tools/training-planning">
            <FeatureItem
              title={t('tools.actions.trainingPlanning.title')}
              description={t('tools.actions.trainingPlanning.description')}
            />
          </Link>
          <Link href="/tools/event-schedule">
            <FeatureItem
              title={t('tools.actions.eventSchedule.title')}
              description={t('tools.actions.eventSchedule.description')}
            />
          </Link>
          <Link href="/tools/bgm-player">
            <FeatureItem
              title={t('tools.actions.bgmPlayer.title')}
              description={t('tools.actions.bgmPlayer.description')}
            />
          </Link>
          <Link href="/tools/bgm-dj">
            <FeatureItem
              title={t('tools.actions.bgmDj.title')}
              description={t('tools.actions.bgmDj.description')}
            />
          </Link>
        </div>
      </CollapsibleBox>

      <CollapsibleBox
        title={t('minigames.title')}
        description={t('minigames.description')}
      >
        <div className="space-y-2">
          <Link href="/minigames/bgm-quiz">
            <FeatureItem
              title={t('minigames.actions.bgmQuiz.title')}
              description={t('minigames.actions.bgmQuiz.description')}
            />
          </Link>
        </div>
      </CollapsibleBox>
    </main>
    </>
  )
}
