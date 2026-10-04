import { pdfjs, type PDFPageProxy } from '../pdfjs'
import type { Vec } from '../../types'

/** A piece of a subpath, already in document coordinates (PDF points, y down). */
export type Piece = { t: 'L'; a: Vec; b: Vec } | { t: 'C'; p0: Vec; p1: Vec; p2: Vec; p3: Vec }

export interface Subpath {
  pieces: Piece[]
  closed: boolean
}

export interface VectorPath {
  subpaths: Subpath[]
  stroked: boolean
  filled: boolean
  /** Stroke width in document units. */
  lineWidth: number
}

export interface TextLabel {
  text: string
  /** Centre of the text box. */
  p: Vec
  size: number
}

export interface PageVectors {
  paths: VectorPath[]
  labels: TextLabel[]
  hasImages: boolean
}

type Matrix = [number, number, number, number, number, number]

/** m1 ∘ m2: apply m2 first, then m1 (PDF / canvas convention). */
const multiply = (m1: Matrix, m2: readonly number[]): Matrix => [
  m1[0] * m2[0]! + m1[2] * m2[1]!,
  m1[1] * m2[0]! + m1[3] * m2[1]!,
  m1[0] * m2[2]! + m1[2] * m2[3]!,
  m1[1] * m2[2]! + m1[3] * m2[3]!,
  m1[0] * m2[4]! + m1[2] * m2[5]! + m1[4],
  m1[1] * m2[4]! + m1[3] * m2[5]! + m1[5],
]

/**
 * pdf.js keeps path coordinates in 32-bit floats, so 541.89 arrives as
 * 541.8900146… Content streams write decimals with a few digits: rounding away
 * the float32 noise (well below 0.0001 pt) gives back the exact written value.
 */
const unfloat32 = (v: number) => Math.round(v * 1e4) / 1e4

const apply = (m: Matrix, x0: number, y0: number): Vec => {
  const x = unfloat32(x0)
  const y = unfloat32(y0)
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }
}

const DRAW = { moveTo: 0, lineTo: 1, curveTo: 2, quadraticCurveTo: 3, closePath: 4 } as const

const parsePath = (data: ArrayLike<number>, m: Matrix, forceClose: boolean): Subpath[] => {
  const subpaths: Subpath[] = []
  // Declared with `as` so narrowing does not ignore the updates made inside `begin`.
  let current = null as Subpath | null
  let start = null as Vec | null
  let last = null as Vec | null
  const begin = (p: Vec) => {
    current = { pieces: [], closed: false }
    subpaths.push(current)
    start = p
    last = p
  }
  for (let i = 0; i < data.length; ) {
    const op = data[i++]
    if (op === DRAW.moveTo) {
      begin(apply(m, data[i++]!, data[i++]!))
    } else if (op === DRAW.lineTo) {
      const p = apply(m, data[i++]!, data[i++]!)
      if (!current || !last) begin(p)
      else current.pieces.push({ t: 'L', a: last, b: p })
      last = p
    } else if (op === DRAW.curveTo) {
      const p1 = apply(m, data[i++]!, data[i++]!)
      const p2 = apply(m, data[i++]!, data[i++]!)
      const p3 = apply(m, data[i++]!, data[i++]!)
      if (!current || !last) begin(p1)
      current!.pieces.push({ t: 'C', p0: last!, p1, p2, p3 })
      last = p3
    } else if (op === DRAW.quadraticCurveTo) {
      const q = apply(m, data[i++]!, data[i++]!)
      const p3 = apply(m, data[i++]!, data[i++]!)
      if (!current || !last) begin(q)
      // Elevate to a cubic so the rest of the pipeline sees one curve type.
      const p0 = last!
      const p1 = { x: p0.x + (2 / 3) * (q.x - p0.x), y: p0.y + (2 / 3) * (q.y - p0.y) }
      const p2 = { x: p3.x + (2 / 3) * (q.x - p3.x), y: p3.y + (2 / 3) * (q.y - p3.y) }
      current!.pieces.push({ t: 'C', p0, p1, p2, p3 })
      last = p3
    } else if (op === DRAW.closePath) {
      if (current && last && start) {
        if (last.x !== start.x || last.y !== start.y) current.pieces.push({ t: 'L', a: last, b: start })
        current.closed = true
        last = start
      }
    } else {
      break // unknown opcode: stop rather than misread coordinates
    }
  }
  if (forceClose) {
    for (const s of subpaths) {
      const first = s.pieces[0]
      const end = s.pieces[s.pieces.length - 1]
      if (first && end && !s.closed) {
        const a = end.t === 'L' ? end.b : end.p3
        const b = first.t === 'L' ? first.a : first.p0
        if (a.x !== b.x || a.y !== b.y) s.pieces.push({ t: 'L', a, b })
        s.closed = true
      }
    }
  }
  return subpaths.filter((s) => s.pieces.length > 0)
}

