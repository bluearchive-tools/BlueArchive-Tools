'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import type { UserIdentity } from '@supabase/supabase-js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDiscord, faGoogle } from '@fortawesome/free-brands-svg-icons'
import { faEye, faEyeSlash, faLink, faUnlink, faUserCircle } from '@fortawesome/free-solid-svg-icons'
import students from '../data/students.json'

interface Props {
  initialUsername: string | null
  initialEmail: string | null
  initialLevel: number | null
  initialBio: string | null
  initialIconStudentId: string | null
}

export default function MyPageClient({
  initialUsername,
  initialEmail,
  initialLevel,
  initialBio,
  initialIconStudentId
}: Props) {
  const supabase = useSupabaseClient()
  const session = useSession()
  const [username, setUsername] = useState(initialUsername ?? '')
  const email = initialEmail ?? ''
  const [level, setLevel] = useState<number | ''>(initialLevel ?? '')
  const [bio, setBio] = useState(initialBio ?? '')
  const [iconStudentId, setIconStudentId] = useState(initialIconStudentId ?? '')
  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [busy, setBusy] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [showUserId, setShowUserId] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
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

  const selectedStudent = useMemo(() => students.find((s) => s.id === iconStudentId), [iconStudentId])

  const copyUserId = async () => {
    if (!session?.user.id) return
    try {
      await navigator.clipboard.writeText(session.user.id)
      setMessage('User ID をコピーしました')
    } catch (err) {
      console.error(err)
      setMessage('コピーに失敗しました')
    }
  }

  const saveProfile = async () => {
    if (!session?.user) return
    setSavingProfile(true)
    setMessage(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        username,
        level: level === '' ? null : level,
        bio,
        icon_student_id: iconStudentId || null
      })
      .eq('id', session.user.id)
    setSavingProfile(false)
    if (error) {
      setMessage(`プロフィールの更新に失敗しました: ${error.message}`)
      return
    }
    setMessage('プロフィールを更新しました')
  }

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  useEffect(() => {
    if (previewOpen) {
      const id = setTimeout(() => setPreviewVisible(true), 10)
      return () => clearTimeout(id)
    }
    setPreviewVisible(false)
  }, [previewOpen])

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
            className="w-full text-left rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
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
              <p className="text-sm text-gray-500">ユーザー名やプロフィール情報を編集できます</p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="block text-sm text-gray-600">
              ユーザー名
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ユーザー名"
              />
            </label>

            <label className="block text-sm text-gray-600">
              ブルアカ レベル
              <input
                value={level}
                onChange={(e) => setLevel(e.target.value === '' ? '' : Number(e.target.value))}
                type="number"
                min={1}
                max={999}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 85"
              />
            </label>

            <label className="block text-sm text-gray-600">
              自己紹介
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ひとこと自己紹介を書いてください"
              />
            </label>

            <label className="block text-sm text-gray-600">
              お気に入りの生徒アイコン
              <div className="mt-1 flex items-center gap-3">
                {selectedStudent ? (
                  <img
                    src={selectedStudent.image}
                    alt={selectedStudent.name}
                    className="h-12 w-12 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gray-200 border border-gray-200" />
                )}
                <select
                  value={iconStudentId}
                  onChange={(e) => setIconStudentId(e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">選択してください</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {savingProfile ? '保存中...' : '保存'}
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                プレビュー
              </button>
            </div>
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
            <div>
              <p className="text-sm text-gray-600 mb-1">メールアドレス</p>
              <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-base">{email || '—'}</p>
              <p className="text-xs text-gray-500 mt-1">メールアドレスの変更は現在サポートしていません。</p>
            </div>
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
                <button
                  type="button"
                  onClick={copyUserId}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                >
                  コピー
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

      {previewOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
            previewVisible ? 'opacity-100' : 'opacity-0'
          }`}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl transform transition-all duration-200 ${
              previewVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            } dark:bg-gray-900`}
          >
            <button
              className="absolute right-3 top-3 text-sm text-gray-500 hover:text-gray-800"
              onClick={() => {
                setPreviewVisible(false)
                setTimeout(() => setPreviewOpen(false), 200)
              }}
              aria-label="閉じる"
            >
              ×
            </button>
            <div className="flex items-center gap-4">
              {selectedStudent ? (
                <img
                  src={selectedStudent.image}
                  alt={selectedStudent.name}
                  className="h-16 w-16 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gray-200 border border-gray-200" />
              )}
              <div>
                <h4 className="text-xl font-bold">{username || 'ユーザー名未設定'}</h4>
                <p className="text-sm text-gray-500">Lv {level || '—'}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-600">自己紹介</p>
              <p className="rounded border border-gray-200 bg-gray-50 p-3 text-sm whitespace-pre-wrap">
                {bio || '自己紹介はまだ入力されていません。'}
              </p>
              <p className="text-xs text-gray-400">メール: {email || '—'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
