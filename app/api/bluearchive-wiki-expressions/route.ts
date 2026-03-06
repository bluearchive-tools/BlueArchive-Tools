import { NextRequest, NextResponse } from 'next/server'

type ExpressionResult = {
  name: string
  imageUrl: string
}

function decodeHtml(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function normalizeWikiTitle(title: string) {
  return title.replaceAll(' ', '_')
}

function toOriginalImageUrl(url: string) {
  const thumbMarker = '/thumb/'
  const thumbIndex = url.indexOf(thumbMarker)
  if (thumbIndex < 0) return url

  const rest = url.slice(thumbIndex + thumbMarker.length)
  const slashIndex = rest.lastIndexOf('/')
  if (slashIndex < 0) return url

  return `${url.slice(0, thumbIndex)}/${rest.slice(0, slashIndex)}`
}

function parseGalleryExpressions(html: string) {
  const itemRegex = /<li[^>]*class="[^"]*gallerybox[^"]*"[\s\S]*?<\/li>/g
  const fileHrefRegex = /href="([^"]*\/wiki\/File:[^"]+\.(?:png|webp|jpg|jpeg)[^"]*)"/i
  const imgSrcRegex = /<img[^>]+src="([^"]+)"/i

  const matches = html.match(itemRegex) ?? []
  const seen = new Set<string>()
  const expressions: ExpressionResult[] = []

  for (const item of matches) {
    const hrefMatch = item.match(fileHrefRegex)
    const srcMatch = item.match(imgSrcRegex)
    if (!hrefMatch || !srcMatch) continue

    const rawHref = decodeHtml(hrefMatch[1] ?? '')
    const rawSrc = decodeHtml(srcMatch[1] ?? '')
    if (!rawHref || !rawSrc) continue

    const fileName = rawHref.split('/wiki/File:')[1]?.split('?')[0]?.split('#')[0] ?? ''
    if (!fileName || seen.has(fileName)) continue
    seen.add(fileName)

    const imageUrl = toOriginalImageUrl(rawSrc)
    expressions.push({
      name: fileName.replace(/\.[^.]+$/, ''),
      imageUrl,
    })
  }

  return expressions
}

export async function GET(request: NextRequest) {
  const rawTitle = request.nextUrl.searchParams.get('title')?.trim() ?? ''
  if (!rawTitle) {
    return NextResponse.json({ message: 'title is required' }, { status: 400 })
  }

  const title = normalizeWikiTitle(rawTitle)
  const url = `https://bluearchive.wiki/wiki/${encodeURIComponent(title)}/gallery`

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ message: `wiki fetch failed: ${response.status}` }, { status: 502 })
    }

    const html = await response.text()
    const expressions = parseGalleryExpressions(html)
    return NextResponse.json({ title, expressions })
  } catch {
    return NextResponse.json({ message: 'wiki fetch failed' }, { status: 502 })
  }
}