/**
 * Reads the vector content of a page straight from pdf.js' operator list,
 * tracking the current transformation matrix so every coordinate is exact in
 * document space. Nothing is rasterised and the PDF is left untouched.
 */
export const extractVectors = async (page: PDFPageProxy): Promise<PageVectors> => {
  const viewport = page.getViewport({ scale: 1 })
  const OPS = pdfjs.OPS
  const ops = await page.getOperatorList()
  const STROKE = new Set<number>([OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke])
  const FILL = new Set<number>([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke])
  const CLOSING = new Set<number>([OPS.closeStroke, OPS.closeFillStroke, OPS.closeEOFillStroke])

  let ctm = viewport.transform.slice() as Matrix
  let lineWidth = 1
  const stack: { ctm: Matrix; lineWidth: number }[] = []
  const paths: VectorPath[] = []
  let hasImages = false

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    const args = ops.argsArray[i] as unknown[] | null
    switch (fn) {
      case OPS.save:
        stack.push({ ctm, lineWidth })
        break
      case OPS.restore: {
        const s = stack.pop()
        if (s) ({ ctm, lineWidth } = s)
        break
      }
      case OPS.transform:
        ctm = multiply(ctm, args as number[])
        break
      case OPS.paintFormXObjectBegin: {
        stack.push({ ctm, lineWidth })
        const matrix = args?.[0] as number[] | null | undefined
        if (matrix && matrix.length === 6) ctm = multiply(ctm, matrix)
        break
      }
      case OPS.paintFormXObjectEnd: {
        const s = stack.pop()
        if (s) ({ ctm, lineWidth } = s)
        break
      }
      case OPS.setLineWidth:
        lineWidth = Number((args as number[])[0]) || 0
        break
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintImageMaskXObject:
        hasImages = true
        break
      case OPS.constructPath: {
        const [paintOp, data] = args as [number, [ArrayLike<number> | null] | null]
        const pathData = data?.[0]
        if (!pathData || !(STROKE.has(paintOp) || FILL.has(paintOp))) break
        const scale = Math.sqrt(Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2]))
        paths.push({
          subpaths: parsePath(pathData, ctm, CLOSING.has(paintOp)),
          stroked: STROKE.has(paintOp),
          filled: FILL.has(paintOp),
          // A zero width means "thinnest possible line": treat as hairline.
          lineWidth: Math.max(lineWidth * scale, 0.1),
        })
        break
      }
    }
  }

  const labels: TextLabel[] = []
  try {
    const text = await page.getTextContent()
    for (const item of text.items) {
      if (!('str' in item)) continue
      const str = item.str.trim()
      if (!str || str.length > 5) continue
      const [, , , d, e, f] = item.transform as number[]
      const size = Math.abs(d ?? item.height) || item.height
      const [x, y] = viewport.convertToViewportPoint(e! + item.width / 2, f! + size * 0.35) as [number, number]
      labels.push({ text: str, p: { x, y }, size })
    }
  } catch {
    /* text is optional: only used to suggest point names */
  }

  return { paths, labels, hasImages }
}
