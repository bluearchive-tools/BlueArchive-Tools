'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import students from '../../../data/students.json'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'

type Student = {
  id: string
  name: string
  image: string
  attackType: string
  initialStars: number
}

type ToolSettings = {
  level: number
  star: number
  uniqueStar: number
  blinkMs: number
  showDangerOnUnknown: boolean
}

const IMAGE_TOOL_SETTINGS_KEY = 'app:imageToolSettings'

const ATTACK_COLORS: Record<string, string> = {
  爆発: '#ef4444',
  貫通: '#eab308',
  神秘: '#3b82f6',
  振動: '#ec4899',
}

const DEFAULT_SETTINGS: ToolSettings = {
  level: 90,
  star: 3,
  uniqueStar: 0,
  blinkMs: 450,
  showDangerOnUnknown: true,
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, color: string) => {
  const inner = outer * 0.45
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI / 180) * (i * 72 - 90)
    const angle2 = angle + Math.PI / 5
    ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer)
    ctx.lineTo(x + Math.cos(angle2) * inner, y + Math.sin(angle2) * inner)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 1
  ctx.stroke()
}

const loadImage = async (url: string) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  const done = new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
  })
  img.src = `/api/image-proxy?url=${encodeURIComponent(url)}`
  return done
}

export default function ImageMakerPage() {
  const allStudents = students as Student[]
  const [selectedId, setSelectedId] = useState(allStudents[0]?.id ?? '')
  const [settings, setSettings] = useState<ToolSettings>(DEFAULT_SETTINGS)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const student = useMemo(
    () => allStudents.find((item) => item.id === selectedId) ?? null,
    [allStudents, selectedId]
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(IMAGE_TOOL_SETTINGS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<ToolSettings>
      setSettings((prev) => ({
        ...prev,
        level: typeof parsed.level === 'number' ? clamp(parsed.level, 1, 99) : prev.level,
        star: typeof parsed.star === 'number' ? clamp(parsed.star, 1, 5) : prev.star,
        uniqueStar: typeof parsed.uniqueStar === 'number' ? clamp(parsed.uniqueStar, 0, 10) : prev.uniqueStar,
        blinkMs: typeof parsed.blinkMs === 'number' ? clamp(parsed.blinkMs, 150, 1000) : prev.blinkMs,
        showDangerOnUnknown:
          typeof parsed.showDangerOnUnknown === 'boolean'
            ? parsed.showDangerOnUnknown
            : prev.showDangerOnUnknown,
      }))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(IMAGE_TOOL_SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* ignore */
    }
  }, [settings])

  const renderCard = async (showBlueOverlay: boolean) => {
    if (!student) return null
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const width = 240
    const height = 150
    canvas.width = width
    canvas.height = height

    const color = ATTACK_COLORS[student.attackType] ?? '#6b7280'
    ctx.clearRect(0, 0, width, height)

    ctx.fillStyle = '#e5eef8'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = color
    ctx.lineWidth = 8
    ctx.strokeRect(4, 4, width - 8, height - 8)

    const image = await loadImage(student.image)
    ctx.save()
    ctx.beginPath()
    const imageX = 10
    const imageY = 16
    const imageW = 180
    const imageH = 118
    const radius = 14
    ctx.moveTo(imageX + radius, imageY)
    ctx.arcTo(imageX + imageW, imageY, imageX + imageW, imageY + imageH, radius)
    ctx.arcTo(imageX + imageW, imageY + imageH, imageX, imageY + imageH, radius)
    ctx.arcTo(imageX, imageY + imageH, imageX, imageY, radius)
    ctx.arcTo(imageX, imageY, imageX + imageW, imageY, radius)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(image, imageX, imageY, imageW, imageH)
    ctx.restore()

    ctx.fillStyle = 'rgba(255,255,255,0.78)'
    ctx.fillRect(8, 8, 64, 18)
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 20px Arial'
    ctx.fillText(`Lv.${settings.level}`, 12, 23)

    const baseY = 136
    if (settings.uniqueStar <= 0) {
      const count = clamp(settings.star, 1, 5)
      for (let i = 0; i < count; i++) {
        drawStar(ctx, 22 + i * 26, baseY, 10, '#facc15')
      }
    } else {
      for (let i = 0; i < 5; i++) {
        drawStar(ctx, 22 + i * 26, baseY, 10, '#facc15')
      }
      if (showBlueOverlay) {
        drawStar(ctx, 22 + 4 * 26, baseY, 11, '#38bdf8')
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 14px Arial'
        ctx.fillText(String(settings.uniqueStar), 118, 141)
      }
    }

    if (!ATTACK_COLORS[student.attackType] && settings.showDangerOnUnknown) {
      ctx.fillStyle = 'rgba(220,38,38,0.35)'
      ctx.beginPath()
      ctx.moveTo(width - 46, 6)
      ctx.lineTo(width - 6, 6)
      ctx.lineTo(width - 6, 46)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = 'bold 28px Arial'
      ctx.fillText('⚠', width - 34, 34)
    }

    return canvas
  }

  const downloadPng = async () => {
    if (!student) return
    setBusy(true)
    setMessage('')
    try {
      const canvas = await renderCard(true)
      if (!canvas) return
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${student.name}-card.png`
        a.click()
        URL.revokeObjectURL(url)
      }, 'image/png')
      setMessage('PNGをダウンロードしました')
    } catch {
      setMessage('PNG生成に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const downloadGif = async () => {
    if (!student) return
    setBusy(true)
    setMessage('')
    try {
      const onCanvas = await renderCard(true)
      const offCanvas = await renderCard(false)
      if (!onCanvas || !offCanvas) return
      const onCtx = onCanvas.getContext('2d')
      const offCtx = offCanvas.getContext('2d')
      if (!onCtx || !offCtx) return

      const width = onCanvas.width
      const height = onCanvas.height
      const frameA = onCtx.getImageData(0, 0, width, height)
      const frameB = offCtx.getImageData(0, 0, width, height)

      const palette = quantize(new Uint8Array([...frameA.data, ...frameB.data]), 256)
      const indexedA = applyPalette(frameA.data, palette)
      const indexedB = applyPalette(frameB.data, palette)

      const gif = GIFEncoder()
      gif.writeFrame(indexedA, width, height, { palette, delay: settings.blinkMs })
      gif.writeFrame(indexedB, width, height, { palette, delay: settings.blinkMs })
      gif.finish()
      const bytes = gif.bytesView()

      const blob = new Blob([bytes], { type: 'image/gif' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${student.name}-card.gif`
      a.click()
      URL.revokeObjectURL(url)
      setMessage('GIFをダウンロードしました')
    } catch {
      setMessage('GIF生成に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-bold">画像作成ツール（試作）</h1>
      <p className="text-sm text-gray-600">生徒を選択して、属性色付きカード画像（PNG/GIF）を生成できます。</p>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">生徒
          <select className="block w-full border rounded px-2 py-1" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {allStudents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Lv
          <input type="number" min={1} max={99} className="block w-full border rounded px-2 py-1" value={settings.level} onChange={(e) => setSettings((p) => ({ ...p, level: clamp(Number(e.target.value || 1), 1, 99) }))} />
        </label>
        <label className="text-sm">星（固有0時）
          <input type="number" min={1} max={5} className="block w-full border rounded px-2 py-1" value={settings.star} onChange={(e) => setSettings((p) => ({ ...p, star: clamp(Number(e.target.value || 1), 1, 5) }))} />
        </label>
        <label className="text-sm">固有星（1以上で青星点滅）
          <input type="number" min={0} max={10} className="block w-full border rounded px-2 py-1" value={settings.uniqueStar} onChange={(e) => setSettings((p) => ({ ...p, uniqueStar: clamp(Number(e.target.value || 0), 0, 10) }))} />
        </label>
        <label className="text-sm">点滅間隔(ms)
          <input type="number" min={150} max={1000} className="block w-full border rounded px-2 py-1" value={settings.blinkMs} onChange={(e) => setSettings((p) => ({ ...p, blinkMs: clamp(Number(e.target.value || 450), 150, 1000) }))} />
        </label>
        <label className="text-sm flex items-center gap-2 mt-5">
          <input type="checkbox" checked={settings.showDangerOnUnknown} onChange={(e) => setSettings((p) => ({ ...p, showDangerOnUnknown: e.target.checked }))} />
          不明攻撃属性に危険マークを表示
        </label>
      </div>

      <div className="flex gap-2">
        <button disabled={busy} onClick={downloadPng} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">PNGダウンロード</button>
        <button disabled={busy} onClick={downloadGif} className="px-3 py-2 rounded bg-purple-600 text-white disabled:opacity-50">GIFダウンロード</button>
      </div>
      {message && <p className="text-sm text-green-700">{message}</p>}
      <canvas ref={canvasRef} className="border rounded max-w-full" />
    </main>
  )
}
