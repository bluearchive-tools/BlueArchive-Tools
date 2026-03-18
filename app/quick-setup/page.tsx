'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import AddStudentModal from '../../components/AddStudentModal'

type SetupSkipState = {
  login: boolean
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
  social_links: unknown
}

type QuickSetupStep = 'login' | 'students' | 'profile' | 'youtube' | 'completed'
type StudentAddMethod = 'image' | 'schaledb' | null

type StepDefinition = {
  key: QuickSetupStep
  title: string
  description: string
}

const QUICK_SETUP_LOCAL_STATE_KEY = 'ba:quick-setup-state'
const QUICK_SETUP_LOCAL_PROGRESS_KEY = 'ba:quick-setup-progress'

const STEP_DEFINITIONS: StepDefinition[] = [
  {
    key: 'login',
    title: '0. ログインする',
    description: '最初にログインしておくと、進行度や設定内容をアカウントに保存できます。',
  },
  {
    key: 'students',
    title: '1. 生徒データを追加する',
    description: '追加方法を選択して、あなたの手元データに生徒情報を登録します。',
  },
  {
    key: 'profile',
    title: '2. 自分のプロフィールを設定する',
    description: 'ユーザー名や表示名を設定して、マイページ表示を整えます。',
  },
  {
    key: 'youtube',
    title: '3. YouTubeアカウントを接続する',
    description: 'YouTube連携を有効にして、関連機能を使える状態にします。',
  },
  {
    key: 'completed',
    title: '4. 完了',
    description: '全ステップを確認したらセットアップ完了です。',
  },
]

const defaultSetupState: SetupState = {
  skipped: {
    login: false,
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
      login: skipped.login === true,
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

const getLocalStudentCount = () => {
  if (typeof window === 'undefined') return 0
  let count = 0
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i)
    if (key?.startsWith('userStudent:')) count += 1
  }
  return count
}

