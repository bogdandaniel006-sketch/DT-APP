import { conicFoci, ellipseFromAxes, hyperbolaFromVertices, parabolaFromDirectrix } from '../geometry/conics'
import { distance, type Segment } from '../geometry/primitives'
import type { SnapResult } from '../geometry/snapping'
import { add, dot, normalize, scale, sub } from '../geometry/vec'
import { createStore } from '../state/createStore'
import type { Conic, ConicType, Vec } from '../types'
import { formatPrecise } from '../utils/format'
import { snapOverlay } from './overlays'
import { bumpTools } from './registry'
import type { Overlay, ReferenceLine, Tool, ToolApi } from './types'

/** Which conic the tool draws. */
export const conicStore = createStore<{ type: ConicType }>({ type: 'ellipse' })

/** Distance from p to the line through o with unit direction u. */
const offAxis = (p: Vec, o: Vec, u: Vec) => Math.abs(dot(sub(p, o), { x: -u.y, y: u.x }))

/** Reflection of p across the line through o with unit direction u. */
const mirror = (p: Vec, o: Vec, u: Vec) => {
  const along = add(o, scale(u, dot(sub(p, o), u)))
  return sub(scale(along, 2), p)
}

/**
 * Conics, one tool for the three:
 *
 * - ellipse: the ends A and B of the major axis, then an end C of the minor axis;
 * - hyperbola: the vertices A and A', then a focus F, then how far the branches reach;
 * - parabola: the directrix (a line, drawn or of the PDF), the focus F, then how far it reaches.
 */
