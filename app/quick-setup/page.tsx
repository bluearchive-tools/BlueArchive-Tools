'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import AddStudentModal from '../../components/AddStudentModal'

type SetupSkipState = {
  students: boolean
  profile: boolean
  youtube: boolean
  completed: boolean
}

type SetupState = {
  skipped: SetupSkipState
}

type ProfileRow = {
  username: string | null
  nickname: string | null
  bio: string | null
  quick_setup_state: unknown
  quick_setup_progress: number | null
  social_links: unknown
}

const defaultSetupState: SetupState = {
  skipped: {
    students: false,
    profile: false,
    youtube: false,
    completed: false,
  },
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseSetupState = (value: unknown): SetupState => {
  if (!isObjectRecord(value)) return defaultSetupState
  const skipped = isObjectRecord(value.skipped) ? value.skipped : {}
  return {
    skipped: {
      students: skipped.students === true,
      profile: skipped.profile === true,
      youtube: skipped.youtube === true,
      completed: skipped.completed === true,
    },
  }
}

const hasYouTubeSocialLink = (value: unknown) => {
  if (!Array.isArray(value)) return false
  return value.some((item) => {
    if (!isObjectRecord(item)) return false
    return item.service === 'youtube'
  })
}

export default function QuickSetupPage() {
  const session = useSession()
  const supabase = useSupabaseClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')

  const [setupState, setSetupState] = useState<SetupState>(defaultSetupState)
  const [studentCount, setStudentCount] = useState(0)
  const [youtubeConnected, setYoutubeConnected] = useState(false)
  const [addStudentOpen, setAddStudentOpen] = useState(false)

  const loadState = useCallback(async () => {
    if (!session) {
      setLoading(false)
      return
    }

    const [{ data: profileData }, { count }, userResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('username, nickname, bio, quick_setup_state, quick_setup_progress, social_links')
        .eq('id', session.user.id)
        .maybeSingle(),
      supabase
        .from('user_students')
        .select('student_id', { count: 'exact', head: true })
        .eq('user_id', session.user.id),
      supabase.auth.getUser(),
    ])

    const profile = (profileData ?? null) as ProfileRow | null
    if (profile) {
      setUsername(profile.username ?? '')
      setNickname(profile.nickname ?? '')
      setBio(profile.bio ?? '')
      setSetupState(parseSetupState(profile.quick_setup_state))
      const hasLinkedYouTube = hasYouTubeSocialLink(profile.social_links)
      const identities = userResult.data.user?.identities ?? []
      const hasGoogleIdentity = identities.some((identity) => identity.provider === 'google')
      setYoutubeConnected(hasLinkedYouTube || hasGoogleIdentity)
    }

    setStudentCount(count ?? 0)
    setLoading(false)
  }, [session, supabase])

  useEffect(() => {
    void loadState()
  }, [loadState])

  const studentsDone = studentCount > 0 || setupState.skipped.students
  const profileDone = username.trim().length > 0 || setupState.skipped.profile
  const youtubeDone = youtubeConnected || setupState.skipped.youtube
  const canCompleteFinal = studentsDone && profileDone && youtubeDone
  const completedDone = canCompleteFinal || setupState.skipped.completed

  const progress = useMemo(() => {
    const doneCount = [studentsDone, profileDone, youtubeDone, completedDone].filter(Boolean).length
    return Math.round((doneCount / 4) * 100)
  }, [studentsDone, profileDone, youtubeDone, completedDone])

  const saveProgress = useCallback(
    async (nextState: SetupState, nextProgress: number) => {
      if (!session) return
      await supabase
        .from('profiles')
        .upsert(
          {
            id: session.user.id,
            quick_setup_state: nextState,
            quick_setup_progress: nextProgress,
          },
          { onConflict: 'id' }
        )
    },
    [session, supabase]
  )

  useEffect(() => {
    if (!session || loading) return
    void saveProgress(setupState, progress)
  }, [setupState, progress, saveProgress, session, loading])

  const skipStep = (step: keyof SetupSkipState) => {
    setSetupState((prev) => ({
      ...prev,
      skipped: {
        ...prev.skipped,
        [step]: true,
      },
    }))
  }

  const saveProfile = async () => {
    if (!session) return
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      setMessage('ユーザー名は3〜20文字の英数字、-_のみ使用できます。')
      return
    }
    setBusy(true)
    setMessage(null)
    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: session.user.id,
          username,
          nickname: nickname || null,
          bio: bio || null,
        },
        { onConflict: 'id' }
      )
    setBusy(false)
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage('プロフィールを保存しました。')
  }

  const connectYouTube = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    if (!origin) return

    setBusy(true)
    setMessage(null)
    const redirectTo = new URL('/auth/callback', origin)
    redirectTo.searchParams.set('next', '/quick-setup')

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo.toString(),
        scopes: 'https://www.googleapis.com/auth/youtube.readonly',
        queryParams: {
          prompt: 'consent',
          access_type: 'offline',
          include_granted_scopes: 'true',
        },
      },
    })

    if (error) {
      setBusy(false)
      setMessage(`YouTube 連携に失敗しました: ${error.message}`)
      return
    }

    if (data.url) {
      window.location.assign(data.url)
      return
    }

    setBusy(false)
  }

  if (!session || loading) {
    return <main className="p-4">Loading...</main>
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-4 space-y-6">
      <h1 className="text-2xl font-bold">クイックセットアップ</h1>
      <div className="rounded border p-3">
        <p className="font-semibold">進行度: {progress}%</p>
        <div className="mt-2 h-2 w-full rounded bg-gray-200">
          <div className="h-2 rounded bg-blue-600" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {message && <p className="rounded border border-blue-200 bg-blue-50 p-3 text-sm">{message}</p>}

      <section className="rounded border p-4 space-y-3">
        <h2 className="text-lg font-bold">1. 生徒データを追加する（画像 or SchaleDB）</h2>
        <p className="text-sm">登録済み生徒数: {studentCount}</p>
        <div className="flex gap-2">
          <button type="button" className="rounded bg-blue-600 px-3 py-1 text-white" onClick={() => setAddStudentOpen(true)}>
            生徒データを追加
          </button>
          {!studentsDone && (
            <button type="button" className="rounded border px-3 py-1" onClick={() => skipStep('students')}>
              スキップ
            </button>
          )}
        </div>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="text-lg font-bold">2. 自分のプロフィールを設定する</h2>
        <div className="grid gap-2">
          <input
            className="rounded border px-3 py-2"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="ユーザー名（必須）"
          />
          <input
            className="rounded border px-3 py-2"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="ニックネーム（任意）"
          />
          <textarea
            className="rounded border px-3 py-2"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="自己紹介（任意）"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded bg-blue-600 px-3 py-1 text-white" disabled={busy} onClick={() => void saveProfile()}>
            保存
          </button>
          {!profileDone && (
            <button type="button" className="rounded border px-3 py-1" onClick={() => skipStep('profile')}>
              スキップ
            </button>
          )}
        </div>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="text-lg font-bold">3. YouTubeアカウントを接続する</h2>
        <p className="text-sm">状態: {youtubeDone ? '接続済み' : '未接続'}</p>
        <div className="flex gap-2">
          {!youtubeDone && (
            <button type="button" className="rounded bg-blue-600 px-3 py-1 text-white" disabled={busy} onClick={() => void connectYouTube()}>
              YouTubeを接続
            </button>
          )}
          {!youtubeDone && (
            <button type="button" className="rounded border px-3 py-1" onClick={() => skipStep('youtube')}>
              スキップ
            </button>
          )}
        </div>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="text-lg font-bold">4. 完了</h2>
        <div className="flex gap-2">
          {canCompleteFinal && !setupState.skipped.completed && (
            <button
              type="button"
              className="rounded bg-green-600 px-3 py-1 text-white"
              onClick={() => {
                skipStep('completed')
                router.push('/')
              }}
            >
              セットアップ完了
            </button>
          )}
          {!completedDone && (
            <button type="button" className="rounded border px-3 py-1" onClick={() => skipStep('completed')}>
              スキップ
            </button>
          )}
        </div>
      </section>

      {addStudentOpen && (
        <AddStudentModal
          addStudents={() => undefined}
          addStudent={() => undefined}
          onAdded={() => {
            void loadState()
          }}
          close={() => setAddStudentOpen(false)}
        />
      )}
    </main>
  )
}
