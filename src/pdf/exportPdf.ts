import { LineCapStyle, PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import { LAYER_OPACITY, pencilStroke } from '../canvas/style'
import { pointOnCircle } from '../geometry/primitives'
import { mmToPt } from '../geometry/units'
import type { Shape, Vec } from '../types'
import { baseName, downloadBlob } from '../utils/download'
import { getSession } from './session'

const hexToRgb = (hex: string) => {
  const v = parseInt(hex.slice(1), 16)
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255)
}

/**
 * Writes the constructions as vectors on top of the untouched original PDF.
 * World coordinates are mapped through pdf.js' viewport, so rotated pages and
 * offset media boxes land exactly where they were drawn.
 */
export const exportPdf = async (shapes: readonly Shape[]) => {
  const session = getSession()
  if (!session) return
  const out = await PDFDocument.load(session.bytes, { ignoreEncryption: true })
  const pages = out.getPages()
  let font: PDFFont | null = null

  for (let index = 0; index < pages.length; index++) {
    const onPage = shapes.filter((s) => s.page === index)
    if (!onPage.length) continue
    const page = pages[index]!
    const viewport = (await session.doc.getPage(index + 1)).getViewport({ scale: 1 })
    const toPdf = (p: Vec) => {
      const [x, y] = viewport.convertToPdfPoint(p.x, p.y) as [number, number]
      return { x, y }
    }

    for (const s of onPage) {
      const { color, width, dash } = pencilStroke(s.pencil)
      const dashArray = dash ? [...dash] : undefined
      const style = { color: hexToRgb(color), opacity: LAYER_OPACITY[s.layer] }
      switch (s.kind) {
        case 'segment':
          page.drawLine({
            start: toPdf(s.a),
            end: toPdf(s.b),
            thickness: width,
            color: style.color,
            opacity: style.opacity,
            lineCap: LineCapStyle.Round,
            dashArray,
          })
          break
        case 'circle': {
          const c = toPdf(s.c)
          page.drawCircle({ x: c.x, y: c.y, size: s.r, borderWidth: width, borderColor: style.color, borderOpacity: style.opacity, borderDashArray: dashArray })
          break
        }
        case 'point': {
          const c = toPdf(s.p)
          page.drawCircle({ x: c.x, y: c.y, size: mmToPt(0.5), color: style.color, opacity: style.opacity })
          if (s.name) {
            font ??= await out.embedFont(StandardFonts.Helvetica)
            const size = mmToPt(3.2)
            const at = toPdf({ x: s.p.x + size * 0.35, y: s.p.y - size * 0.35 })
            page.drawText(s.name, { x: at.x, y: at.y, size, font, color: style.color, opacity: style.opacity })
          }
          break
        }
        case 'arc': {
          const steps = Math.max(8, Math.ceil((Math.abs(s.sweep) / (Math.PI * 2)) * 128))
          const pts = Array.from({ length: steps + 1 }, (_, i) =>
            toPdf(pointOnCircle(s.c, s.r, s.start + (s.sweep * i) / steps)),
          )
          // drawSvgPath flips y around the origin, so feed it -y.
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${-p.y}`).join('')
          page.drawSvgPath(d, {
            x: 0,
            y: 0,
            borderWidth: width,
            borderColor: style.color,
            borderOpacity: style.opacity,
            borderLineCap: LineCapStyle.Round,
            borderDashArray: dashArray,
          })
        }
      }
    }
  }

  const bytes = await out.save()
  downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${baseName(session.name)} - lámina.pdf`)
}
