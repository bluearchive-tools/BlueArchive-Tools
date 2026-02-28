import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('url')
  if (!target) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 })
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return NextResponse.json({ error: 'invalid protocol' }, { status: 400 })
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'BlueArchive-Tools/1.0',
      },
      cache: 'force-cache',
      next: { revalidate: 60 * 60 * 24 },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'failed to fetch image' }, { status: response.status })
    }

    const contentType = response.headers.get('content-type') || 'image/png'
    const buffer = await response.arrayBuffer()
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'failed to fetch image' }, { status: 500 })
  }
}
