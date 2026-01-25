import { NextResponse } from 'next/server'
import { createReadStream, statSync } from 'fs'
import path from 'path'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const file = url.pathname.split('/').pop() ?? ''
  const decoded = decodeURIComponent(file)

  if (!/^[\w.-]+\.opus$/.test(decoded)) {
    return new NextResponse('Invalid file', { status: 400 })
  }

  const filePath = path.join(process.cwd(), 'data', 'bgm', decoded)

  try {
    const stat = statSync(filePath)
    const stream = createReadStream(filePath)

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        'Content-Type': 'audio/ogg',
        'Content-Length': stat.size.toString(),
        'Accept-Ranges': 'bytes',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
