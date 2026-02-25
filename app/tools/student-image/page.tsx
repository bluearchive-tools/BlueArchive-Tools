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
  cornerRadius: number
  borderThin: number
  borderBottom: number
  skewRatio: number
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
  cornerRadius: 14,
  borderThin: 3,
  borderBottom: 11,
  skewRatio: 0.14,
  glowStrength: 0.52,
  levelTextColor: '#cbd5e1',
  blinkDelay: 34,
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function createParallelogramPath(size: number, skew: number, insetTop: number, insetBottom: number, insetSide: number) {
  const topY = insetTop
  const bottomY = size - insetBottom
  const leftTopX = skew + insetSide
  const rightTopX = size - insetSide
  const rightBottomX = size - skew - insetSide
  const leftBottomX = insetSide

  const path = new Path2D()
  path.moveTo(leftTopX, topY)
  path.lineTo(rightTopX, topY)
  path.lineTo(rightBottomX, bottomY)
  path.lineTo(leftBottomX, bottomY)
  path.closePath()
  return path
}

function drawStarWithNumber(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill: string,
  stroke: string,
  value: number,
) {
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
  ctx.lineWidth = Math.max(2, radius * 0.16)
  ctx.stroke()

  const text = String(clamp(value, 0, 99))
  ctx.font = `700 ${Math.round(radius * 1.08)}px Arial`
  ctx.fillStyle = '#f8fafc'
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = Math.max(2, radius * 0.13)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeText(text, x, y + radius * 0.05)
  ctx.fillText(text, x, y + radius * 0.05)
}

