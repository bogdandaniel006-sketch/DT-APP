import { geometryPath } from '../canvas/paths'
import { HATCH_SPACING, hatchLines, inRegion, regionAt, thicken, type Region, type Walls } from '../geometry/hatch'
import { pageOffset } from '../geometry/layout'
import { segment } from '../geometry/primitives'
import { bounds, translateGeometry } from '../geometry/shapes'
import { mmToPt } from '../geometry/units'
import { sub } from '../geometry/vec'
import { detectionStore } from '../pdf/detect'
import { getSession } from '../pdf/session'
import { appStore } from '../state/appStore'
import { createStore } from '../state/createStore'
import { documentActions, documentStore } from '../state/documentStore'
import { isGeometry, isText, type Geometry, type HatchShape, type Shape, type Vec } from '../types'
import { bumpTools } from './registry'
import type { Overlay, Tool } from './types'

/** Angle and spacing new linings are drawn with. */
export const hatchStore = createStore<{ angle: number; spacing: number }>({ angle: 45, spacing: HATCH_SPACING })

/** Cells per millimetre of the grid the areas are found on: fine enough for the smallest parts of a sheet. */
const CELLS_PER_MM = 6
const RES = CELLS_PER_MM / mmToPt(1)
/** Outlines are thickened this many cells, so gaps of up to about half a millimetre close. */
const GROW_CELLS = 2
/** Darkness from which a pixel of the PDF counts as ink (0 black … 255 white). */
const INK = 170

/** The page as an image, at the grid's resolution: rendering it is the slow part, so it is kept. */
const inkCache = new Map<string, Promise<Uint8ClampedArray | null>>()

const pageInk = (page: number, w: number, h: number): Promise<Uint8ClampedArray | null> => {
  const session = getSession()
  if (!session) return Promise.resolve(null)
  const key = `${session.fingerprint}/${page}`
  let ink = inkCache.get(key)
  if (!ink) {
    ink = (async () => {
      const pdfPage = await session.doc.getPage(page + 1)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
      await pdfPage.render({ canvas, viewport: pdfPage.getViewport({ scale: RES }) }).promise
      return ctx.getImageData(0, 0, w, h).data
    })().catch(() => null)
    // Two pages at most: each is a few megabytes.
    if (inkCache.size >= 2) inkCache.delete(inkCache.keys().next().value!)
    inkCache.set(key, ink)
  }
  return ink
}

/** What bounds areas on the desk: drawn strokes of the visible layers, never texts, points or other linings. */
const deskOutlines = (): Geometry[] => {
  const { pageRects, hiddenLayers } = appStore.get()
  return documentStore
    .get()
    .shapes.filter((s): s is Shape & Geometry => isGeometry(s) && !isText(s) && s.kind !== 'point' && !hiddenLayers.includes(s.layer))
    .map((s) => translateGeometry(s, pageOffset(pageRects, s.page)))
}

/** Strokes of a page found in its PDF, on the desk. */
const pdfOutlines = (page: number): Geometry[] => {
  const d = detectionStore.get().pages[page]
  if (!d || !appStore.get().pdfVisible) return []
  const o = pageOffset(appStore.get().pageRects, page)
  return [...d.lines, ...d.circles, ...d.arcs].map((g) => translateGeometry(g, o))
}

