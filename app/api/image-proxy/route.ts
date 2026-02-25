import { NextRequest, NextResponse } from 'next/server'

const isAllowedImageUrl = (value: string) => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    return true
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')
  if (!rawUrl || !isAllowedImageUrl(rawUrl)) {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 })
  }

  try {
    const res = await fetch(rawUrl, {
      headers: {
        'User-Agent': 'BlueArchive-Tools/1.0',
      },
      cache: 'force-cache',
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'fetch failed' }, { status: 502 })
    }

    const contentType = res.headers.get('content-type') ?? 'image/png'
    const body = await res.arrayBuffer()
    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'proxy error' }, { status: 500 })
  }
}
