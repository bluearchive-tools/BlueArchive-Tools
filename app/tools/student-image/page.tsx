'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyPalette, GIFEncoder, quantize, type RGB } from 'gifenc'

type Student = {
  id: string
  name: string
  image: string
  attackType: string
  initialStars: number
}

type AttackType = '爆発' | '貫通' | '神秘' | '振動'

type Options = {
  level: number
  stars: number
  unique: number
  size: number
  cornerRadius: number
  borderThin: number
  borderBottom: number
  skewRatio: number
  blinkHoldMs: number
}

type AttackColor = {
  ring: string
}

type BlueFrame = {
  alpha: number
  delayMs: number
}

const ATTACK_TYPES: AttackType[] = ['爆発', '貫通', '神秘', '振動']

const ATTACK_COLORS: Record<AttackType, AttackColor> = {
  爆発: { ring: '#e11d48' },
  貫通: { ring: '#d97706' },
  神秘: { ring: '#2563eb' },
  振動: { ring: '#db2777' },
}

const BASE: Options = {
  level: 90,
  stars: 3,
  unique: 0,
  size: 512,
  cornerRadius: 52,
  borderThin: 6,
  borderBottom: 150,
  skewRatio: 0.1,
  blinkHoldMs: 18000,
}

const TRANSPARENT_MARKER: RGB = [1, 2, 3]

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function createParallelogramPath(
  width: number,
  height: number,
  skew: number,
  insetTop: number,
  insetBottom: number,
  insetSide: number,
  offsetY: number,
) {
  const topY = offsetY + insetTop
  const bottomY = offsetY + height - insetBottom
  const leftTopX = skew + insetSide
  const rightTopX = width - insetSide
  const rightBottomX = width - skew - insetSide
  const leftBottomX = insetSide

  const path = new Path2D()
  path.moveTo(leftTopX, topY)
  path.lineTo(rightTopX, topY)
  path.lineTo(rightBottomX, bottomY)
  path.lineTo(leftBottomX, bottomY)
  path.closePath()
  return path
}