/** The grid of a page: the ink of its PDF (when shown) and the drawn strokes, thickened. */
const buildWalls = async (page: number, outlines: readonly Geometry[]): Promise<Walls | null> => {
  const rect = appStore.get().pageRects[page]
  if (!rect) return null
  const w = Math.ceil(rect.w * RES)
  const h = Math.ceil(rect.h * RES)
  const data = new Uint8Array(w * h)
  // A black sheet has nothing printed on it: all of it would count as ink.
  if (appStore.get().pdfVisible && !appStore.get().darkSheet) {
    const ink = await pageInk(page, w, h)
    if (ink) {
      for (let i = 0; i < w * h; i++) {
        const lum = (ink[i * 4]! * 299 + ink[i * 4 + 1]! * 587 + ink[i * 4 + 2]! * 114) / 1000
        if (lum < INK) data[i] = 1
      }
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.setTransform(RES, 0, 0, RES, -rect.x * RES, -rect.y * RES)
  ctx.lineWidth = 1.5 / RES
  ctx.strokeStyle = '#000'
  for (const g of outlines) ctx.stroke(new Path2D(geometryPath(g)))
  const strokes = ctx.getImageData(0, 0, w, h).data
  for (let i = 0; i < w * h; i++) if (strokes[i * 4 + 3]! > 64) data[i] = 1
  return { data: thicken(data, w, h, GROW_CELLS), w, h, origin: { x: rect.x, y: rect.y }, res: RES, grow: GROW_CELLS / RES + mmToPt(0.15) }
}

/** The lines of the area around a desk point, or why there are none. */
const lineArea = (walls: Walls, region: Region | null, outlines: readonly Geometry[], angle: number, spacing: number) => {
  if (!region) return { lines: null, problem: 'outline' as const }
  if (region.open) return { lines: null, problem: 'open' as const }
  const box = {
    minX: walls.origin.x + region.minX / walls.res - 2,
    minY: walls.origin.y + region.minY / walls.res - 2,
    maxX: walls.origin.x + (region.maxX + 1) / walls.res + 2,
    maxY: walls.origin.y + (region.maxY + 1) / walls.res + 2,
  }
  const near = outlines.filter((g) => {
    const b = bounds(g)
    return b.maxX >= box.minX && b.minX <= box.maxX && b.maxY >= box.minY && b.minY <= box.maxY
  })
  return { lines: hatchLines(walls, region, angle, spacing, near), problem: null }
}

/**
 * Lines again the given linings from their seeds, with a new angle or spacing, against the
 * outlines as they are now (one undo step).
 */
export const relineHatches = async (ids: readonly string[], patch: { angle?: number; spacing?: number }) => {
  const { pageRects } = appStore.get()
  const targets = documentStore.get().shapes.filter((s): s is HatchShape => s.kind === 'hatch' && ids.includes(s.id))
  const own = deskOutlines()
  const next = new Map<string, HatchShape>()
  for (const h of targets) {
    const o = pageOffset(pageRects, h.page)
    const outlines = [...own, ...pdfOutlines(h.page)]
    const walls = await buildWalls(h.page, outlines)
    if (!walls) continue
    const seed = { x: h.seed.x + o.x, y: h.seed.y + o.y }
    const angle = patch.angle ?? h.angle
    const spacing = patch.spacing ?? h.spacing
    const { lines } = lineArea(walls, regionAt(walls, seed), outlines, angle, spacing)
    if (!lines?.length) continue
    // Back to the coordinates of its page, as shapes are stored.
    next.set(h.id, { ...h, angle, spacing, lines: lines.map(([a, b]): [Vec, Vec] => [sub(a, o), sub(b, o)]) })
  }
  if (next.size) documentActions.update([...next.keys()], (s) => next.get(s.id) ?? s)
}

/** Lining tool: hover an area to see it lined, click to line it. */
export const createHatchTool = (): Tool => {
  /** Grid of the page under the cursor, for the strokes as they are now. */
  let walls: { key: string; page: number; ready: Walls | null } | null = null
  let outlines: Geometry[] = []
  let region: Region | null = null
  let preview: { lines: [Vec, Vec][] | null; problem: 'outline' | 'open' | null; params: string } | null = null
  let cursor: Vec | null = null

  /** What the grid depends on: which page, the strokes, and whether the PDF is shown. */
  const keyOf = (page: number) => {
    const { pdfVisible, hiddenLayers } = appStore.get()
    return `${page}/${pdfVisible}/${hiddenLayers.join()}/${detectionStore.get().pages[page] ? 1 : 0}`
  }
  let shapesSeen: readonly Shape[] | null = null

  const ensureWalls = (page: number) => {
    const key = keyOf(page)
    const shapes = documentStore.get().shapes
    if (walls?.key === key && shapesSeen === shapes) return walls.ready
    shapesSeen = shapes
    const pending = { key, page, ready: null as Walls | null }
    walls = pending
    region = null
    preview = null
    outlines = [...deskOutlines(), ...pdfOutlines(page)]
    void buildWalls(page, outlines).then((built) => {
      if (walls !== pending) return
      pending.ready = built
      update()
      bumpTools()
    })
    return null
  }

  const update = () => {
    const grid = walls?.ready
    if (!grid || !cursor) return
    const { angle, spacing } = hatchStore.get()
    const params = `${angle}/${spacing}`
    // Still in the same area with the same settings: nothing to work out again.
    if (region && preview?.params === params && inRegion(grid, region, cursor)) return
    region = regionAt(grid, cursor)
    preview = { ...lineArea(grid, region, outlines, angle, spacing), params }
  }

  // A new angle or spacing shows at once on the area under the cursor.
  hatchStore.subscribe(() => {
    update()
    bumpTools()
  })

  return {
    down(e, api) {
      cursor = e.world
      ensureWalls(api.pageAt(e.world))
      update()
      if (!preview?.lines?.length) return
      const { angle, spacing } = hatchStore.get()
      api.create([{ kind: 'hatch', seed: e.world, angle, spacing, lines: preview.lines }])
      region = null
      preview = null
    },
    move(e, api) {
      cursor = e.world
      if (ensureWalls(api.pageAt(e.world))) update()
    },
    up() {},
    cancel() {
      const had = preview !== null
      region = null
      preview = null
      return had
    },
    overlays() {
      if (!preview?.lines) return []
      return preview.lines.map(([a, b]): Overlay => ({ kind: 'ghost', geom: segment(a, b), faint: true }))
    },
    hint() {
      if (!cursor) return 'Haz clic dentro de una zona cerrada para rayarla'
      if (walls && !walls.ready) return 'Preparando la lámina…'
      if (preview?.problem === 'open') return 'Esta zona no está cerrada: completa el contorno para rayarla'
      if (preview?.problem === 'outline') return 'Sitúa el cursor dentro de la zona que quieres rayar'
      return 'Clic para rayar la zona · cambia el ángulo en piezas contiguas'
    },
  }
}
