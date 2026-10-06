import { DIMENSION_SIZE, DIMENSION_WIDTH, dimensionFigure, dimensionParts } from '../canvas/dimension'
import { geometryPath } from '../canvas/paths'
import { NAME_SIZE, nameAnchor, nameReach, placeName } from '../canvas/pointLabel'
import { LAYER_OPACITY, pencilStroke } from '../canvas/style'
import { LINE_HEIGHT, textLines, textSize } from '../geometry/text'
import { mmToPt } from '../geometry/units'
import { isGeometry, type Shape, type Vec } from '../types'
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
    /** Writes a name around its anchor, where it covers the fewest strokes, as on screen. */
    const writeName = (anchor: Vec, name: string) => {
      const strokes = [...onPage, ...detectedNear(pageIndex, anchor, nameReach(name, NAME_SIZE)).curves]
      const at = placeName(anchor, name, NAME_SIZE, strokes)
      ctx.font = `500 ${NAME_SIZE}px Inter, system-ui, sans-serif`
      ctx.fillText(name, at.x, at.y)
    }
    ctx.fillStyle = color
    if (s.kind === 'point' && s.text) {
      const size = textSize(s.size)
      ctx.font = `500 ${size}px Inter, system-ui, sans-serif`
      textLines(s.name ?? '').forEach((line, i) => ctx.fillText(line, s.p.x, s.p.y + i * size * LINE_HEIGHT))
    } else if (s.kind === 'point') {
      ctx.fill(path)
      if (s.name) writeName(s.p, s.name)
    } else if (s.kind === 'segment' && s.dimension) {
      const { arrows, tails, figureAt, angle } = dimensionParts(s.a, s.b)
      // Always the thin continuous line of the standard, whatever pencil it was drawn with.
      ctx.strokeStyle = color
      ctx.lineWidth = DIMENSION_WIDTH
      ctx.setLineDash([])
      ctx.stroke(path)
      for (const [from, to] of tails) ctx.stroke(new Path2D(`M${from.x} ${from.y}L${to.x} ${to.y}`))
      for (const [tip, left, right] of arrows) ctx.fill(new Path2D(`M${tip.x} ${tip.y}L${left.x} ${left.y}L${right.x} ${right.y}Z`))
      ctx.save()
      ctx.translate(figureAt.x, figureAt.y)
      ctx.rotate(angle)
      ctx.setLineDash([])
      ctx.font = `500 ${DIMENSION_SIZE}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(s.name ?? dimensionFigure(s.a, s.b), 0, 0)
      ctx.restore()
    } else {
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.stroke(path)
      if (s.name) writeName(nameAnchor(s), s.name)
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (blob) downloadBlob(blob, `${baseName(session.name)} - página ${pageIndex + 1}.png`)
}