const stepIndex = (step: QuickSetupStep) => STEP_DEFINITIONS.findIndex((entry) => entry.key === step)

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
  const [selectedMethod, setSelectedMethod] = useState<StudentAddMethod>(null)

  const [currentStep, setCurrentStep] = useState<QuickSetupStep>('login')
  const [moveDirection, setMoveDirection] = useState<'forward' | 'backward'>('forward')

  const loadState = useCallback(async () => {
    if (!session) {
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(QUICK_SETUP_LOCAL_STATE_KEY)
          if (raw) {
            setSetupState(parseSetupState(JSON.parse(raw) as unknown))
          }
        } catch {
          setSetupState(defaultSetupState)
        }
      }
      setStudentCount(getLocalStudentCount())
      setYoutubeConnected(false)
      setLoading(false)
      return
    }

    const [{ data: profileData }, { count }, userResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('username, nickname, bio, quick_setup_state, social_links')
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

  const loginDone = !!session || setupState.skipped.login
  const studentsDone = studentCount > 0 || setupState.skipped.students
  const profileDone = (session ? username.trim().length > 0 : false) || setupState.skipped.profile
  const youtubeDone = (session ? youtubeConnected : false) || setupState.skipped.youtube
  const canCompleteFinal = loginDone && studentsDone && profileDone && youtubeDone
  const completedDone = canCompleteFinal || setupState.skipped.completed

  const progress = useMemo(() => {
    const doneCount = [loginDone, studentsDone, profileDone, youtubeDone, completedDone].filter(Boolean).length
    return Math.round((doneCount / 5) * 100)
  }, [loginDone, studentsDone, profileDone, youtubeDone, completedDone])

  const saveProgressToLocal = useCallback((nextState: SetupState, nextProgress: number) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(QUICK_SETUP_LOCAL_STATE_KEY, JSON.stringify(nextState))
      window.localStorage.setItem(QUICK_SETUP_LOCAL_PROGRESS_KEY, String(nextProgress))
    } catch {
      // ignore
    }
  }, [])

  const saveProgressToProfile = useCallback(
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
    if (loading) return
    saveProgressToLocal(setupState, progress)
    void saveProgressToProfile(setupState, progress)
  }, [setupState, progress, saveProgressToLocal, saveProgressToProfile, loading])

  const moveToStep = (target: QuickSetupStep) => {
    setMoveDirection(stepIndex(target) >= stepIndex(currentStep) ? 'forward' : 'backward')
    setCurrentStep(target)
  }

  const goNextStep = () => {
    const currentIndex = stepIndex(currentStep)
    if (currentIndex < STEP_DEFINITIONS.length - 1) {
      moveToStep(STEP_DEFINITIONS[currentIndex + 1].key)
    }
  }

  const goPrevStep = () => {
    const currentIndex = stepIndex(currentStep)
    if (currentIndex > 0) {
      moveToStep(STEP_DEFINITIONS[currentIndex - 1].key)
    }
  }

  const skipStep = (step: keyof SetupSkipState) => {
    setSetupState((prev) => ({
      ...prev,
      skipped: {
        ...prev.skipped,
        [step]: true,
      },
    }))
    goNextStep()
  }

  const oauthSignIn = async (provider: 'google' | 'discord') => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    if (!origin) return
    setBusy(true)
    const redirectTo = new URL('/auth/callback', origin)
    redirectTo.searchParams.set('next', '/quick-setup')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectTo.toString(),
      },
    })
    if (error) {
      setBusy(false)
      setMessage(`ログインに失敗しました: ${error.message}`)
      return
    }
    if (data.url) {
      window.location.assign(data.url)
      return
    }
    setBusy(false)
  }

  const saveProfile = async () => {
    if (!session) {
      setMessage('ログインが必要です。')
      return
    }
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
    goNextStep()
  }

  const connectYouTube = async () => {
    if (!session) {
      setMessage('ログインが必要です。')
      return
    }
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

  const currentStepDefinition = STEP_DEFINITIONS[stepIndex(currentStep)]

  const renderStepContent = () => {
    if (currentStep === 'login') {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">ログイン済みならこのステップは完了です。未ログイン時はここでログインしてください。</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !!session}
              onClick={() => void oauthSignIn('google')}
              className="rounded border px-3 py-2 disabled:opacity-50"
            >
              Googleでログイン
            </button>
            <button
              type="button"
              disabled={busy || !!session}
              onClick={() => void oauthSignIn('discord')}
              className="rounded border px-3 py-2 disabled:opacity-50"
            >
              Discordでログイン
            </button>
            {!loginDone && (
              <button type="button" className="rounded border px-3 py-2" onClick={() => skipStep('login')}>
                スキップ
              </button>
            )}
            {loginDone && (
              <button type="button" className="rounded bg-blue-600 px-3 py-2 text-white" onClick={goNextStep}>
                次へ
              </button>
            )}
          </div>
        </div>
      )
    }

    if (currentStep === 'students') {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">追加方法ごとに案内を分けています。まずは方法を選択してください。</p>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedMethod('image')}
              className={`rounded border p-3 text-left ${selectedMethod === 'image' ? 'border-blue-500 bg-blue-50' : ''}`}
            >
              <p className="font-semibold">画像から追加</p>
              <p className="mt-1 text-sm text-gray-600">スクリーンショットを読み込んで生徒データを追加します。</p>
            </button>
            <button
              type="button"
              onClick={() => setSelectedMethod('schaledb')}
              className={`rounded border p-3 text-left ${selectedMethod === 'schaledb' ? 'border-blue-500 bg-blue-50' : ''}`}
            >
              <p className="font-semibold">SchaleDBから追加</p>
              <p className="mt-1 text-sm text-gray-600">SchaleDB形式のJSONをインポートして一括登録します。</p>
            </button>
          </div>

          {selectedMethod === 'image' && (
            <div className="rounded border bg-gray-50 p-3 text-sm space-y-2">
              <p>画像から追加: 生徒ステータス画像を用意して、追加モーダルの「画像から追加」を選択してください。</p>
              <button type="button" className="rounded bg-blue-600 px-3 py-1 text-white" onClick={() => setAddStudentOpen(true)}>
                画像追加モーダルを開く
              </button>
            </div>
          )}

          {selectedMethod === 'schaledb' && (
            <div className="rounded border bg-gray-50 p-3 text-sm space-y-2">
              <p>SchaleDBから追加: 学生一覧ページへ移動し、追加モーダルの「インポート」からJSONを読み込んでください。</p>
              <Link href="/students" className="inline-block rounded bg-blue-600 px-3 py-1 text-white">
                生徒ページへ移動
              </Link>
            </div>
          )}

          <p className="text-sm">登録済み生徒数: {studentCount}</p>
          <div className="flex gap-2">
            {!studentsDone && (
              <button type="button" className="rounded border px-3 py-1" onClick={() => skipStep('students')}>
                スキップ
              </button>
            )}
            {(studentsDone || selectedMethod !== null) && (
              <button type="button" className="rounded bg-blue-600 px-3 py-1 text-white" onClick={goNextStep}>
                次へ
              </button>
            )}
          </div>
        </div>
      )
    }

    if (currentStep === 'profile') {
      return (
        <div className="space-y-4">
          {!session && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
              ログインが必要です。 <button type="button" className="underline" onClick={() => moveToStep('login')}>やっぱりログインする</button>
            </div>
          )}
          <p className="text-sm text-gray-700">公開プロフィールの基本情報を登録します。ユーザー名は3〜20文字で入力してください。</p>
          <div className="grid gap-2">
            <input className="rounded border px-3 py-2" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ユーザー名（必須）" disabled={!session} />
            <input className="rounded border px-3 py-2" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="ニックネーム（任意）" disabled={!session} />
            <textarea className="rounded border px-3 py-2" value={bio} onChange={(event) => setBio(event.target.value)} placeholder="自己紹介（任意）" disabled={!session} />
          </div>
          <div className="flex gap-2">
            <button type="button" className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50" disabled={busy || !session} onClick={() => void saveProfile()}>
              保存して次へ
            </button>
            {!profileDone && (
              <button type="button" className="rounded border px-3 py-1" onClick={() => skipStep('profile')}>
                スキップ
              </button>
            )}
          </div>
        </div>
      )
    }

    if (currentStep === 'youtube') {
      return (
        <div className="space-y-4">
          {!session && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
              ログインが必要です。 <button type="button" className="underline" onClick={() => moveToStep('login')}>やっぱりログインする</button>
            </div>
          )}
          <p className="text-sm text-gray-700">YouTube連携を行うと、関連する機能でチャンネル情報の確認ができます。</p>
          <p className="text-sm">状態: {youtubeDone ? '接続済み' : '未接続'}</p>
          <div className="flex gap-2">
            {!youtubeDone && (
              <button type="button" className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50" disabled={busy || !session} onClick={() => void connectYouTube()}>
                YouTubeを接続
              </button>
            )}
            {!youtubeDone && (
              <button type="button" className="rounded border px-3 py-1" onClick={() => skipStep('youtube')}>
                スキップ
              </button>
            )}
            {youtubeDone && (
              <button type="button" className="rounded bg-blue-600 px-3 py-1 text-white" onClick={goNextStep}>
                次へ
              </button>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-700">これですべてのセットアップステップが完了です。</p>
        <div className="flex flex-wrap gap-2">
          {canCompleteFinal && !setupState.skipped.completed && (
            <button
              type="button"
              className="rounded bg-green-600 px-3 py-1 text-white"
              onClick={() => {
                setSetupState((prev) => ({ ...prev, skipped: { ...prev.skipped, completed: true } }))
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
          <Link href="/" className="inline-block rounded border px-3 py-1">
            ホームへ戻る
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return <main className="p-4">Loading...</main>
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-4 space-y-4">
      <h1 className="text-2xl font-bold">クイックセットアップ</h1>
      <div className="rounded border p-3">
        <p className="font-semibold">進行度: {progress}%</p>
        <div className="mt-2 h-2 w-full rounded bg-gray-200">
          <div className="h-2 rounded bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded border p-3">
        <div>
          <p className="text-sm text-gray-500">現在のステップ</p>
          <h2 className="text-lg font-bold">{currentStepDefinition.title}</h2>
          <p className="text-sm text-gray-600">{currentStepDefinition.description}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={goPrevStep} disabled={currentStep === 'login'} className="rounded border px-3 py-1 disabled:opacity-50">
            戻る
          </button>
          <button type="button" onClick={goNextStep} disabled={currentStep === 'completed'} className="rounded border px-3 py-1 disabled:opacity-50">
            進む
          </button>
        </div>
      </div>

      {message && <p className="rounded border border-blue-200 bg-blue-50 p-3 text-sm">{message}</p>}

      <section
        key={currentStep}
        className={`rounded border p-4 transition-all duration-300 ${moveDirection === 'forward' ? 'animate-[slideInRight_0.28s_ease-out]' : 'animate-[slideInLeft_0.28s_ease-out]'}`}
      >
        {renderStepContent()}
      </section>

      <style jsx>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {addStudentOpen && (
        <AddStudentModal
          addStudents={() => undefined}
          addStudent={() => undefined}
          onAdded={() => {
            setStudentCount(getLocalStudentCount())
            if (session) void loadState()
          }}
          close={() => setAddStudentOpen(false)}
        />
      )}
    </main>
  )
}
