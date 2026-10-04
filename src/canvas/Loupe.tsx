import { useEffect, useRef, useState } from 'react'
import { deskToScreen, screenToDesk } from '../geometry/coords'
import { pageAt, type PageRect } from '../geometry/layout'
import type { SnapResult } from '../geometry/snapping'
import { mmToPt } from '../geometry/units'
import { getSession } from '../pdf/session'
import type { GeometryShape, Vec, View } from '../types'
import { geometryPath } from './paths'
import { ACCENT, LAYER_OPACITY, pencilStroke } from './style'

const SIZE = 132
const MAGNIFY = 4
const OFFSET = 26
const MAX_PIXELS = 24_000_000

/** High-resolution renders of single pages for the loupe, rebuilt only when the zoom changes. */
const cache = new Map<string, HTMLCanvasElement>()
const pendingRenders = new Set<string>()

const renderPage = async (fingerprint: string, page: number, pxPerPt: number, done: () => void) => {
  const key = `${fingerprint}:${page}:${pxPerPt}`
  if (cache.has(key) || pendingRenders.has(key)) return
  const session = getSession()
  if (!session) return
  pendingRenders.add(key)
  try {
    const pdfPage = await session.doc.getPage(page + 1)
    const viewport = pdfPage.getViewport({ scale: pxPerPt })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    await pdfPage.render({ canvas, viewport }).promise
    // Keep memory bounded: only the latest render per page.
    for (const k of [...cache.keys()]) if (k.startsWith(`${fingerprint}:${page}:`)) cache.delete(k)
    cache.set(key, canvas)
    done()
  } finally {
    pendingRenders.delete(key)
  }
}

interface Props {
  cursor: Vec
  view: View
  rects: readonly PageRect[]
  shapes: readonly GeometryShape[]
  snap: SnapResult | null
  viewport: { w: number; h: number }
}

/** A small round magnifier following the cursor: the PDF, the drawing and the exact snap point. */
export const Loupe = ({ cursor, view, rects, shapes, snap, viewport }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [, setRendered] = useState(0)
  const dpr = window.devicePixelRatio || 1
  const fingerprint = getSession()?.fingerprint ?? ''
  const S = view.scale * MAGNIFY
  const centre = snap?.kind ? snap.p : screenToDesk(view, cursor)
  const page = pageAt(rects, centre)
  const rect = rects[page]
  // Bitmap resolution: enough for the loupe, rounded so tiny zoom changes reuse the cache.
  const maxPxPerPt = rect ? Math.sqrt(MAX_PIXELS / (rect.w * rect.h)) : 1
  const pxPerPt = Math.min(maxPxPerPt, Math.pow(2, Math.ceil(Math.log2(S * dpr))))

  useEffect(() => {
    if (!rect) return
    const t = setTimeout(() => void renderPage(fingerprint, page, pxPerPt, () => setRendered((n) => n + 1)), 120)
    return () => clearTimeout(t)
  }, [fingerprint, page, pxPerPt, rect])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const W = SIZE * dpr
    canvas.width = W
    canvas.height = W
    // Desk → loupe pixels, centred on the point of interest.
    const k = S * dpr
    const tx = W / 2 - centre.x * k
    const ty = W / 2 - centre.y * k
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(0, 0, W, W)

    if (rect) {
      ctx.setTransform(k, 0, 0, k, tx, ty)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      const bitmap =
        cache.get(`${fingerprint}:${page}:${pxPerPt}`) ??
        [...cache.entries()].find(([key]) => key.startsWith(`${fingerprint}:${page}:`))?.[1] ??
        (document.querySelector(`.sheet[data-page="${page}"] canvas`) as HTMLCanvasElement | null)
      if (bitmap) {
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(bitmap, rect.x, rect.y, rect.w, rect.h)
      }
    }

    // The drawing, at its real pencil width.
    ctx.setTransform(k, 0, 0, k, tx, ty)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of shapes) {
      const { color, width, dash } = pencilStroke(s.pencil)
      ctx.globalAlpha = LAYER_OPACITY[s.layer]
      ctx.setLineDash(dash ?? [])
      const path = new Path2D(geometryPath(s, mmToPt(0.5)))
      if (s.kind === 'point') {
        ctx.fillStyle = color
        ctx.fill(path)
      } else {
        ctx.strokeStyle = color
        ctx.lineWidth = Math.max(width, 0.8 / k)
        ctx.stroke(path)
      }
    }
    ctx.globalAlpha = 1
    ctx.setLineDash([])

    // Crosshair on the exact point, and where the raw cursor is when it was pulled by a snap.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.strokeStyle = ACCENT
    ctx.lineWidth = 1 * dpr
    const c = W / 2
    const gap = 5 * dpr
    ctx.beginPath()
    ctx.moveTo(c - 16 * dpr, c)
    ctx.lineTo(c - gap, c)
    ctx.moveTo(c + gap, c)
    ctx.lineTo(c + 16 * dpr, c)
    ctx.moveTo(c, c - 16 * dpr)
    ctx.lineTo(c, c - gap)
    ctx.moveTo(c, c + gap)
    ctx.lineTo(c, c + 16 * dpr)
    ctx.stroke()
    if (snap?.kind) {
      ctx.beginPath()
      ctx.arc(c, c, 3.5 * dpr, 0, Math.PI * 2)
      ctx.stroke()
      const raw = screenToDesk(view, cursor)
      ctx.fillStyle = ACCENT
      ctx.globalAlpha = 0.45
      ctx.beginPath()
      ctx.arc(c + (raw.x - centre.x) * k, c + (raw.y - centre.y) * k, 2 * dpr, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  })

  // Beside the cursor, flipping to stay inside the workspace.
  const anchorPx = snap?.kind ? deskToScreen(view, snap.p) : cursor
  let left = anchorPx.x + OFFSET
  let top = anchorPx.y - OFFSET - SIZE
  if (left + SIZE > viewport.w - 8) left = anchorPx.x - OFFSET - SIZE
  if (top < 8) top = anchorPx.y + OFFSET

  return (
    <div className="loupe pointer-events-none absolute" style={{ left, top, width: SIZE, height: SIZE }} data-testid="loupe">
      <canvas ref={canvasRef} style={{ width: SIZE, height: SIZE }} />
      <span className="loupe-zoom">×{MAGNIFY}</span>
    </div>
  )
}
