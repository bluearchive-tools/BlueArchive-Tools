import { NextRequest, NextResponse } from 'next/server'

type BlueArchiveWikiFile = {
  name?: string
  url?: string
}

type BlueArchiveWikiResponse = {
  files?: BlueArchiveWikiFile[]
}

type ExpressionResult = {
  name: string
  imageUrl: string
}

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title')?.trim() ?? ''
  if (!title) {
    return NextResponse.json({ message: 'title is required' }, { status: 400 })
  }

  try {
    const response = await fetch(`https://bluearchive.wiki/wiki/${encodeURIComponent(title)}?output=1&format=json`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ message: `wiki fetch failed: ${response.status}` }, { status: 502 })
    }

    const payload = await response.json() as BlueArchiveWikiResponse
    const files = Array.isArray(payload.files) ? payload.files : []

    const expressions: ExpressionResult[] = files
      .filter((file) => typeof file.name === 'string' && typeof file.url === 'string' && file.name.includes('Portrait') && file.name.includes('.webp'))
      .map((file) => ({
        name: file.name!.replace(/\.[^.]+$/, '').replace(/^.*?Portrait_?/, ''),
        imageUrl: file.url!,
      }))

    return NextResponse.json({ title, expressions })
  } catch {
    return NextResponse.json({ message: 'wiki fetch failed' }, { status: 502 })
  }
}
