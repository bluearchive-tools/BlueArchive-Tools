'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  faRightToBracket,
  faSpinner,
  faUserGear,
  faUsers,
  faVideo,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { faDiscord, faYoutube } from '@fortawesome/free-brands-svg-icons'
import { useLocale, useTranslations } from 'next-intl'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import AddStudentModal from '../../components/AddStudentModal'
import GoogleSignInButton from '../../components/GoogleSignInButton'
import StudentImportContent from '../../components/StudentImportContent'

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
type StudentMethodMarkdownMap = Record<Exclude<StudentAddMethod, null>, string>

const QUICK_SETUP_LOCAL_STATE_KEY = 'ba:quick-setup-state'
const QUICK_SETUP_LOCAL_PROGRESS_KEY = 'ba:quick-setup-progress'
const QUICK_SETUP_MD_PATHS: Record<QuickSetupStep, string> = {
  login: 'quick-setup-login',
  students: 'quick-setup-students',
  profile: 'quick-setup-profile',
  youtube: 'quick-setup-youtube',
  completed: 'quick-setup-completed',
}

const QUICK_SETUP_STUDENT_METHOD_MD_PATHS: Record<Exclude<StudentAddMethod, null>, string> = {
  image: 'quick-setup-students-image',
  schaledb: 'quick-setup-students-schaledb',
}


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

