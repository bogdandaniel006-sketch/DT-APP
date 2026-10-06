import { geometryPath } from '../canvas/paths'
import { NAME_SIZE, nameReach, placeName } from '../canvas/pointLabel'
import { LAYER_OPACITY, pencilStroke } from '../canvas/style'
import { mmToPt } from '../geometry/units'
import { isGeometry, type Shape } from '../types'
import { baseName, downloadBlob } from '../utils/download'
import { detectedNear } from './detect'
import { getSession } from './session'

/** ~216 dpi: sharp enough to print, small enough to share. */
const EXPORT_SCALE = 3

export const exportPng = async (shapes: readonly Shape[], pageIndex: number, includePdf: boolean) => {
  const session = getSession()
  if (!session) return
  const page = await session.doc.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale: EXPORT_SCALE })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (includePdf) await page.render({ canvas, viewport }).promise

  ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const onPage = shapes.filter((s) => s.page === pageIndex).filter(isGeometry)
  for (const s of shapes) {
    // Measures are on-screen annotations, not part of the drawing.
    if (s.page !== pageIndex || !isGeometry(s)) continue
    const { color, width, dash } = pencilStroke(s.pencil)
    ctx.globalAlpha = LAYER_OPACITY[s.layer]
    ctx.setLineDash(dash ?? [])
    const path = new Path2D(geometryPath(s, mmToPt(0.5)))
    if (s.kind === 'point') {
      ctx.fillStyle = color
      ctx.fill(path)
      if (s.name) {
        const size = NAME_SIZE
        const strokes = [...onPage, ...detectedNear(pageIndex, s.p, nameReach(s.name, size)).curves]
        const at = placeName(s.p, s.name, size, strokes)
        ctx.font = `500 ${size}px Inter, system-ui, sans-serif`
        ctx.fillText(s.name, at.x, at.y)
      }
    } else {
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.stroke(path)
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (blob) downloadBlob(blob, `${baseName(session.name)} - página ${pageIndex + 1}.png`)
}
