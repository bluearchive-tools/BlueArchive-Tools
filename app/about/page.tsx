import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { parseLocale, type Locale } from '../../lib/i18n/config'

type LocalizedPage = {
  title: string
  lead: string
  updated: string
  termsTitle: string
  termsItems: string[]
  privacyTitle: string
  privacyItems: string[]
  contactTitle: string
  contactBody: string
}

const CONTENT: Record<Locale, LocalizedPage> = {
  ja: {
    title: 'このサイトについて（利用規約・プライバシーポリシー）',
    lead: 'BlueArchive Tools の利用条件および個人情報の取り扱いについて記載しています。',
    updated: '最終更新日: 2026-03-11',
    termsTitle: '利用規約',
    termsItems: [
      '本サイトは「ブルーアーカイブ」の非公式ファンメイドサイトです。運営会社および権利者とは提携していません。',
      '本サイトの内容は予告なく変更・停止される場合があります。',
      '本サイトの利用により生じた損害について、運営者は可能な範囲で対応しますが、完全な保証はできません。',
      '法令や公序良俗に反する行為、またはサービス運営を妨げる行為は禁止します。',
    ],
    privacyTitle: 'プライバシーポリシー',
    privacyItems: [
      'Googleログイン等の認証機能を利用するため、認証プロバイダから必要最小限の情報（ユーザーID・メールアドレス等）を取得する場合があります。',
      '取得した情報は、ログイン状態の維持・ユーザー設定の保存・不正利用対策の目的で利用します。',
      '法令に基づく場合を除き、本人の同意なく第三者へ個人情報を提供しません。',
      'ユーザーは必要に応じて、アカウント連携解除やデータ削除を依頼できます。',
    ],
    contactTitle: 'お問い合わせ',
    contactBody: 'ご質問や削除依頼などは、サイト内の案内または運営の連絡先からお問い合わせください。',
  },
  en: {
    title: 'About this site (Terms of Service & Privacy Policy)',
    lead: 'This page describes the terms and privacy practices for BlueArchive Tools.',
    updated: 'Last updated: 2026-03-11',
    termsTitle: 'Terms of Service',
    termsItems: [
      'This website is an unofficial fan-made site for Blue Archive and is not affiliated with the game publishers or rights holders.',
      'Site content may be changed, suspended, or discontinued without prior notice.',
      'We make reasonable efforts to keep the service stable, but we cannot guarantee complete availability or accuracy.',
      'Any illegal use or behavior that disrupts service operation is prohibited.',
    ],
    privacyTitle: 'Privacy Policy',
    privacyItems: [
      'To provide sign-in features (including Google OAuth), we may receive minimum required profile data from identity providers (such as user ID and email address).',
      'Collected information is used for authentication, account settings, and abuse prevention.',
      'We do not share personal information with third parties without consent, except when required by law.',
      'Users can request account unlinking or data deletion when applicable.',
    ],
    contactTitle: 'Contact',
    contactBody: 'For questions or data deletion requests, please use the contact channel listed on this site.',
  },
  'zh-CN': {
    title: '关于本站（服务条款与隐私政策）',
    lead: '本页面说明 BlueArchive Tools 的使用条款与隐私处理方式。',
    updated: '最后更新：2026-03-11',
    termsTitle: '服务条款',
    termsItems: [
      '本网站为《蔚蓝档案》非官方同人工具站，与游戏发行方及权利方无合作关系。',
      '网站内容可能在不另行通知的情况下变更、暂停或终止。',
      '我们会尽力维持服务稳定，但不保证绝对可用性与完整准确性。',
      '禁止任何违法行为或妨碍本站运营的行为。',
    ],
    privacyTitle: '隐私政策',
    privacyItems: [
      '为提供登录功能（含 Google OAuth），我们可能从身份提供商获取必要的最小信息（如用户ID、邮箱）。',
      '收集的信息仅用于身份验证、账号设置保存与防止滥用。',
      '除法律要求外，未经本人同意不会向第三方提供个人信息。',
      '用户可在适用情况下申请解除账号绑定或删除数据。',
    ],
    contactTitle: '联系我们',
    contactBody: '如需咨询或申请删除数据，请通过站内提供的联系方式联系运营者。',
  },
  'zh-TW': {
    title: '關於本站（服務條款與隱私權政策）',
    lead: '本頁說明 BlueArchive Tools 的使用條款與隱私資料處理方式。',
    updated: '最後更新：2026-03-11',
    termsTitle: '服務條款',
    termsItems: [
      '本網站為《蔚藍檔案》非官方粉絲工具站，與遊戲發行方及權利方並無合作關係。',
      '網站內容可能在未另行通知的情況下變更、暫停或終止。',
      '我們會盡力維持服務穩定，但不保證絕對可用性與完整準確性。',
      '禁止任何違法行為或妨礙本站營運的行為。',
    ],
    privacyTitle: '隱私權政策',
    privacyItems: [
      '為提供登入功能（含 Google OAuth），我們可能從身分提供者取得必要最小資料（如使用者 ID、電子郵件）。',
      '蒐集的資料僅用於身分驗證、帳號設定保存與防止濫用。',
      '除法律要求外，未經本人同意不會向第三方提供個人資料。',
      '使用者可在適用情況下申請解除帳號連結或刪除資料。',
    ],
    contactTitle: '聯絡我們',
    contactBody: '如需詢問或申請刪除資料，請透過站內提供的聯絡方式與營運者聯繫。',
  },
}

async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const cookieLocale = parseLocale(cookieStore.get('locale')?.value)
  if (cookieLocale) return cookieLocale

  const headerStore = await headers()
  const acceptLanguage = headerStore.get('accept-language')
  if (acceptLanguage) {
    for (const language of acceptLanguage.split(',')) {
      const parsed = parseLocale(language.trim().split(';')[0])
      if (parsed) return parsed
    }
  }

  return 'ja'
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale()
  return {
    title: CONTENT[locale].title,
    description: CONTENT[locale].lead,
  }
}

export default async function AboutPage() {
  const locale = await resolveLocale()
  const content = CONTENT[locale]

  return (
    <main className="mx-auto max-w-3xl p-4 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{content.title}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">{content.lead}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{content.updated}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{content.termsTitle}</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm leading-6">
          {content.termsItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{content.privacyTitle}</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm leading-6">
          {content.privacyItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{content.contactTitle}</h2>
        <p className="text-sm leading-6">{content.contactBody}</p>
      </section>
    </main>
  )
}
