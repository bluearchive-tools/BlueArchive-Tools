'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'
import type { UserIdentity } from '@supabase/supabase-js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDiscord, faGoogle, faXTwitter } from '@fortawesome/free-brands-svg-icons'
import { faEye, faEyeSlash, faLink, faLock, faUnlink, faUserCheck, faUserCircle } from '@fortawesome/free-solid-svg-icons'
import students from '../data/students.json'
import FriendCodeCopy from './FriendCodeCopy'
import DecorationInfoButton from './DecorationInfoButton'
import { colord } from 'colord'
import { useTheme } from './ThemeProvider'
import { useLocale } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SUPPORTED_LOCALES, parseLocale, type Locale } from '../lib/i18n/config'
import { stripLeadingLocale } from '../lib/i18n/utils'
import {
  defaultShortcuts,
  TL_MAKER_SHORTCUT_CATEGORIES,
  TL_MAKER_SHORTCUT_STORAGE_KEY,
  type TlMakerShortcutSettings,
} from '../lib/tl-maker-shortcuts'

interface Props {
  initialUsername: string | null
  initialNickname: string | null
  initialEmail: string | null
  initialLevel: number | null
  initialBio: string | null
  initialIconStudentId: string | null
  initialFriendCode: string | null
  initialFriendCodePublic: boolean | null
  initialSocialLinks: unknown
  initialTlDefaults: unknown
  initialDecorationIds: string[]
  initialDecorationInventory: string[]
  initialDecorations: {
    id: string
    name: string
    emoji: string
    description?: string
    price?: number
    style?: string
    genre?: string
    tags?: string[]
    background_color?: string | null
    text_color?: string | null
    font_family?: string | null
  }[]
}


type SocialService = 'x' | 'youtube' | 'bilibili' | 'other'
type SocialLink = {
  service: SocialService
  label: string
  value: string
  verified?: boolean
  verifiedAt?: string | null
  autoFormationStatus?: boolean
  channelId?: string | null
  channelTitle?: string | null
  channelHandle?: string | null
  xUserId?: string | null
  xUsername?: string | null
  xName?: string | null
  biliUid?: string | null
  biliName?: string | null
  biliAvatar?: string | null
}

type TlDefaultSettings = {
  includeSquad: boolean
  allowTl: boolean
  visibility: 'public' | 'restricted' | 'private'
  allowedUserIds: string[]
  hideTlUntilYoutube: boolean
  formationCardStyle: 'student-image' | 'compact'
}

const detectIsMacPlatform = () => {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
}

const defaultSearchShortcut = (preferMeta: boolean) => (preferMeta ? 'Cmd+K' : 'Ctrl+K')

const SEARCH_SHORTCUT_STORAGE_KEY = 'app:searchShortcut'
const HELP_SHORTCUT_STORAGE_KEY = 'app:helpShortcut'
const TL_DEFAULT_SETTINGS_STORAGE_KEY = 'app:tlDefaultSettings'
const defaultHelpShortcut = (preferMeta: boolean) => (preferMeta ? 'Cmd+/' : 'Ctrl+/')

const formatShortcutFromEvent = (event: ReactKeyboardEvent<HTMLInputElement>) => {
  const key = event.key
  if (key === 'Backspace' || key === 'Delete') return ''
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(key)) return null
  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.metaKey) parts.push('Cmd')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  const label =
    key.length === 1 ? key.toUpperCase() : `${key.slice(0, 1).toUpperCase()}${key.slice(1)}`
  parts.push(label)
  return parts.join('+')
}

const detectSocialService = (label: string): SocialService => {
  const s = label.trim().toLowerCase()
  if (!s) return 'other'
  if (s === 'x' || s.includes('twitter')) return 'x'
  if (s.includes('youtube')) return 'youtube'
  if (s.includes('bilibili') || s.includes('bili') || s.includes('b站')) return 'bilibili'
  return 'other'
}

const socialLabel = (service: SocialService, customLabel: string) => {
  if (service === 'x') return 'X'
  if (service === 'youtube') return 'YouTube'
  if (service === 'bilibili') return 'Bilibili'
  return customLabel.trim() || 'その他'
}

const socialPlaceholder = (service: SocialService) => {
  if (service === 'x') return '例: @username / https://x.com/...'
  if (service === 'youtube') return '例: https://www.youtube.com/@...'
  if (service === 'bilibili') return '例: https://space.bilibili.com/123456 / UID'
  return 'リンクやID'
}

const parseAllowedIdentifiers = (raw: string) =>
  raw
    .split(/[\n,]+/)
    .map((v) => v.trim())
    .filter(Boolean)

const normalizeTlDefaults = (raw: unknown): TlDefaultSettings => {
  const defaults: TlDefaultSettings = {
    includeSquad: true,
    allowTl: true,
    visibility: 'public',
    allowedUserIds: [],
    hideTlUntilYoutube: true,
    formationCardStyle: 'student-image',
  }
  if (!raw) return defaults
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return defaults
    }
  }
  if (!parsed || typeof parsed !== 'object') return defaults
  const obj = parsed as Record<string, unknown>
  return {
    includeSquad: typeof obj.includeSquad === 'boolean' ? obj.includeSquad : defaults.includeSquad,
    allowTl: typeof obj.allowTl === 'boolean' ? obj.allowTl : defaults.allowTl,
    visibility:
      obj.visibility === 'public' || obj.visibility === 'restricted' || obj.visibility === 'private'
        ? obj.visibility
        : defaults.visibility,
    allowedUserIds: Array.isArray(obj.allowedUserIds)
      ? (obj.allowedUserIds as string[]).filter(Boolean)
      : defaults.allowedUserIds,
    hideTlUntilYoutube:
      typeof obj.hideTlUntilYoutube === 'boolean' ? obj.hideTlUntilYoutube : defaults.hideTlUntilYoutube,
    formationCardStyle:
      obj.formationCardStyle === 'compact' || obj.formationCardStyle === 'student-image'
        ? obj.formationCardStyle
        : defaults.formationCardStyle,
  }
}

const isYouTubeNetworkBlocked = (err: unknown) => {
  if (err instanceof TypeError) return true
  if (err instanceof Error) {
    return /failed to fetch|networkerror|load failed|blocked/i.test(err.message)
  }
  return false
}

type SerializedSocialLink = {
  service: SocialService
  label: string
  value: string
  verified: boolean
  verifiedAt: string | null
  autoFormationStatus: boolean
  channelId: string | null
  channelTitle: string | null
  channelHandle: string | null
  xUserId: string | null
  xUsername: string | null
  xName: string | null
  biliUid: string | null
  biliName: string | null
  biliAvatar: string | null
}

/**
 * 保存用:
 * - X/YouTube は value が空でも保持（後で入力・認証できるようにする）
 * - その他 は (サービス名 or URL) が空なら保存しない
 */
const serializeSocialLinksForSave = (links: SocialLink[]): SerializedSocialLink[] => {
  const mapped = links.map((link) => {
    const trimmedLabel = link.label.trim()
    const trimmedValue = link.value.trim()
    const displayLabel = socialLabel(link.service, trimmedLabel)

    if (link.service === 'other') {
      if (!trimmedLabel && !trimmedValue) return null
    }
    if (link.service === 'bilibili' && !trimmedValue) {
      return null
    }

    return {
      service: link.service,
      label: displayLabel,
      value: link.value,
      verified: link.verified ?? false,
      verifiedAt: link.verifiedAt ?? null,
      autoFormationStatus: link.autoFormationStatus ?? false,
      channelId: link.channelId ?? null,
      channelTitle: link.channelTitle ?? null,
      channelHandle: link.channelHandle ?? null,
      xUserId: link.xUserId ?? null,
      xUsername: link.xUsername ?? null,
      xName: link.xName ?? null,
      biliUid: link.biliUid ?? null,
      biliName: link.biliName ?? null,
      biliAvatar: link.biliAvatar ?? null,
    } satisfies SerializedSocialLink
  })

  return mapped.filter((x): x is SerializedSocialLink => x !== null)
}

/**
 * 表示用（プレビューなど）:
 * - X/YouTube は URL が空なら表示しない（認証情報があれば表示OK）
 * - その他 は (サービス名 or URL) があれば表示
 */
const filterSocialLinksForDisplay = (links: SerializedSocialLink[]): SerializedSocialLink[] => {
  return links.filter((link) => {
    const hasValue = link.value.trim().length > 0
    if (link.service === 'other') {
      return link.label.trim().length > 0 || hasValue
    }
    return hasValue || link.verified
  })
}

const mergeVerifiedSocialLinks = (
  current: SerializedSocialLink[],
  existing: SerializedSocialLink[]
): SerializedSocialLink[] => {
  const hasService = new Set(current.map((link) => link.service))
  const missingVerified = existing.filter(
    (link) =>
      link.verified &&
      (link.service === 'youtube' || link.service === 'x' || link.service === 'bilibili') &&
      !hasService.has(link.service)
  )
  if (missingVerified.length === 0) return current
  return [...current, ...missingVerified]
}


