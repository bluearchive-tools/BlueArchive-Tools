'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import NoticeModal from './NoticeModal'
import type { NextRouter } from 'next/router'
import {
  useSession,
  useSupabaseClient,
} from '@supabase/auth-helpers-react'
import { useRouter, usePathname } from 'next/navigation'

export default function Header() {
  const session = useSession()
  const supabase = useSupabaseClient()
  const router = useRouter()
  const pathname = usePathname()
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
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
  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const openNotice = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('openNotice'))
    }
  }

  return (
    <header className="fixed top-0 inset-x-0 z-10 flex justify-between items-center border-b bg-white p-4 h-16 relative">
      <h1 className="text-lg font-bold">
        <Link href="/">BlueArchive Tools</Link>
      </h1>
      <div className="flex items-center gap-4">
        <button onClick={openNotice} aria-label="Notices">
          <span>🔔</span>
        </button>
        <Link href="/settings" aria-label="Settings">
          <span>⚙</span>
        </Link>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setAccountOpen(!accountOpen)}
            className="cursor-pointer min-w-[8rem] whitespace-nowrap text-center"
          >
            {session && username ? username : 'アカウント'}
          </button>
          {accountOpen && (
            <div className="absolute right-0 mt-2 bg-white text-black shadow p-2 z-10">
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
                <Link href="/" className="block px-2 py-1">
                  ログイン
                </Link>
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
