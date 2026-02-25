'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyPalette, GIFEncoder, quantize } from 'gifenc'

type Student = {
  id: string
  name: string
  image: string
  attackType: string
  initialStars: number
}

type Options = {
  level: number
  stars: number
  unique: number
  size: number
  borderWidth: number
  cornerRadius: number
  glowStrength: number
  levelTextColor: string
  blinkDelay: number
}

type AttackColor = {
  ring: string
  glow: string
}

const ATTACK_COLORS: Record<string, AttackColor> = {
  爆発: { ring: '#ef4444', glow: '#fca5a5' },
  貫通: { ring: '#f59e0b', glow: '#fde68a' },
  神秘: { ring: '#3b82f6', glow: '#93c5fd' },
  振動: { ring: '#ec4899', glow: '#f9a8d4' },
}

const BASE: Options = {
  level: 90,
  stars: 3,
  unique: 0,
  size: 192,
  borderWidth: 8,
  cornerRadius: 18,
  glowStrength: 0.55,
  levelTextColor: '#cbd5e1',
  blinkDelay: 36,
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string, stroke: string) {
  const inner = radius * 0.5
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
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(1, radius * 0.14)
  ctx.stroke()
}

function drawDanger(ctx: CanvasRenderingContext2D, size: number) {
  const pad = size * 0.07
  const tri = size * 0.26
  const left = size - tri - pad
  const top = pad
  ctx.save()
  ctx.globalAlpha = 0.26
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
  ctx.globalAlpha = 0.45
  ctx.fillStyle = '#7f1d1d'
  ctx.font = `bold ${Math.round(size * 0.12)}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('!', left + tri / 2, top + tri * 0.62)
  ctx.restore()
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  attackType: string,
  options: Options,
  showBlueStar: boolean,
) {
  const size = options.size
  const border = options.borderWidth
  const radius = options.cornerRadius
  const color = ATTACK_COLORS[attackType]
  const hasInvalidAttack = !color

  ctx.clearRect(0, 0, size, size)

  const ring = color?.ring ?? '#64748b'
  const glow = color?.glow ?? '#94a3b8'

  ctx.save()
  ctx.fillStyle = ring
  ctx.shadowColor = glow
  ctx.shadowBlur = size * options.glowStrength * 0.35
  const outer = new Path2D()
  outer.roundRect(0, 0, size, size, radius)
  ctx.fill(outer)
  ctx.restore()

  const inner = new Path2D()
  inner.roundRect(border, border, size - border * 2, size - border * 2, Math.max(0, radius - border * 0.8))
  ctx.save()
  ctx.clip(inner)

  const ratio = Math.max(size / image.width, size / image.height)
  const drawWidth = image.width * ratio
  const drawHeight = image.height * ratio
  const dx = (size - drawWidth) / 2
  const dy = (size - drawHeight) / 2
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight)
  ctx.restore()

  const gradient = ctx.createLinearGradient(0, size * 0.62, 0, size)
  gradient.addColorStop(0, 'rgba(2,6,23,0)')
  gradient.addColorStop(1, 'rgba(2,6,23,0.78)')
  ctx.fillStyle = gradient
  ctx.fillRect(border, border, size - border * 2, size - border * 2)

  const levelFont = Math.round(size * 0.17)
  ctx.font = `italic 700 ${levelFont}px Arial`
  ctx.fillStyle = options.levelTextColor
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = Math.max(2, size * 0.02)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  const levelText = `Lv.${options.level}`
  ctx.strokeText(levelText, size * 0.05, size * 0.28)
  ctx.fillText(levelText, size * 0.05, size * 0.28)

  const yellowStarCount = options.unique >= 1 ? 5 : clamp(options.stars, 1, 10)
  const starBaseY = size * 0.88
  const starSpacing = size * 0.13
  const starRadius = size * 0.045

  for (let i = 0; i < yellowStarCount; i += 1) {
    const x = size * 0.13 + i * starSpacing
    drawStar(ctx, x, starBaseY, starRadius, '#fbbf24', '#92400e')
  }

  if (options.unique >= 1 && showBlueStar) {
    const blueX = size * 0.88
    const blueY = starBaseY - size * 0.01
    drawStar(ctx, blueX, blueY, starRadius * 1.2, '#60a5fa', '#1e3a8a')

    ctx.font = `700 ${Math.round(size * 0.09)}px Arial`
    ctx.fillStyle = '#e0f2fe'
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = Math.max(2, size * 0.014)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const value = String(clamp(options.unique, 1, 99))
    ctx.strokeText(value, blueX, blueY + size * 0.004)
    ctx.fillText(value, blueX, blueY + size * 0.004)
  }

  if (hasInvalidAttack) {
    drawDanger(ctx, size)
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

export default function StudentImageToolPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [options, setOptions] = useState<Options>(BASE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/students')
      const json = (await res.json()) as Student[]
      setStudents(json)
      if (json.length > 0) {
        setSelectedStudentId(json[0].id)
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
    setOptions((prev) => ({ ...prev, stars: selectedStudent.initialStars }))
  }, [selectedStudent])

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
    async (showBlueStar: boolean) => {
      if (!selectedStudent || !canvasRef.current) return

      if (!imageRef.current) {
        imageRef.current = await loadImage(selectedStudent.image)
      }

      canvasRef.current.width = options.size
      canvasRef.current.height = options.size
      const ctx = canvasRef.current.getContext('2d')
      if (!ctx || !imageRef.current) return

      drawCard(ctx, imageRef.current, selectedStudent.attackType, options, showBlueStar)
    },
    [loadImage, options, selectedStudent],
  )

  useEffect(() => {
    imageRef.current = null
    renderPreview(options.unique >= 1).catch(() => setError('画像の描画に失敗しました'))
  }, [selectedStudentId, renderPreview, options.unique])

  useEffect(() => {
    renderPreview(options.unique >= 1).catch(() => setError('画像の描画に失敗しました'))
  }, [options, renderPreview])

  const onDownload = useCallback(async () => {
    if (!selectedStudent || !canvasRef.current) return
    setBusy(true)
    setError('')

    try {
      if (options.unique <= 0) {
        await renderPreview(false)
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
        const delays = [options.blinkDelay, options.blinkDelay]

        const frames = [false, true]
        for (let index = 0; index < frames.length; index += 1) {
          drawCard(ctx, imageRef.current, selectedStudent.attackType, options, frames[index])
          const frame = ctx.getImageData(0, 0, options.size, options.size)
          const palette = quantize(frame.data, 256)
          const indexed = applyPalette(frame.data, palette)
          encoder.writeFrame(indexed, options.size, options.size, {
            palette,
            delay: delays[index],
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

        await renderPreview(true)
      }
    } catch {
      setError('ダウンロード画像の生成に失敗しました')
    } finally {
      setBusy(false)
    }
  }, [loadImage, options, renderPreview, selectedStudent])

  return (
    <main className="p-4 space-y-4 pb-16">
      <section className="rounded border p-4 bg-white space-y-4">
        <h1 className="text-lg font-bold">生徒アイコン画像作成ツール</h1>
        <p className="text-sm text-gray-600">生徒を選んで、レベル表示・星表示・縁色を調整した画像を生成してダウンロードできます。固有1以上は青星が点滅するGIFを出力します。</p>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-semibold">生徒</span>
            <select
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.attackType})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">レベル</span>
            <input
              type="number"
              min={1}
              max={99}
              value={options.level}
              onChange={(event) => setOptions((prev) => ({ ...prev, level: clamp(Number(event.target.value), 1, 99) }))}
              className="w-full rounded border px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">星（固有0時）</span>
            <input
              type="number"
              min={1}
              max={10}
              value={options.stars}
              onChange={(event) => setOptions((prev) => ({ ...prev, stars: clamp(Number(event.target.value), 1, 10) }))}
              className="w-full rounded border px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">固有</span>
            <input
              type="number"
              min={0}
              max={10}
              value={options.unique}
              onChange={(event) => setOptions((prev) => ({ ...prev, unique: clamp(Number(event.target.value), 0, 10) }))}
              className="w-full rounded border px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">画像サイズ(px)</span>
            <input
              type="number"
              min={96}
              max={512}
              step={8}
              value={options.size}
              onChange={(event) => setOptions((prev) => ({ ...prev, size: clamp(Number(event.target.value), 96, 512) }))}
              className="w-full rounded border px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">枠線幅</span>
            <input
              type="number"
              min={2}
              max={20}
              value={options.borderWidth}
              onChange={(event) => setOptions((prev) => ({ ...prev, borderWidth: clamp(Number(event.target.value), 2, 20) }))}
              className="w-full rounded border px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">角丸</span>
            <input
              type="number"
              min={0}
              max={56}
              value={options.cornerRadius}
              onChange={(event) => setOptions((prev) => ({ ...prev, cornerRadius: clamp(Number(event.target.value), 0, 56) }))}
              className="w-full rounded border px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">青星点滅速度(1/100秒)</span>
            <input
              type="number"
              min={8}
              max={100}
              value={options.blinkDelay}
              onChange={(event) => setOptions((prev) => ({ ...prev, blinkDelay: clamp(Number(event.target.value), 8, 100) }))}
              className="w-full rounded border px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-semibold">レベル文字色</span>
            <input
              type="color"
              value={options.levelTextColor}
              onChange={(event) => setOptions((prev) => ({ ...prev, levelTextColor: event.target.value }))}
              className="h-11 w-full rounded border px-2"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => onDownload()}
          disabled={busy || !selectedStudent}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? '生成中...' : options.unique >= 1 ? 'GIFをダウンロード' : 'PNGをダウンロード'}
        </button>

        {selectedStudent && !ATTACK_COLORS[selectedStudent.attackType] && (
          <p className="text-sm text-amber-700">未知の攻撃属性です。危険マークを右上に表示します。</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      <section className="rounded border bg-slate-50 p-4">
        <h2 className="text-base font-semibold mb-3">プレビュー</h2>
        <canvas ref={canvasRef} className="rounded border bg-white max-w-full h-auto" />
      </section>
    </main>
  )
}
