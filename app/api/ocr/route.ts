import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('image')
  const requestedModel = formData.get('model')
  const requestedEngine = formData.get('engine')
  const model =
    typeof requestedModel === 'string' ? requestedModel.trim().toLowerCase() : ''
  const engine =
    typeof requestedEngine === 'string' ? requestedEngine.trim().toLowerCase() : ''

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '画像が見つかりません。' }, { status: 400 })
  }

  const token = process.env.OCR_API_TOKEN
  const mode = process.env.OCR_ENDPOINT_MODE
  const useHighModel = model === 'high' || model === 'accurate'
  const basePrimaryEndpoint = process.env.OCR_ENDPOINT_PRIMARY ?? process.env.OCR_ENDPOINT
  const baseFallbackEndpoint = process.env.OCR_ENDPOINT_FALLBACK
  const highPrimaryEndpoint =
    process.env.OCR_ENDPOINT_PRIMARY_HIGH ?? process.env.OCR_ENDPOINT_HIGH
  const highFallbackEndpoint = process.env.OCR_ENDPOINT_FALLBACK_HIGH
  const highEndpoints = [highPrimaryEndpoint, highFallbackEndpoint].filter(
    (value, index, self): value is string => Boolean(value) && self.indexOf(value) === index
  )
  const baseEndpoints = [basePrimaryEndpoint, baseFallbackEndpoint].filter(
    (value, index, self): value is string => Boolean(value) && self.indexOf(value) === index
  )
  const endpoints = useHighModel && highEndpoints.length > 0 ? highEndpoints : baseEndpoints
  if (endpoints.length === 0) {
    return NextResponse.json(
      { error: 'OCRエンドポイントが設定されていません。', detail: { model, engine } },
      { status: 500 }
    )
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  const buildInit = (useMultipart: boolean): RequestInit => {
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const init: RequestInit = { method: 'POST', headers }
    if (useMultipart) {
      const forwardForm = new FormData()
      forwardForm.append('image', file, file.name || 'image')
      if (model) {
        forwardForm.append('model', model)
      }
      if (engine) {
        forwardForm.append('engine', engine)
      }
      init.body = forwardForm
    } else {
      headers['Content-Type'] = file.type || 'application/octet-stream'
      init.body = fileBuffer
    }
    return init
  }

  let lastError: unknown = null
  for (const endpoint of endpoints) {
    const isHuggingFace =
      endpoint.includes('api-inference.huggingface.co') ||
      endpoint.includes('router.huggingface.co')
    const useMultipart = mode ? mode === 'multipart' : !isHuggingFace
    try {
      const res = await fetch(endpoint, buildInit(useMultipart))
      const text = await res.text()
      let data: unknown = text
      try {
        data = JSON.parse(text)
      } catch {
        // keep raw text
      }

      if (!res.ok) {
        lastError = { endpoint, data }
        continue
      }

      return NextResponse.json({ data })
    } catch (error) {
      lastError = { endpoint, error: String(error) }
    }
  }

  return NextResponse.json(
    { error: 'OCRサービスの呼び出しに失敗しました。', detail: lastError },
    { status: 502 }
  )
}