function drawStarShape(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  const inner = radius * 0.46
  ctx.beginPath()
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const current = i % 2 === 0 ? radius : inner
    const px = x + Math.cos(angle) * current
    const py = y + Math.sin(angle) * current
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function drawStarWithNumber(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  colorTop: string,
  colorBottom: string,
  stroke: string,
  value: number,
  alpha = 1,
) {
  ctx.save()
  ctx.globalAlpha = alpha

  drawStarShape(ctx, x, y, radius)
  const grad = ctx.createLinearGradient(x, y - radius, x, y + radius)
  grad.addColorStop(0, colorTop)
  grad.addColorStop(1, colorBottom)
  ctx.fillStyle = grad
  ctx.fill()

  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(1, radius * 0.065)
  ctx.lineJoin = 'round'
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x - radius * 0.2, y - radius * 0.25, radius * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fill()

  const text = String(clamp(value, 0, 99))
  ctx.font = `italic 700 ${Math.round(radius * 0.9)}px "M PLUS Rounded 1c", Arial`
  ctx.fillStyle = '#111827'
  ctx.strokeStyle = 'rgba(255,255,255,0.72)'
  ctx.lineWidth = Math.max(0.8, radius * 0.045)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeText(text, x - radius * 0.06, y)
  ctx.fillText(text, x - radius * 0.06, y)

  ctx.restore()
}

function drawDanger(ctx: CanvasRenderingContext2D, size: number) {
  const pad = size * 0.06
  const tri = size * 0.24
  const left = size - tri - pad
  const top = pad
  ctx.save()
  ctx.globalAlpha = 0.24
  ctx.fillStyle = '#ef4444'
  ctx.beginPath()
  ctx.moveTo(left + tri / 2, top)
  ctx.lineTo(left + tri, top + tri)
  ctx.lineTo(left, top + tri)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#7f1d1d'
  ctx.lineWidth = Math.max(1, size * 0.01)
  ctx.stroke()
  ctx.globalAlpha = 0.46
  ctx.fillStyle = '#7f1d1d'
  ctx.font = `bold ${Math.round(size * 0.11)}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('!', left + tri / 2, top + tri * 0.62)
  ctx.restore()
}

function createBlueFrames(holdMs: number): BlueFrame[] {
  const hold = clamp(holdMs, 200, 30000)
  return [
    { alpha: 0, delayMs: hold },
    { alpha: 0.45, delayMs: 140 },
    { alpha: 1, delayMs: 140 },
    { alpha: 1, delayMs: hold },
    { alpha: 0.45, delayMs: 140 },
    { alpha: 0, delayMs: 140 },
  ]
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  attackType: AttackType,
  originalAttackType: string,
  options: Options,
  blueStarAlpha: number,
) {
  const size = options.size
  const frameHeight = size * 0.88
  const frameTop = size * 0.05
  const skew = size * options.skewRatio
  const thin = options.borderThin
  const bottom = options.borderBottom
  const color = ATTACK_COLORS[attackType]
  const ring = color.ring

  const shouldWarn = attackType !== originalAttackType

  ctx.clearRect(0, 0, size, size)
  ctx.imageSmoothingEnabled = true

  const outerPath = createParallelogramPath(size, frameHeight, skew, 0, 0, 0, frameTop)
  const innerBottomInset = Math.max(2, bottom * 0.35)
  const innerPath = createParallelogramPath(size, frameHeight, skew, thin, innerBottomInset, thin, frameTop)

  ctx.fillStyle = ring
  ctx.fill(outerPath)
  ctx.strokeStyle = ring
  ctx.lineWidth = Math.max(2, thin * 1.6)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke(outerPath)

  ctx.save()
  ctx.clip(innerPath)

  const ratio = Math.max(size / image.width, frameHeight / image.height)
  const drawWidth = image.width * ratio
  const drawHeight = image.height * ratio
  const dx = (size - drawWidth) / 2
  const dy = frameTop + (frameHeight - drawHeight) / 2
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight)

  const gradient = ctx.createLinearGradient(0, frameTop + frameHeight * 0.56, 0, frameTop + frameHeight)
  gradient.addColorStop(0, 'rgba(2,6,23,0)')
  gradient.addColorStop(1, 'rgba(2,6,23,0.45)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, frameTop, size, frameHeight)
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.52)'
  ctx.lineWidth = Math.max(1, thin * 0.85)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke(createParallelogramPath(size, frameHeight, skew, thin * 0.8, innerBottomInset * 0.95, thin * 0.8, frameTop))
  ctx.restore()

  const levelFont = Math.round(size * 0.135)
  ctx.font = `italic 700 ${levelFont}px "M PLUS Rounded 1c", Arial`
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(15,23,42,0.42)'
  ctx.lineWidth = Math.max(1, size * 0.006)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const levelText = `Lv.${options.level}`
  ctx.strokeText(levelText, size * 0.095, frameTop + size * 0.015)
  ctx.fillText(levelText, size * 0.095, frameTop + size * 0.015)

  const starRadius = size * 0.12
  const starX = size * 0.18
  const starY = frameTop + frameHeight - Math.max(starRadius * 1.18, size * 0.12)
  drawStarWithNumber(ctx, starX, starY, starRadius, '#fde047', '#f59e0b', '#92400e', options.stars)

  if (options.unique >= 1 && blueStarAlpha > 0) {
    drawStarWithNumber(ctx, starX, starY, starRadius, '#7dd3fc', '#3b82f6', '#1e3a8a', options.unique, blueStarAlpha)
  }

  if (shouldWarn) {
    drawDanger(ctx, size)
  }

  const stripHeight = Math.max(2, size * 0.02)
  const bottomY = frameTop + frameHeight + size * 0.004
  const rightBottomX = size - skew
  const strip = new Path2D()
  strip.moveTo(0, bottomY)
  strip.lineTo(rightBottomX, bottomY)
  strip.lineTo(rightBottomX + 1, bottomY + stripHeight)
  strip.lineTo(1, bottomY + stripHeight)
  strip.closePath()
  ctx.fillStyle = 'rgba(148,163,184,0.42)'
  ctx.fill(strip)

  const clipRadius = Math.max(0, options.cornerRadius)
  if (clipRadius > 0) {
    const rounded = new Path2D()
    rounded.roundRect(0, 0, size, size, clipRadius)
    ctx.save()
    ctx.globalCompositeOperation = 'destination-in'
    ctx.fill(rounded)
    ctx.restore()
  }
}

function dataUrlToBlob(dataUrl: string) {
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] ?? 'image/png'
  const bin = atob(parts[1])
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function prepareTransparentFrame(imageData: ImageData) {
  const rgba = new Uint8Array(imageData.data)
  const alphaMask = new Uint8Array(imageData.width * imageData.height)

  for (let i = 0; i < alphaMask.length; i += 1) {
    const offset = i * 4
    const alpha = rgba[offset + 3]
    if (alpha < 8) {
      alphaMask[i] = 1
      rgba[offset] = TRANSPARENT_MARKER[0]
      rgba[offset + 1] = TRANSPARENT_MARKER[1]
      rgba[offset + 2] = TRANSPARENT_MARKER[2]
      rgba[offset + 3] = 255
    }
  }

  const quantized = quantize(rgba, 255)
  const palette: RGB[] = [TRANSPARENT_MARKER]
  for (let i = 0; i < quantized.length && palette.length < 256; i += 1) {
    const color = quantized[i]
    if (color[0] === TRANSPARENT_MARKER[0] && color[1] === TRANSPARENT_MARKER[1] && color[2] === TRANSPARENT_MARKER[2]) {
      continue
    }
    palette.push(color)
  }

  const indexed = applyPalette(rgba, palette)
  for (let i = 0; i < alphaMask.length; i += 1) {
    if (alphaMask[i] === 1) {
      indexed[i] = 0
    }
  }

  return {
    palette,
    indexed,
  }
}

export default function StudentImageToolPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedAttackType, setSelectedAttackType] = useState<AttackType>('爆発')
  const [options, setOptions] = useState<Options>(BASE)
  const [previewFrameIndex, setPreviewFrameIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const blueFrames = useMemo(() => createBlueFrames(options.blinkHoldMs), [options.blinkHoldMs])
  const previewBlueAlpha = options.unique >= 1 ? blueFrames[previewFrameIndex]?.alpha ?? 0 : 0

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/students')
      const json = (await res.json()) as Student[]
      setStudents(json)
      if (json.length > 0) {
        setSelectedStudentId(json[0].id)
        const initialAttackType = ATTACK_TYPES.includes(json[0].attackType as AttackType)
          ? (json[0].attackType as AttackType)
          : '爆発'
        setSelectedAttackType(initialAttackType)
        setOptions((prev) => ({ ...prev, stars: json[0].initialStars }))
      }
    }
    load().catch(() => setError('生徒データの読み込みに失敗しました'))
  }, [])

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [students, selectedStudentId],
  )

  useEffect(() => {
    if (!selectedStudent) return
    const safeAttackType = ATTACK_TYPES.includes(selectedStudent.attackType as AttackType)
      ? (selectedStudent.attackType as AttackType)
      : '爆発'
    setSelectedAttackType(safeAttackType)
    setOptions((prev) => ({ ...prev, stars: selectedStudent.initialStars }))
  }, [selectedStudent])

  useEffect(() => {
    if (options.unique < 1) {
      setPreviewFrameIndex(0)
      return
    }
    const delay = blueFrames[previewFrameIndex]?.delayMs ?? 140
    const id = window.setTimeout(() => {
      setPreviewFrameIndex((prev) => (prev + 1) % blueFrames.length)
    }, delay)
    return () => window.clearTimeout(id)
  }, [blueFrames, options.unique, previewFrameIndex])

  const loadImage = useCallback(async (sourceUrl: string) => {
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(sourceUrl)}`
    const image = new Image()
    image.src = proxyUrl
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('failed image load'))
    })
    return image
  }, [])

  const renderPreview = useCallback(
    async (alpha: number) => {
      if (!selectedStudent || !canvasRef.current) return
      if (!imageRef.current) {
        imageRef.current = await loadImage(selectedStudent.image)
      }
      canvasRef.current.width = options.size
      canvasRef.current.height = options.size
      const ctx = canvasRef.current.getContext('2d')
      if (!ctx || !imageRef.current) return

      drawCard(ctx, imageRef.current, selectedAttackType, selectedStudent.attackType, options, alpha)
    },
    [loadImage, options, selectedAttackType, selectedStudent],
  )

  useEffect(() => {
    imageRef.current = null
    renderPreview(previewBlueAlpha).catch(() => setError('画像の描画に失敗しました'))
  }, [previewBlueAlpha, renderPreview, selectedStudentId])

  useEffect(() => {
    renderPreview(previewBlueAlpha).catch(() => setError('画像の描画に失敗しました'))
  }, [options, previewBlueAlpha, renderPreview])

  const onDownload = useCallback(async () => {
    if (!selectedStudent || !canvasRef.current) return
    setBusy(true)
    setError('')

    try {
      if (options.unique <= 0) {
        await renderPreview(0)
        const dataUrl = canvasRef.current.toDataURL('image/png')
        const blob = dataUrlToBlob(dataUrl)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${selectedStudent.name}_icon.png`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        if (!imageRef.current) {
          imageRef.current = await loadImage(selectedStudent.image)
        }
        const canvas = document.createElement('canvas')
        canvas.width = options.size
        canvas.height = options.size
        const ctx = canvas.getContext('2d')
        if (!ctx || !imageRef.current) return

        const encoder = GIFEncoder()

        for (let index = 0; index < blueFrames.length; index += 1) {
          const frame = blueFrames[index]
          drawCard(ctx, imageRef.current, selectedAttackType, selectedStudent.attackType, options, frame.alpha)
          const imageData = ctx.getImageData(0, 0, options.size, options.size)
          const transparentFrame = prepareTransparentFrame(imageData)
          encoder.writeFrame(transparentFrame.indexed, options.size, options.size, {
            palette: transparentFrame.palette,
            delay: Math.max(1, Math.round(frame.delayMs / 10)),
            transparent: true,
            transparentIndex: 0,
          })
        }

        encoder.finish()
        const gifBlob = new Blob([encoder.bytesView()], { type: 'image/gif' })
        const url = URL.createObjectURL(gifBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${selectedStudent.name}_icon.gif`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      setError('ダウンロード画像の生成に失敗しました')
    } finally {
      setBusy(false)
    }
  }, [blueFrames, loadImage, options, renderPreview, selectedAttackType, selectedStudent])

  const isDanger = !!selectedStudent && selectedAttackType !== selectedStudent.attackType

  return (
    <main className="p-4 space-y-4 pb-16">
      <section className="rounded border p-4 bg-white space-y-4">
        <h1 className="text-lg font-bold">生徒アイコン画像作成ツール</h1>
        <p className="text-sm text-gray-600">右傾き平行四辺形のフレームで生徒画像を加工します。固有1以上は黄色星の上に同位置・同サイズの青星を重ね、フェード点滅してGIF出力できます。</p>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-semibold">生徒</span>
            <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} className="w-full rounded border px-3 py-2">
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.attackType})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">攻撃属性（選択）</span>
            <select
              value={selectedAttackType}
              onChange={(event) => setSelectedAttackType(event.target.value as AttackType)}
              className="w-full rounded border px-3 py-2"
            >
              {ATTACK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">レベル</span>
            <input type="number" min={1} max={99} value={options.level} onChange={(event) => setOptions((prev) => ({ ...prev, level: clamp(Number(event.target.value), 1, 99) }))} className="w-full rounded border px-3 py-2" />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">星の数字（黄星）</span>
            <input type="number" min={1} max={99} value={options.stars} onChange={(event) => setOptions((prev) => ({ ...prev, stars: clamp(Number(event.target.value), 1, 99) }))} className="w-full rounded border px-3 py-2" />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">固有（青星の数字）</span>
            <input type="number" min={0} max={99} value={options.unique} onChange={(event) => setOptions((prev) => ({ ...prev, unique: clamp(Number(event.target.value), 0, 99) }))} className="w-full rounded border px-3 py-2" />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">画像サイズ(px)</span>
            <input type="number" min={96} max={512} step={8} value={options.size} onChange={(event) => setOptions((prev) => ({ ...prev, size: clamp(Number(event.target.value), 96, 512) }))} className="w-full rounded border px-3 py-2" />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">枠線の細さ（上/左右）</span>
            <input type="number" min={1} max={20} value={options.borderThin} onChange={(event) => setOptions((prev) => ({ ...prev, borderThin: clamp(Number(event.target.value), 1, 20) }))} className="w-full rounded border px-3 py-2" />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">枠線の太さ（下）</span>
            <input type="number" min={4} max={220} value={options.borderBottom} onChange={(event) => setOptions((prev) => ({ ...prev, borderBottom: clamp(Number(event.target.value), 4, 220) }))} className="w-full rounded border px-3 py-2" />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">右傾き率</span>
            <input type="number" min={0.05} max={0.25} step={0.01} value={options.skewRatio} onChange={(event) => setOptions((prev) => ({ ...prev, skewRatio: clamp(Number(event.target.value), 0.05, 0.25) }))} className="w-full rounded border px-3 py-2" />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">青星待機時間(ms)</span>
            <input type="number" min={200} max={30000} step={100} value={options.blinkHoldMs} onChange={(event) => setOptions((prev) => ({ ...prev, blinkHoldMs: clamp(Number(event.target.value), 200, 30000) }))} className="w-full rounded border px-3 py-2" />
          </label>
        </div>

        <button type="button" onClick={() => onDownload()} disabled={busy || !selectedStudent} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          {busy ? '生成中...' : options.unique >= 1 ? 'GIFをダウンロード' : 'PNGをダウンロード'}
        </button>

        {isDanger && <p className="text-sm text-amber-700">本来の攻撃属性ではないため、右上に危険マークを表示します。</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      <section className="rounded border bg-slate-50 p-4">
        <h2 className="text-base font-semibold mb-3">プレビュー（固有1以上ならフェード点滅）</h2>
        <canvas ref={canvasRef} className="rounded border bg-white max-w-full h-auto" />
      </section>
    </main>
  )
}
