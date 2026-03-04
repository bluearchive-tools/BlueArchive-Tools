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
  borderTop: number
  borderSide: number
  borderBottom: number
  skewRatio: number
  blinkHoldMs: number
  levelXRatio: number
  levelYRatio: number
  layoutOffsetX: number
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
  爆発: { ring: '#920b05' },
  貫通: { ring: '#c08b0b' },
  神秘: { ring: '#296c99' },
  振動: { ring: '#b060aa' },
}

const BASE: Options = {
  level: 90,
  stars: 3,
  unique: 0,
  size: 512,
  cornerRadius: 52,
  borderTop: 6,
  borderSide: 5,
  borderBottom: 45,
  skewRatio: 0.11,
  blinkHoldMs: 18000,
  levelXRatio: 0.11,
  levelYRatio: 0.02,
  layoutOffsetX: 1,
}


function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

type Point = { x: number; y: number }

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function normalize(vector: Point) {
  const len = Math.hypot(vector.x, vector.y)
  if (len === 0) return { x: 0, y: 0 }
  return { x: vector.x / len, y: vector.y / len }
}

function buildRoundedPolygonPath(points: Point[], radius: number) {
  const path = new Path2D()
  if (points.length < 3) return path

  const corners = points.map((point, index) => {
    const prev = points[(index - 1 + points.length) % points.length]
    const next = points[(index + 1) % points.length]

    const toPrev = { x: prev.x - point.x, y: prev.y - point.y }
    const toNext = { x: next.x - point.x, y: next.y - point.y }
    const prevLen = Math.hypot(toPrev.x, toPrev.y)
    const nextLen = Math.hypot(toNext.x, toNext.y)
    const currentRadius = Math.min(radius, prevLen * 0.5, nextLen * 0.5)
    const prevDir = normalize(toPrev)
    const nextDir = normalize(toNext)

    return {
      point,
      start: {
        x: point.x + prevDir.x * currentRadius,
        y: point.y + prevDir.y * currentRadius,
      },
      end: {
        x: point.x + nextDir.x * currentRadius,
        y: point.y + nextDir.y * currentRadius,
      },
    }
  })

  path.moveTo(corners[0].end.x, corners[0].end.y)
  for (let i = 1; i <= corners.length; i += 1) {
    const current = corners[i % corners.length]
    path.lineTo(current.start.x, current.start.y)
    path.quadraticCurveTo(current.point.x, current.point.y, current.end.x, current.end.y)
  }
  path.closePath()
  return path
}

