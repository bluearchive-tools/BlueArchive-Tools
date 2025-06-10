'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import NoticeModal from './NoticeModal'
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

export default function Header() {
  const session = useSession()
  const supabase = useSupabaseClient()
  const router = useRouter()
  const pathname = usePathname()
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
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
    await supabase.auth.signOut()
  }

  const toggleTheme = () => toggle()

  const openNotice = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('openNotice'))
    }
  }

  return (
    <header className="sticky top-0 inset-x-0 z-10 w-full flex justify-between items-center border-b dark:bg-black dark:text-white dark:border-gray-700 transition-colors p-4 h-16 relative">
      <h1 className="text-lg font-bold">
        <Link href="/">BlueArchive Tools</Link>
      </h1>
      <div className="flex items-center gap-4">
        <button onClick={openNotice} aria-label="Notices">
          <FontAwesomeIcon icon={faBell} />
        </button>
        <Link href="/settings" aria-label="Settings">
          <FontAwesomeIcon icon={faCog} />
        </Link>
        <button onClick={toggleTheme} aria-label="Toggle theme">
          <FontAwesomeIcon icon={dark ? faSun : faMoon} />
        </button>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setAccountOpen(!accountOpen)}
            className="cursor-pointer min-w-[8rem] whitespace-nowrap text-center flex items-center justify-center gap-1"
          >
            {session && username ? username : 'アカウント'}
            <FontAwesomeIcon icon={faChevronDown} />
          </button>
          {accountOpen && (
            <div className="absolute right-0 mt-2 bg-white dark:bg-gray-800 dark:text-white text-black shadow p-2 z-10">
              {session ? (
                <>
                  <Link href="/mypage" className="block px-2 py-1">
                    マイページ
                  </Link>
                  <button onClick={signOut} className="block w-full text-left px-2 py-1">
                    サインアウト
                  </button>
                </>
              ) : (
                <button onClick={signIn} className="block w-full text-left px-2 py-1 flex items-center gap-2">
                  <FontAwesomeIcon icon={faGoogle} className="text-black dark:text-white" />
                  <span>Googleでログイン</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300 ${loading ? 'w-full' : 'w-0'}`}></div>
      <NoticeModal />
    </header>
  )
}
