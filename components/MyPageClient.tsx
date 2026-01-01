'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import type { UserIdentity } from '@supabase/supabase-js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDiscord, faGoogle } from '@fortawesome/free-brands-svg-icons'
import { faEye, faEyeSlash, faLink, faUnlink, faUserCircle } from '@fortawesome/free-solid-svg-icons'

interface Props {
  initialUsername: string | null
  initialEmail: string | null
}

export default function MyPageClient({ initialUsername, initialEmail }: Props) {
  const supabase = useSupabaseClient()
  const session = useSession()
  const [username, setUsername] = useState(initialUsername ?? '')
  const [email, setEmail] = useState(initialEmail ?? '')
  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [busy, setBusy] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [showUserId, setShowUserId] = useState(false)
  const profileRef = useRef<HTMLElement | null>(null)
  const accountRef = useRef<HTMLElement | null>(null)
  const linksRef = useRef<HTMLElement | null>(null)

  const fetchIdentities = async () => {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      console.error(error.message)
      return
    }
    setIdentities((data?.user?.identities as UserIdentity[]) ?? [])
  }

  useEffect(() => {
    fetchIdentities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLink = async (provider: 'google' | 'discord') => {
    setBusy(true)
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined
    const { data, error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo }
    })
    setBusy(false)
    if (error) {
      console.error(error.message)
      return
    }
    if (data?.url) {
      window.location.assign(data.url)
    }
  }

  const handleUnlink = async (identity: UserIdentity) => {
    setBusy(true)
    const { error } = await supabase.auth.unlinkIdentity(identity)
    setBusy(false)
    if (error) {
      console.error(error.message)
      return
    }
    fetchIdentities()
  }

  const providerIcon = useMemo(
    () => ({
      google: faGoogle,
      discord: faDiscord
    }),
    []
  )

  const identityEmail = (identity: UserIdentity) => {
    const raw = (identity.identity_data as Record<string, unknown> | undefined)?.email
    return typeof raw === 'string' ? raw : null
  }

  const linkedProviders = new Set(identities.map((id) => id.provider))

  const saveProfile = async () => {
    if (!session?.user) return
    setSavingProfile(true)
    setMessage(null)
    const { error } = await supabase
      .from('profiles')
      .update({ username })
      .eq('id', session.user.id)
    setSavingProfile(false)
    if (error) {
      setMessage(`プロフィールの更新に失敗しました: ${error.message}`)
      return
    }
    setMessage('プロフィールを更新しました')
  }

  const saveEmail = async () => {
    setSavingEmail(true)
    setMessage(null)
    const { error } = await supabase.auth.updateUser({ email })
    setSavingEmail(false)
    if (error) {
      setMessage(`メールアドレスの更新に失敗しました: ${error.message}`)
      return
    }
    setMessage('メールアドレスを更新しました。確認メールが届いている場合はご確認ください。')
  }

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
      <aside className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <nav className="space-y-2">
          <button
            className="w-full text-left rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={() => scrollTo(profileRef)}
          >
            プロフィール設定
          </button>
          <button
            className="w-full text-left rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={() => scrollTo(accountRef)}
          >
            アカウント設定
          </button>
          <button
            className="w-full text-left rounded px-3 py-2 hover:bg-gray-50 dark:hover.bg-gray-800"
            onClick={() => scrollTo(linksRef)}
          >
            連携サービス
          </button>
        </nav>
      </aside>

      <div className="space-y-6">
        {message && <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>}

        <section
          ref={profileRef as unknown as React.RefObject<HTMLElement>}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex items-center gap-3 mb-4">
            <FontAwesomeIcon icon={faUserCircle} className="text-3xl text-gray-500" />
            <div>
              <h2 className="text-xl font-semibold">プロフィール設定</h2>
              <p className="text-sm text-gray-500">ユーザー名を編集できます</p>
            </div>
          </div>
          <div className="space-y-3">
            <label className="block text-sm text-gray-600">
              ユーザー名
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ユーザー名"
              />
            </label>
            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingProfile ? '保存中...' : '保存'}
            </button>
          </div>
        </section>

        <section
          ref={accountRef as unknown as React.RefObject<HTMLElement>}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">アカウント設定</h3>
              <p className="text-sm text-gray-500">ログインメールと User ID</p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="block text-sm text-gray-600">
              メールアドレス
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                type="email"
                placeholder="you@example.com"
              />
            </label>
            <button
              onClick={saveEmail}
              disabled={savingEmail}
              className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingEmail ? '更新中...' : 'メールアドレスを更新'}
            </button>
            <div>
              <p className="text-sm text-gray-600 mb-1">Supabase User ID</p>
              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-100 px-2 py-1 text-xs break-all">
                  {showUserId ? session?.user.id : '●●●●●●●●●●●●●●●●●●●'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowUserId((v) => !v)}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                >
                  <FontAwesomeIcon icon={showUserId ? faEyeSlash : faEye} />
                  {showUserId ? '隠す' : '表示'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section
          ref={linksRef as unknown as React.RefObject<HTMLElement>}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">連携サービス</h3>
              <p className="text-sm text-gray-500">Google / Discord との紐付け管理</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleLink('google')}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              >
                <FontAwesomeIcon icon={faGoogle} />
                {linkedProviders.has('google') ? '再連携' : 'Google を連携'}
              </button>
              <button
                onClick={() => handleLink('discord')}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              >
                <FontAwesomeIcon icon={faDiscord} />
                {linkedProviders.has('discord') ? '再連携' : 'Discord を連携'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {identities.length === 0 && <p className="text-sm text-gray-500">まだ外部サービスは連携されていません。</p>}
            {identities.map((identity) => (
              <div
                key={identity.identity_id}
                className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <FontAwesomeIcon icon={providerIcon[identity.provider as 'google' | 'discord'] ?? faLink} />
                  <div>
                    <p className="font-medium capitalize">{identity.provider}</p>
                    {identityEmail(identity) && <p className="text-sm text-gray-500">{identityEmail(identity)}</p>}
                    {identity.last_sign_in_at && (
                      <p className="text-xs text-gray-400">最終サインイン: {new Date(identity.last_sign_in_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleUnlink(identity)}
                  disabled={busy || identities.length <= 1}
                  className="inline-flex items-center gap-2 rounded border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  <FontAwesomeIcon icon={faUnlink} /> 解除
                </button>
              </div>
            ))}
            {identities.length > 0 && identities.length <= 1 && (
              <p className="text-xs text-gray-400">
                すべて解除することはできません。別の連携を追加してから解除してください。
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