function drawDanger(ctx: CanvasRenderingContext2D, size: number) {
  const pad = size * 0.06
  const tri = size * 0.24
  const left = size - tri - pad
  const top = pad
  ctx.save()
  ctx.globalAlpha = 0.22
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
  ctx.font = `bold ${Math.round(size * 0.11)}px Arial`
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
  const skew = size * options.skewRatio
  const thin = options.borderThin
  const bottom = options.borderBottom
  const color = ATTACK_COLORS[attackType]
  const hasInvalidAttack = !color
  const ring = color?.ring ?? '#64748b'
  const glow = color?.glow ?? '#94a3b8'

  ctx.clearRect(0, 0, size, size)

  const outerPath = createParallelogramPath(size, skew, 0, 0, 0)
  const innerPath = createParallelogramPath(size, skew, thin, bottom, thin)

  ctx.save()
  ctx.fillStyle = ring
  ctx.shadowColor = glow
  ctx.shadowBlur = size * options.glowStrength * 0.3
  ctx.fill(outerPath)
  ctx.restore()

  ctx.save()
  ctx.clip(innerPath)
  const ratio = Math.max(size / image.width, size / image.height)
  const drawWidth = image.width * ratio
  const drawHeight = image.height * ratio
  const dx = (size - drawWidth) / 2
  const dy = (size - drawHeight) / 2
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight)

  const gradient = ctx.createLinearGradient(0, size * 0.56, 0, size)
  gradient.addColorStop(0, 'rgba(2,6,23,0)')
  gradient.addColorStop(1, 'rgba(2,6,23,0.82)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = '#ffffff'
  ctx.globalAlpha = 0.55
  ctx.lineWidth = Math.max(1, thin * 0.45)
  ctx.stroke(createParallelogramPath(size, skew, thin * 0.7, bottom * 0.88, thin * 0.7))
  ctx.restore()

  const levelFont = Math.round(size * 0.17)
  ctx.font = `italic 700 ${levelFont}px Arial`
  ctx.fillStyle = options.levelTextColor
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = Math.max(2, size * 0.02)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  const levelText = `Lv.${options.level}`
  ctx.strokeText(levelText, size * 0.08, size * 0.28)
  ctx.fillText(levelText, size * 0.08, size * 0.28)

  const starX = size * 0.18
  const starY = size * 0.83
  const starRadius = size * 0.11
  drawStarWithNumber(ctx, starX, starY, starRadius, '#fbbf24', '#92400e', options.stars)

  if (options.unique >= 1 && showBlueStar) {
    drawStarWithNumber(ctx, starX, starY, starRadius, '#60a5fa', '#1e3a8a', options.unique)
  }

  if (hasInvalidAttack) {
    drawDanger(ctx, size)
  }

  const shadowBottom = createParallelogramPath(size, skew, size - bottom, 0, 0)
  ctx.save()
  ctx.globalAlpha = 0.17
  ctx.fillStyle = '#020617'
  ctx.fill(shadowBottom)
  ctx.restore()

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

export default function StudentImageToolPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedAttackType, setSelectedAttackType] = useState('')
  const [options, setOptions] = useState<Options>(BASE)
  const [blinkOn, setBlinkOn] = useState(true)
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
        setSelectedAttackType(json[0].attackType)
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
    setSelectedAttackType(selectedStudent.attackType)
    setOptions((prev) => ({ ...prev, stars: selectedStudent.initialStars }))
  }, [selectedStudent])

  useEffect(() => {
    if (options.unique < 1) {
      setBlinkOn(false)
      return
    }
    let mounted = true
    const id = window.setInterval(() => {
      if (!mounted) return
      setBlinkOn((prev) => !prev)
    }, clamp(options.blinkDelay, 8, 100) * 10)
    return () => {
      mounted = false
      window.clearInterval(id)
    }
  }, [options.blinkDelay, options.unique])

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
      drawCard(ctx, imageRef.current, selectedAttackType, options, showBlueStar)
    },
    [loadImage, options, selectedAttackType, selectedStudent],
  )

  useEffect(() => {
    imageRef.current = null
    renderPreview(options.unique >= 1 && blinkOn).catch(() => setError('画像の描画に失敗しました'))
  }, [selectedStudentId, renderPreview, options.unique, blinkOn])

  useEffect(() => {
    renderPreview(options.unique >= 1 && blinkOn).catch(() => setError('画像の描画に失敗しました'))
  }, [options, renderPreview, blinkOn])

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
          drawCard(ctx, imageRef.current, selectedAttackType, options, frames[index])
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
      }
    } catch {
      setError('ダウンロード画像の生成に失敗しました')
    } finally {
      setBusy(false)
    }
  }, [loadImage, options, renderPreview, selectedAttackType, selectedStudent])

  const isUnknownAttackType = !ATTACK_COLORS[selectedAttackType]

  return (
    <main className="p-4 space-y-4 pb-16">
      <section className="rounded border p-4 bg-white space-y-4">
        <h1 className="text-lg font-bold">生徒アイコン画像作成ツール</h1>
        <p className="text-sm text-gray-600">右傾き平行四辺形のフレームで生徒画像を加工します。固有1以上は黄色星の上に同位置・同サイズの青星を重ねて点滅表示し、GIF出力できます。</p>

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
            <span className="font-semibold">攻撃属性（手動変更可）</span>
            <input
              type="text"
              value={selectedAttackType}
              onChange={(event) => setSelectedAttackType(event.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="爆発 / 貫通 / 神秘 / 振動"
            />
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
            <span className="font-semibold">星の数字（黄星）</span>
            <input
              type="number"
              min={1}
              max={99}
              value={options.stars}
              onChange={(event) => setOptions((prev) => ({ ...prev, stars: clamp(Number(event.target.value), 1, 99) }))}
              className="w-full rounded border px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">固有（青星の数字）</span>
            <input
              type="number"
              min={0}
              max={99}
              value={options.unique}
              onChange={(event) => setOptions((prev) => ({ ...prev, unique: clamp(Number(event.target.value), 0, 99) }))}
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
            <span className="font-semibold">枠線の細さ（上/左右）</span>
            <input
              type="number"
              min={1}
              max={12}
              value={options.borderThin}
              onChange={(event) => setOptions((prev) => ({ ...prev, borderThin: clamp(Number(event.target.value), 1, 12) }))}
              className="w-full rounded border px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">枠線の太さ（下）</span>
            <input
              type="number"
              min={4}
              max={28}
              value={options.borderBottom}
              onChange={(event) => setOptions((prev) => ({ ...prev, borderBottom: clamp(Number(event.target.value), 4, 28) }))}
              className="w-full rounded border px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">右傾き率</span>
            <input
              type="number"
              min={0.05}
              max={0.25}
              step={0.01}
              value={options.skewRatio}
              onChange={(event) => setOptions((prev) => ({ ...prev, skewRatio: clamp(Number(event.target.value), 0.05, 0.25) }))}
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

        {isUnknownAttackType && <p className="text-sm text-amber-700">未知の攻撃属性です。右上に危険マークを表示します。</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      <section className="rounded border bg-slate-50 p-4">
        <h2 className="text-base font-semibold mb-3">プレビュー（固有1以上なら点滅）</h2>
        <canvas ref={canvasRef} className="rounded border bg-white max-w-full h-auto" />
      </section>
    </main>
  )
}