function createParallelogramPath(
  width: number,
  height: number,
  skew: number,
  insetTop: number,
  insetBottom: number,
  insetSide: number,
  offsetY: number,
  cornerRadius = 0,
) {
  const topY = offsetY + insetTop
  const bottomY = offsetY + height - insetBottom
  const leftTopX = skew + insetSide
  const rightTopX = width - insetSide
  const rightBottomX = width - skew - insetSide
  const leftBottomX = insetSide

  const p1: Point = { x: leftTopX, y: topY }
  const p2: Point = { x: rightTopX, y: topY }
  const p3: Point = { x: rightBottomX, y: bottomY }
  const p4: Point = { x: leftBottomX, y: bottomY }

  const maxRadius = Math.max(0, Math.min(distance(p1, p2), distance(p2, p3), distance(p3, p4), distance(p4, p1)) * 0.25)
  const r = Math.min(cornerRadius, maxRadius)
  return buildRoundedPolygonPath([p1, p2, p3, p4], r)
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
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = radius * 0.22
  ctx.shadowOffsetY = radius * 0.07

  const grad = ctx.createLinearGradient(x, y - radius, x, y + radius)
  grad.addColorStop(0, '#fff7c2')
  grad.addColorStop(0.32, colorTop)
  grad.addColorStop(0.72, colorBottom)
  grad.addColorStop(1, '#8a4f00')
  ctx.fillStyle = grad
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(1.2, radius * 0.08)
  ctx.lineJoin = 'round'
  ctx.stroke()

  drawStarShape(ctx, x, y, radius * 0.86)
  const innerGlow = ctx.createRadialGradient(x - radius * 0.2, y - radius * 0.28, radius * 0.05, x, y, radius * 0.9)
  innerGlow.addColorStop(0, 'rgba(255,255,255,0.8)')
  innerGlow.addColorStop(0.55, 'rgba(255,255,255,0.2)')
  innerGlow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = innerGlow
  ctx.fill()

  ctx.beginPath()
  ctx.arc(x - radius * 0.24, y - radius * 0.3, radius * 0.14, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
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

function createInnerWindowPath(
  size: number,
  frameHeight: number,
  frameTop: number,
  outerSkew: number,
  thin: number,
  bottom: number,
  sideInset: number,
  cornerRadius: number,
) {
  const topY = frameTop + thin
  const bottomY = frameTop + frameHeight - bottom
  const visibleHeight = bottomY - topY
  const innerSkew = outerSkew * (visibleHeight / frameHeight)

  const leftTopX = outerSkew + sideInset
  const rightTopX = size - sideInset
  const leftBottomX = leftTopX - innerSkew
  const rightBottomX = rightTopX - innerSkew

  const p1: Point = { x: leftTopX, y: topY }
  const p2: Point = { x: rightTopX, y: topY }
  const p3: Point = { x: rightBottomX, y: bottomY }
  const p4: Point = { x: leftBottomX, y: bottomY }

  const maxRadius = Math.max(
    0,
    Math.min(distance(p1, p2), distance(p2, p3), distance(p3, p4), distance(p4, p1)) * 0.25,
  )
  const r = Math.min(cornerRadius, maxRadius)

  return {
    path: buildRoundedPolygonPath([p1, p2, p3, p4], r),
    minX: Math.min(leftTopX, leftBottomX),
    maxX: Math.max(rightTopX, rightBottomX),
    topY,
    bottomY,
  }
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
  const topBorder = options.borderTop
  const sideBorder = options.borderSide
  const bottom = options.borderBottom
  const skewSlope = skew / frameHeight
  const sideInset = sideBorder * Math.hypot(1, skewSlope)
  const color = ATTACK_COLORS[attackType]
  const ring = color.ring

  const shouldWarn = attackType !== originalAttackType

  ctx.clearRect(0, 0, size, size)
  ctx.imageSmoothingEnabled = true

  const outerPath = createParallelogramPath(size, frameHeight, skew, 0, 0, 0, frameTop, options.cornerRadius)
  const innerWindow = createInnerWindowPath(size, frameHeight, frameTop, skew, topBorder, bottom, sideInset, options.cornerRadius)

  ctx.save()
  ctx.translate(options.layoutOffsetX, 0)

  ctx.fillStyle = ring
  ctx.fill(outerPath)

  const targetLeft = innerWindow.minX
  const targetTop = innerWindow.topY
  const targetWidth = innerWindow.maxX - innerWindow.minX
  const targetHeight = innerWindow.bottomY - innerWindow.topY
  const ratio = Math.max(targetWidth / image.width, targetHeight / image.height)
  const drawWidth = image.width * ratio
  const drawHeight = image.height * ratio
  const dx = (targetWidth - drawWidth) / 2
  const dy = (targetHeight - drawHeight) / 2

  ctx.save()
  ctx.clip(innerWindow.path)
  ctx.drawImage(image, targetLeft + dx, targetTop + dy, drawWidth, drawHeight)
  ctx.restore()

  const levelFont = Math.round(size * 0.135)
  ctx.font = `italic 700 ${levelFont}px "M PLUS Rounded 1c", Arial`
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(15,23,42,0.42)'
  ctx.lineWidth = Math.max(1.9, size * 0.0095)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const levelText = `Lv.${options.level}`
  const levelX = size * options.levelXRatio
  const levelY = frameTop + size * options.levelYRatio
  ctx.strokeText(levelText, levelX, levelY)
  ctx.fillText(levelText, levelX, levelY)

  const starRadius = size * 0.12
  const starX = size * 0.14
  const starY = frameTop + frameHeight - Math.max(starRadius * 1.18, size * 0.12)
  drawStarWithNumber(ctx, starX, starY, starRadius, '#fde047', '#f59e0b', '#92400e', options.stars)

  if (options.unique >= 1 && blueStarAlpha > 0) {
    drawStarWithNumber(ctx, starX, starY, starRadius, '#7dd3fc', '#3b82f6', '#1e3a8a', options.unique, blueStarAlpha)
  }

  if (shouldWarn) {
    drawDanger(ctx, size)
  }

  ctx.restore()

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

function buildParallelogramVisibleMask(options: Options) {
  const size = options.size
  const frameHeight = size * 0.88
  const frameTop = size * 0.05
  const skew = size * options.skewRatio

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new Uint8Array(size * size)

  const path = createParallelogramPath(size, frameHeight, skew, 0, 0, 0, frameTop, options.cornerRadius)
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#ffffff'
  ctx.save()
  ctx.translate(options.layoutOffsetX, 0)
  ctx.fill(path)
  ctx.restore()

  const data = ctx.getImageData(0, 0, size, size).data
  const mask = new Uint8Array(size * size)
  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = data[i * 4 + 3] > 10 ? 1 : 0
  }
  return mask
}

function prepareTransparentFrame(imageData: ImageData, visibleMask: Uint8Array) {
  const rgba = new Uint8Array(imageData.data)
  const basePalette = quantize(rgba, 255)
  const palette: RGB[] = [[0, 0, 0], ...basePalette.slice(0, 255)]
  const indexed = applyPalette(rgba, basePalette)
  const maskedIndexed = new Uint8Array(indexed.length)

  for (let i = 0; i < visibleMask.length; i += 1) {
    maskedIndexed[i] = visibleMask[i] === 0 ? 0 : indexed[i] + 1
  }

  return { palette, indexed: maskedIndexed }
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
        const visibleMask = buildParallelogramVisibleMask(options)

        for (let index = 0; index < blueFrames.length; index += 1) {
          const frame = blueFrames[index]
          drawCard(ctx, imageRef.current, selectedAttackType, selectedStudent.attackType, options, frame.alpha)
          const imageData = ctx.getImageData(0, 0, options.size, options.size)
          const transparentFrame = prepareTransparentFrame(imageData, visibleMask)
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
            <span className="font-semibold">枠線の細さ（上）</span>
            <input type="number" min={1} max={20} value={options.borderTop} onChange={(event) => setOptions((prev) => ({ ...prev, borderTop: clamp(Number(event.target.value), 1, 20) }))} className="w-full rounded border px-3 py-2" />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">枠線の細さ（左右）</span>
            <input type="number" min={1} max={20} value={options.borderSide} onChange={(event) => setOptions((prev) => ({ ...prev, borderSide: clamp(Number(event.target.value), 1, 20) }))} className="w-full rounded border px-3 py-2" />
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

          <label className="space-y-1 text-sm">
            <span className="font-semibold">Lv位置X比率</span>
            <input type="number" min={0} max={0.5} step={0.005} value={options.levelXRatio} onChange={(event) => setOptions((prev) => ({ ...prev, levelXRatio: clamp(Number(event.target.value), 0, 0.5) }))} className="w-full rounded border px-3 py-2" />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">Lv位置Y比率</span>
            <input type="number" min={-0.05} max={0.3} step={0.005} value={options.levelYRatio} onChange={(event) => setOptions((prev) => ({ ...prev, levelYRatio: clamp(Number(event.target.value), -0.05, 0.3) }))} className="w-full rounded border px-3 py-2" />
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
