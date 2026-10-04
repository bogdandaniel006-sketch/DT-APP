import { angleWithNeighbours, horizontalMark } from '../geometry/angles'
import { distance, midpoint, normalOf, segment, type Segment } from '../geometry/primitives'
import type { SnapResult } from '../geometry/snapping'
import type { Shape, Vec } from '../types'
import { formatLength } from '../utils/format'
import { scale } from '../geometry/vec'
import type { Overlay, ToolApi } from './types'

const LABEL_OFFSET_PX = 20
const HORIZONTAL_REF_PX = 44

/** Offset (screen px) that places a label beside a segment, on its upper side. */
export const sideOffset = (s: Segment, px = LABEL_OFFSET_PX): Vec => {
  const n = normalOf(s)
  return scale(n.y > 0 ? scale(n, -1) : n, px)
}

export const segmentsOf = (shapes: readonly Shape[], excludeId?: string): Segment[] =>
  shapes.filter((s): s is Shape & Segment => s.kind === 'segment' && s.id !== excludeId)

interface SegmentOverlayOptions {
  ghost?: boolean
  names?: [string, string]
  excludeId?: string
}

/** Length, inclination and angles with neighbouring lines of a segment. */
export const segmentOverlays = (a: Vec, b: Vec, api: ToolApi, options: SegmentOverlayOptions = {}): Overlay[] => {
  const s = segment(a, b)
  const out: Overlay[] = []
  if (options.ghost !== false) out.push({ kind: 'ghost', geom: s })
  if (distance(a, b) < api.px(4)) {
    out.push({ kind: 'marker', p: a, label: options.names?.[0] })
    return out
  }
  const inclination = horizontalMark(a, b)
  if (inclination.value > 1e-3 && Math.abs(inclination.value - Math.PI) > 1e-3) {
    // Short horizontal reference so the angle arc reads at a glance.
    out.push({ kind: 'guide', a, b: { x: a.x + api.px(HORIZONTAL_REF_PX), y: a.y } })
  }
  out.push({ kind: 'angle', mark: inclination, showValue: true })
  // Drawn and PDF lines around the new one; lines meeting a little past their ends count too.
  const len = distance(a, b)
  const reach = Math.min(len * 0.25, api.px(60))
  const nearby = api
    .linesNear(midpoint(a, b), len / 2 + reach)
    .filter((o) => !(options.excludeId && 'id' in o && o.id === options.excludeId))
  for (const { mark, extensions } of angleWithNeighbours(s, nearby, api.px(4), 2, reach)) {
    // A horizontal neighbour at the start repeats the inclination already shown.
    const repeatsInclination = distance(mark.vertex, a) < api.px(2) && Math.abs(Math.sin(mark.value - inclination.value)) < 1e-6
    if (repeatsInclination) continue
    for (const [from, to] of extensions) out.push({ kind: 'guide', a: from, b: to })
    out.push({ kind: 'angle', mark, showValue: true })
  }
  out.push({ kind: 'label', at: midpoint(a, b), text: formatLength(distance(a, b)), offset: sideOffset(s) })
  if (options.names) {
    out.push({ kind: 'marker', p: a, label: options.names[0] }, { kind: 'marker', p: b, label: options.names[1] })
  }
  return out
}

export const snapOverlay = (snap: SnapResult | null): Overlay[] => (snap?.kind ? [{ kind: 'snap', snap }] : [])
