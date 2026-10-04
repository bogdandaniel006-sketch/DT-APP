import { segment, type Arc, type Circle, type Segment } from '../../geometry/primitives'
import { bounds, keyPoints } from '../../geometry/shapes'
import type { SnapPoint } from '../../geometry/snapping'
import { SpatialIndex } from '../../geometry/spatialIndex'
import { mmToPt } from '../../geometry/units'
import { createStore } from '../../state/createStore'
import type { Geometry, Vec } from '../../types'
import { getSession } from '../session'
import { analyzeVectors, computeIntersections, mergeCollinear, nearestLabel, roundsFromChords, type DetectedGeometry } from './analyze'
import type { RasterSegments } from './raster'
import { extractVectors } from './vectors'

export type DetectionSource = 'vector' | 'raster' | 'none'

export interface PageDetection extends DetectedGeometry {
  source: DetectionSource
  points: Vec[]
  /** Snap candidates (markers, intersections, endpoints, centres, midpoints) and curves, by location. */
  index: SpatialIndex<{ point: SnapPoint } | { curve: Geometry }>
}

interface DetectionState {
  fingerprint: string
  pages: Readonly<Record<number, PageDetection>>
  pending: number
}

/** Detection results, kept in memory per page: computed once, never while the cursor moves. */
export const detectionStore = createStore<DetectionState>({ fingerprint: '', pages: {}, pending: 0 })

/** Below this many vector strokes a page is treated as a scan and analysed as an image. */
const MIN_VECTOR_LINES = 3
const RASTER_SCALE = 2

const buildIndex = (g: DetectedGeometry) => {
  const index = new SpatialIndex<{ point: SnapPoint } | { curve: Geometry }>(28)
  const addPoint = (p: Vec, kind: SnapPoint['kind']) =>
    index.insert({ point: { p, kind, source: 'pdf' } }, { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y })
  g.points.forEach((p) => addPoint(p, 'point'))
  g.intersections.forEach((p) => addPoint(p, 'intersection'))
  for (const curve of [...g.lines, ...g.circles, ...g.arcs]) {
    index.insert({ curve }, bounds(curve))
    for (const k of keyPoints(curve)) addPoint(k.p, k.kind)
  }
  return index
}

const finish = (g: DetectedGeometry, source: DetectionSource): PageDetection => ({ ...g, source, index: buildIndex(g) })

let worker: Worker | null = null
let requestId = 0
const rasterWorker = () => {
  worker ??= new Worker(new URL('./raster.worker.ts', import.meta.url), { type: 'module' })
  return worker
}

const ask = <T,>(message: object, transfer: Transferable[] = []): Promise<T> => {
  const id = ++requestId
  const w = rasterWorker()
  return new Promise<T>((resolve) => {
    const onMessage = (e: MessageEvent<{ id: number } & T>) => {
      if (e.data.id !== id) return
      w.removeEventListener('message', onMessage)
      resolve(e.data)
    }
    w.addEventListener('message', onMessage)
    w.postMessage({ ...message, id }, transfer)
  })
}

const detectRaster = async (pageIndex: number): Promise<Segment[]> => {
  const session = getSession()
  if (!session) return []
  const page = await session.doc.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale: RASTER_SCALE })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  await page.render({ canvas, viewport }).promise
  const image = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
  const { segments } = await ask<{ segments: RasterSegments }>(
    { type: 'lines', data: image.data, width: image.width, height: image.height, scale: RASTER_SCALE, minLength: mmToPt(6) * RASTER_SCALE },
    [image.data.buffer],
  )
  return segments.map(([ax, ay, bx, by]) => segment({ x: ax!, y: ay! }, { x: bx!, y: by! }))
}

