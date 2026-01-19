import { NextResponse } from 'next/server'

const DEFAULT_ENDPOINT = 'https://api-inference.huggingface.co/models/PaddlePaddle/paddleocr'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('image')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '画像が見つかりません。' }, { status: 400 })
  }

  const endpoint = process.env.OCR_ENDPOINT ?? DEFAULT_ENDPOINT
  const token = process.env.OCR_API_TOKEN
  const headers: Record<string, string> = {
    'Content-Type': file.type || 'application/octet-stream',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const body = Buffer.from(await file.arrayBuffer())
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body,
  })

  const text = await res.text()
  let data: unknown = text
  try {
    data = JSON.parse(text)
  } catch {
    // keep raw text
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: 'OCRサービスの呼び出しに失敗しました。', detail: data },
      { status: 502 }
    )
  }

  return NextResponse.json({ data })
}
