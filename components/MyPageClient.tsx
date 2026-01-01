'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDiscord, faGoogle } from '@fortawesome/free-brands-svg-icons'
import { faLink, faUnlink, faUserCircle } from '@fortawesome/free-solid-svg-icons'

interface Props {
  initialUsername: string | null
  initialEmail: string | null
}

type Identity = {
  identity_id: string
  provider: string
  last_sign_in_at?: string | null
  email?: string | null
}

export default function MyPageClient({ initialUsername, initialEmail }: Props) {
  const supabase = useSupabaseClient()
  const session = useSession()
  const [username] = useState(initialUsername)
  const [email] = useState(initialEmail)
  const [identities, setIdentities] = useState<Identity[]>([])
  const [busy, setBusy] = useState(false)

  const fetchIdentities = async () => {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      console.error(error.message)
      return
    }
    setIdentities((data?.user?.identities as Identity[]) ?? [])
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

  const handleUnlink = async (identity: Identity) => {
    setBusy(true)
    const { error } = await supabase.auth.unlinkIdentity({
      identity: { provider: identity.provider, identity_id: identity.identity_id }
    })
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

  const linkedProviders = new Set(identities.map((id) => id.provider))

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-3 mb-4">
          <FontAwesomeIcon icon={faUserCircle} className="text-3xl text-gray-500" />
          <div>
            <h2 className="text-xl font-semibold">アカウント情報</h2>
            <p className="text-sm text-gray-500">基本情報とログインメール</p>
          </div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">ユーザー名</dt>
            <dd className="text-base font-medium">{username ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">メールアドレス</dt>
            <dd className="text-base font-medium">{email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Supabase User ID</dt>
            <dd className="text-xs break-all text-gray-700 dark:text-gray-300">{session?.user.id}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
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
                  {identity.email && <p className="text-sm text-gray-500">{identity.email}</p>}
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
  )
}
