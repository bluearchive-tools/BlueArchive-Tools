import { NextResponse } from 'next/server'

const allowedHosts = new Set(['i0.hdslb.com', 'i1.hdslb.com', 'i2.hdslb.com', 'i3.hdslb.com'])

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawUrl = searchParams.get('url')
  if (!rawUrl) {
    return NextResponse.json({ error: 'missing_url' }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
  }

  if (target.protocol !== 'https:' || !allowedHosts.has(target.hostname)) {
    return NextResponse.json({ error: 'forbidden_host' }, { status: 403 })
  }

  try {
    const res = await fetch(target.toString(), {
      headers: {
        referer: 'https://www.bilibili.com/',
        'user-agent': 'Mozilla/5.0',
      },
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'fetch_failed' }, { status: res.status })
    }
    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    return new NextResponse(buffer, {
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 })
  }
}
