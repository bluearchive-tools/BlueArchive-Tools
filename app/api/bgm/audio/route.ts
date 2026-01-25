import fs from 'fs/promises'
import path from 'path'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const file = searchParams.get('file')
  if (!file) {
    return new Response('missing file', { status: 400 })
  }

  const safeName = path.basename(file)
  const filePath = path.join(process.cwd(), 'data', 'bgm', safeName)

  try {
    const data = await fs.readFile(filePath)
    return new Response(data, {
      headers: {
        'Content-Type': 'audio/ogg',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new Response('not found', { status: 404 })
  }
}