export const createConicTool = (): Tool => {
  /** Points clicked so far. */
  let pts: Vec[] = []
  /** The directrix of a parabola, once picked. */
  let directrix: Segment | null = null
  let hoverLine: ReferenceLine | null = null
  let cursor: Vec | null = null
  let snap: SnapResult | null = null

  const reset = () => {
    pts = []
    directrix = null
  }
  // Changing the kind of conic starts over.
  conicStore.subscribe(() => {
    reset()
    bumpTools()
  })

  const type = () => conicStore.get().type

  /** The conic the next click would make, with the cursor at p. */
  const preview = (p: Vec): Conic | null => {
    switch (type()) {
      case 'ellipse':
        return pts.length === 2 ? ellipseFromAxes(pts[0]!, pts[1]!, p) : null
      case 'hyperbola': {
        if (pts.length < 2) return null
        const [A, A2] = pts as [Vec, Vec]
        const c = scale(add(A, A2), 0.5)
        const u = normalize(sub(A2, A))
        if (pts.length === 2) {
          // The focus is being placed: branches as long as the real axis meanwhile.
          return hyperbolaFromVertices(A, A2, p, distance(A, A2))
        }
        return hyperbolaFromVertices(A, A2, pts[2]!, Math.max(offAxis(p, c, u), 1))
      }
      case 'parabola': {
        if (!directrix || pts.length === 0) return null
        const F = pts[0]!
        const along = normalize(sub(directrix.b, directrix.a))
        return parabolaFromDirectrix(directrix, F, Math.max(offAxis(p, F, { x: -along.y, y: along.x }), 1))
      }
    }
  }

  /** How many clicks the current conic takes (the directrix of a parabola apart). */
  const needed = () => (type() === 'ellipse' ? 3 : type() === 'hyperbola' ? 4 : 2)

  return {
    down(e, api) {
      if (type() === 'parabola' && !directrix) {
        const picked = api.lineAt(e.world)
        directrix = picked?.seg ?? null
        hoverLine = null
        return
      }
      const p = snap?.p ?? e.world
      if (pts.length + 1 < needed()) {
        // Two points of an axis cannot coincide.
        if (pts.length === 1 && type() !== 'parabola' && distance(pts[0]!, p) < api.px(3)) return
        if (type() === 'hyperbola' && pts.length === 2 && !hyperbolaFromVertices(pts[0]!, pts[1]!, p, 1)) return
        pts = [...pts, p]
        return
      }
      const conic = preview(p)
      if (!conic) return
      api.create([conic])
      reset()
    },
    move(e, api: ToolApi) {
      if (type() === 'parabola' && !directrix) {
        hoverLine = api.lineAt(e.world)
        snap = null
        cursor = e.world
        return
      }
      snap = api.snap(e.world)
      cursor = snap.p
    },
    up() {},
    cancel() {
      const had = pts.length > 0 || directrix !== null
      reset()
      return had
    },
    overlays() {
      const out: Overlay[] = []
      if (type() === 'parabola' && !directrix) return hoverLine ? [{ kind: 'highlight', geom: hoverLine.seg }] : []
      if (directrix) out.push({ kind: 'highlight', geom: directrix })
      const p = cursor
      if (!p) return out
      const conic = preview(p)
      if (conic) {
        out.push({ kind: 'ghost', geom: conic })
        conicFoci(conic).forEach((f, i) => out.push({ kind: 'marker', p: f, label: conic.type === 'parabola' ? 'F' : i ? "F'" : 'F' }))
      }
      const t = type()
      if (t === 'ellipse') {
        if (pts.length === 1) out.push({ kind: 'guide', a: pts[0]!, b: p }, { kind: 'marker', p: pts[0]!, label: 'A' })
        if (pts.length === 2) {
          const [A, B] = pts as [Vec, Vec]
          const c = scale(add(A, B), 0.5)
          const u = normalize(sub(B, A))
          const D = mirror(p, c, u)
          out.push({ kind: 'guide', a: A, b: B }, { kind: 'guide', a: p, b: D })
          out.push({ kind: 'marker', p: A, label: 'A' }, { kind: 'marker', p: B, label: 'B' }, { kind: 'marker', p: c, label: 'O' })
          out.push({ kind: 'marker', p, label: 'C' }, { kind: 'marker', p: D, label: 'D' })
          if (conic) out.push({ kind: 'label', at: p, text: `2a ${formatPrecise(2 * conic.a)} · 2b ${formatPrecise(2 * conic.b)}`, offset: { x: 0, y: -26 } })
        }
      }
      if (t === 'hyperbola') {
        if (pts.length === 1) out.push({ kind: 'guide', a: pts[0]!, b: p }, { kind: 'marker', p: pts[0]!, label: 'A' })
        if (pts.length >= 2) {
          const [A, A2] = pts as [Vec, Vec]
          out.push({ kind: 'guide', a: A, b: A2 }, { kind: 'marker', p: A, label: 'A' }, { kind: 'marker', p: A2, label: "A'" })
          out.push({ kind: 'marker', p: scale(add(A, A2), 0.5), label: 'O' })
          if (conic) out.push({ kind: 'label', at: p, text: `2a ${formatPrecise(2 * conic.a)} · 2c ${formatPrecise(2 * Math.hypot(conic.a, conic.b))}`, offset: { x: 0, y: -26 } })
        }
      }
      if (t === 'parabola' && conic) {
        out.push({ kind: 'marker', p: conic.c, label: 'V' })
        out.push({ kind: 'label', at: p, text: `p ${formatPrecise(2 * conic.a)}`, offset: { x: 0, y: -26 } })
      }
      if (pts.length === 0) out.push({ kind: 'marker', p })
      return [...out, ...snapOverlay(snap)]
    },
    hint() {
      switch (type()) {
        case 'ellipse':
          return [
            'Elipse, paso 1 de 3: escoge un punto, que será el extremo A del eje mayor',
            'Paso 2 de 3: escoge el otro extremo B del eje mayor (el centro O queda en medio)',
            'Paso 3 de 3: escoge un punto C, extremo del eje menor (D sale simétrico)',
          ][pts.length] ?? null
        case 'hyperbola':
          return [
            'Hipérbola, paso 1 de 4: escoge un punto, que será el vértice A',
            "Paso 2 de 4: escoge el otro vértice A' (entre los dos queda el eje real)",
            'Paso 3 de 4: escoge un punto, que será el foco F (por fuera de los vértices)',
            'Paso 4 de 4: mueve el cursor y haz clic para escoger la longitud de las ramas',
          ][pts.length] ?? null
        case 'parabola':
          if (!directrix) return 'Parábola, paso 1 de 3: escoge una recta, que será la directriz'
          return [
            'Paso 2 de 3: escoge un punto, que será el foco F',
            'Paso 3 de 3: mueve el cursor y haz clic para escoger la longitud de la parábola',
          ][pts.length] ?? null
      }
    },
  }
}

