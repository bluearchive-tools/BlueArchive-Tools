import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

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

const socialLabel = (service: SocialService, customLabel: string) => {
  if (service === 'x') return 'X'
  if (service === 'youtube') return 'YouTube'
  if (service === 'bilibili') return 'Bilibili'
  return customLabel.trim() || 'その他'
}

const serializeSocialLinksForSave = (links: SocialLink[]) => {
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
    }
  })
  return mapped.filter((x) => x !== null)
}

type BiliAuthTokenResponse = {
  token?: string
  user?: {
    uid?: number | string
    name?: string
    avatar?: string
  }
}

const parseSocialLinks = (raw: unknown): SocialLink[] => {
  if (!raw) return []
  const parsed = (() => {
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)
      } catch {
        return []
      }
    }
    return []
  })()
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item) => {
      const obj = item as Record<string, unknown>
      return {
        service: typeof obj.service === 'string' ? (obj.service as SocialService) : 'other',
        label: typeof obj.label === 'string' ? obj.label : '',
        value: typeof obj.value === 'string' ? obj.value : '',
        verified: typeof obj.verified === 'boolean' ? obj.verified : false,
        verifiedAt: typeof obj.verifiedAt === 'string' ? obj.verifiedAt : null,
        autoFormationStatus: typeof obj.autoFormationStatus === 'boolean' ? obj.autoFormationStatus : false,
        channelId: typeof obj.channelId === 'string' ? obj.channelId : null,
        channelTitle: typeof obj.channelTitle === 'string' ? obj.channelTitle : null,
        channelHandle: typeof obj.channelHandle === 'string' ? obj.channelHandle : null,
        xUserId: typeof obj.xUserId === 'string' ? obj.xUserId : null,
        xUsername: typeof obj.xUsername === 'string' ? obj.xUsername : null,
        xName: typeof obj.xName === 'string' ? obj.xName : null,
        biliUid: typeof obj.biliUid === 'string' ? obj.biliUid : null,
        biliName: typeof obj.biliName === 'string' ? obj.biliName : null,
        biliAvatar: typeof obj.biliAvatar === 'string' ? obj.biliAvatar : null,
      } satisfies SocialLink
    })
    .filter((item) => item.label.trim() || item.value.trim())
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  const baseUrl = process.env.BILI_AUTH_BASE_URL
  const clientId = process.env.BILI_AUTH_CLIENT_ID
  const clientSecret = process.env.BILI_AUTH_CLIENT_SECRET

  const redirectTo = new URL('/mypage', origin)

  const cookieStore = await cookies()
  const verifyCookie = cookieStore.get('ba_bili_verify')
  let index: number | null = null
  if (verifyCookie?.value) {
    try {
      const parsed = JSON.parse(decodeURIComponent(verifyCookie.value)) as { index?: string }
      if (parsed.index) {
        const parsedIndex = Number(parsed.index)
        if (!Number.isNaN(parsedIndex)) index = parsedIndex
      }
    } catch {
      /* ignore */
    }
  }

  if (!code) {
    redirectTo.searchParams.set('message', encodeURIComponent('Bilibili 認証コードが取得できませんでした。'))
    const res = NextResponse.redirect(redirectTo)
    res.cookies.delete('ba_bili_verify')
    return res
  }

  if (!baseUrl || !clientId || !clientSecret) {
    redirectTo.searchParams.set('message', encodeURIComponent('Bilibili 認証の設定が不足しています。管理者に確認してください。'))
    const res = NextResponse.redirect(redirectTo)
    res.cookies.delete('ba_bili_verify')
    return res
  }

  const tokenUrl = new URL('/oauth/access_token', baseUrl)
  tokenUrl.searchParams.set('client_id', clientId)
  tokenUrl.searchParams.set('client_secret', clientSecret)
  tokenUrl.searchParams.set('code', code)

  let tokenData: BiliAuthTokenResponse | null = null
  try {
    const tokenRes = await fetch(tokenUrl.toString(), { method: 'POST' })
    tokenData = (await tokenRes.json().catch(() => null)) as BiliAuthTokenResponse | null
    if (!tokenRes.ok || !tokenData) {
      throw new Error('token_error')
    }
  } catch {
    redirectTo.searchParams.set('message', encodeURIComponent('Bilibili 認証に失敗しました。'))
    const res = NextResponse.redirect(redirectTo)
    res.cookies.delete('ba_bili_verify')
    return res
  }

  const uid = tokenData?.user?.uid ? String(tokenData.user.uid) : ''
  const name = tokenData?.user?.name ?? ''
  const avatar = tokenData?.user?.avatar ?? ''

  const supabase = createRouteHandlerClient(
    { cookies },
    {
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_ANON_KEY!,
    }
  )

  // getUser はサーバー側で JWT を検証するため getSession より安全
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirectTo.searchParams.set('message', encodeURIComponent('ログイン状態を確認できませんでした。再ログインしてください。'))
    const res = NextResponse.redirect(redirectTo)
    res.cookies.delete('ba_bili_verify')
    return res
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('social_links')
    .eq('id', authUser.id)
    .maybeSingle()

  const currentLinks = parseSocialLinks(profile?.social_links)
  const verifiedAt = new Date().toISOString()
  const nextLink: SocialLink = {
    service: 'bilibili',
    label: '',
    value: uid,
    verified: true,
    verifiedAt,
    biliUid: uid,
    biliName: name,
    biliAvatar: avatar,
  }

  const nextLinks = [...currentLinks]
  if (typeof index === 'number' && nextLinks[index]) {
    nextLinks[index] = { ...nextLinks[index], ...nextLink }
  } else {
    nextLinks.push(nextLink)
  }

  const { error } = await supabase
    .from('profiles')
    .update({ social_links: serializeSocialLinksForSave(nextLinks) })
    .eq('id', authUser.id)

  if (error) {
    redirectTo.searchParams.set('message', encodeURIComponent('Bilibili 認証の保存に失敗しました。'))
  } else {
    redirectTo.searchParams.set('message', encodeURIComponent(`Bilibili 認証成功: ${name || uid}`))
  }

  const res = NextResponse.redirect(redirectTo)
  res.cookies.delete('ba_bili_verify')
  return res
}
