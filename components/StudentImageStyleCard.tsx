'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type AttackType = '爆発' | '貫通' | '神秘' | '振動'

type StudentCardData = {
  id: string
  name: string
  image: string
  attackType: string
  characterType: string
  initialStars: number
}

type Props = {
  student: StudentCardData | undefined
  memberLevel?: number
  memberStar?: number
  memberUniqueStar?: number
}

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
  levelXRatio: number
  levelYRatio: number
  starNumberXRatio: number
  starNumberYRatio: number
  badgeMarginRight: number
  badgeMarginBottom: number
}

type Point = { x: number; y: number }

const ATTACK_COLORS: Record<AttackType, { ring: string }> = {
  爆発: { ring: '#920b05' },
  貫通: { ring: '#c08b0b' },
  神秘: { ring: '#296c99' },
  振動: { ring: '#b060aa' },
}

const CHARACTER_TYPE_ICONS: Record<string, string> = {
  タンク: 'https://static.wikitide.net/bluearchivewiki/a/af/Tank.svg',
  アタッカー: 'https://static.wikitide.net/bluearchivewiki/d/d5/Attacker.svg',
  サポーター: 'https://static.wikitide.net/bluearchivewiki/5/58/Support.svg',
  ヒーラー: 'https://static.wikitide.net/bluearchivewiki/c/cc/Healer.svg',
  'T.S.': 'https://static.wikitide.net/bluearchivewiki/c/c7/TacticalSupport.svg',
}

const BADGE_ICON_FILL_COLOR = { r: 34, g: 53, b: 81 }
const STAR_NUMBER_FONT_NAME = 'StudentImageStarNumber'
const STAR_NUMBER_FONT_FILE = '/fonts/student-image-star-number.otf'
const STAR_NUMBER_FONT_FALLBACK = '"mfw-pshinmgopr6n-medium", "M PLUS Rounded 1c", "M PLUS 1p", sans-serif'

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
  levelXRatio: 0.12,
  levelYRatio: 0.04,
  starNumberXRatio: 0,
  starNumberYRatio: 0.08,
  badgeMarginRight: 3,
  badgeMarginBottom: 3,
}