const emptyStudentMethodMarkdown: StudentMethodMarkdownMap = {
  image: '',
  schaledb: '',
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


const markdownCardClass =
  'prose prose-sm max-w-none rounded-3xl border bg-slate-50 p-6 prose-headings:mt-0 prose-p:leading-7 prose-img:rounded-2xl prose-img:shadow-sm'

export default function QuickSetupPage() {
  const session = useSession()
  const supabase = useSupabaseClient()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('quick-setup')

  const stepDefinitions = useMemo<StepDefinition[]>(
    () => [
      { key: 'login', title: t('steps.login.title'), description: t('steps.login.description'), icon: faRightToBracket },
      { key: 'students', title: t('steps.students.title'), description: t('steps.students.description'), icon: faUsers },
      { key: 'profile', title: t('steps.profile.title'), description: t('steps.profile.description'), icon: faUserGear },
      { key: 'youtube', title: t('steps.youtube.title'), description: t('steps.youtube.description'), icon: faVideo },
      { key: 'completed', title: t('steps.completed.title'), description: t('steps.completed.description'), icon: faCheckCircle },
    ],
    [t]
  )

  const getStepIndex = useCallback((step: QuickSetupStep) => stepDefinitions.findIndex((entry) => entry.key === step), [stepDefinitions])

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
  const [studentMethodMarkdown, setStudentMethodMarkdown] = useState<StudentMethodMarkdownMap>(emptyStudentMethodMarkdown)
  const stepHeadingRef = useRef<HTMLDivElement | null>(null)
  const previousStepRef = useRef<QuickSetupStep>(currentStep)

  const loadMarkdownText = useCallback(
    async (filename: string) => {
      const requestedLocale = locale || 'ja'
      const localeCandidates = requestedLocale === 'ja' ? ['ja'] : [requestedLocale, 'ja']

      for (const localeCode of localeCandidates) {
        const response = await fetch(`/helps/${localeCode}/${filename}.md`, { cache: 'no-store' })
        if (response.ok) {
          return response.text()
        }
      }

      return ''
    },
    [locale]
  )

  const loadStepMarkdown = useCallback(async () => {
    const nextMarkdownEntries = await Promise.all(
      (Object.keys(QUICK_SETUP_MD_PATHS) as QuickSetupStep[]).map(async (stepKey) => [
        stepKey,
        await loadMarkdownText(QUICK_SETUP_MD_PATHS[stepKey]),
      ] as const)
    )

    const markdownMap = nextMarkdownEntries.reduce<StepMarkdownMap>((accumulator, [stepKey, markdown]) => {
      accumulator[stepKey] = markdown
      return accumulator
    }, { ...emptyStepMarkdown })

    setStepMarkdown(markdownMap)
  }, [loadMarkdownText])

  const loadStudentMethodMarkdown = useCallback(async () => {
    const nextMarkdownEntries = await Promise.all(
      (Object.keys(QUICK_SETUP_STUDENT_METHOD_MD_PATHS) as Array<Exclude<StudentAddMethod, null>>).map(
        async (methodKey) => [
          methodKey,
          await loadMarkdownText(QUICK_SETUP_STUDENT_METHOD_MD_PATHS[methodKey]),
        ] as const
      )
    )

    const markdownMap = nextMarkdownEntries.reduce<StudentMethodMarkdownMap>(
      (accumulator, [methodKey, markdown]) => {
        accumulator[methodKey] = markdown
        return accumulator
      },
      { ...emptyStudentMethodMarkdown }
    )

    setStudentMethodMarkdown(markdownMap)
  }, [loadMarkdownText])

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
    void loadStudentMethodMarkdown()
  }, [loadState, loadStepMarkdown, loadStudentMethodMarkdown])

  useEffect(() => {
    if (currentStep !== 'students') return undefined

    const intervalId = window.setInterval(() => {
      setStudentCount(getLocalStudentCount())
    }, 2000)

    return () => window.clearInterval(intervalId)
  }, [currentStep])

  useEffect(() => {
    if (loading) return

    if (previousStepRef.current === currentStep) {
      previousStepRef.current = currentStep
      return
    }

    previousStepRef.current = currentStep
    window.requestAnimationFrame(() => {
      stepHeadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [currentStep, loading])

  const loginDone = !!session || setupState.skipped.login
  const studentsDone = studentCount > 0 || setupState.skipped.students
  const requiresProfileUsername = !!session && username.trim().length === 0
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
    return Math.round((doneCount / stepDefinitions.length) * 100)
  }, [completionMap, stepDefinitions.length])

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
    setMoveDirection(getStepIndex(target) >= getStepIndex(currentStep) ? 'forward' : 'backward')
    setCurrentStep(target)
    setMessage(null)
  }

  const goNextStep = () => {
    const currentIndex = getStepIndex(currentStep)
    if (currentIndex < stepDefinitions.length - 1) {
      moveToStep(stepDefinitions[currentIndex + 1]!.key)
    }
  }

  const goPrevStep = () => {
    const currentIndex = getStepIndex(currentStep)
    if (currentIndex > 0) {
      moveToStep(stepDefinitions[currentIndex - 1]!.key)
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

  const handleDiscordSignIn = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    if (!origin) return

    setBusy(true)
    setMessage(null)
    const redirectTo = new URL('/auth/callback', origin)
    redirectTo.searchParams.set('next', '/quick-setup')

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: redirectTo.toString(),
      },
    })

    if (error) {
      setBusy(false)
      setMessage(t('messages.loginFailed', { message: error.message }))
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
      setMessage(t('messages.loginRequired'))
      return
    }
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      setMessage(t('messages.usernameInvalid'))
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

    setMessage(t('messages.profileSaved'))
    goNextStep()
  }

  const connectYouTube = async () => {
    if (!session) {
      setMessage(t('messages.loginRequired'))
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
      setMessage(t('messages.youtubeFailed', { message: error.message }))
      return
    }

    if (data.url) {
      window.location.assign(data.url)
      return
    }

    setBusy(false)
  }

  const currentStepDefinition = stepDefinitions[getStepIndex(currentStep)]!

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
              <h3 className="text-xl font-bold">{t('login.heading')}</h3>
            </div>
            <div className={markdownCardClass}>{renderStepMarkdown('login')}</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className={`${stepCardBaseClass} ${session ? 'cursor-default opacity-60' : 'border-blue-200 bg-white'}`}>
                <span className="text-xl font-bold">{t('login.googleTitle')}</span>
                <span className="mt-2 text-sm text-gray-600">{t('login.googleDescription')}</span>
                <div className="mt-4">
                  {session ? (
                    <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                      {t('login.googleDone')}
                    </div>
                  ) : (
                    <GoogleSignInButton
                      width={260}
                      theme="outline"
                      size="large"
                      text="continue_with"
                      className="inline-flex"
                    />
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={busy || !!session}
                onClick={() => void handleDiscordSignIn()}
                className={`${stepCardBaseClass} ${session ? 'cursor-default opacity-60' : 'border-indigo-200 bg-white'}`}
              >
                <FontAwesomeIcon icon={faDiscord} className="mb-4 text-4xl text-[#5865F2]" />
                <span className="text-xl font-bold">{t('login.discordTitle')}</span>
                <span className="mt-2 text-sm text-gray-600">{t('login.discordDescription')}</span>
              </button>
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-3xl border bg-white p-6">
            <div>
              <div className="flex items-center gap-3 text-green-600">
                <FontAwesomeIcon icon={faCheckCircle} className="text-2xl" />
                <h3 className="text-xl font-bold">{t('login.statusTitle')}</h3>
              </div>
              <p className="mt-4 text-base text-gray-700">
                {loginDone ? t('login.done') : t('login.pending')}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {!loginDone && (
                <button type="button" className="rounded-2xl border px-5 py-3 font-semibold" onClick={() => markSkipped('login')}>
                  {t('buttons.skip')}
                </button>
              )}
              {loginDone && (
                <button type="button" className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white" onClick={goNextStep}>
                  {t('buttons.nextStep')}
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }

    if (currentStep === 'students') {
      const selectedMethodMarkdownText = selectedMethod ? studentMethodMarkdown[selectedMethod] : ''

      return (
        <div className="space-y-6">
          <div className="rounded-3xl bg-slate-50 p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <FontAwesomeIcon icon={faUsers} className="text-2xl" />
              <h3 className="text-xl font-bold">{t('students.heading')}</h3>
            </div>
            <p className="mt-4 text-base leading-7 text-gray-700">
              {t('students.description')}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedMethod('image')}
              className={`${stepCardBaseClass} min-h-60 ${selectedMethod === 'image' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 bg-white'}`}
            >
              <FontAwesomeIcon icon={faCamera} className="mb-5 text-5xl text-blue-500" />
              <span className="text-2xl font-bold">{t('students.imageTitle')}</span>
              <span className="mt-3 text-base leading-7 text-gray-600">
                {t('students.imageDescription')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedMethod('schaledb')}
              className={`${stepCardBaseClass} min-h-60 ${selectedMethod === 'schaledb' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-gray-200 bg-white'}`}
            >
              <FontAwesomeIcon icon={faCloudArrowUp} className="mb-5 text-5xl text-emerald-500" />
              <span className="text-2xl font-bold">{t('students.schaledbTitle')}</span>
              <span className="mt-3 text-base leading-7 text-gray-600">
                {t('students.schaledbDescription')}
              </span>
            </button>
          </div>

          {selectedMethod && (
            <div
              className={`rounded-3xl border p-6 ${
                selectedMethod === 'image' ? 'border-blue-200 bg-white' : 'border-emerald-200 bg-white'
              }`}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className={`flex items-center gap-3 ${selectedMethod === 'image' ? 'text-blue-700' : 'text-emerald-700'}`}>
                  <FontAwesomeIcon
                    icon={selectedMethod === 'image' ? faCamera : faCloudArrowUp}
                    className="text-2xl"
                  />
                  <h3 className="text-xl font-bold">
                    {selectedMethod === 'image' ? t('students.imageSectionTitle') : t('students.schaledbSectionTitle')}
                  </h3>
                </div>
              </div>

              {selectedMethodMarkdownText && (
                <div className={markdownCardClass}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {selectedMethodMarkdownText}
                  </ReactMarkdown>
                </div>
              )}

              <div className="mt-6 rounded-3xl border border-dashed border-gray-200 p-4 md:p-6">
                <StudentImportContent
                  mode={selectedMethod === 'schaledb' ? 'schale' : 'image'}
                  showHeader={false}
                  onSaved={() => {
                    setStudentCount(getLocalStudentCount())
                    if (session) {
                      void loadState()
                    }
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-white p-6">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faCircleUser} className="text-2xl text-slate-500" />
              <div>
                <p className="text-sm text-gray-500">{t('students.currentStatus')}</p>
                <p className="text-xl font-bold">{t('students.registeredCount', { count: studentCount })}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {!studentsDone && (
                <button type="button" className="rounded-2xl border px-5 py-3 font-semibold" onClick={() => markSkipped('students')}>
                  {t('buttons.skip')}
                </button>
              )}
              {(studentsDone || selectedMethod !== null) && (
                <button type="button" className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white" onClick={goNextStep}>
                  {t('buttons.nextStep')}
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
              <h3 className="text-xl font-bold">{t('profile.heading')}</h3>
            </div>
            <div className={markdownCardClass}>{renderStepMarkdown('profile')}</div>
            {!session && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {t('profile.loginRequired')}{' '}
                <button type="button" className="font-semibold underline" onClick={() => moveToStep('login')}>
                  {t('buttons.loginAgain')}
                </button>
              </div>
            )}
          </div>
          {session ? (
            <div className="rounded-3xl border bg-white p-6">
              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="font-semibold">{t('profile.username')}<span className="ml-1 text-red-600">*</span></span>
                  <input
                    className="rounded-2xl border px-4 py-3"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder={t('profile.usernamePlaceholder')}
                    required
                    aria-required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="font-semibold">{t('profile.nickname')}</span>
                  <input
                    className="rounded-2xl border px-4 py-3"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder={t('profile.nicknamePlaceholder')}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="font-semibold">{t('profile.bio')}</span>
                  <textarea
                    className="min-h-32 rounded-2xl border px-4 py-3"
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder={t('profile.bioPlaceholder')}
                  />
                </label>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
                  disabled={busy || requiresProfileUsername}
                  onClick={() => void saveProfile()}
                >
                  {t('buttons.saveAndNext')}
                </button>
                {!profileDone && !requiresProfileUsername && (
                  <button type="button" className="rounded-2xl border px-5 py-3 font-semibold" onClick={() => markSkipped('profile')}>
                    {t('buttons.skip')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border bg-white p-6">
              <p className="text-base leading-7 text-gray-700">
                {t('profile.availableAfterLogin')}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" className="rounded-2xl border px-5 py-3 font-semibold" onClick={() => moveToStep('login')}>
                  {t('buttons.backToLogin')}
                </button>
                {!profileDone && (
                  <button type="button" className="rounded-2xl border px-5 py-3 font-semibold" onClick={() => markSkipped('profile')}>
                    {t('buttons.skip')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )
    }

    if (currentStep === 'youtube') {
      return (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-4 rounded-3xl bg-red-50 p-6">
            <div className="flex items-center gap-3 text-red-700">
              <FontAwesomeIcon icon={faYoutube} className="text-3xl" />
              <h3 className="text-xl font-bold">{t('youtube.heading')}</h3>
            </div>
            <div className={markdownCardClass}>{renderStepMarkdown('youtube')}</div>
            {!session && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {t('youtube.loginRequired')}{' '}
                <button type="button" className="font-semibold underline" onClick={() => moveToStep('login')}>
                  {t('buttons.loginAgain')}
                </button>
              </div>
            )}
          </div>
          {session ? (
            <div className="rounded-3xl border bg-white p-6">
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={youtubeDone ? faCheckCircle : faYoutube} className={`text-3xl ${youtubeDone ? 'text-green-600' : 'text-red-500'}`} />
                <div>
                  <p className="text-sm text-gray-500">{t('youtube.statusLabel')}</p>
                  <p className="text-2xl font-bold">{youtubeDone ? t('youtube.connected') : t('youtube.disconnected')}</p>
                </div>
              </div>
              <p className="mt-5 text-base leading-7 text-gray-700">
                {t('youtube.description')}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {!youtubeDone && (
                  <button
                    type="button"
                    className="rounded-2xl bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void connectYouTube()}
                  >
                    {t('buttons.connectYoutube')}
                  </button>
                )}
                {!youtubeDone && (
                  <button type="button" className="rounded-2xl border px-5 py-3 font-semibold" onClick={() => markSkipped('youtube')}>
                    {t('buttons.skip')}
                  </button>
                )}
                {youtubeDone && (
                  <button type="button" className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white" onClick={goNextStep}>
                    {t('buttons.nextStep')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border bg-white p-6">
              <p className="text-base leading-7 text-gray-700">
                {t('youtube.availableAfterLogin')}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" className="rounded-2xl border px-5 py-3 font-semibold" onClick={() => moveToStep('login')}>
                  {t('buttons.backToLogin')}
                </button>
                {!youtubeDone && (
                  <button type="button" className="rounded-2xl border px-5 py-3 font-semibold" onClick={() => markSkipped('youtube')}>
                    {t('buttons.skip')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-4 rounded-3xl bg-green-50 p-6">
          <div className="flex items-center gap-3 text-green-700">
            <FontAwesomeIcon icon={faCheckCircle} className="text-3xl" />
            <h3 className="text-2xl font-bold">{t('completed.heading')}</h3>
          </div>
          <div className={markdownCardClass}>{renderStepMarkdown('completed')}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {stepDefinitions.map((step) => (
              <div key={step.key} className="rounded-2xl border bg-white p-4">
                <div className="flex items-center gap-3">
                  <FontAwesomeIcon icon={step.icon} className={`text-lg ${completionMap[step.key] ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="font-semibold">{step.title}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{completionMap[step.key] ? t('completed.done') : t('completed.pending')}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border bg-white p-6">
          <p className="text-sm text-gray-500">{t('completed.finalActionLabel')}</p>
          <p className="mt-2 text-xl font-bold">{t('completed.finalActionTitle')}</p>
          <p className="mt-3 text-base leading-7 text-gray-700">
            {t('completed.finalActionDescription')}
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
                {t('buttons.complete')}
              </button>
            )}
            <Link href="/" className="rounded-2xl border px-5 py-3 font-semibold">
              {t('buttons.backHome')}
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
          <span>{t('loading')}</span>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
      <section className="overflow-hidden rounded-[2rem] border bg-white p-5 shadow-sm md:p-6">
        <div className="mb-4">
          <p className="text-sm text-gray-500">{t('progress')}</p>
          <h2 className="text-xl font-bold">{currentStepDefinition.title}</h2>
        </div>

        <div className="rounded-2xl border border-blue-500 bg-blue-50 p-4 shadow-sm">
          <button
            type="button"
            onClick={() => moveToStep(currentStepDefinition.key)}
            className="flex min-h-20 w-full items-center gap-3 text-left"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
              <FontAwesomeIcon icon={currentStepDefinition.icon} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{t('stepLabel', { step: getStepIndex(currentStepDefinition.key) + 1 })}</p>
              <p className="font-semibold leading-tight break-words">{currentStepDefinition.title}</p>
            </div>
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <div className="relative h-5 overflow-hidden rounded-full bg-gray-100">
            <div className="absolute inset-0 grid grid-cols-5 gap-px px-1 py-1">
              {stepDefinitions.map((step) => (
                <div key={step.key} className="rounded-full bg-white/80" />
              ))}
            </div>
            <div className="absolute inset-y-1 left-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300" style={{ width: progress === 0 ? '0%' : `calc(${progress}% - 0.5rem)` }} />
          </div>
          <div className="grid grid-cols-5 gap-2 text-[10px] font-semibold text-gray-500 sm:text-[11px]">
            {stepDefinitions.map((step) => (
              <span key={step.key} className="min-w-0 break-words text-center leading-tight">
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


      <section
        key={currentStep}
        className={`overflow-hidden rounded-[2rem] border bg-white p-5 shadow-sm transition-all duration-300 md:p-8 ${moveDirection === 'forward' ? 'animate-[slideInRight_0.28s_ease-out]' : 'animate-[slideInLeft_0.28s_ease-out]'}`}
      >
        <div ref={stepHeadingRef} className="mb-6 flex items-center gap-4 border-b pb-5">
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

      <section className="overflow-hidden rounded-[2rem] border bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={goPrevStep}
            disabled={currentStep === 'login'}
            className="rounded-2xl border px-4 py-3 font-semibold disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
            {t('buttons.back')}
          </button>
          {completionMap[currentStep] && currentStep !== 'completed' && (
            <button
              type="button"
              onClick={goNextStep}
              className="rounded-2xl border px-4 py-3 font-semibold"
            >
              {t('buttons.next')}
              <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
            </button>
          )}
        </div>
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
