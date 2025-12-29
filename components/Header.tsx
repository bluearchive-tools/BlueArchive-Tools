'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import NoticeModal from './NoticeModal'
import DataSyncModal from './DataSyncModal'
import SquadSyncModal from './SquadSyncModal'
import type { NextRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBell, faCog, faChevronDown, faMoon, faSun } from '@fortawesome/free-solid-svg-icons'
import { faGoogle } from '@fortawesome/free-brands-svg-icons'
import {
  useSession,
  useSupabaseClient,
} from '@supabase/auth-helpers-react'
import { useRouter, usePathname } from 'next/navigation'
import { useTheme } from './ThemeProvider'
import { useLocale, useTranslations } from 'next-intl'
import { SUPPORTED_LOCALES, parseLocale, type Locale } from '../lib/i18n/config'
import { useSearchParams } from 'next/navigation'

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
  const { dark, toggle } = useTheme()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      if (session) {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .maybeSingle()
        if (data) {
          setUsername(data?.username ?? null)
        } else if (pathname !== '/profile/setup') {
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

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` }
    })
    if (error) console.error(error.message)
  }
  const signOut = async () => {
    if (session) {
      const { data } = await supabase
        .from('user_students')
        .select('*')
        .eq('user_id', session.user.id)
      if (data) {
        for (const row of data) {
          const key = `userStudent:${row.student_id}`
          localStorage.setItem(key, JSON.stringify(row))
        }
      }
      localStorage.removeItem(`sync_done_${session.user.id}`)
    }
    await supabase.auth.signOut()
  }

  const toggleTheme = () => toggle()

  const openNotice = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('openNotice'))
    }
  }

  const pathWithSearch = useMemo(() => {
    const normalizedPath = pathname?.startsWith('/') ? pathname : `/${pathname ?? ''}`
    const search = searchParams?.toString()
    return search ? `${normalizedPath}?${search}` : normalizedPath
  }, [pathname, searchParams])

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
    router.push(`/${nextLocale}${pathWithSearch}`)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = parseLocale(localStorage.getItem('locale'))
      if (stored && stored !== locale) {
        document.cookie = `locale=${stored}; path=/`
        router.replace(`/${stored}${pathWithSearch}`)
      }
    } catch {
      /* ignore */
    }
  }, [locale, pathWithSearch, router])

  const isMakerPage = (pathname ?? '').startsWith('/tl/maker')
  if (isMakerPage && hideHeader) return null

  return (
    <header className="sticky top-0 inset-x-0 z-10 w-full flex justify-between items-center border-b dark:bg-black dark:text-white dark:border-gray-700 transition-colors p-4 h-16 relative">
      <h1 className="text-lg font-bold">
        <Link href="/">{t('brand')}</Link>
      </h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
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
        </div>
        <button onClick={openNotice} aria-label={t('actions.notices')}>
          <FontAwesomeIcon icon={faBell} />
        </button>
        <Link href="/settings" aria-label={t('actions.settings')}>
          <FontAwesomeIcon icon={faCog} />
        </Link>
        <button onClick={toggleTheme} aria-label={t('actions.toggleTheme')}>
          <FontAwesomeIcon icon={dark ? faSun : faMoon} />
        </button>
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
                  <Link href="/mypage" className="block px-2 py-1">
                    {t('account.mypage')}
                  </Link>
                  <button onClick={signOut} className="block w-full text-left px-2 py-1">
                    {t('account.signOut')}
                  </button>
                </>
              ) : (
                <button onClick={signIn} className="block w-full text-left px-2 py-1 flex items-center gap-2">
                  <FontAwesomeIcon icon={faGoogle} className="text-black dark:text-white" />
                  <span>{t('account.signInWithGoogle')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300 ${loading ? 'w-full' : 'w-0'}`}></div>
      <NoticeModal />
      <DataSyncModal />
      <SquadSyncModal />
    </header>
  )
}
