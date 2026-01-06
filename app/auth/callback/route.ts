import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

// Type definitions for logic reproduction
type SocialService = 'x' | 'youtube' | 'other'
type SocialLink = {
  service: SocialService
  label: string
  value: string
  verified?: boolean
  verifiedAt?: string | null
  channelId?: string | null
  channelTitle?: string | null
  channelHandle?: string | null
  xUserId?: string | null
  xUsername?: string | null
  xName?: string | null
}

const socialLabel = (service: SocialService, customLabel: string) => {
  if (service === 'x') return 'X'
  if (service === 'youtube') return 'YouTube'
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

    return {
      service: link.service,
      label: displayLabel,
      value: link.value,
      verified: link.verified ?? false,
      verifiedAt: link.verifiedAt ?? null,
      channelId: link.channelId ?? null,
      channelTitle: link.channelTitle ?? null,
      channelHandle: link.channelHandle ?? null,
      xUserId: link.xUserId ?? null,
      xUsername: link.xUsername ?? null,
      xName: link.xName ?? null,
    }
  })
  return mapped.filter((x) => x !== null)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)

  const code = requestUrl.searchParams.get('code')
  const nextParam = requestUrl.searchParams.get('next') ?? '/'
  // Check for Cookie-based verification state (fallback if URL params missing)
  const cookieStore = await cookies()
  const verifyCookie = cookieStore.get('ba_x_verify')

  const ytVerify = requestUrl.searchParams.get('yt_verify')
  let xVerifyRaw = requestUrl.searchParams.get('x_verify')
  let xHandleCheck = requestUrl.searchParams.get('x_handle_check')

  if (!xVerifyRaw && verifyCookie?.value) {
    try {
      const state = JSON.parse(decodeURIComponent(verifyCookie.value))
      if (state.index !== undefined) xVerifyRaw = String(state.index)
      if (state.handle) xHandleCheck = state.handle
      console.log('[Callback] Using Cookie State:', state)
    } catch (e) {
      console.error('[Callback] Failed to parse cookie state', e)
    }
  }

  const errorDescription = requestUrl.searchParams.get('error_description')
  const error = requestUrl.searchParams.get('error')

  console.log('[Callback] Incoming:', { url: request.url, code: !!code, xVerifyRaw, error, errorDescription })

  // open redirect 対策：アプリ内パスのみ許可
  const safeNext = nextParam.startsWith('/') ? nextParam : '/'

  const supabase = createRouteHandlerClient(
    { cookies },
    {
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_ANON_KEY!,
    }
  )

  if (code) {
    // PKCE の code を session に交換
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Session check
  const {
    data: { session },
  } = await supabase.auth.getSession()

  let redirectTo = safeNext
  let message = ''

  if (session) {
    // Check if new profile setup is needed
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()

    if (!profile) {
      redirectTo = '/profile/setup'
    } else if (xVerifyRaw && xHandleCheck) {
      // --- Server-Side X Verification Logic ---
      try {
        const xIndex = parseInt(xVerifyRaw, 10)
        if (!isNaN(xIndex)) {
          const providerToken = session.provider_token
          if (!providerToken) {
            message = 'X認証エラー: プロバイダートークンが見つかりません。再連携してください。'
          } else {
            // 1. Fetch X User from Twitter API
            const twitterRes = await fetch('https://api.twitter.com/2/users/me?user.fields=name,username', {
              headers: {
                Authorization: `Bearer ${providerToken}`,
              },
            })

            if (!twitterRes.ok) {
              const errJson = await twitterRes.json().catch(() => ({}))
              console.error('Twitter API Error in Callback:', twitterRes.status, errJson)
              message = `X認証エラー: Twitter APIへの接続に失敗しました (${twitterRes.status})`
            } else {
              const twitterData = await twitterRes.json()
              const xUser = twitterData.data

              if (!xUser || !xUser.username) {
                message = 'X認証エラー: ユーザー情報を取得できませんでした。'
              } else {
                // 2. Validate Handle
                // Handle input might have @ or not, and case might differ
                const inputHandle = xHandleCheck.replace(/^@/, '').toLowerCase()
                const actualHandle = xUser.username.toLowerCase()

                if (inputHandle !== actualHandle) {
                  message = `X認証失敗: 入力されたハンドル(@${xHandleCheck})と、認証されたアカウント(@${xUser.username})が一致しません。`
                } else {
                  // 3. Update Profile
                  // Need to parse current social_links widely
                  let currentLinks: SocialLink[] = []
                  try {
                    // Attempt to parse existing links safely
                    const rawLinks = profile.social_links
                    if (Array.isArray(rawLinks)) {
                      // Assuming it matches the shape roughly, we cast it. 
                      // In a real app we might want more robust parsing like zod.
                      currentLinks = rawLinks as SocialLink[]
                    }
                  } catch (e) { console.error('Error parsing social links', e) }

                  // Ensure the index exists
                  if (currentLinks[xIndex] && currentLinks[xIndex].service === 'x') {
                    const verifiedAt = new Date().toISOString()
                    currentLinks[xIndex] = {
                      ...currentLinks[xIndex],
                      value: `@${xUser.username}`, // Normalize value
                      verified: true,
                      verifiedAt,
                      xUserId: xUser.id,
                      xUsername: xUser.username,
                      xName: xUser.name
                    }

                    const { error: updateError } = await supabase
                      .from('profiles')
                      .update({ social_links: serializeSocialLinksForSave(currentLinks) })
                      .eq('id', session.user.id)

                    if (updateError) {
                      console.error('Profile update error', updateError)
                      message = 'X認証成功しましたが、プロフィールの保存に失敗しました。'
                    } else {
                      message = `X認証成功: @${xUser.username} を確認しました。`
                    }
                  } else {
                    message = 'X認証エラー: リンク情報が見つかりません。もう一度最初から設定してください。'
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Server execution error', err)
        message = 'X認証中に内部エラーが発生しました。'
      }
    }
  }

  const outUrl = new URL(redirectTo, requestUrl)

  // YouTube logic (client-side verify continuation)
  if (redirectTo === safeNext) {
    if (ytVerify) outUrl.searchParams.set('yt_verify', ytVerify)
  }

  // Attach message if any
  if (message) {
    outUrl.searchParams.set('message', encodeURIComponent(message))
  }

  return NextResponse.redirect(outUrl)
}