const detectPage = async (pageIndex: number): Promise<PageDetection> => {
  const session = getSession()
  if (!session) return finish({ lines: [], circles: [], arcs: [], points: [], intersections: [], labels: [] }, 'none')
  const page = await session.doc.getPage(pageIndex + 1)
  const vectors = await extractVectors(page)
  const geometry = analyzeVectors(vectors.paths, vectors.labels)
  if (geometry.lines.length + geometry.circles.length + geometry.arcs.length >= MIN_VECTOR_LINES || !vectors.hasImages) {
    return finish(geometry, geometry.lines.length || geometry.circles.length || geometry.points.length ? 'vector' : 'none')
  }
  // A scan: find the strokes in the picture instead.
  // Strokes cut where they cross others are joined again; chains of chords become circles.
  const { rounds, rest } = roundsFromChords(await detectRaster(pageIndex))
  const lines = mergeCollinear(rest, 0.8, mmToPt(2.5))
  // Refine every circle and arc on the ink itself (the worker still holds this page's pixels).
  const { circles: refined } = await ask<{ circles: [number, number, number][] }>({
    type: 'refine',
    circles: rounds.map((r) => [r.c.x, r.c.y, r.r]),
  })
  rounds.forEach((r, i) => {
    const [x, y, rad] = refined[i]!
    r.c = { x, y }
    r.r = rad
  })
  const circles = rounds.filter((r): r is Circle => r.kind === 'circle')
  const arcs = rounds.filter((r): r is Arc => r.kind === 'arc')
  const intersections = computeIntersections([...lines, ...circles, ...arcs])
  return finish(
    { ...geometry, lines: [...geometry.lines, ...lines], circles, arcs, intersections },
    lines.length || rounds.length ? 'raster' : 'none',
  )
}

/** Detects every page of the open PDF in the background, one after another. */
export const startDetection = async (fingerprint: string, pageCount: number) => {
  detectionStore.set({ fingerprint, pages: {}, pending: pageCount })
  for (let i = 0; i < pageCount; i++) {
    if (detectionStore.get().fingerprint !== fingerprint) return // another PDF was opened
    let result: PageDetection
    try {
      result = await detectPage(i)
    } catch (err) {
      console.warn(`Detección de la página ${i + 1} fallida`, err)
      result = finish({ lines: [], circles: [], arcs: [], points: [], intersections: [], labels: [] }, 'none')
    }
    if (detectionStore.get().fingerprint !== fingerprint) return
    detectionStore.set((s) => ({ pages: { ...s.pages, [i]: result }, pending: s.pending - 1 }))
    await new Promise((r) => setTimeout(r, 0)) // keep the interface responsive between pages
  }
}

/** Detected geometry near a point of a page (document coordinates). */
export const detectedNear = (page: number, p: Vec, r: number): { points: SnapPoint[]; curves: Geometry[] } => {
  const d = detectionStore.get().pages[page]
  if (!d) return { points: [], curves: [] }
  const points: SnapPoint[] = []
  const curves: Geometry[] = []
  for (const item of d.index.query(p, r)) {
    if ('point' in item) points.push(item.point)
    else curves.push(item.curve)
  }
  return { points, curves }
}

/** Detected line under a point, to use PDF lines as references (perpendicular, parallel…). */
export const detectedLineAt = (page: number, p: Vec, tol: number): Segment | null => {
  let best: Segment | null = null
  let bestD = tol
  for (const g of detectedNear(page, p, tol).curves) {
    if (g.kind !== 'segment') continue
    const t = Math.max(0, Math.min(1, ((p.x - g.a.x) * (g.b.x - g.a.x) + (p.y - g.a.y) * (g.b.y - g.a.y)) / ((g.b.x - g.a.x) ** 2 + (g.b.y - g.a.y) ** 2)))
    const q = { x: g.a.x + (g.b.x - g.a.x) * t, y: g.a.y + (g.b.y - g.a.y) * t }
    const d = Math.hypot(q.x - p.x, q.y - p.y)
    if (d <= bestD) {
      best = g
      bestD = d
    }
  }
  return best
}

/** Suggested name for a detected point, from the letters printed next to it. */
export const suggestName = (page: number, p: Vec): string | null => {
  const d = detectionStore.get().pages[page]
  return d ? nearestLabel(d.labels, p) : null
}

export const detectionSummary = (page: number) => {
  const d = detectionStore.get().pages[page]
  if (!d) return null
  return {
    source: d.source,
    lines: d.lines.length,
    circles: d.circles.length + d.arcs.length,
    points: d.points.length,
    intersections: d.intersections.length,
  }
}

