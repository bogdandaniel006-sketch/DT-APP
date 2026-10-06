import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { screenToDesk } from '../geometry/coords'
import { instrumentEdges } from '../geometry/instruments'
import { pageAt, pageOffset } from '../geometry/layout'
import { distanceToGeometry, distanceToSegment, type Segment } from '../geometry/primitives'
import { anchorOf, hitTest, translateGeometry } from '../geometry/shapes'
import { SNAP_RADIUS_PX, snapAlongLine, snap as snapPoint, type SnapPoint } from '../geometry/snapping'
import { add, dot, normalize, scale, sub } from '../geometry/vec'
import { detectedLineAt, detectedNear, detectionStore } from '../pdf/detect'
import { appStore, viewActions } from '../state/appStore'
import { useStore } from '../state/createStore'
import { documentActions, documentStore } from '../state/documentStore'
import { instrumentHandles } from '../tools/instrumentTool'
import { bumpTools, toolTick, tools } from '../tools/registry'
import type { ToolApi, ToolPointer } from '../tools/types'
import { isGeometry, isMeasure, isText, type Geometry, type InstrumentKind, type Shape, type Vec } from '../types'
import { newId } from '../utils/id'
import { localPoint } from '../utils/localPoint'
import { nextPointName } from '../utils/pointNames'
import { wheelDelta, wheelZoomFactor } from '../utils/wheel'
import { InstrumentBody } from './InstrumentLayer'
import { Loupe } from './Loupe'
import { MeasuresLayer } from './MeasuresLayer'
import { NamePopover } from './NamePopover'
import { OverlayLayer } from './OverlayLayer'
import { PdfPages } from './PdfPageLayer'
import { ShapesLayer } from './ShapesLayer'
import { TextEditor } from './TextEditor'

const HIT_PX = 7
const INSTRUMENTS: InstrumentKind[] = ['escuadra', 'cartabon']
/** Tools that place points precisely: the loupe follows the cursor with them. */
const PRECISION_TOOLS = new Set(['select', 'point', 'line', 'perpendicular', 'parallel', 'bisector', 'compass', 'arc', 'dimension', 'measure-distance', 'measure-angle'])

