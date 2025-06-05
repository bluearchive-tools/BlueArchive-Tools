'use client'

import Link from 'next/link'

import { useEffect, useState } from 'react'
import {
  useSession,
  useSupabaseClient,
} from '@supabase/auth-helpers-react'
import { useRouter, usePathname } from 'next/navigation'


import { useEffect, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'


export default function Header() {
  const session = useSession()
  const supabase = useSupabaseClient()

  const router = useRouter()
  const pathname = usePathname()


  const [username, setUsername] = useState<string | null>(null)

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

        setUsername(data?.username ?? null)
      }
    }
    fetchProfile()
  }, [session, supabase])




  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <header className="flex justify-between items-center border-b p-4">
      <h1 className="text-lg font-bold">
        <Link href="/">My App</Link>
      </h1>
      <div className="flex items-center gap-4">
        <Link href="/settings" aria-label="Settings">
          <span>⚙</span>
        </Link>
        <details className="relative">
          <summary className="cursor-pointer">

            {session && username ? username : 'アカウント'}

            {session ? username ?? session.user.email : 'アカウント'}
            {session ? session.user.email : 'アカウント'}

          </summary>
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
        </details>
      </div>
    </header>
  )
}
