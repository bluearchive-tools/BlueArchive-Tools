'use client'

import Link from 'next/link'
import GoogleSignInButton from './GoogleSignInButton'
import { useEffect, useMemo, useRef, useState } from 'react'
import NoticeModal from './NoticeModal'
import DataSyncModal from './DataSyncModal'
import SquadSyncModal from './SquadSyncModal'
import AboutModal from './AboutModal'
import DiscordSignInButton from './DiscordSignInButton'
import type { NextRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBars,
  faBell,
  faChevronDown,
  faCircleQuestion,
  faCog,
  faMoon,
  faShop,
  faSun,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useRouter, usePathname } from 'next/navigation'
import { useTheme } from './ThemeProvider'
import { useLocale, useTranslations } from 'next-intl'
import { SUPPORTED_LOCALES, parseLocale, type Locale } from '../lib/i18n/config'
import { useSearchParams } from 'next/navigation'
import { stripLeadingLocale } from '../lib/i18n/utils'

export default function Header() {
  const t = useTranslations('header')
  const locale = useLocale() as Locale
  const session = useSession()
  const supabase = useSupabaseClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [hideHeader, setHideHeader] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)
  const { dark, toggle } = useTheme()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      if (session) {
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .maybeSingle()
        if (data) {
          setUsername(data?.username ?? null)
        } else if (!error && pathname !== '/profile/setup') {
          router.push('/profile/setup')
        }
      }
    }
    fetchProfile()
  }, [session, supabase, router, pathname])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (accountOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [accountOpen])

  useEffect(() => {
    const read = () => {
      try {
        setHideHeader(localStorage.getItem('tlMaker:hideHeader') === '1')
      } catch {
        /* ignore */
      }
    }
    read()
    const onChanged = () => read()
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'tlMaker:hideHeader') read()
    }
    window.addEventListener('tlMaker:hideHeaderChanged', onChanged as EventListener)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('tlMaker:hideHeaderChanged', onChanged as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])


  useEffect(() => {
    const openMobileTools = () => setMobileToolsOpen(true)
    const closeMobileTools = () => setMobileToolsOpen(false)
    window.addEventListener('site-tutorial-open-mobile-tools', openMobileTools)
    window.addEventListener('site-tutorial-close-mobile-tools', closeMobileTools)
    return () => {
      window.removeEventListener('site-tutorial-open-mobile-tools', openMobileTools)
      window.removeEventListener('site-tutorial-close-mobile-tools', closeMobileTools)
    }
  }, [])

  useEffect(() => {
    let legacyRouter: NextRouter | undefined
    const handleStart = () => setLoading(true)
    const handleDone = () => setLoading(false)
    if (typeof window !== 'undefined') {
      import('next/router').then((mod) => {
        legacyRouter = mod.default
        legacyRouter.events.on('routeChangeStart', handleStart)
        legacyRouter.events.on('routeChangeComplete', handleDone)
        legacyRouter.events.on('routeChangeError', handleDone)
      })
    }
    return () => {
      if (legacyRouter) {
        legacyRouter.events.off('routeChangeStart', handleStart)
        legacyRouter.events.off('routeChangeComplete', handleDone)
        legacyRouter.events.off('routeChangeError', handleDone)
      }
    }
  }, [])

  const signOut = async () => {
    if (session) {
      const { data } = await supabase.from('user_students').select('*').eq('user_id', session.user.id)
      if (data) {
        for (const row of data) {
          const key = `userStudent:${row.student_id}`
          localStorage.setItem(key, JSON.stringify(row))
        }
      }
      localStorage.removeItem(`sync_done_${session.user.id}`)
    }
    await supabase.auth.signOut()
    setAccountOpen(false)
    setMobileToolsOpen(false)
    router.push('/')
  }

  const toggleTheme = () => toggle()

  const openNotice = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('openNotice'))
    }
  }

  const pathWithSearch = useMemo(() => {
    const normalizedPath = pathname?.startsWith('/') ? pathname : `/${pathname ?? ''}`
    const basePath = stripLeadingLocale(normalizedPath)
    const search = searchParams ? new URLSearchParams(searchParams) : null
    search?.delete('lang')
    const searchString = search?.toString()
    return searchString ? `${basePath}?${searchString}` : basePath
  }, [pathname, searchParams])

  const currentPath = useMemo(() => {
    const normalizedPath = pathname?.startsWith('/') ? pathname : `/${pathname ?? ''}`
    const basePath = stripLeadingLocale(normalizedPath)
    return basePath || '/'
  }, [pathname])

  const changeLocale = (nextLocale: Locale) => {
    if (!nextLocale || nextLocale === locale) return
    if (typeof document !== 'undefined') {
      document.cookie = `locale=${nextLocale}; path=/`
      try {
        localStorage.setItem('locale', nextLocale)
      } catch {
        /* ignore */
      }
    }
    const target = new URLSearchParams()
    target.set('lang', nextLocale)
    router.push(`${pathWithSearch}?${target.toString()}`)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = parseLocale(localStorage.getItem('locale'))
      if (stored && stored !== locale) {
        document.cookie = `locale=${stored}; path=/`
        const params = new URLSearchParams()
        params.set('lang', stored)
        router.replace(`${pathWithSearch}?${params.toString()}`)
      }
    } catch {
      /* ignore */
    }
  }, [locale, pathWithSearch, router])

  const isMakerPage = (pathname ?? '').startsWith('/tl/maker')
  if (isMakerPage && hideHeader) return null

  const accountButton = (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setAccountOpen(!accountOpen)}
        className="cursor-pointer min-w-[8rem] whitespace-nowrap text-center flex items-center justify-center gap-1"
      >
        {session && username ? username : t('account.label')}
        <FontAwesomeIcon icon={faChevronDown} />
      </button>
      {accountOpen && (
        <div className="absolute right-0 mt-2 bg-white dark:bg-gray-800 dark:text-white text-black shadow p-2 z-10">
          {session ? (
            <>
              {username && (
                <Link href={`/users/${username}`} className="block px-2 py-1" onClick={() => setAccountOpen(false)}>
                  {t('account.userProfile')}
                </Link>
              )}
              <Link href="/mypage" className="block px-2 py-1" onClick={() => setAccountOpen(false)}>
                {t('account.mypage')}
              </Link>
              <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
              <button onClick={signOut} className="block w-full text-left px-2 py-1">
                {t('account.signOut')}
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 px-2 py-1">
              <GoogleSignInButton
                width={220}
                theme="outline"
                size="medium"
                text="continue_with"
                className="flex justify-center"
              />
              <DiscordSignInButton label={t('account.signInWithDiscord')} className="w-full" />
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <header className="sticky top-0 inset-x-0 z-10 w-full border-b dark:bg-black dark:text-white dark:border-gray-700 transition-colors px-4 py-3 relative">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-lg font-bold leading-tight">
            <Link href="/" data-tutorial="header-brand">{t('brand')}</Link>
          </h1>
          <button onClick={() => setAboutOpen(true)} aria-label={t('actions.about')} className="text-base shrink-0">
            <FontAwesomeIcon icon={faCircleQuestion} />
          </button>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <label htmlFor="locale-select" className="sr-only">
            {t('locale.label')}
          </label>
          <select
            id="locale-select"
            aria-label={t('locale.ariaLabel')}
            value={locale}
            onChange={(e) => changeLocale(e.target.value as Locale)}
            className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SUPPORTED_LOCALES.map((code) => (
              <option key={code} value={code}>
                {t(`locale.${code}`)}
              </option>
            ))}
          </select>
          <button data-tutorial="header-notices" onClick={openNotice} aria-label={t('actions.notices')}>
            <FontAwesomeIcon icon={faBell} />
          </button>
          <Link href="/decorations" aria-label="デコレーションショップ" className="text-lg">
            <FontAwesomeIcon icon={faShop} />
          </Link>
          <Link href="/mypage" data-tutorial="header-settings" aria-label={t('actions.settings')}>
            <FontAwesomeIcon icon={faCog} />
          </Link>
          <button onClick={toggleTheme} aria-label={t('actions.toggleTheme')}>
            <FontAwesomeIcon icon={dark ? faSun : faMoon} />
          </button>
          {accountButton}
        </div>

        <div className="md:hidden flex items-center gap-2 shrink-0">
          <label htmlFor="locale-select-mobile" className="sr-only">
            {t('locale.label')}
          </label>
          <select
            id="locale-select-mobile"
            aria-label={t('locale.ariaLabel')}
            value={locale}
            onChange={(e) => changeLocale(e.target.value as Locale)}
            className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700"
          >
            {SUPPORTED_LOCALES.map((code) => (
              <option key={code} value={code}>
                {t(`locale.${code}`)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setMobileToolsOpen((prev) => !prev)}
            aria-label={mobileToolsOpen ? 'ツールを閉じる' : 'ツールを開く'}
            className="border rounded px-2 py-1"
          >
            <FontAwesomeIcon icon={mobileToolsOpen ? faXmark : faBars} />
          </button>
        </div>
      </div>

      {mobileToolsOpen && (
        <div className="md:hidden mt-3 border-t pt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button data-tutorial="header-notices" onClick={openNotice} aria-label={t('actions.notices')} className="border rounded px-3 py-1">
              <FontAwesomeIcon icon={faBell} />
            </button>
            <Link href="/decorations" aria-label="デコレーションショップ" className="border rounded px-3 py-1">
              <FontAwesomeIcon icon={faShop} />
            </Link>
            <Link href="/mypage" data-tutorial="header-settings" aria-label={t('actions.settings')} className="border rounded px-3 py-1">
              <FontAwesomeIcon icon={faCog} />
            </Link>
            <button onClick={toggleTheme} aria-label={t('actions.toggleTheme')} className="border rounded px-3 py-1">
              <FontAwesomeIcon icon={dark ? faSun : faMoon} />
            </button>
          </div>
          <div className="flex justify-end">{accountButton}</div>
        </div>
      )}

      <div className={`absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300 ${loading ? 'w-full' : 'w-0'}`}></div>
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} currentPath={currentPath} />
      <NoticeModal />
      <DataSyncModal />
      <SquadSyncModal />
    </header>
  )
}