export const Workspace = ({ spaceDown }: { spaceDown: boolean }) => {
  const container = useRef<HTMLDivElement>(null)
  const pan = useRef<{ last: Vec; id: number } | null>(null)
  const [panning, setPanning] = useState(false)
  const [cursorAt, setCursorAt] = useState<Vec | null>(null)

  const view = useStore(appStore, (s) => s.view)
  const toolId = useStore(appStore, (s) => s.tool)
  const pageRects = useStore(appStore, (s) => s.pageRects)
  const fingerprint = useStore(appStore, (s) => s.fingerprint)
  const hiddenLayers = useStore(appStore, (s) => s.hiddenLayers)
  const pdfVisible = useStore(appStore, (s) => s.pdfVisible)
  const selectionIds = useStore(appStore, (s) => s.selection)
  const instruments = useStore(appStore, (s) => s.instruments)
  const snapMode = useStore(appStore, (s) => s.snapMode)
  const loupe = useStore(appStore, (s) => s.loupe)
  /** Text being rewritten: its box replaces it on the sheet meanwhile. */
  const editingText = useStore(appStore, (s) => (s.naming?.text ? s.naming.id : undefined))
  const measuresVisible = useStore(appStore, (s) => s.measuresVisible)
  const detected = useStore(detectionStore, (s) => s.pages)
  useStore(appStore, (s) => s.compassRadius)
  useStore(appStore, (s) => s.measuring)
  useStore(toolTick, (s) => s.n)
  const allShapes = useStore(documentStore, (s) => s.shapes)

  // Every page lies on the desk; tools work in desk coordinates. Measures follow their own visibility.
  const shapes = useMemo(
    () =>
      allShapes
        .filter((s) => (isMeasure(s) ? measuresVisible : !hiddenLayers.includes(s.layer)))
        .map((s) => translateGeometry(s, pageOffset(pageRects, s.page))),
    [allShapes, hiddenLayers, pageRects, measuresVisible],
  )
  const geometryShapes = useMemo(() => shapes.filter(isGeometry), [shapes])
  /** What tools may snap to: the geometry, never written text nor dimension lines. */
  const snapShapes = useMemo(() => geometryShapes.filter((s) => !isText(s) && !s.dimension), [geometryShapes])
  const selection = useMemo(() => new Set(selectionIds), [selectionIds])
  /** Strokes around a point, drawn or of the PDF: the names of points keep clear of them. */
  const strokesNear = useCallback(
    (p: Vec, r: number): Geometry[] => {
      const page = pageAt(pageRects, p)
      const o = pageOffset(pageRects, page)
      const pdf = detectedNear(page, sub(p, o), r).curves.map((g): Geometry => translateGeometry(g, o))
      const own = geometryShapes.filter((s) => s.kind !== 'point' && distanceToGeometry(s, p) <= r)
      return [...own, ...pdf]
    },
    // `detected` is a dependency so names settle again as the detection of a page completes.
    [geometryShapes, pageRects, detected],
  )
  const edges = useMemo(
    () => INSTRUMENTS.filter((k) => instruments[k].visible).flatMap((k) => instrumentEdges(k, instruments[k])),
    [instruments],
  )

  const api = useMemo<ToolApi>(() => {
    const px = (n: number) => n / view.scale
    const offsetOf = (page: number) => pageOffset(pageRects, page)

    /** Detected PDF geometry near a desk point, converted to desk coordinates. */
    const pdfNear = (p: Vec, r: number) => {
      const page = pageAt(pageRects, p)
      const o = offsetOf(page)
      const found = detectedNear(page, sub(p, o), r)
      return {
        points: found.points.map((q): SnapPoint => ({ ...q, p: add(q.p, o) })),
        curves: found.curves.map((g): Geometry => translateGeometry(g, o)),
      }
    }

    return {
      shapes,
      instrumentEdges: edges,
      instrumentAngles: edges.map((e) => Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x)),
      snapMode,
      px,
      snap(p, exclude, withInstruments = true) {
        const radius = px(SNAP_RADIUS_PX[snapMode])
        const geoms = exclude ? snapShapes.filter((s) => !exclude.has(s.id)) : snapShapes
        return snapPoint(p, { geoms, edges: withInstruments ? edges : [], pdf: pdfNear(p, radius) }, radius, snapMode)
      },
      snapAlong(p, origin, dir, exclude) {
        const radius = px(SNAP_RADIUS_PX[snapMode])
        const unit = normalize(dir)
        const on = add(origin, scale(unit, dot(sub(p, origin), unit)))
        const geoms = exclude ? snapShapes.filter((s) => !exclude.has(s.id)) : snapShapes
        return snapAlongLine(on, unit, { geoms, edges, pdf: pdfNear(on, radius) }, radius, snapMode)
      },
      hit: (p, filter) => hitTest(shapes, p, px(HIT_PX), filter),
      lineAt(p) {
        const own = hitTest(geometryShapes, p, px(HIT_PX), (s) => s.kind === 'segment')
        if (own && own.kind === 'segment') return { seg: own, id: own.id }
        const page = pageAt(pageRects, p)
        const o = offsetOf(page)
        const line = detectedLineAt(page, sub(p, o), px(HIT_PX))
        return line ? { seg: translateGeometry(line, o) } : null
      },
      linesNear(p, r) {
        const own = geometryShapes.filter((s): s is Shape & Segment => s.kind === 'segment')
        const pdf = pdfNear(p, r).curves.filter((g): g is Segment => g.kind === 'segment')
        return [...own, ...pdf].filter((s) => distanceToSegment(p, s.a, s.b) <= r)
      },
      pageOffset: offsetOf,
      pageAt: (p) => pageAt(pageRects, p),
      nextPointName(p) {
        const page = pageAt(pageRects, p)
        return nextPointName(new Set(allShapes.filter((s) => s.page === page && s.kind === 'point' && !s.text && s.name).map((s) => s.name!)))
      },
      create(items) {
        const { pencil, layer } = appStore.get()
        const created = items.map((g) => {
          // A construction belongs to the sheet where it starts.
          const page = pageAt(pageRects, anchorOf(g))
          const local = translateGeometry(g, scale(offsetOf(page), -1))
          return { ...local, id: newId(), page, layer, pencil } as Shape
        })
        documentActions.add(created)
        return created.map((s) => s.id)
      },
    }
    // `detected` is a dependency so snapping picks up pages as their detection completes.
  }, [shapes, geometryShapes, snapShapes, edges, view.scale, pageRects, snapMode, allShapes, detected])

  const tool = tools[toolId]

  // Switching tools abandons any half-finished construction.
  useEffect(() => {
    Object.entries(tools).forEach(([id, t]) => id !== toolId && t.cancel())
    bumpTools()
  }, [toolId])

  // Viewport size, and fit the page the first time it is known.
  useEffect(() => {
    const el = container.current
    if (!el) return
    let first = true
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      appStore.set({ viewport: { w: width, h: height } })
      if (first) viewActions.fitPage()
      first = false
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Wheel scrolls the sheet (Shift: sideways), Ctrl/⌘ + wheel or a pinch zooms around the cursor.
  useEffect(() => {
    const el = container.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        viewActions.zoomAt(localPoint(el, e.clientX, e.clientY), wheelZoomFactor(e))
        return
      }
      const d = wheelDelta(e)
      if (e.shiftKey && !d.x) viewActions.pan(-d.y, 0)
      else viewActions.pan(-d.x, -d.y)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /** The single entry point from screen to desk coordinates for all input. */
  const pointer = useCallback(
    (e: ReactPointerEvent): ToolPointer => {
      const screen = localPoint(container.current!, e.clientX, e.clientY)
      return { screen, world: screenToDesk(view, screen), shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey }
    },
    [view],
  )

  const onPointerDown = (e: ReactPointerEvent) => {
    container.current?.setPointerCapture(e.pointerId)
    if (appStore.get().naming) appStore.set({ naming: null })
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      e.preventDefault()
      pan.current = { last: { x: e.clientX, y: e.clientY }, id: e.pointerId }
      setPanning(true)
      return
    }
    if (e.button === 2) {
      tool.cancel()
      bumpTools()
      return
    }
    if (e.button !== 0) return
    tool.down(pointer(e), api)
    bumpTools()
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (pan.current) {
      viewActions.pan(e.clientX - pan.current.last.x, e.clientY - pan.current.last.y)
      pan.current.last = { x: e.clientX, y: e.clientY }
      return
    }
    const p = pointer(e)
    setCursorAt(p.screen)
    tool.move(p, api)
    bumpTools()
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    if (container.current?.hasPointerCapture(e.pointerId)) container.current.releasePointerCapture(e.pointerId)
    if (pan.current) {
      pan.current = null
      setPanning(false)
      return
    }
    if (e.button !== 0) return
    tool.up(pointer(e), api)
    bumpTools()
  }

  const instrumentTool = toolId === 'escuadra' || toolId === 'cartabon' ? toolId : null
  const handles =
    instrumentTool && instruments[instrumentTool].visible
      ? instrumentHandles(instrumentTool, instruments[instrumentTool], api.px)
      : null
  const overlays = tool.overlays(api)
  const snapNow = overlays.find((o) => o.kind === 'snap')
  const showLoupe = loupe && cursorAt && !panning && !spaceDown && PRECISION_TOOLS.has(toolId)

  const cursor = panning ? 'grabbing' : spaceDown ? 'grab' : (tool.cursor?.() ?? 'crosshair')

  return (
    <div
      ref={container}
      className="desk absolute inset-0 touch-none select-none overflow-clip"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setCursorAt(null)}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="workspace"
    >
      <PdfPages rects={pageRects} fingerprint={fingerprint} view={view} visible={pdfVisible} />
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          <ShapesLayer shapes={geometryShapes} strokesNear={strokesNear} selection={selection} editingId={editingText} scale={view.scale} />
          {INSTRUMENTS.map((k) => (
            <InstrumentBody key={k} kind={k} state={instruments[k]} scale={view.scale} active={toolId === k} />
          ))}
        </g>
      </svg>
      {measuresVisible && <MeasuresLayer shapes={shapes} named={geometryShapes} selection={selection} view={view} />}
      <OverlayLayer overlays={overlays} view={view} handles={handles} />
      {showLoupe && (
        <Loupe
          cursor={cursorAt}
          view={view}
          rects={pageRects}
          shapes={geometryShapes}
          snap={snapNow?.kind === 'snap' ? snapNow.snap : null}
          viewport={appStore.get().viewport}
        />
      )}
      <NamePopover view={view} />
      <TextEditor view={view} />
    </div>
  )
}
