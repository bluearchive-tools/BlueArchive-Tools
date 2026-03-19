'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faArrowRight,
  faCamera,
  faCheckCircle,
  faCircleUser,
  faCloudArrowUp,
  faCompass,
  faFileLines,
  faRightToBracket,
  faSpinner,
  faUserGear,
  faUsers,
  faVideo,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { faDiscord, faGoogle, faYoutube } from '@fortawesome/free-brands-svg-icons'
import { useLocale } from 'next-intl'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
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
  icon: IconDefinition
}

type StepMarkdownMap = Record<QuickSetupStep, string>

const QUICK_SETUP_LOCAL_STATE_KEY = 'ba:quick-setup-state'
const QUICK_SETUP_LOCAL_PROGRESS_KEY = 'ba:quick-setup-progress'
const QUICK_SETUP_MD_PATHS: Record<QuickSetupStep, string> = {
  login: 'quick-setup-login',
  students: 'quick-setup-students',
  profile: 'quick-setup-profile',
  youtube: 'quick-setup-youtube',
  completed: 'quick-setup-completed',
}

const STEP_DEFINITIONS: StepDefinition[] = [
  {
    key: 'login',
    title: 'ログインする',
    description: '進行状況や各種設定をアカウントへ保存できるよう、最初にログインします。',
    icon: faRightToBracket,
  },
  {
    key: 'students',
    title: '生徒データを追加する',
    description: '画像かSchaleDBのどちらを使うか選び、あなたの生徒データを登録します。',
    icon: faUsers,
  },
  {
    key: 'profile',
    title: 'プロフィールを設定する',
    description: 'ユーザー名や表示名を設定して、マイページや公開表示を整えます。',
    icon: faUserGear,
  },
  {
    key: 'youtube',
    title: 'YouTubeアカウントを接続する',
    description: 'YouTube連携を有効にして、関連する投稿者機能を利用できるようにします。',
    icon: faVideo,
  },
  {
    key: 'completed',
    title: '完了',
    description: '最後に内容を確認し、セットアップを完了します。',
    icon: faCheckCircle,
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

const emptyStepMarkdown: StepMarkdownMap = {
  login: '',
  students: '',
  profile: '',
  youtube: '',
  completed: '',
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
  return value.some((item) => isObjectRecord(item) && item.service === 'youtube')
}

const getLocalStudentCount = () => {
  if (typeof window === 'undefined') return 0
  let count = 0
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith('userStudent:')) count += 1
  }
  return count
}

const stepIndex = (step: QuickSetupStep) => STEP_DEFINITIONS.findIndex((entry) => entry.key === step)

const markdownCardClass =
  'prose prose-sm max-w-none rounded-3xl border bg-slate-50 p-6 prose-headings:mt-0 prose-p:leading-7 prose-img:rounded-2xl prose-img:shadow-sm'