export default function MyPageClient({
  initialUsername,
  initialNickname,
  initialEmail,
  initialLevel,
  initialBio,
  initialIconStudentId,
  initialFriendCode,
  initialFriendCodePublic,
  initialSocialLinks,
  initialTlDefaults,
  initialDecorationIds,
  initialDecorationInventory,
  initialDecorations
}: Props) {
  const supabase = useSupabaseClient()
  const session = useSession()
  const isLoggedIn = !!session?.user
  const [username, setUsername] = useState(initialUsername ?? '')
  const [nickname, setNickname] = useState(initialNickname ?? '')
  const email = initialEmail ?? ''
  const [level, setLevel] = useState<number | ''>(initialLevel ?? '')
  const [bio, setBio] = useState(initialBio ?? '')
  const [iconStudentId, setIconStudentId] = useState(initialIconStudentId ?? '')
  const [friendCode, setFriendCode] = useState(initialFriendCode ?? '')
  const [friendCodePublic, setFriendCodePublic] = useState<boolean>(initialFriendCodePublic ?? false)
  const [decorationIds, setDecorationIds] = useState<string[]>(initialDecorationIds ?? [])
  const [decorationInventory] = useState<string[]>(initialDecorationInventory ?? [])
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(
    (() => {
      try {
        const parsed: unknown = (() => {
          if (!initialSocialLinks) return []
          if (typeof initialSocialLinks === 'string') {
            try {
              return JSON.parse(initialSocialLinks) as unknown
            } catch {
              return []
            }
          }
          return initialSocialLinks
        })()
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((raw) => {
              const r = raw as Record<string, unknown> | null
              const label = typeof r?.label === 'string' ? (r.label as string) : ''
              const value = typeof r?.value === 'string' ? (r.value as string) : ''
              const serviceRaw = typeof r?.service === 'string' ? (r.service as string) : null
              const service: SocialService =
                serviceRaw === 'x' || serviceRaw === 'youtube' || serviceRaw === 'bilibili' || serviceRaw === 'other'
                  ? (serviceRaw as SocialService)
                  : detectSocialService(label)

              const verified = typeof r?.verified === 'boolean' ? (r.verified as boolean) : undefined
              const verifiedAt = typeof r?.verifiedAt === 'string' ? (r.verifiedAt as string) : null
              const autoFormationStatus =
                typeof r?.autoFormationStatus === 'boolean' ? (r.autoFormationStatus as boolean) : false
              const channelId = typeof r?.channelId === 'string' ? (r.channelId as string) : null
              const channelTitle = typeof r?.channelTitle === 'string' ? (r.channelTitle as string) : null
              const channelHandle = typeof r?.channelHandle === 'string' ? (r.channelHandle as string) : null
              const xUserId = typeof r?.xUserId === 'string' ? (r.xUserId as string) : null
              const xUsername = typeof r?.xUsername === 'string' ? (r.xUsername as string) : null
              const xName = typeof r?.xName === 'string' ? (r.xName as string) : null
              const biliUid = typeof r?.biliUid === 'string' ? (r.biliUid as string) : null
              const biliName = typeof r?.biliName === 'string' ? (r.biliName as string) : null
              const biliAvatar = typeof r?.biliAvatar === 'string' ? (r.biliAvatar as string) : null

              return {
                service,
                label: service === 'other' ? label : '',
                value,
                verified,
                verifiedAt,
                autoFormationStatus,
                channelId,
                channelTitle,
                channelHandle,
                xUserId,
                xUsername,
                xName,
                biliUid,
                biliName,
                biliAvatar,
              } satisfies SocialLink
            })
            .filter((item) =>
              item.service === 'other'
                ? item.label.trim() || item.value.trim()
                : item.value.trim() || !!item.verified
            )

          if (normalized.length > 0) return normalized
        }
      } catch {
        /* ignore */
      }
      return [{ service: 'other', label: '', value: '' }]
    })()
  )
  const [tlDefaults, setTlDefaults] = useState<TlDefaultSettings>(
    () => normalizeTlDefaults(initialTlDefaults)
  )

  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [busy, setBusy] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingSocial, setSavingSocial] = useState(false)
  const [savingEnvironment, setSavingEnvironment] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Array<{ id: number; text: string }>>([])
  const [showUserId, setShowUserId] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [showUnowned, setShowUnowned] = useState(false)
  const [activeSection, setActiveSection] = useState<
    'profile' | 'social' | 'account' | 'youtube' | 'links' | 'header' | 'shortcuts' | 'data'
  >('profile')
  const [makerShortcuts, setMakerShortcuts] = useState<TlMakerShortcutSettings>(() =>
    defaultShortcuts(detectIsMacPlatform())
  )
  const [searchShortcut, setSearchShortcut] = useState(() =>
    defaultSearchShortcut(detectIsMacPlatform())
  )
  const [helpShortcut, setHelpShortcut] = useState(() =>
    defaultHelpShortcut(detectIsMacPlatform())
  )
  const [delUser, setDelUser] = useState(false)
  const [delTheme, setDelTheme] = useState(false)
  const [delNotice, setDelNotice] = useState(false)
  const [delOpts, setDelOpts] = useState(false)
  const [delSync, setDelSync] = useState(false)
  const [delSquad, setDelSquad] = useState(false)
  const [delTL, setDelTL] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)
  const [confirmActive, setConfirmActive] = useState(false)
  const [confirmStep, setConfirmStep] = useState<'first' | 'second'>('first')
  const profileRef = useRef<HTMLElement | null>(null)
  const socialRef = useRef<HTMLElement | null>(null)
  const accountRef = useRef<HTMLElement | null>(null)
  const linksRef = useRef<HTMLElement | null>(null)
  const youtubeRef = useRef<HTMLElement | null>(null)
  const headerRef = useRef<HTMLElement | null>(null)
  const shortcutRef = useRef<HTMLElement | null>(null)

  const isSectionLocked = useCallback(
    (section: typeof activeSection) =>
      !isLoggedIn && section !== 'header' && section !== 'shortcuts' && section !== 'data',
    [isLoggedIn]
  )

  useEffect(() => {
    if (typeof window === 'undefined' || isLoggedIn) return
    try {
      const raw = window.localStorage.getItem(TL_DEFAULT_SETTINGS_STORAGE_KEY)
      if (!raw) return
      setTlDefaults(normalizeTlDefaults(raw))
    } catch {
      /* ignore */
    }
  }, [isLoggedIn])

  const handleSectionChange = useCallback(
    (section: typeof activeSection) => {
      if (isSectionLocked(section)) return
      setActiveSection(section)
    },
    [isSectionLocked]
  )

  const { dark, toggle } = useTheme()
  const isMacPlatform = useMemo(() => detectIsMacPlatform(), [])
  const makerShortcutDefaults = useMemo(() => defaultShortcuts(isMacPlatform), [isMacPlatform])
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!isLoggedIn && activeSection !== 'header' && activeSection !== 'shortcuts' && activeSection !== 'data') {
      setActiveSection('header')
    }
  }, [isLoggedIn, activeSection])

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
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?next=/mypage` : undefined
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
      discord: faDiscord,
      twitter: faXTwitter,
      x: faXTwitter,
    }),
    []
  )

  const identityEmail = (identity: UserIdentity) => {
    const raw = (identity.identity_data as Record<string, unknown> | undefined)?.email
    return typeof raw === 'string' ? raw : null
  }

  const linkedProviders = new Set(identities.map((id) => id.provider))
  const youtubeIndex = useMemo(
    () => socialLinks.findIndex((link) => link.service === 'youtube'),
    [socialLinks]
  )
  const youtubeLink = youtubeIndex >= 0 ? socialLinks[youtubeIndex] : null
  const isGoogleLinked = linkedProviders.has('google')
  const isXLinked = linkedProviders.has('x') || linkedProviders.has('twitter')

  const renderVerifiedBadge = () => (
    <span className="relative inline-flex items-center group">
      <FontAwesomeIcon icon={faUserCheck} className="text-green-600" />
      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-max -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition group-hover:opacity-100">
        本人認証済み
        <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-gray-900" />
      </span>
    </span>
  )

  const selectedStudent = useMemo(() => students.find((s) => s.id === iconStudentId), [iconStudentId])
  const selectedDecorations = useMemo(() => {
    const byGenre = new Map<string, (typeof initialDecorations)[number]>()
    initialDecorations.forEach((d) => {
      if (!decorationIds.includes(d.id)) return
      const key = d.genre ?? d.id
      if (!byGenre.has(key)) byGenre.set(key, d)
    })
    return Array.from(byGenre.values())
  }, [decorationIds, initialDecorations])
  const hasRedFrame = useMemo(
    () => selectedDecorations.some((d) => d.style === 'red-gradient'),
    [selectedDecorations]
  )
  const backgroundDecoration = useMemo(
    () =>
      selectedDecorations.find(
        (d) => d.background_color || d.style === 'aurora-gradient' || d.style === 'sunset-gradient' || d.genre === '背景'
      ),
    [selectedDecorations]
  )
  const fontDecoration = useMemo(() => selectedDecorations.find((d) => d.font_family), [selectedDecorations])
  const textColor =
    backgroundDecoration?.style === 'aurora-gradient' || backgroundDecoration?.style === 'sunset-gradient'
      ? backgroundDecoration.text_color ?? '#F8FAFC'
      : backgroundDecoration?.background_color
        ? (() => {
          const parsed = colord(backgroundDecoration.background_color)
          return parsed.isValid() ? (parsed.isLight() ? '#111827' : '#F9FAFB') : undefined
        })()
        : undefined
  const previewStyle =
    backgroundDecoration?.style === 'aurora-gradient'
      ? { backgroundImage: 'linear-gradient(120deg, #0ea5e9, #8b5cf6, #22d3ee)', backgroundSize: '200% 200%', animation: 'ba-aurora 12s ease infinite' }
      : backgroundDecoration?.style === 'sunset-gradient'
        ? { backgroundImage: 'linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)', backgroundSize: '200% 200%', animation: 'ba-sunset 10s ease infinite' }
        : backgroundDecoration?.background_color
          ? { background: backgroundDecoration.background_color }
          : {}
  const fieldStyle = {
    background: backgroundDecoration?.background_color ?? previewStyle.background ?? undefined,
    backgroundImage: previewStyle.backgroundImage,
    backgroundSize: previewStyle.backgroundSize,
    animation: previewStyle.animation,
    color: textColor ?? undefined,
    borderColor: textColor ? 'rgba(255,255,255,0.35)' : undefined,
  }
  const frameDecoration = useMemo(
    () =>
      selectedDecorations.find(
        (d) => d.genre === 'フレーム' || d.style === 'red-gradient' || d.style === 'aurora-frame' || d.style === 'sunset-frame'
      ),
    [selectedDecorations]
  )

  const decorationsByGenre = useMemo(() => {
    const map = new Map<string, (typeof initialDecorations)[number][]>()
    initialDecorations.forEach((d) => {
      if (!showUnowned && !decorationInventory.includes(d.id)) return
      const genre = d.genre ?? 'その他'
      if (!map.has(genre)) map.set(genre, [])
      map.get(genre)!.push(d)
    })
    return Array.from(map.entries())
  }, [initialDecorations, decorationInventory, showUnowned])

  const toggleDecoration = (itemId: string) => {
    const item = initialDecorations.find((d) => d.id === itemId)
    if (!item) return
    if (!decorationInventory.includes(itemId)) return
    const key = item.genre ?? item.id
    setDecorationIds((prev) => {
      const filtered = prev.filter((id) => {
        const current = initialDecorations.find((d) => d.id === id)
        const currentKey = current?.genre ?? current?.id
        return currentKey !== key
      })
      const alreadySelected = prev.includes(itemId)
      return alreadySelected ? filtered : [...filtered, itemId]
    })
  }

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

  const youtubeScope = 'https://www.googleapis.com/auth/youtube.readonly'
  const YT_VERIFY_LS_KEY = 'ba:yt_verify_pending'
  type YtVerifyPending = { value: string; startedAt: number; index?: number }
  const ytPendingRef = useRef<YtVerifyPending | null>(null)


  const startYouTubeVerify = async (index: number) => {
    const link = socialLinks[index]
    if (!link || link.service !== 'youtube') return

    setBusy(true)
    setMessage(null)

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const redirectTo = (() => {
      if (!origin) return undefined
      const url = new URL('/auth/callback', origin)
      url.searchParams.set('next', '/mypage')
      url.searchParams.set('yt_verify', String(index))
      return url.toString()
    })()

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        YT_VERIFY_LS_KEY,
        JSON.stringify({ value: link.value, startedAt: Date.now(), index } satisfies YtVerifyPending)
      )
    }

    try {
      const { data: userData } = await supabase.auth.getUser()
      const identities = userData.user?.identities ?? []
      const hasGoogleIdentity = identities.some((i) => i.provider === 'google')

      const queryParams = {
        prompt: 'consent',
        access_type: 'offline',
        include_granted_scopes: 'true',
      } as const

      if (hasGoogleIdentity) {
        // すでに Google と紐付いている場合は「再認証」でスコープ追加（linkIdentity すると identity_already_exists になり得る）
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            scopes: youtubeScope,
            queryParams,
          },
        })

        if (error) {
          console.error(error.message)
          setMessage(`YouTube 連携に失敗しました: ${error.message}`)
          return
        }
        if (data?.url) window.location.assign(data.url)
        return
      }

      // Google 未紐付けの場合は linkIdentity で接続
      const { data, error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo,
          scopes: youtubeScope,
          queryParams,
        },
      })

      if (error) {
        console.error(error.message)
        setMessage(`YouTube 連携に失敗しました: ${error.message}`)
        return
      }
      if (data?.url) window.location.assign(data.url)
    } finally {
      setBusy(false)
    }
  }

  const startXVerify = async (index: number) => {
    const link = socialLinks[index]
    if (!link || link.service !== 'x') return

    setBusy(true)
    setMessage(null)

    const origin = typeof window !== 'undefined' ? window.location.origin : ''

    // Debug: Check which project we are talking to
    const checkUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    console.log('[startXVerify] Target Supabase URL:', checkUrl)

    const redirectTo = origin
      ? (() => {
        const url = new URL('/auth/callback', origin)
        url.searchParams.set('next', '/mypage')
        url.searchParams.set('x_verify', String(index))
        // Pass the handle the user entered to verify against the authenticated user
        url.searchParams.set('x_handle_check', link.value.trim())
        return url.toString()
      })()
      : undefined

    try {
      const { data: userData } = await supabase.auth.getUser()
      const isSignedIn = !!userData.user

      // If already signed in, link identity
      if (isSignedIn) {
        const { data, error } = await supabase.auth.linkIdentity({ provider: 'x' })
        if (error) throw error
        if (data?.url && typeof window !== 'undefined') {
          const u = new URL(data.url)
          if (redirectTo) u.searchParams.set('redirect_to', redirectTo)
          window.location.assign(u.toString())
          return
        }
      }

      // Otherwise, generic sign in (though usually for verification we assume they are logged in or will log in)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'x',
        options: {
          // clean redirect URL: Remove params to satisfy strict X validation
          redirectTo: `${origin}/auth/callback`,
        },
      })

      if (error) throw error
      if (data?.url && typeof window !== 'undefined') {
        window.location.assign(data.url)
        return
      }

      setMessage('Xの認証URLが取得できませんでした。')
    } catch (e) {
      console.error('startXVerify failed', e)
      setMessage('Xの認証が開始できませんでした。もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  const startBilibiliVerify = (index: number) => {
    const link = socialLinks[index]
    if (!link || link.service !== 'bilibili') return
    setMessage(null)
    setBusy(true)
    if (typeof window !== 'undefined') {
      window.location.assign(`/auth/bilibili/start?index=${index}`)
    }
  }

  const extractYouTubeTarget = (

    raw: string
  ): { kind: 'channelId' | 'handle' | 'username' | null; value: string } => {
    const s = raw.trim()

    const ch = s.match(/(UC[A-Za-z0-9_-]{16,})/)
    if (ch?.[1]) return { kind: 'channelId', value: ch[1] }

    const h1 = s.match(/\/@([A-Za-z0-9._-]{3,})/)
    if (h1?.[1]) return { kind: 'handle', value: h1[1] }

    const h2 = s.match(/^@([A-Za-z0-9._-]{3,})$/)
    if (h2?.[1]) return { kind: 'handle', value: h2[1] }

    const u = s.match(/youtube\.com\/user\/([^/?#]+)/i)
    if (u?.[1]) return { kind: 'username', value: u[1] }

    return { kind: null, value: '' }
  }
  type YouTubeChannelItem = { id?: string; snippet?: { title?: string; customUrl?: string } }
  type YouTubeChannelsResponse = { items?: YouTubeChannelItem[] }

  const getGoogleErrorMessage = (json: unknown): string | null => {
    if (!json || typeof json !== 'object') return null
    const obj = json as Record<string, unknown>
    const err = obj['error']
    if (!err || typeof err !== 'object') return null
    const eobj = err as Record<string, unknown>
    const msg = eobj['message']
    return typeof msg === 'string' ? msg : null
  }

  const fetchYouTube = async (url: string, token: string): Promise<YouTubeChannelsResponse> => {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const json: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const detail = getGoogleErrorMessage(json) ?? (json ? JSON.stringify(json) : res.statusText)
      throw new Error(detail)
    }
    return json as YouTubeChannelsResponse
  }

  const resolveUserId = useCallback(async (): Promise<string | null> => {
    if (session?.user?.id) return session.user.id
    const { data: userData, error } = await supabase.auth.getUser()
    if (error) {
      console.error(error.message)
      return null
    }
    return userData.user?.id ?? null
  }, [session, supabase])

  const verifyYouTubeAtIndex = useCallback(async (index: number) => {
    const link = socialLinks[index]
    if (!link || link.service !== 'youtube') return

    const target = extractYouTubeTarget(link.value)

    setBusy(true)
    setMessage(null)

    try {
      const userId = await resolveUserId()
      if (!userId) {
        setMessage('ユーザー情報を取得できませんでした。再ログインしてお試しください。')
        return
      }

      const { data } = await supabase.auth.getSession()
      const token = data.session?.provider_token
      if (!token) {
        setMessage('YouTube と接続してから更新してください（「接続する」）')
        return
      }

      const mineJson = await fetchYouTube(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        token
      )
      const mine = mineJson?.items?.[0]
      const mineId: string | undefined = mine?.id
      const mineTitle: string | undefined = mine?.snippet?.title
      const mineCustomUrl: string | undefined = mine?.snippet?.customUrl

      if (!mineId) {
        setMessage('YouTube チャンネル情報を取得できませんでした（mine=true が空）')
        return
      }

      let expectedId: string | null = null
      let expectedHandle: string | null = null

      if (target.kind === 'channelId') {
        expectedId = target.value
      } else if (target.kind === 'handle') {
        expectedHandle = `@${target.value}`
        const json = await fetchYouTube(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(
            target.value
          )}`,
          token
        )
        expectedId = json?.items?.[0]?.id ?? null
      } else if (target.kind === 'username') {
        const json = await fetchYouTube(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet&forUsername=${encodeURIComponent(
            target.value
          )}`,
          token
        )
        expectedId = json?.items?.[0]?.id ?? null
      } else {
        // 値が空の場合は、許可したチャンネル (mine) をそのまま認証対象にする
        expectedId = mineId
        expectedHandle =
          typeof mineCustomUrl === 'string' && mineCustomUrl.startsWith('@') ? mineCustomUrl : null
      }

      if (!expectedId) {
        setMessage('入力されたチャンネルを特定できませんでした。URL/IDを確認してください。')
        return
      }

      if (expectedId !== mineId) {
        setMessage(
          `本人確認に失敗しました。入力されたチャンネル（${expectedId}）と、許可したチャンネル（${mineId}）が一致しません。`
        )
        return
      }

      const channelHandle =
        expectedHandle ||
        (typeof mineCustomUrl === 'string' && mineCustomUrl.startsWith('@') ? mineCustomUrl : null)

      const verifiedAt = new Date().toISOString()
      const valueToSave =
        link.value.trim() ||
        channelHandle ||
        (typeof mineId === 'string' ? mineId : '')

      const nextLinks: SocialLink[] = socialLinks.map((l, i) =>
        i === index
          ? {
            ...l,
            value: valueToSave,
            verified: true,
            verifiedAt,
            channelId: mineId,
            channelTitle: mineTitle ?? null,
            channelHandle,
          }
          : l
      )

      setSocialLinks(nextLinks)

      const { error } = await supabase
        .from('profiles')
        .update({ social_links: serializeSocialLinksForSave(nextLinks) })
        .eq('id', userId)

      if (error) {
        console.error(error.message)
        setMessage(`認証は成功しましたが保存に失敗しました: ${error.message}`)
      } else {
        setMessage(`YouTube を認証しました: ${mineTitle ?? mineId}`)
      }
    } catch (err: unknown) {
      console.error(err)
      if (isYouTubeNetworkBlocked(err)) {
        setMessage('YouTubeへの通信がブロックされています。ネットワークや拡張機能の設定をご確認ください。')
      } else {
        setMessage(
          `YouTube 確認に失敗しました。YouTube 連携（スコープ許可）をやり直してください。詳細: ${(err instanceof Error ? err.message : String(err))
          }`
        )
      }
    } finally {
      setBusy(false)
    }
  }, [socialLinks, supabase, resolveUserId, setMessage, fetchYouTube])





  const clearYouTubeVerification = async (index: number) => {
    const link = socialLinks[index]
    if (!link || link.service !== 'youtube') return

    const nextLinks: SocialLink[] = socialLinks.map((l, i) =>
      i === index
        ? {
          ...l,
          verified: false,
          verifiedAt: null,
          channelId: null,
          channelTitle: null,
          channelHandle: null,
        }
        : l
    )

    setSocialLinks(nextLinks)

    const userId = await resolveUserId()
    if (!userId) {
      setMessage('ユーザー情報を取得できませんでした。再ログインしてお試しください。')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ social_links: serializeSocialLinksForSave(nextLinks) })
      .eq('id', userId)

    if (error) {
      console.error(error.message)
      setMessage(`解除に失敗しました: ${error.message}`)
      return
    }
    setMessage('YouTube 認証を解除しました')
  }

  const clearXVerification = async (index: number) => {
    const link = socialLinks[index]
    if (!link || link.service !== 'x') return

    const nextLinks: SocialLink[] = socialLinks.map((l, i) =>
      i === index
        ? {
          ...l,
          verified: false,
          verifiedAt: null,
          xUserId: null,
          xUsername: null,
          xName: null,
        }
        : l
    )

    setSocialLinks(nextLinks)

    const userId = await resolveUserId()
    if (!userId) {
      setMessage('ユーザー情報を取得できませんでした。再ログインしてお試しください。')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ social_links: serializeSocialLinksForSave(nextLinks) })
      .eq('id', userId)

    if (error) {
      console.error(error.message)
      setMessage(`解除に失敗しました: ${error.message}`)
      return
    }
    setMessage('X 認証を解除しました')
  }

  const clearBilibiliVerification = async (index: number) => {
    const link = socialLinks[index]
    if (!link || link.service !== 'bilibili') return

    const nextLinks: SocialLink[] = socialLinks.map((l, i) =>
      i === index
        ? {
          ...l,
          verified: false,
          verifiedAt: null,
          biliUid: null,
          biliName: null,
          biliAvatar: null,
        }
        : l
    )

    setSocialLinks(nextLinks)

    const userId = await resolveUserId()
    if (!userId) {
      setMessage('ユーザー情報を取得できませんでした。再ログインしてお試しください。')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ social_links: serializeSocialLinksForSave(nextLinks) })
      .eq('id', userId)

    if (error) {
      console.error(error.message)
      setMessage(`解除に失敗しました: ${error.message}`)
      return
    }
    setMessage('Bilibili 認証を解除しました')
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('yt_verify')
    if (!raw) return
    const idx = Number(raw)
    if (!Number.isFinite(idx)) return
    params.delete('yt_verify')
    const qs = params.toString()
    const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`
    window.history.replaceState({}, '', nextUrl)
    void verifyYouTubeAtIndex(idx)
  }, [verifyYouTubeAtIndex])

  // Removed client-side X verification effect (handled in auth/callback)


  // YouTube 検証：redirectTo にクエリを付けられない環境向け（Redirect URL が厳密一致のみの場合）
  useEffect(() => {
    const run = async () => {
      if (typeof window === 'undefined') return

      if (!ytPendingRef.current) {
        const raw = window.localStorage.getItem(YT_VERIFY_LS_KEY)
        if (!raw) return

        try {
          ytPendingRef.current = JSON.parse(raw) as YtVerifyPending
        } catch {
          window.localStorage.removeItem(YT_VERIFY_LS_KEY)
          return
        }
      }

      const pending = ytPendingRef.current

      // 10分以上前なら破棄
      if (!pending || typeof pending.value !== 'string' || Date.now() - pending.startedAt > 10 * 60 * 1000) {
        window.localStorage.removeItem(YT_VERIFY_LS_KEY)
        ytPendingRef.current = null
        return
      }

      const targetValue = pending.value.trim()
      const preferredIndex =
        typeof pending.index === 'number' && socialLinks[pending.index]?.service === 'youtube'
          ? pending.index
          : -1
      const idx2 = socialLinks.findIndex((l) => l.service === 'youtube' && l.value.trim() === targetValue)
      const index =
        preferredIndex >= 0
          ? preferredIndex
          : idx2 >= 0
            ? idx2
            : socialLinks.findIndex((l) => l.service === 'youtube')

      if (index < 0) {
        setSocialLinks((prev) => [
          ...prev,
          { service: 'youtube', label: '', value: targetValue, verified: false },
        ])
        return
      }

      // 一度だけ実行
      window.localStorage.removeItem(YT_VERIFY_LS_KEY)
      ytPendingRef.current = null
      await verifyYouTubeAtIndex(index)
    }

    void run()
  }, [socialLinks, verifyYouTubeAtIndex])

  // Check for message from server-side callback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const msg = urlParams.get('message')
      if (msg) {
        setMessage(decodeURIComponent(msg))
        // Clean up URL
        const newUrl = window.location.pathname
        window.history.replaceState({}, '', newUrl)
      }
    }
  }, [])



  const savedSocialLinks = useMemo(() => serializeSocialLinksForSave(socialLinks), [socialLinks])
  const displaySocialLinks = useMemo(() => filterSocialLinksForDisplay(savedSocialLinks), [savedSocialLinks])

  const saveSocialLinks = async () => {
    if (!session?.user) return
    setSavingSocial(true)
    setMessage(null)
    let mergedLinks = savedSocialLinks
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('social_links')
      .eq('id', session.user.id)
      .maybeSingle()
    const existingLinks = Array.isArray(existingProfile?.social_links)
      ? (existingProfile?.social_links as SerializedSocialLink[])
      : []
    mergedLinks = mergeVerifiedSocialLinks(savedSocialLinks, existingLinks)
    const { error } = await supabase
      .from('profiles')
      .update({
        social_links: mergedLinks,
        tl_default_settings: tlDefaults,
      })
      .eq('id', session.user.id)
    setSavingSocial(false)
    if (error) {
      setMessage(`ソーシャル設定の更新に失敗しました: ${error.message}`)
      return
    }
    setMessage('ソーシャル設定を更新しました')
  }

  const saveEnvironmentSettings = async () => {
    if (!session?.user) {
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(TL_DEFAULT_SETTINGS_STORAGE_KEY, JSON.stringify(tlDefaults))
        }
        setMessage('環境設定をローカルに保存しました')
      } catch {
        setMessage('ローカル保存に失敗しました')
      }
      return
    }
    setSavingEnvironment(true)
    setMessage(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        tl_default_settings: tlDefaults,
      })
      .eq('id', session.user.id)
    setSavingEnvironment(false)
    if (error) {
      setMessage(`環境設定の更新に失敗しました: ${error.message}`)
      return
    }
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TL_DEFAULT_SETTINGS_STORAGE_KEY, JSON.stringify(tlDefaults))
      }
    } catch {
      /* ignore */
    }
    setMessage('環境設定を更新しました')
  }

  const saveProfile = async () => {
    if (!session?.user) return
    setSavingProfile(true)
    setMessage(null)
    let mergedLinks = savedSocialLinks
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('social_links')
      .eq('id', session.user.id)
      .maybeSingle()
    const existingLinks = Array.isArray(existingProfile?.social_links)
      ? (existingProfile?.social_links as SerializedSocialLink[])
      : []
    mergedLinks = mergeVerifiedSocialLinks(savedSocialLinks, existingLinks)
    const { error } = await supabase
      .from('profiles')
      .update({
        username,
        nickname,
        level: level === '' ? null : level,
        bio,
        icon_student_id: iconStudentId || null,
        friend_code: friendCode || null,
        friend_code_public: friendCodePublic,
        decoration_ids: decorationIds,
        decoration_inventory: decorationInventory,
        social_links: mergedLinks,
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

  useEffect(() => {
    if (!message) return
    const toastId = Date.now() + Math.random()
    setToasts((prev) => [{ id: toastId, text: message }, ...prev])
    setMessage(null)
    const id = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== toastId))
    }, 2000)
    return () => window.clearTimeout(id)
  }, [message])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TL_MAKER_SHORTCUT_STORAGE_KEY)
      if (!raw) {
        setMakerShortcuts(defaultShortcuts(isMacPlatform))
        return
      }
      const parsed = JSON.parse(raw) as Partial<TlMakerShortcutSettings>
      setMakerShortcuts((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(parsed).filter(([, value]) => typeof value === 'string')
        ),
      }))
    } catch {
      /* ignore */
    }
  }, [isMacPlatform])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEARCH_SHORTCUT_STORAGE_KEY)
      if (!raw) {
        setSearchShortcut(defaultSearchShortcut(isMacPlatform))
        return
      }
      if (raw.trim()) {
        setSearchShortcut(raw)
      } else {
        setSearchShortcut(defaultSearchShortcut(isMacPlatform))
      }
    } catch {
      /* ignore */
    }
  }, [isMacPlatform])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HELP_SHORTCUT_STORAGE_KEY)
      if (!raw) {
        setHelpShortcut(defaultHelpShortcut(isMacPlatform))
        return
      }
      if (raw.trim()) {
        setHelpShortcut(raw)
      } else {
        setHelpShortcut(defaultHelpShortcut(isMacPlatform))
      }
    } catch {
      /* ignore */
    }
  }, [isMacPlatform])

  useEffect(() => {
    try {
      localStorage.setItem(TL_MAKER_SHORTCUT_STORAGE_KEY, JSON.stringify(makerShortcuts))
      window.dispatchEvent(new StorageEvent('storage', {
        key: TL_MAKER_SHORTCUT_STORAGE_KEY,
        newValue: JSON.stringify(makerShortcuts),
      }))
    } catch {
      /* ignore */
    }
  }, [makerShortcuts])

  useEffect(() => {
    try {
      localStorage.setItem(SEARCH_SHORTCUT_STORAGE_KEY, searchShortcut)
    } catch {
      /* ignore */
    }
  }, [searchShortcut])

  useEffect(() => {
    try {
      localStorage.setItem(HELP_SHORTCUT_STORAGE_KEY, helpShortcut)
      window.dispatchEvent(new StorageEvent('storage', {
        key: HELP_SHORTCUT_STORAGE_KEY,
        newValue: helpShortcut,
      }))
    } catch {
      /* ignore */
    }
  }, [helpShortcut])

  const selectedTargets = [
    { label: '学生データ', value: delUser },
    { label: 'テーマ設定', value: delTheme },
    { label: 'お知らせ既読状態', value: delNotice },
    { label: '学生一覧設定', value: delOpts },
    { label: '同期完了フラグ', value: delSync },
    { label: '部隊データ', value: delSquad },
    { label: 'TLデータ', value: delTL },
  ].filter((item) => item.value)

  const clearLocalData = () => {
    if (delUser) {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('userStudent:')) keys.push(key)
      }
      keys.forEach((k) => localStorage.removeItem(k))
    }
    if (delTheme) localStorage.removeItem('theme')
    if (delNotice) localStorage.removeItem('lastNoticeId')
    if (delOpts) localStorage.removeItem('students_page_opts')
    if (delSync) {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('sync_done_')) keys.push(key)
      }
      keys.forEach((k) => localStorage.removeItem(k))
    }
    if (delSquad) localStorage.removeItem('squadGroups')
    if (delTL) {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (
          key &&
          (key.startsWith('tlMakerProject_') ||
            key === 'tlLength' ||
            key === 'tlDefaultSkillLevels' ||
            key === 'tlSkillColors' ||
            key === 'tlMakerCache' ||
            key === 'tlMakerLastKey')
        ) {
          keys.push(key)
        }
      }
      keys.forEach((k) => localStorage.removeItem(k))
    }
    setMessage('選択したローカルデータを削除しました')
  }

  const handleConfirmNo = () => {
    setConfirmActive(false)
    setTimeout(() => {
      setConfirmVisible(false)
      setConfirmStep('first')
    }, 150)
  }

  const handleConfirmYes = () => {
    if (confirmStep === 'first') {
      setConfirmStep('second')
      return
    }
    clearLocalData()
    setConfirmActive(false)
    setTimeout(() => {
      setConfirmVisible(false)
      setConfirmStep('first')
    }, 150)
  }

  const pathWithSearch = useMemo(() => {
    const normalizedPath = pathname?.startsWith('/') ? pathname : `/${pathname ?? ''}`
    const basePath = stripLeadingLocale(normalizedPath)
    const search = searchParams ? new URLSearchParams(searchParams) : null
    search?.delete('lang')
    const searchString = search?.toString()
    return searchString ? `${basePath}?${searchString}` : basePath
  }, [pathname, searchParams])

  const changeLocale = (nextLocale: Locale) => {
    if (!nextLocale || nextLocale === locale) return
    if (typeof document !== 'undefined') {
      document.cookie = `locale=${nextLocale}; path=/`
      try {
        localStorage.setItem('locale', nextLocale)
      } catch {
        /* ignore */
      }
    }
    const target = new URLSearchParams()
    target.set('lang', nextLocale)
    router.push(`${pathWithSearch}?${target.toString()}`)
  }

  const renderLockedSection = (title: string, description: string) => (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-3 mb-3">
        <FontAwesomeIcon icon={faLock} className="text-2xl text-gray-400" />
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <p className="text-sm text-gray-600">
        この設定はログイン後に利用できます。ログインしてからもう一度お試しください。
      </p>
    </section>
  )

  const profileLocked = isSectionLocked('profile')
  const socialLocked = isSectionLocked('social')
  const accountLocked = isSectionLocked('account')
  const youtubeLocked = isSectionLocked('youtube')
  const linksLocked = isSectionLocked('links')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = parseLocale(localStorage.getItem('locale'))
      if (stored && stored !== locale) {
        document.cookie = `locale=${stored}; path=/`
        const params = new URLSearchParams()
        params.set('lang', stored)
        router.replace(`${pathWithSearch}?${params.toString()}`)
      }
    } catch {
      /* ignore */
    }
  }, [locale, pathWithSearch, router])

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full lg:w-64 shrink-0 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <nav className="space-y-2">
          <button
            className={`w-full text-left rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 ${
              activeSection === 'profile' ? 'bg-blue-50 text-blue-700' : ''
            } ${profileLocked ? 'cursor-not-allowed text-gray-400 hover:bg-transparent' : ''}`}
            onClick={() => handleSectionChange('profile')}
            disabled={profileLocked}
          >
            プロフィール設定
            {profileLocked && <FontAwesomeIcon icon={faLock} className="ml-2 text-xs text-gray-400" />}
          </button>
          <button
            className={`w-full text-left rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 ${
              activeSection === 'social' ? 'bg-blue-50 text-blue-700' : ''
            } ${socialLocked ? 'cursor-not-allowed text-gray-400 hover:bg-transparent' : ''}`}
            onClick={() => handleSectionChange('social')}
            disabled={socialLocked}
          >
            ソーシャルアカウント
            {socialLocked && <FontAwesomeIcon icon={faLock} className="ml-2 text-xs text-gray-400" />}
          </button>
          <button
            className={`w-full text-left rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 ${
              activeSection === 'account' ? 'bg-blue-50 text-blue-700' : ''
            } ${accountLocked ? 'cursor-not-allowed text-gray-400 hover:bg-transparent' : ''}`}
            onClick={() => handleSectionChange('account')}
            disabled={accountLocked}
          >
            アカウント設定
            {accountLocked && <FontAwesomeIcon icon={faLock} className="ml-2 text-xs text-gray-400" />}
          </button>
          <button
            className={`w-full text-left rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 ${
              activeSection === 'youtube' ? 'bg-blue-50 text-blue-700' : ''
            } ${youtubeLocked ? 'cursor-not-allowed text-gray-400 hover:bg-transparent' : ''}`}
            onClick={() => handleSectionChange('youtube')}
            disabled={youtubeLocked}
          >
            YouTube/Bilibili設定
            {youtubeLocked && <FontAwesomeIcon icon={faLock} className="ml-2 text-xs text-gray-400" />}
          </button>
          <button
            className={`w-full text-left rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 ${
              activeSection === 'links' ? 'bg-blue-50 text-blue-700' : ''
            } ${linksLocked ? 'cursor-not-allowed text-gray-400 hover:bg-transparent' : ''}`}
            onClick={() => handleSectionChange('links')}
            disabled={linksLocked}
          >
            連携サービス
            {linksLocked && <FontAwesomeIcon icon={faLock} className="ml-2 text-xs text-gray-400" />}
          </button>
          <button
            className={`w-full text-left rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 ${
              activeSection === 'header' ? 'bg-blue-50 text-blue-700' : ''
            }`}
            onClick={() => handleSectionChange('header')}
          >
            環境設定
          </button>
          <button
            className={`w-full text-left rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 ${
              activeSection === 'shortcuts' ? 'bg-blue-50 text-blue-700' : ''
            }`}
            onClick={() => handleSectionChange('shortcuts')}
          >
            ショートカットキー
          </button>
          <button
            className={`w-full text-left rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 ${
              activeSection === 'data' ? 'bg-blue-50 text-blue-700' : ''
            }`}
            onClick={() => handleSectionChange('data')}
          >
            データ管理
          </button>
        </nav>
      </aside>

      <div className="flex-1 space-y-6">
        {toasts.length > 0 && (
          <div className="fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className="toast-item relative overflow-hidden rounded border border-blue-200 bg-blue-50 px-4 py-3 pb-4 text-sm text-blue-800 shadow-lg"
              >
                <div>{toast.text}</div>
                <div className="toast-bar absolute bottom-0 left-0 right-0 h-1 bg-blue-100">
                  <div className="toast-progress h-full bg-blue-400" />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'profile' && (
          profileLocked
            ? renderLockedSection('プロフィール設定', 'プロフィール情報の編集')
            : <section
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
                ニックネーム（表示名、12文字まで）
                <input
                  value={nickname}
                  maxLength={12}
                  onChange={(e) => setNickname(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 先生"
                />
              </label>

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
                maxLength={100}
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
                    className="h-12 w-12 rounded-xl object-cover border border-gray-200"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-gray-200 border border-gray-200" />
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

            <label className="block text-sm text-gray-600">
              フレンドコード
              <input
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="フレンドコードを入力"
              />
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={friendCodePublic}
                  onChange={(e) => setFriendCodePublic(e.target.checked)}
                />
                公開する
              </label>
            </label>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">デコレーション</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUnowned((v) => !v)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50"
                  >
                    {showUnowned ? '未購入を隠す' : '未購入を表示'}
                  </button>
                  <a href="/decorations" className="text-sm text-blue-600 hover:underline">
                    デコレーションショップへ
                  </a>
                </div>
              </div>
              <p className="text-sm text-gray-600">カテゴリごとに1つ選択できます。</p>
              <div className="space-y-3">
                {decorationsByGenre.map(([genre, items]) => (
                  <div key={genre} className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700">{genre}</p>
                    <div className="grid gap-2">
                      {items.map((item) => {
                        const owned = decorationInventory.includes(item.id)
                        const checked = decorationIds.includes(item.id)
                        return (
                          <label
                            key={item.id}
                            className={`flex items-start gap-3 rounded border p-3 text-sm ${checked ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'
                              } dark:border-gray-700 dark:bg-gray-800`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!owned}
                              onChange={() => toggleDecoration(item.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-lg" aria-hidden>
                                  {item.emoji}
                                </span>
                                <p className="font-semibold">{item.name}</p>
                                {!owned && <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">未購入</span>}
                              </div>
                              <p className="text-gray-600">{item.description}</p>
                              {item.style === 'red-gradient' && <p className="text-xs text-rose-600">効果: 赤グラデーション枠</p>}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
        )}

        {activeSection === 'social' && (
          socialLocked
            ? renderLockedSection('ソーシャルアカウント', '公開プロフィールのリンク管理')
            : <section
                ref={socialRef as unknown as React.RefObject<HTMLElement>}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
              >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">ソーシャルアカウント</h3>
                <p className="text-sm text-gray-500">公開プロフィールに表示するリンクを管理します</p>
              </div>
            </div>
            <div className="space-y-2">
              {socialLinks.map((link, idx) => (
                <div key={idx} className="flex flex-col gap-2 rounded border border-gray-200 p-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={link.service}
                      onChange={(e) => {
                        const service = e.target.value as SocialService
                        const next = [...socialLinks]
                        next[idx] = { ...next[idx], service }
                        setSocialLinks(next)
                      }}
                      className="rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-40"
                    >
                      <option value="x">X</option>
                      <option value="youtube">YouTube</option>
                      <option value="bilibili">Bilibili</option>
                      <option value="other">その他</option>
                    </select>

                    {link.service === 'other' ? (
                      <input
                        value={link.label}
                        onChange={(e) => {
                          const next = [...socialLinks]
                          next[idx] = { ...next[idx], label: e.target.value }
                          setSocialLinks(next)
                        }}
                        className="flex-1 rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="サービス名 (例: Discord)"
                      />
                    ) : (
                      <input
                        value={socialLabel(link.service, link.label)}
                        disabled
                        className="flex-1 rounded border border-gray-300 bg-gray-100 px-3 py-2 text-base text-gray-500"
                      />
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={link.value}
                      onChange={(e) => {
                        const next = [...socialLinks]
                        next[idx] = { ...next[idx], value: e.target.value }
                        setSocialLinks(next)
                      }}
                      className="flex-1 rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={socialPlaceholder(link.service)}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSocialLinks((prev) =>
                          prev.length === 1
                            ? [{ service: 'other', label: '', value: '' }]
                            : prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="rounded border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      削除
                    </button>
                  </div>

                  {(link.service === 'youtube' || link.service === 'x' || link.service === 'bilibili') && (
                    <div className="rounded border border-gray-200 bg-gray-50 p-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-gray-700">
                          {link.verified ? (
                            <span className="inline-flex items-center gap-1">
                              {renderVerifiedBadge()}
                              <span>認証済み:</span>{' '}
                              {link.service === 'youtube'
                                ? link.channelTitle || link.channelHandle || link.channelId || 'YouTube'
                                : link.service === 'x'
                                  ? link.xUsername
                                    ? `@${link.xUsername}`
                                    : link.value || 'X'
                                  : link.biliName || link.biliUid || link.value || 'Bilibili'}
                            </span>
                          ) : (
                            <span>未認証（このアカウントの所有者確認）</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {link.service === 'x' && (
                            <span className="text-xs text-gray-500">現在開発中</span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              link.service === 'youtube'
                                ? verifyYouTubeAtIndex(idx)
                                : link.service === 'x'
                                  ? startXVerify(idx)
                                  : startBilibiliVerify(idx)
                            }
                            disabled={link.service === 'x' || busy}
                            className="rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-100 disabled:opacity-60"
                          >
                            {link.service === 'x' ? '更新（開発中）' : '更新'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              link.service === 'youtube'
                                ? startYouTubeVerify(idx)
                                : link.service === 'x'
                                  ? startXVerify(idx)
                                  : startBilibiliVerify(idx)
                            }
                            disabled={link.service === 'x' || busy}
                            className="rounded border border-blue-300 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                          >
                            {link.service === 'x'
                              ? `${isXLinked ? '接続先を変更する' : '接続する'}（開発中）`
                              : isGoogleLinked
                                ? '接続先を変更する'
                                : link.service === 'bilibili'
                                  ? '接続する'
                                  : '接続する'}
                          </button>
                          {link.verified && (
                            <button
                              type="button"
                              onClick={() =>
                                link.service === 'youtube'
                                  ? clearYouTubeVerification(idx)
                                  : link.service === 'x'
                                    ? clearXVerification(idx)
                                    : clearBilibiliVerification(idx)
                              }
                              disabled={link.service === 'x' || busy}
                              className="rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                            >
                              {link.service === 'x' ? '解除（開発中）' : '解除'}
                            </button>
                          )}
                        </div>
                      </div>
                      {link.service === 'youtube' ? (
                        <p className="mt-1 text-xs text-gray-500">
                          ブランドアカウントでもOKです。確認時は「このYouTubeチャンネル」として許可してください。
                        </p>
                      ) : link.service === 'x' ? (
                        <p className="mt-1 text-xs text-gray-500">
                          X OAuth 画面で承認したアカウントと、入力したハンドルが一致していることを確認します。
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-500">
                          Bilibili OAuth で認証したアカウント情報を保存します。
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setSocialLinks((prev) => [...prev, { service: 'other', label: '', value: '' }])
                }
                className="inline-flex items-center justify-center rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
              >
                ＋ 追加
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={saveSocialLinks}
                disabled={savingSocial}
                className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {savingSocial ? '保存中...' : '保存'}
              </button>
            </div>
          </section>
        )}

        {activeSection === 'account' && (
          accountLocked
            ? renderLockedSection('アカウント設定', 'アカウント情報の確認')
            : <section
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
        )}

        {activeSection === 'youtube' && (
          youtubeLocked
            ? renderLockedSection('YouTube/Bilibili設定', '本人確認・チャンネル情報の管理')
            : <section
                ref={youtubeRef as unknown as React.RefObject<HTMLElement>}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
              >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">YouTube/Bilibili設定</h3>
                <p className="text-sm text-gray-500">YouTube/Bilibili本人確認・チャンネル情報</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              {youtubeLink?.verified ? (
                <p className="flex items-center gap-1 text-gray-700">
                  {renderVerifiedBadge()}
                  <span>
                    認証済み: {youtubeLink.channelTitle || youtubeLink.channelHandle || youtubeLink.channelId || youtubeLink.value}
                  </span>
                </p>
              ) : (
                <p className="text-gray-600">YouTubeの認証がまだ完了していません。</p>
              )}
              <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={youtubeLink?.autoFormationStatus ?? false}
                    onChange={(e) => {
                      const nextValue = e.target.checked
                      setSocialLinks((prev) => {
                        const idx = prev.findIndex((link) => link.service === 'youtube')
                        if (idx >= 0) {
                          const next = [...prev]
                          next[idx] = { ...next[idx], autoFormationStatus: nextValue }
                          return next
                        }
                        return [
                          ...prev,
                          { service: 'youtube', label: '', value: '', verified: false, autoFormationStatus: nextValue },
                        ]
                      })
                    }}
                  />
                  <span className="text-gray-700">
                    投稿した動画の編成に、サイトに登録済みのステータスを自動追加する
                  </span>
                </label>
                <p className="mt-2 text-xs text-gray-500">
                  TL 登録時に「自動」でステータスを補完する設定です。手動管理したい場合はオフにしてください。
                </p>
              </div>
              <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm space-y-3">
                <div>
                  <p className="font-semibold text-sm text-gray-700">動画のデフォルト管理設定</p>
                  <p className="text-xs text-gray-500">
                    自分の投稿動画や手動追加する動画に対して、初期値として適用する設定です。
                  </p>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tlDefaults.includeSquad}
                    onChange={(e) =>
                      setTlDefaults((prev) => ({ ...prev, includeSquad: e.target.checked }))
                    }
                  />
                  <span>部隊のデータを含める</span>
                </label>
                <div className="space-y-2">
                  <p className="text-xs text-gray-600">TL登録/変更の設定</p>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="tl-default-edit-policy"
                      checked={tlDefaults.allowTl}
                      onChange={() =>
                        setTlDefaults((prev) => ({ ...prev, allowTl: true }))
                      }
                    />
                    <span>変更を許可する</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="tl-default-edit-policy"
                      checked={!tlDefaults.allowTl}
                      onChange={() =>
                        setTlDefaults((prev) => ({ ...prev, allowTl: false }))
                      }
                    />
                    <span>変更をロックする（許可しない）</span>
                  </label>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tlDefaults.hideTlUntilYoutube}
                    onChange={(e) =>
                      setTlDefaults((prev) => ({ ...prev, hideTlUntilYoutube: e.target.checked }))
                    }
                  />
                  <span>動画を開くまでTLを非表示にする</span>
                </label>
                <div className="space-y-2">
                  <p className="text-xs text-gray-600">TL検索の公開範囲</p>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="tl-default-visibility"
                      checked={tlDefaults.visibility === 'public'}
                      onChange={() =>
                        setTlDefaults((prev) => ({ ...prev, visibility: 'public' }))
                      }
                    />
                    <span>全体公開</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="tl-default-visibility"
                      checked={tlDefaults.visibility === 'restricted'}
                      onChange={() =>
                        setTlDefaults((prev) => ({ ...prev, visibility: 'restricted' }))
                      }
                    />
                    <span>特定ユーザーのみ（profilesのID指定）</span>
                  </label>
                  {tlDefaults.visibility === 'restricted' && (
                    <textarea
                      value={tlDefaults.allowedUserIds.join('\n')}
                      onChange={(e) =>
                        setTlDefaults((prev) => ({
                          ...prev,
                          allowedUserIds: parseAllowedIdentifiers(e.target.value),
                        }))
                      }
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      rows={3}
                      placeholder="許可するprofilesのIDまたはユーザー名を改行/カンマで入力"
                    />
                  )}
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="tl-default-visibility"
                      checked={tlDefaults.visibility === 'private'}
                      onChange={() =>
                        setTlDefaults((prev) => ({ ...prev, visibility: 'private' }))
                      }
                    />
                    <span>非公開（自分だけ表示）</span>
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (youtubeIndex >= 0) {
                      void startYouTubeVerify(youtubeIndex)
                    } else {
                      setSocialLinks((prev) => [
                        ...prev,
                        { service: 'youtube', label: '', value: '', verified: false },
                      ])
                    }
                  }}
                  disabled={busy}
                  className="inline-flex items-center justify-center rounded border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                >
                  {youtubeLink ? (isGoogleLinked ? '接続先を変更する' : '接続する') : 'YouTubeリンクを追加'}
                </button>
                {youtubeLink && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection('links')
                      scrollTo(linksRef)
                    }}
                    className="inline-flex items-center justify-center rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
                  >
                    連携サービスへ
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveSocialLinks}
                  disabled={savingSocial}
                  className="inline-flex items-center justify-center rounded border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                >
                  {savingSocial ? '保存中...' : 'YouTube/Bilibili設定を保存'}
                </button>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'links' && (
          linksLocked
            ? renderLockedSection('連携サービス', 'Google / Discord の連携管理')
            : <section
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
        )}

        {activeSection === 'header' && (
          <section
            ref={headerRef as unknown as React.RefObject<HTMLElement>}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">環境設定</h3>
                <p className="text-sm text-gray-500">表示や操作に関する設定を管理します</p>
              </div>
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
                <div>
                  <p className="font-semibold text-gray-700">テーマ</p>
                  <p className="text-xs text-gray-500">ヘッダーのテーマ切替と連動します</p>
                </div>
                <button
                  type="button"
                  onClick={toggle}
                  className="rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-white"
                >
                  {dark ? 'ライトモードに切替' : 'ダークモードに切替'}
                </button>
              </div>
              <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm space-y-2">
                <p className="font-semibold text-gray-700">TL検索の編成カード表示デザイン</p>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="tl-default-formation-card-style"
                    checked={tlDefaults.formationCardStyle === 'student-image'}
                    onChange={() =>
                      setTlDefaults((prev) => ({ ...prev, formationCardStyle: 'student-image' }))
                    }
                  />
                  <span>生徒アイコンビューワーと同じデザイン（推奨）</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="tl-default-formation-card-style"
                    checked={tlDefaults.formationCardStyle === 'compact'}
                    onChange={() =>
                      setTlDefaults((prev) => ({ ...prev, formationCardStyle: 'compact' }))
                    }
                  />
                  <span>コンパクトデザイン（旧表示）</span>
                </label>
              </div>
              <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
                <div>
                  <p className="font-semibold text-gray-700">表示言語</p>
                  <p className="text-xs text-gray-500">ヘッダーの言語切替と同じ設定です</p>
                </div>
                <select
                  value={locale}
                  onChange={(e) => changeLocale(e.target.value as Locale)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm bg-white"
                >
                  {SUPPORTED_LOCALES.map((code) => (
                    <option key={code} value={code}>
                      {code.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={saveEnvironmentSettings}
                  disabled={savingEnvironment}
                  className="rounded border border-blue-300 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                >
                  {savingEnvironment ? '保存中...' : '環境設定を保存'}
                </button>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'shortcuts' && (
          <section
            ref={shortcutRef as unknown as React.RefObject<HTMLElement>}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">ショートカットキー</h3>
                <p className="text-sm text-gray-500">TLメーカーdev・検索バー・ヘルプ/チュートリアルのショートカットキーを設定します</p>
              </div>
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-white dark:border-gray-600 dark:hover:bg-gray-800"
                onClick={() => {
                  setMakerShortcuts(defaultShortcuts(isMacPlatform))
                  setSearchShortcut(defaultSearchShortcut(isMacPlatform))
                  setHelpShortcut(defaultHelpShortcut(isMacPlatform))
                  setMessage('ショートカットキーをデフォルトに戻しました')
                }}
              >
                デフォルトに戻す
              </button>
            </div>
            <div className="space-y-3 text-sm">
              {TL_MAKER_SHORTCUT_CATEGORIES.map((category) => (
                <div key={category.title} className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-500">{category.title}</h4>
                  {category.items.map((item) => (
                    <label key={item.key} className="flex items-center gap-3">
                      <span className="w-32 text-gray-700">{item.label}</span>
                      <input
                        value={makerShortcuts[item.key]}
                        onKeyDown={(e) => {
                          e.preventDefault()
                          const next = formatShortcutFromEvent(e)
                          if (next === null) return
                          setMakerShortcuts((prev) => ({ ...prev, [item.key]: next }))
                        }}
                        readOnly
                        className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                        placeholder={makerShortcutDefaults[item.key]}
                      />
                    </label>
                  ))}
                </div>
              ))}
              <label className="flex items-center gap-3">
                <span className="w-32 text-gray-700">検索バー</span>
                <input
                  value={searchShortcut}
                  onKeyDown={(e) => {
                    e.preventDefault()
                    const next = formatShortcutFromEvent(e)
                    if (next === null) return
                    setSearchShortcut(next)
                  }}
                  readOnly
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder={isMacPlatform ? 'Cmd+K' : 'Ctrl+K'}
                />
              </label>

              <label className="flex items-center gap-3">
                <span className="w-32 text-gray-700">ヘルプ/チュートリアル</span>
                <input
                  value={helpShortcut}
                  onKeyDown={(e) => {
                    e.preventDefault()
                    const next = formatShortcutFromEvent(e)
                    if (next === null) return
                    setHelpShortcut(next)
                  }}
                  readOnly
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder={isMacPlatform ? 'Cmd+/' : 'Ctrl+/'}
                />
              </label>
              <p className="text-xs text-gray-500">
                入力欄をクリックしてキーを押してください（例: {isMacPlatform ? 'Cmd+Z' : 'Ctrl+Z'}）。
              </p>
            </div>
          </section>
        )}

        {activeSection === 'data' && (
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">データ管理</h3>
              <p className="text-sm text-gray-500">端末に保存されたローカルデータをカテゴリごとに削除します</p>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-bold">削除するデータ</p>
              <label className="block"><input type="checkbox" className="mr-2" checked={delUser} onChange={(e) => setDelUser(e.target.checked)} />学生データ</label>
              <label className="block"><input type="checkbox" className="mr-2" checked={delTheme} onChange={(e) => setDelTheme(e.target.checked)} />テーマ設定</label>
              <label className="block"><input type="checkbox" className="mr-2" checked={delNotice} onChange={(e) => setDelNotice(e.target.checked)} />お知らせ既読状態</label>
              <label className="block"><input type="checkbox" className="mr-2" checked={delOpts} onChange={(e) => setDelOpts(e.target.checked)} />学生一覧設定</label>
              <label className="block"><input type="checkbox" className="mr-2" checked={delSync} onChange={(e) => setDelSync(e.target.checked)} />同期完了フラグ</label>
              <label className="block"><input type="checkbox" className="mr-2" checked={delSquad} onChange={(e) => setDelSquad(e.target.checked)} />部隊データ</label>
              <label className="block"><input type="checkbox" className="mr-2" checked={delTL} onChange={(e) => setDelTL(e.target.checked)} />TLデータ</label>
              <button
                type="button"
                onClick={() => {
                  setConfirmStep('first')
                  setConfirmVisible(true)
                  requestAnimationFrame(() => setConfirmActive(true))
                }}
                className="mt-2 w-full rounded border border-red-300 bg-red-50 px-3 py-2 text-red-700"
              >
                選択したデータを削除
              </button>
            </div>
          </section>
        )}
      </div>

      {confirmVisible && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 transition-opacity duration-200 ${confirmActive ? 'opacity-100' : 'opacity-0'}`}
          onClick={handleConfirmNo}
        >
          <div
            className={`${dark ? 'bg-gray-800 text-white' : 'bg-white'} w-[90%] max-w-sm rounded p-4 shadow transition-all duration-200 ${confirmActive ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-semibold">
              {confirmStep === 'first'
                ? '選択したデータを削除してもよろしいですか？'
                : '本当に削除してもよろしいですか？'}
            </p>
            <div className="mt-3 rounded bg-gray-50 p-2 text-sm dark:bg-gray-900">
              <p className="font-semibold">対象</p>
              {selectedTargets.length > 0 ? (
                <ul className="list-disc pl-5">
                  {selectedTargets.map((target) => (
                    <li key={target.label}>{target.label}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">選択なし</p>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={handleConfirmNo} className="rounded border px-3 py-1">
                いいえ
              </button>
              <button
                type="button"
                onClick={handleConfirmYes}
                className="rounded border bg-red-600 px-3 py-1 text-white"
              >
                はい
              </button>
            </div>
          </div>
        </div>
      )}

      {previewOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${previewVisible ? 'opacity-100' : 'opacity-0'
            }`}
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewVisible(false)
              setTimeout(() => setPreviewOpen(false), 200)
            }
          }}
        >
          <div
            className={`relative w-full max-w-3xl rounded-xl bg-white p-6 shadow-2xl transform transition-all duration-200 ${previewVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
              } dark:bg-gray-900`}
            onClick={(e) => e.stopPropagation()}
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
            <div
              className={`relative ${frameDecoration?.style === 'aurora-frame'
                ? 'rounded-xl p-[2px] ba-aurora-frame'
                : frameDecoration?.style === 'sunset-frame'
                  ? 'rounded-xl p-[2px] ba-sunset-frame'
                  : hasRedFrame
                    ? 'rounded-xl bg-gradient-to-r from-rose-500 via-red-500 to-orange-400 p-[2px]'
                    : ''
                }`}
            >
              <div
                className="relative rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4 dark:border-gray-700 dark:bg-gray-900"
                style={{
                  background: backgroundDecoration?.background_color ?? previewStyle.background ?? undefined,
                  backgroundImage: previewStyle.backgroundImage,
                  backgroundSize: previewStyle.backgroundSize,
                  animation: previewStyle.animation,
                  color: textColor ?? undefined,
                  fontFamily: fontDecoration?.font_family ?? undefined,
                }}
              >
                <div className="flex items-center gap-4">
                  {selectedStudent ? (
                    <img
                      src={selectedStudent.image}
                      alt={selectedStudent.name}
                      className="h-16 w-16 rounded-xl object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-gray-200 border border-gray-200" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Tools ID: {username || '—'}</p>
                    <h4 className="text-xl font-bold">{nickname || username || 'ユーザー名未設定'}</h4>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <span>Lv {level || '—'} / フレンドコード:</span>{' '}
                      <FriendCodeCopy code={friendCode} disabled={!friendCodePublic} />
                    </p>
                  </div>
                  <DecorationInfoButton decorations={selectedDecorations} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">自己紹介</p>
                  <p className="rounded border p-3 text-sm whitespace-pre-wrap" style={fieldStyle}>
                    {bio || '自己紹介はまだ入力されていません。'}
                  </p>
                  {displaySocialLinks.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">ソーシャル</p>
                      {displaySocialLinks.map((link, idx) => (
                        <p key={idx} className="rounded border p-2 text-sm" style={fieldStyle}>
                          {link.label && <span className="font-semibold mr-1">{link.label}:</span>}
                          {link.service === 'youtube' && link.verified && (
                            <span className="mr-1 text-xs">{renderVerifiedBadge()}</span>
                          )}
                          <span>{link.value || '未入力'}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes ba-aurora {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            @keyframes ba-sunset {
              0% { background-position: 0% 0%; }
              50% { background-position: 100% 100%; }
              100% { background-position: 0% 0%; }
            }
            .ba-aurora-frame {
              background-image: linear-gradient(120deg, #0ea5e9, #8b5cf6, #22d3ee);
              background-size: 200% 200%;
              animation: ba-aurora 12s ease infinite;
            }
            .ba-sunset-frame {
              background-image: linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6);
              background-size: 200% 200%;
              animation: ba-sunset 10s ease infinite;
            }
            @keyframes toast-in-out {
              0% { opacity: 0; transform: translateY(-8px); }
              10% { opacity: 1; transform: translateY(0); }
              90% { opacity: 1; transform: translateY(0); }
              100% { opacity: 0; transform: translateY(-6px); }
            }
            .toast-item {
              animation: toast-in-out 2s ease-in-out forwards;
            }
            @keyframes toast-progress {
              0% { width: 100%; }
              100% { width: 0%; }
            }
            .toast-progress {
              animation: toast-progress 2s linear forwards;
            }
          `,
        }}
      />
    </div>
  )
}