let fontLoaded = false

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const normalize = (vector: Point) => {
  const len = Math.hypot(vector.x, vector.y)
  if (len === 0) return { x: 0, y: 0 }
  return { x: vector.x / len, y: vector.y / len }
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

const buildRoundedPolygonPath = (points: Point[], radius: number) => {
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
      start: { x: point.x + prevDir.x * currentRadius, y: point.y + prevDir.y * currentRadius },
      end: { x: point.x + nextDir.x * currentRadius, y: point.y + nextDir.y * currentRadius },
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

const createParallelogramPath = (
  width: number,
  height: number,
  skew: number,
  insetTop: number,
  insetBottom: number,
  insetSide: number,
  offsetY: number,
  cornerRadius = 0,
) => {
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

const createParallelogramPathWithTopLeftAndBottomRightRadius = (
  width: number,
  height: number,
  skew: number,
  offsetY: number,
  cornerRadius: number,
) => {
  const topY = offsetY
  const bottomY = offsetY + height
  const leftTopX = skew
  const rightTopX = width
  const rightBottomX = width - skew
  const leftBottomX = 0
  const p1: Point = { x: leftTopX, y: topY }
  const p2: Point = { x: rightTopX, y: topY }
  const p3: Point = { x: rightBottomX, y: bottomY }
  const p4: Point = { x: leftBottomX, y: bottomY }
  const maxRadius = Math.max(0, Math.min(distance(p1, p2), distance(p2, p3), distance(p3, p4), distance(p4, p1)) * 0.5)
  const r = Math.min(cornerRadius, maxRadius)
  const tlEdgeBottom = normalize({ x: p4.x - p1.x, y: p4.y - p1.y })
  const tlEdgeTop = normalize({ x: p2.x - p1.x, y: p2.y - p1.y })
  const tlStart = { x: p1.x + tlEdgeBottom.x * r, y: p1.y + tlEdgeBottom.y * r }
  const tlEnd = { x: p1.x + tlEdgeTop.x * r, y: p1.y + tlEdgeTop.y * r }
  const brEdgeTop = normalize({ x: p2.x - p3.x, y: p2.y - p3.y })
  const brEdgeBottom = normalize({ x: p4.x - p3.x, y: p4.y - p3.y })
  const brStart = { x: p3.x + brEdgeTop.x * r, y: p3.y + brEdgeTop.y * r }
  const brEnd = { x: p3.x + brEdgeBottom.x * r, y: p3.y + brEdgeBottom.y * r }
  const path = new Path2D()
  path.moveTo(tlEnd.x, tlEnd.y)
  path.lineTo(p2.x, p2.y)
  path.lineTo(brStart.x, brStart.y)
  path.quadraticCurveTo(p3.x, p3.y, brEnd.x, brEnd.y)
  path.lineTo(p4.x, p4.y)
  path.lineTo(tlStart.x, tlStart.y)
  path.quadraticCurveTo(p1.x, p1.y, tlEnd.x, tlEnd.y)
  path.closePath()
  return path
}

const createInnerWindowPath = (
  size: number,
  frameHeight: number,
  frameTop: number,
  outerSkew: number,
  thin: number,
  bottom: number,
  sideInset: number,
  cornerRadius: number,
) => {
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
  const maxRadius = Math.max(0, Math.min(distance(p1, p2), distance(p2, p3), distance(p3, p4), distance(p4, p1)) * 0.25)
  const r = Math.min(cornerRadius, maxRadius)
  return {
    path: buildRoundedPolygonPath([p1, p2, p3, p4], r),
    minX: Math.min(leftTopX, leftBottomX),
    maxX: Math.max(rightTopX, rightBottomX),
    topY,
    bottomY,
  }
}

const drawStarShape = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
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

const drawStarWithNumber = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  colorTop: string,
  colorBottom: string,
  stroke: string,
  value: number,
  fontFamily: string,
  alpha = 1,
  numberXRatio = 0,
  numberYRatio = 0.08,
) => {
  ctx.save()
  ctx.globalAlpha = alpha
  drawStarShape(ctx, x, y, radius)
  const grad = ctx.createLinearGradient(x, y - radius, x, y + radius)
  grad.addColorStop(0, colorTop)
  grad.addColorStop(1, colorBottom)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(2, radius * 0.08)
  ctx.stroke()
  const text = String(Math.max(1, Math.floor(value)))
  ctx.fillStyle = '#1f2937'
  ctx.font = `700 ${Math.round(radius * 1.15)}px ${fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + radius * numberXRatio, y + radius * numberYRatio)
  ctx.restore()
}

const drawLevel = (ctx: CanvasRenderingContext2D, options: Options) => {
  const text = `Lv.${options.level}`
  const x = options.size * options.levelXRatio
  const y = options.size * options.levelYRatio
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = Math.max(2, options.size * 0.006)
  ctx.font = `700 ${Math.round(options.size * 0.08)}px ${STAR_NUMBER_FONT_FALLBACK}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.strokeText(text, x, y)
  ctx.fillText(text, x, y)
  ctx.restore()
}

const recolorWhitePixelsToBadgeColor = (source: HTMLImageElement) => {
  const canvas = document.createElement('canvas')
  const width = source.naturalWidth || source.width
  const height = source.naturalHeight || source.height
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(source, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  const pixels = imageData.data
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue
    if (pixels[i] >= 235 && pixels[i + 1] >= 235 && pixels[i + 2] >= 235) {
      pixels[i] = BADGE_ICON_FILL_COLOR.r
      pixels[i + 1] = BADGE_ICON_FILL_COLOR.g
      pixels[i + 2] = BADGE_ICON_FILL_COLOR.b
    }
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

const loadImage = async (sourceUrl: string) => {
  const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(sourceUrl)}`
  const image = new Image()
  image.src = proxyUrl
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('failed image load'))
  })
  return image
}

const drawCard = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  badgeIcon: HTMLCanvasElement | null,
  attackType: AttackType,
  originalAttackType: string,
  options: Options,
  fontFamily: string,
) => {
  const size = options.size
  const frameHeight = size * 0.88
  const frameTop = size * 0.05
  const skew = size * options.skewRatio
  const sideInset = options.borderSide * Math.hypot(1, skew / frameHeight)
  const color = ATTACK_COLORS[attackType]
  const outerPath = createParallelogramPath(size, frameHeight, skew, 0, 0, 0, frameTop, options.cornerRadius)
  const innerWindow = createInnerWindowPath(size, frameHeight, frameTop, skew, options.borderTop, options.borderBottom, sideInset, options.cornerRadius)

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = color.ring
  ctx.fill(outerPath)

  const targetWidth = innerWindow.maxX - innerWindow.minX
  const targetHeight = innerWindow.bottomY - innerWindow.topY
  const ratio = Math.max(targetWidth / image.width, targetHeight / image.height)
  const drawWidth = image.width * ratio
  const drawHeight = image.height * ratio
  const dx = (targetWidth - drawWidth) / 2
  const dy = (targetHeight - drawHeight) / 2

  ctx.save()
  ctx.clip(innerWindow.path)
  ctx.drawImage(image, innerWindow.minX + dx, innerWindow.topY + dy, drawWidth, drawHeight)
  ctx.restore()

  ctx.save()
  ctx.clip(outerPath)
  const badgeHeight = Math.min(size * 0.21, targetHeight * 0.58, targetWidth * 0.34)
  const badgeWidth = badgeHeight * 1.15
  const skewSlope = skew / frameHeight
  const badgeBottom = frameTop + frameHeight - options.badgeMarginBottom
  const badgeY = badgeBottom - badgeHeight
  const outerRightAtBadgeTop = size - skewSlope * (badgeY - frameTop)
  const badgeRight = outerRightAtBadgeTop - options.badgeMarginRight
  const badgeX = badgeRight - badgeWidth
  ctx.translate(badgeX, badgeY)
  const badgePath = createParallelogramPathWithTopLeftAndBottomRightRadius(badgeWidth, badgeHeight, skewSlope * badgeHeight, 0, options.cornerRadius)
  ctx.fillStyle = '#ffffff'
  ctx.fill(badgePath)
  if (badgeIcon) {
    const iconSize = badgeHeight * 0.68
    const iconX = (badgeWidth - iconSize) / 2
    const iconY = (badgeHeight - iconSize) / 2
    ctx.save()
    ctx.clip(badgePath)
    ctx.drawImage(badgeIcon, iconX, iconY, iconSize, iconSize)
    ctx.restore()
  }
  ctx.restore()

  drawLevel(ctx, options)

  const starRadius = size * 0.12
  const starX = size * 0.15
  const starY = frameTop + frameHeight - Math.max(starRadius * 1.18, size * 0.12)
  drawStarWithNumber(ctx, starX, starY, starRadius, '#fde047', '#f59e0b', '#92400e', options.stars, fontFamily, 1, options.starNumberXRatio, options.starNumberYRatio)
  if (options.unique >= 1) {
    drawStarWithNumber(ctx, starX, starY, starRadius, '#7dd3fc', '#3b82f6', '#1e3a8a', options.unique, fontFamily, 1, options.starNumberXRatio, options.starNumberYRatio)
  }

  if (attackType !== originalAttackType) {
    ctx.save()
    const tri = size * 0.16
    const left = size * 0.04
    const top = size * 0.04
    ctx.beginPath()
    ctx.moveTo(left, top)
    ctx.lineTo(left + tri, top)
    ctx.lineTo(left, top + tri)
    ctx.closePath()
    ctx.fillStyle = '#fecaca'
    ctx.fill()
    ctx.restore()
  }
}

export default function StudentImageStyleCard({ student, memberLevel, memberStar, memberUniqueStar }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [fontFamily, setFontFamily] = useState(STAR_NUMBER_FONT_FALLBACK)

  const options = useMemo(() => {
    const stars = memberStar ?? student?.initialStars ?? 1
    return {
      ...BASE,
      level: clamp(memberLevel ?? BASE.level, 1, 999),
      stars: clamp(stars, 1, 99),
      unique: clamp(memberUniqueStar ?? 0, 0, 99),
    }
  }, [memberLevel, memberStar, memberUniqueStar, student?.initialStars])

  useEffect(() => {
    let cancelled = false
    const loadFont = async () => {
      if (fontLoaded || typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) {
        setFontFamily(STAR_NUMBER_FONT_FALLBACK)
        return
      }
      try {
        const face = new FontFace(STAR_NUMBER_FONT_NAME, `url(${STAR_NUMBER_FONT_FILE})`, { style: 'normal', weight: '400' })
        const loadedFace = await face.load()
        if (cancelled) return
        document.fonts.add(loadedFace)
        await document.fonts.load(`400 32px "${STAR_NUMBER_FONT_NAME}"`)
        if (cancelled) return
        fontLoaded = true
        setFontFamily(`"${STAR_NUMBER_FONT_NAME}", ${STAR_NUMBER_FONT_FALLBACK}`)
      } catch {
        if (cancelled) return
        setFontFamily(STAR_NUMBER_FONT_FALLBACK)
      }
    }
    void loadFont()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const draw = async () => {
      const canvas = canvasRef.current
      if (!canvas || !student?.image) return
      const attackType: AttackType = student.attackType === '貫通' || student.attackType === '神秘' || student.attackType === '振動' ? student.attackType : '爆発'
      const image = await loadImage(student.image)
      const iconUrl = CHARACTER_TYPE_ICONS[student.characterType]
      let badgeIcon: HTMLCanvasElement | null = null
      if (iconUrl) {
        try {
          const iconImage = await loadImage(iconUrl)
          badgeIcon = recolorWhitePixelsToBadgeColor(iconImage)
        } catch {
          badgeIcon = null
        }
      }
      if (cancelled) return
      canvas.width = options.size
      canvas.height = options.size
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      drawCard(ctx, image, badgeIcon, attackType, student.attackType, options, fontFamily)
    }
    void draw()
    return () => {
      cancelled = true
    }
  }, [fontFamily, options, student])

  if (!student) {
    return <div className="h-14 w-14 rounded bg-gray-200" />
  }

  return (
    <canvas
      ref={canvasRef}
      width={BASE.size}
      height={BASE.size}
      className="h-14 w-14"
      title={student.name}
    />
  )
}