export default function QuickSetupPage() {
  const session = useSession()
  const supabase = useSupabaseClient()
  const router = useRouter()
  const locale = useLocale()

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
  const [stepMarkdown, setStepMarkdown] = useState<StepMarkdownMap>(emptyStepMarkdown)

  const loadStepMarkdown = useCallback(async () => {
    const requestedLocale = locale || 'ja'
    const nextMarkdownEntries = await Promise.all(
      (Object.keys(QUICK_SETUP_MD_PATHS) as QuickSetupStep[]).map(async (stepKey) => {
        const filename = QUICK_SETUP_MD_PATHS[stepKey]
        const localeCandidates = requestedLocale === 'ja' ? ['ja'] : [requestedLocale, 'ja']

        for (const localeCode of localeCandidates) {
          const response = await fetch(`/helps/${localeCode}/${filename}.md`, { cache: 'no-store' })
          if (response.ok) {
            return [stepKey, await response.text()] as const
          }
        }

        return [stepKey, ''] as const
      })
    )

    const markdownMap = nextMarkdownEntries.reduce<StepMarkdownMap>((accumulator, [stepKey, markdown]) => {
      accumulator[stepKey] = markdown
      return accumulator
    }, { ...emptyStepMarkdown })

    setStepMarkdown(markdownMap)
  }, [locale])

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
    void loadStepMarkdown()
  }, [loadState, loadStepMarkdown])

  useEffect(() => {
    if (currentStep !== 'students') return undefined

    const intervalId = window.setInterval(() => {
      setStudentCount(getLocalStudentCount())
    }, 2000)

    return () => window.clearInterval(intervalId)
  }, [currentStep])

  const loginDone = !!session || setupState.skipped.login
  const studentsDone = studentCount > 0 || setupState.skipped.students
  const profileDone = (session ? username.trim().length > 0 : false) || setupState.skipped.profile
  const youtubeDone = (session ? youtubeConnected : false) || setupState.skipped.youtube
  const canCompleteFinal = loginDone && studentsDone && profileDone && youtubeDone
  const completedDone = canCompleteFinal || setupState.skipped.completed

  const completionMap = useMemo<Record<QuickSetupStep, boolean>>(
    () => ({
      login: loginDone,
      students: studentsDone,
      profile: profileDone,
      youtube: youtubeDone,
      completed: completedDone,
    }),
    [completedDone, loginDone, profileDone, studentsDone, youtubeDone]
  )

  const progress = useMemo(() => {
    const doneCount = Object.values(completionMap).filter(Boolean).length
    return Math.round((doneCount / STEP_DEFINITIONS.length) * 100)
  }, [completionMap])

  const saveProgressToLocal = useCallback((nextState: SetupState, nextProgress: number) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(QUICK_SETUP_LOCAL_STATE_KEY, JSON.stringify(nextState))
    window.localStorage.setItem(QUICK_SETUP_LOCAL_PROGRESS_KEY, String(nextProgress))
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
  }, [loading, progress, saveProgressToLocal, saveProgressToProfile, setupState])

  const moveToStep = (target: QuickSetupStep) => {
    setMoveDirection(stepIndex(target) >= stepIndex(currentStep) ? 'forward' : 'backward')
    setCurrentStep(target)
    setMessage(null)
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

  const markSkipped = (step: keyof SetupSkipState) => {
    setSetupState((prev) => ({
      ...prev,
      skipped: {
        ...prev.skipped,
        [step]: true,
      },
    }))
    goNextStep()
  }

  const handleOAuthSignIn = async (provider: 'google' | 'discord') => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    if (!origin) return

    setBusy(true)
    setMessage(null)
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
  const currentMarkdown = stepMarkdown[currentStepDefinition.key]

  const stepCardBaseClass =
    'group flex min-h-48 flex-col rounded-3xl border p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg'

  const renderStepMarkdown = (stepKey: QuickSetupStep) => {
    const markdown = stepMarkdown[stepKey]
    if (!markdown) return null

    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {markdown}
      </ReactMarkdown>
    )
  }

  const renderStepContent = () => {
    if (currentStep === 'login') {
      return (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-3xl bg-blue-50 p-6">
            <div className="flex items-center gap-3 text-blue-700">
              <FontAwesomeIcon icon={faCompass} className="text-2xl" />
              <h3 className="text-xl font-bold">まずはアカウントを用意しましょう</h3>
            </div>
            <div className={markdownCardClass}>{renderStepMarkdown('login')}</div>
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                disabled={busy || !!session}
                onClick={() => void handleOAuthSignIn('google')}
                className={`${stepCardBaseClass} ${session ? 'cursor-default opacity-60' : 'border-blue-200 bg-white'}`}
              >
                <FontAwesomeIcon icon={faGoogle} className="mb-4 text-4xl text-[#4285F4]" />
                <span className="text-xl font-bold">Googleでログイン</span>
                <span className="mt-2 text-sm text-gray-600">YouTube連携までまとめて進めたい人におすすめです。</span>
              </button>
              <button
                type="button"
                disabled={busy || !!session}
                onClick={() => void handleOAuthSignIn('discord')}
                className={`${stepCardBaseClass} ${session ? 'cursor-default opacity-60' : 'border-indigo-200 bg-white'}`}
              >
                <FontAwesomeIcon icon={faDiscord} className="mb-4 text-4xl text-[#5865F2]" />
                <span className="text-xl font-bold">Discordでログイン</span>
                <span className="mt-2 text-sm text-gray-600">まずはアカウントだけ作って始めたいときに便利です。</span>
              </button>
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-3xl border bg-white p-6">
            <div>
              <div className="flex items-center gap-3 text-green-600">
                <FontAwesomeIcon icon={faCheckCircle} className="text-2xl" />
                <h3 className="text-xl font-bold">このステップの状態</h3>
              </div>
              <p className="mt-4 text-base text-gray-700">
                {loginDone ? 'ログイン済み、またはこのステップをスキップ済みです。' : 'まだログインしていません。ここでログインすると後の設定がスムーズです。'}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {!loginDone && (
                <button type="button" className="rounded-2xl border px-5 py-3 font-semibold" onClick={() => markSkipped('login')}>
                  このステップをスキップ
                </button>
              )}
              {loginDone && (
                <button type="button" className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white" onClick={goNextStep}>
                  次のステップへ
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }

    if (currentStep === 'students') {
      return (
        <div className="space-y-6">
          <div className="rounded-3xl bg-slate-50 p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <FontAwesomeIcon icon={faUsers} className="text-2xl" />
              <h3 className="text-xl font-bold">追加方法を選んでください</h3>
            </div>
            <div className={`mt-4 ${markdownCardClass}`}>{renderStepMarkdown('students')}</div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedMethod('image')}
              className={`${stepCardBaseClass} min-h-60 ${selectedMethod === 'image' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 bg-white'}`}
            >
              <FontAwesomeIcon icon={faCamera} className="mb-5 text-5xl text-blue-500" />
              <span className="text-2xl font-bold">画像から追加</span>
              <span className="mt-3 text-base leading-7 text-gray-600">
                `/students/import` と同じ形式の画面を、このクイックセットアップ内に埋め込んで使えます。
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedMethod('schaledb')}
              className={`${stepCardBaseClass} min-h-60 ${selectedMethod === 'schaledb' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-gray-200 bg-white'}`}
            >
              <FontAwesomeIcon icon={faCloudArrowUp} className="mb-5 text-5xl text-emerald-500" />
              <span className="text-2xl font-bold">SchaleDBから追加</span>
              <span className="mt-3 text-base leading-7 text-gray-600">
                SchaleDBのエクスポート文字列を使って生徒データを取り込みます。
              </span>
            </button>
          </div>

          {selectedMethod === 'image' && (
            <div className="rounded-3xl border border-blue-200 bg-white p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-blue-700">
                  <FontAwesomeIcon icon={faCamera} className="text-2xl" />
                  <h3 className="text-xl font-bold">画像アップロード（同形式）</h3>
                </div>
                <button
                  type="button"
                  className="rounded-2xl border px-4 py-2 text-sm font-semibold"
                  onClick={() => {
                    setStudentCount(getLocalStudentCount())
                    if (session) {
                      void loadState()
                    }
                  }}
                >
                  取り込み後に件数を更新
                </button>
              </div>
              <p className="mb-4 text-sm text-gray-600">
                下の埋め込み画面は <code>/students/import</code> と同じ形式です。画像アップロード後、保存したら「取り込み後に件数を更新」を押してください。
              </p>
              <iframe
                title="students-import-embed"
                src="/students/import"
                className="h-[1100px] w-full rounded-2xl border bg-white"
              />
            </div>
          )}

          {selectedMethod === 'schaledb' && (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex items-center gap-3 text-emerald-700">
                <FontAwesomeIcon icon={faCloudArrowUp} className="text-2xl" />
                <h3 className="text-xl font-bold">SchaleDB追加の進め方</h3>
              </div>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-base leading-7 text-gray-700">
                <li>SchaleDBからエクスポートしたJSONまたはBase64文字列を用意します。</li>
                <li>生徒ページへ移動します。</li>
                <li>追加モーダルの「インポート」またはインポートページから読み込んでください。</li>
              </ol>
              <Link href="/students/import" className="mt-5 inline-flex rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white">
                インポートページへ移動
              </Link>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-white p-6">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faCircleUser} className="text-2xl text-slate-500" />
              <div>
                <p className="text-sm text-gray-500">現在の登録状況</p>
                <p className="text-xl font-bold">登録済み生徒数: {studentCount}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {!studentsDone && (
                <button type="button" className="rounded-2xl border px-5 py-3 font-semibold" onClick={() => markSkipped('students')}>
                  このステップをスキップ
                </button>
              )}
              {(studentsDone || selectedMethod !== null) && (
                <button type="button" className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white" onClick={goNextStep}>
                  次のステップへ
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }

    if (currentStep === 'profile') {
      return (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4 rounded-3xl bg-purple-50 p-6">
            <div className="flex items-center gap-3 text-purple-700">
              <FontAwesomeIcon icon={faUserGear} className="text-2xl" />
              <h3 className="text-xl font-bold">プロフィールを整えましょう</h3>
            </div>
            <div className={markdownCardClass}>{renderStepMarkdown('profile')}</div>
            {!session && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                ログインが必要です。{' '}
                <button type="button" className="font-semibold underline" onClick={() => moveToStep('login')}>
                  やっぱりログインする
                </button>
              </div>
            )}
          </div>
          <div className="rounded-3xl border bg-white p-6">
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="font-semibold">ユーザー名</span>
                <input
                  className="rounded-2xl border px-4 py-3"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="例: sensei_123"
                  disabled={!session}
                />
              </label>
              <label className="grid gap-2">
                <span className="font-semibold">ニックネーム</span>
                <input
                  className="rounded-2xl border px-4 py-3"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="表示名を入力"
                  disabled={!session}
                />
              </label>
              <label className="grid gap-2">
                <span className="font-semibold">自己紹介</span>
                <textarea
                  className="min-h-32 rounded-2xl border px-4 py-3"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="好きな生徒やプレイスタイルなど"
                  disabled={!session}
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
                disabled={busy || !session}
                onClick={() => void saveProfile()}
              >
                保存して次へ
              </button>
              {!profileDone && (
                <button type="button" className="rounded-2xl border px-5 py-3 font-semibold" onClick={() => markSkipped('profile')}>
                  このステップをスキップ
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }

    if (currentStep === 'youtube') {
      return (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-4 rounded-3xl bg-red-50 p-6">
            <div className="flex items-center gap-3 text-red-700">
              <FontAwesomeIcon icon={faYoutube} className="text-3xl" />
              <h3 className="text-xl font-bold">YouTube連携を設定する</h3>
            </div>
            <div className={markdownCardClass}>{renderStepMarkdown('youtube')}</div>
            {!session && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                ログインが必要です。{' '}
                <button type="button" className="font-semibold underline" onClick={() => moveToStep('login')}>
                  やっぱりログインする
                </button>
              </div>
            )}
          </div>
          <div className="rounded-3xl border bg-white p-6">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={youtubeDone ? faCheckCircle : faYoutube} className={`text-3xl ${youtubeDone ? 'text-green-600' : 'text-red-500'}`} />
              <div>
                <p className="text-sm text-gray-500">接続状態</p>
                <p className="text-2xl font-bold">{youtubeDone ? '接続済み' : '未接続'}</p>
              </div>
            </div>
            <p className="mt-5 text-base leading-7 text-gray-700">
              接続時には YouTube 読み取り権限を要求します。ブランドアカウントを使う場合も、接続先を確認しながら進めてください。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {!youtubeDone && (
                <button
                  type="button"
                  className="rounded-2xl bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
                  disabled={busy || !session}
                  onClick={() => void connectYouTube()}
                >
                  YouTubeを接続
                </button>
              )}
              {!youtubeDone && (
                <button type="button" className="rounded-2xl border px-5 py-3 font-semibold" onClick={() => markSkipped('youtube')}>
                  このステップをスキップ
                </button>
              )}
              {youtubeDone && (
                <button type="button" className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white" onClick={goNextStep}>
                  次のステップへ
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-4 rounded-3xl bg-green-50 p-6">
          <div className="flex items-center gap-3 text-green-700">
            <FontAwesomeIcon icon={faCheckCircle} className="text-3xl" />
            <h3 className="text-2xl font-bold">セットアップの最終確認</h3>
          </div>
          <div className={markdownCardClass}>{renderStepMarkdown('completed')}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {STEP_DEFINITIONS.map((step) => (
              <div key={step.key} className="rounded-2xl border bg-white p-4">
                <div className="flex items-center gap-3">
                  <FontAwesomeIcon icon={step.icon} className={`text-lg ${completionMap[step.key] ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="font-semibold">{step.title}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{completionMap[step.key] ? '完了またはスキップ済みです。' : 'まだ確認が残っています。'}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border bg-white p-6">
          <p className="text-sm text-gray-500">最終アクション</p>
          <p className="mt-2 text-xl font-bold">セットアップを終了する</p>
          <p className="mt-3 text-base leading-7 text-gray-700">
            完了すると、進行度が100%になり、ヘッダーのクイックスタート表示も非表示になります。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {canCompleteFinal && !setupState.skipped.completed && (
              <button
                type="button"
                className="rounded-2xl bg-green-600 px-5 py-3 font-semibold text-white"
                onClick={() => {
                  setSetupState((prev) => ({
                    ...prev,
                    skipped: {
                      ...prev.skipped,
                      completed: true,
                    },
                  }))
                  router.push('/')
                }}
              >
                セットアップ完了
              </button>
            )}
            {!completedDone && (
              <button type="button" className="rounded-2xl border px-5 py-3 font-semibold" onClick={() => markSkipped('completed')}>
                このステップをスキップ
              </button>
            )}
            <Link href="/" className="rounded-2xl border px-5 py-3 font-semibold">
              ホームへ戻る
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-6 py-10">
        <div className="flex items-center gap-3 rounded-2xl border bg-white px-6 py-4 shadow-sm">
          <FontAwesomeIcon icon={faSpinner} spin className="text-blue-600" />
          <span>クイックセットアップを読み込み中...</span>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
      <section className="rounded-[2rem] bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 p-8 text-white shadow-lg md:p-10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
              <FontAwesomeIcon icon={faCompass} />
              Quick Setup
            </div>
            <h1 className="text-3xl font-bold md:text-4xl">迷わず始められる初期セットアップ</h1>
            <p className="text-base leading-7 text-white/90 md:text-lg">
              ログイン、生徒データ追加、プロフィール設定、YouTube接続までを順番にガイドします。必要なところだけ進めても大丈夫です。
            </p>
          </div>
          <div className="rounded-3xl bg-white/15 p-5 backdrop-blur-sm xl:min-w-80">
            <p className="text-sm font-semibold text-white/80">全体の進行度</p>
            <p className="mt-2 text-3xl font-bold">{progress}%</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border bg-white p-5 shadow-sm md:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">進行状況</p>
            <h2 className="text-xl font-bold">{currentStepDefinition.title}</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={goPrevStep}
              disabled={currentStep === 'login'}
              className="rounded-2xl border px-4 py-3 font-semibold disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
              戻る
            </button>
            <button
              type="button"
              onClick={goNextStep}
              disabled={currentStep === 'completed'}
              className="rounded-2xl border px-4 py-3 font-semibold disabled:opacity-50"
            >
              進む
              <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          {STEP_DEFINITIONS.map((step, index) => {
            const isActive = step.key === currentStep
            const isCompleted = completionMap[step.key]
            return (
              <div key={step.key} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => moveToStep(step.key)}
                  className={`flex min-h-20 flex-1 items-center gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                    isActive ? 'border-blue-500 bg-blue-50 shadow-sm' : isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full ${isActive ? 'bg-blue-600 text-white' : isCompleted ? 'bg-green-600 text-white' : 'bg-white text-gray-500'}`}>
                    <FontAwesomeIcon icon={step.icon} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">STEP {index + 1}</p>
                    <p className="font-semibold leading-tight">{step.title}</p>
                  </div>
                </button>
                {index < STEP_DEFINITIONS.length - 1 && <div className="hidden h-1 flex-1 rounded-full bg-gray-200 md:block" />}
              </div>
            )
          })}
        </div>

        <div className="mt-6 space-y-3">
          <div className="relative h-5 overflow-hidden rounded-full bg-gray-100">
            <div className="absolute inset-0 grid grid-cols-5 gap-px px-1 py-1">
              {STEP_DEFINITIONS.map((step) => (
                <div key={step.key} className="rounded-full bg-white/80" />
              ))}
            </div>
            <div className="absolute inset-y-1 left-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300" style={{ width: `calc(${progress}% - 0.5rem)` }} />
          </div>
          <div className="flex justify-between text-xs font-semibold text-gray-500">
            {STEP_DEFINITIONS.map((step) => (
              <span key={step.key} className="text-center">
                {step.title}
              </span>
            ))}
          </div>
        </div>
      </section>

      {message && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">
          {message}
        </section>
      )}

      {currentMarkdown && currentStep !== 'students' && (
        <section className="rounded-[2rem] border bg-white p-5 shadow-sm md:p-8">
          <div className="mb-4 flex items-center gap-3">
            <FontAwesomeIcon icon={faFileLines} className="text-xl text-slate-600" />
            <h2 className="text-xl font-bold">このステップの説明（Markdown管理）</h2>
          </div>
          <div className={markdownCardClass}>{renderStepMarkdown(currentStep)}</div>
        </section>
      )}

      <section
        key={currentStep}
        className={`rounded-[2rem] border bg-white p-5 shadow-sm transition-all duration-300 md:p-8 ${moveDirection === 'forward' ? 'animate-[slideInRight_0.28s_ease-out]' : 'animate-[slideInLeft_0.28s_ease-out]'}`}
      >
        <div className="mb-6 flex items-center gap-4 border-b pb-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-700">
            <FontAwesomeIcon icon={currentStepDefinition.icon} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{currentStepDefinition.title}</h2>
            <p className="mt-1 text-base leading-7 text-gray-600">{currentStepDefinition.description}</p>
          </div>
        </div>
        {renderStepContent()}
      </section>

      <style jsx>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(24px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-24px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>

      {addStudentOpen && (
        <AddStudentModal
          addStudents={() => undefined}
          addStudent={() => undefined}
          onAdded={() => {
            setStudentCount(getLocalStudentCount())
            if (session) {
              void loadState()
            }
          }}
          close={() => setAddStudentOpen(false)}
        />
      )}
    </main>
  )
}
