import { LineCapStyle, PDFDocument, StandardFonts, degrees, rgb, type PDFFont } from 'pdf-lib'
import { DIMENSION_SIZE, dimensionFigure, dimensionParts } from '../canvas/dimension'
import { NAME_SIZE, nameAnchor, nameReach, placeName } from '../canvas/pointLabel'
import { LAYER_OPACITY, pencilStroke } from '../canvas/style'
import { pointOnCircle } from '../geometry/primitives'
import { TEXT_SIZE } from '../geometry/text'
import { mmToPt } from '../geometry/units'
import { isGeometry, type Shape, type Vec } from '../types'
import { baseName, downloadBlob } from '../utils/download'
import { detectedNear } from './detect'
import { stamp } from './make'
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

    const strokes = onPage.filter(isGeometry)
    for (const s of onPage) {
      const { color, width, dash } = pencilStroke(s.pencil)
      const dashArray = dash ? [...dash] : undefined
      const style = { color: hexToRgb(color), opacity: LAYER_OPACITY[s.layer] }
      /** Where a name goes around its anchor so that it covers the fewest strokes, as on screen. */
      const nameAt = (anchor: Vec, name: string) =>
        placeName(anchor, name, NAME_SIZE, [...strokes, ...detectedNear(index, anchor, nameReach(name, NAME_SIZE)).curves])
      /** Writes at a point of the page (left end of the baseline), leaving out what the font cannot print. */
      const write = async (text: string, at: Vec, size: number) => {
        const used = (font ??= await out.embedFont(StandardFonts.Helvetica))
        const known = new Set(used.getCharacterSet())
        const printable = [...text].filter((ch) => known.has(ch.codePointAt(0) ?? -1)).join('')
        if (!printable) return
        const o = toPdf(at)
        page.drawText(printable, { x: o.x, y: o.y, size, font: used, color: style.color, opacity: style.opacity })
      }
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
          if (s.text) {
            await write(s.name ?? '', s.p, TEXT_SIZE)
            break
          }
          const c = toPdf(s.p)
          page.drawCircle({ x: c.x, y: c.y, size: mmToPt(0.5), color: style.color, opacity: style.opacity })
          if (s.name) await write(s.name, nameAt(s.p, s.name), NAME_SIZE)
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
      if (s.kind === 'segment' && s.dimension) {
        // A dimension: its arrowheads, and its figure written along the line.
        const { arrows, figureAt, angle } = dimensionParts(s.a, s.b)
        for (const corners of arrows) {
          const [tip, left, right] = corners.map(toPdf) as [Vec, Vec, Vec]
          // drawSvgPath flips y around the origin, so feed it -y.
          page.drawSvgPath(`M${tip.x} ${-tip.y}L${left.x} ${-left.y}L${right.x} ${-right.y}Z`, { x: 0, y: 0, color: style.color, opacity: style.opacity })
        }
        const used = (font ??= await out.embedFont(StandardFonts.Helvetica))
        const known = new Set(used.getCharacterSet())
        const figure = [...(s.name ?? dimensionFigure(s.a, s.b))].filter((ch) => known.has(ch.codePointAt(0) ?? -1)).join('')
        // The figure is centred on its point: it starts half its width back along its own direction.
        const half = used.widthOfTextAtSize(figure, DIMENSION_SIZE) / 2
        const from = toPdf({ x: figureAt.x - Math.cos(angle) * half, y: figureAt.y - Math.sin(angle) * half })
        // Pages are y-up: the same turn has the opposite sign there.
        if (figure) {
          page.drawText(figure, { x: from.x, y: from.y, size: DIMENSION_SIZE, font: used, color: style.color, opacity: style.opacity, rotate: degrees((-angle * 180) / Math.PI) })
        }
      } else if (isGeometry(s) && s.kind !== 'point' && s.name) {
        // Names of lines and curves, placed as on screen.
        await write(s.name, nameAt(nameAnchor(s), s.name), NAME_SIZE)
      }
    }
  }

  // The export is a document of its own: with the original's identity it would be taken for it when opened here.
  await stamp(out)
  const bytes = await out.save()
  downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${baseName(session.name)} - lámina.pdf`)
}
