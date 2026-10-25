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
import { bumpTools, setDeskApi, toolTick, tools } from '../tools/registry'
import type { ToolApi, ToolPointer } from '../tools/types'
import { isGeometry, isHatch, isMeasure, isText, type Geometry, type InstrumentKind, type Shape, type Vec } from '../types'
import { newId } from '../utils/id'
import { localPoint } from '../utils/localPoint'
import { nextPointName } from '../utils/pointNames'
import { touchDevice } from '../utils/device'
import { wheelDelta, wheelZoomFactor } from '../utils/wheel'
import { InstrumentBody } from './InstrumentLayer'
import { Loupe } from './Loupe'
import { HatchLayer } from './HatchLayer'
import { MeasuresLayer } from './MeasuresLayer'
import { NamePopover } from './NamePopover'
import { OverlayLayer } from './OverlayLayer'
import { PdfPages } from './PdfPageLayer'
import { ShapesLayer } from './ShapesLayer'
import { MIN_NAME_PX, NAME_SIZE, nameBaseline, nameExtent, nameReach } from './pointLabel'
import { TextEditor } from './TextEditor'

const HIT_PX = 7
/** Names are picked a little beyond their letters, so that small ones are easy to grab. */
const NAME_PICK_PX = 3
const INSTRUMENTS: InstrumentKind[] = ['escuadra', 'cartabon']
/** How long a first finger waits before drawing, in case a second one comes to zoom or move. */
const TOUCH_WAIT_MS = 110
/** A finger moving this far (screen pixels) draws at once. */
const TOUCH_SLOP_PX = 10
/** A tap of two or three fingers: short, and the fingers hardly move. */
const TAP_MS = 300
const TAP_SLOP_PX = 14
/** Tools that place points precisely: the loupe follows the cursor with them. */
const PRECISION_TOOLS = new Set(['select', 'point', 'line', 'perpendicular', 'parallel', 'bisector', 'compass', 'arc', 'conic', 'dimension', 'measure-distance', 'measure-angle'])

export const Workspace = ({ spaceDown }: { spaceDown: boolean }) => {
  const container = useRef<HTMLDivElement>(null)
  const pan = useRef<{ last: Vec; id: number } | null>(null)
  /** Where the cursor last was over the desk, to replay it when the view moves under it. */
  const lastPointer = useRef<ToolPointer | null>(null)
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
  const darkSheet = useStore(appStore, (s) => s.darkSheet)
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
  const hatches = useMemo(() => shapes.filter(isHatch), [shapes])
  /** What tools may snap to: the geometry, never written text, dimension lines nor freehand strokes. */
  const snapShapes = useMemo(() => geometryShapes.filter((s) => !isText(s) && !s.dimension && s.kind !== 'stroke'), [geometryShapes])
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
    // As ShapesLayer writes them: as on paper, never smaller than legible on screen.
    const nameSize = Math.max(NAME_SIZE, MIN_NAME_PX / view.scale)
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
      nameSize,
      nameAt(p) {
        // Last drawn on top: the name that shows is the one picked.
        for (let i = geometryShapes.length - 1; i >= 0; i--) {
          const s = geometryShapes[i]!
          if (!s.name || isText(s) || s.dimension) continue
          const at = nameBaseline(s, s.name, nameSize, (anchor) => strokesNear(anchor, nameReach(s.name!, nameSize)))
          const { w, h } = nameExtent(s.name, nameSize)
          const pad = px(NAME_PICK_PX)
          if (p.x >= at.x - pad && p.x <= at.x + w + pad && p.y >= at.y - h - pad && p.y <= at.y + pad) {
            return { shape: s, centre: { x: at.x + w / 2, y: at.y - h / 2 } }
          }
        }
        return null
      },
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
  }, [shapes, geometryShapes, snapShapes, edges, view.scale, pageRects, snapMode, allShapes, detected, strokesNear])

  const tool = tools[toolId]

  // A figure typed in finishes a step outside any pointer event: it needs the same API.
  useEffect(() => {
    setDeskApi(api)
    return () => setDeskApi(null)
  }, [api])

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

  // ── Fingers (phones and tablets, see utils/device): one draws, two or more move the sheet. ──
  /** Fingers on the screen, where they are (window coordinates). */
  const touches = useRef(new Map<number, Vec>())
  /** A first finger not yet handed to the tool: a second one may still come, to zoom or move. */
  const held = useRef<{ id: number; down: ToolPointer; moves: ToolPointer[]; start: Vec; timer: ReturnType<typeof setTimeout> } | null>(null)
  /** The finger the tool follows. */
  const drawing = useRef<number | null>(null)
  /** Two or more fingers: moving and zooming the sheet, or a tap that undoes or redoes. */
  const gesture = useRef<{ centre: Vec; spread: number; start: number; travel: number; most: number } | null>(null)
  /** A pen is on the screen: the hand resting on it does not draw. */
  const penDown = useRef(false)
  const [flash, setFlash] = useState<string | null>(null)
  // Timers hand the finger over later: they must reach the tool and the API of that moment.
  const latest = useRef({ tool: tools[toolId], api })
  latest.current = { tool: tools[toolId], api }

  const say = (text: string) => {
    setFlash(text)
    setTimeout(() => setFlash((f) => (f === text ? null : f)), 900)
  }

  /** The held finger starts drawing, with what it did meanwhile. */
  const handOver = () => {
    const h = held.current
    if (!h) return
    clearTimeout(h.timer)
    held.current = null
    drawing.current = h.id
    const { tool: t, api: a } = latest.current
    t.down(h.down, a)
    for (const m of h.moves) t.move(m, a)
    bumpTools()
  }

  const fingers = () => {
    const pts = [...touches.current.values()]
    const centre = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length }
    const spread = pts.length === 2 ? Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) : 0
    return { centre, spread }
  }

  /** A second finger: the drawing gives way to moving the sheet. */
  const startGesture = () => {
    if (held.current) {
      clearTimeout(held.current.timer)
      held.current = null
    }
    if (drawing.current !== null) {
      // The first finger had already begun: what it started is dropped, as with Esc.
      documentActions.cancelGesture()
      tool.cancel()
      drawing.current = null
      bumpTools()
    }
    lastPointer.current = null
    setCursorAt(null)
    const { centre, spread } = fingers()
    const g = gesture.current
    gesture.current = g ? { ...g, centre, spread, most: Math.max(g.most, touches.current.size) } : { centre, spread, start: performance.now(), travel: 0, most: touches.current.size }
  }

  const moveGesture = () => {
    const g = gesture.current
    if (!g || !container.current) return
    const { centre, spread } = fingers()
    viewActions.pan(centre.x - g.centre.x, centre.y - g.centre.y)
    g.travel += Math.hypot(centre.x - g.centre.x, centre.y - g.centre.y)
    // Pinching zooms around the fingers; three or more only move the sheet.
    if (spread > 0 && g.spread > 0) {
      const box = container.current.getBoundingClientRect()
      viewActions.zoomAt({ x: centre.x - box.left, y: centre.y - box.top }, spread / g.spread)
      g.travel += Math.abs(spread - g.spread)
    }
    g.centre = centre
    g.spread = spread
  }

  const touchDown = (e: ReactPointerEvent) => {
    container.current?.setPointerCapture(e.pointerId)
    // A hand resting on the screen while the pen draws.
    if (penDown.current) return
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (appStore.get().naming) appStore.set({ naming: null })
    if (touches.current.size === 1 && !gesture.current) {
      held.current = { id: e.pointerId, down: pointer(e), moves: [], start: { x: e.clientX, y: e.clientY }, timer: setTimeout(handOver, TOUCH_WAIT_MS) }
      return
    }
    startGesture()
  }

  const touchMove = (e: ReactPointerEvent) => {
    if (!touches.current.has(e.pointerId)) return
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (gesture.current) return moveGesture()
    const h = held.current
    if (h?.id === e.pointerId) {
      h.moves.push(pointer(e))
      if (Math.hypot(e.clientX - h.start.x, e.clientY - h.start.y) > TOUCH_SLOP_PX) handOver()
      return
    }
    if (drawing.current !== e.pointerId) return
    const p = pointer(e)
    lastPointer.current = p
    setCursorAt(p.screen)
    tool.move(p, api)
    bumpTools()
  }

  const touchUp = (e: ReactPointerEvent) => {
    if (container.current?.hasPointerCapture(e.pointerId)) container.current.releasePointerCapture(e.pointerId)
    if (!touches.current.delete(e.pointerId)) return
    const g = gesture.current
    if (g) {
      if (touches.current.size) {
        // Some fingers stay: they go on moving the sheet from where they are.
        const { centre, spread } = fingers()
        g.centre = centre
        g.spread = spread
        return
      }
      gesture.current = null
      // A quick tap: two fingers undo, three redo.
      if (g.travel < TAP_SLOP_PX && performance.now() - g.start < TAP_MS) {
        if (g.most === 2) {
          documentActions.undo()
          say('Deshecho')
        } else {
          documentActions.redo()
          say('Rehecho')
        }
        appStore.set({ selection: [] })
      }
      return
    }
    // A tap too short to have been handed over yet.
    if (held.current?.id === e.pointerId) handOver()
    if (drawing.current !== e.pointerId) return
    drawing.current = null
    lastPointer.current = null
    setCursorAt(null)
    tool.up(pointer(e), api)
    bumpTools()
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (touchDevice && e.pointerType === 'touch') return touchDown(e)
    if (e.pointerType === 'pen') penDown.current = true
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

  // Scrolling or zooming moves the sheet under a still cursor: the construction in progress
  // follows, as if the cursor had moved over the sheet, so it can go on past the edge of the screen.
  useEffect(() => {
    const last = lastPointer.current
    if (!last || pan.current) return
    tool.move({ ...last, world: screenToDesk(view, last.screen) }, api)
    bumpTools()
    // Only a change of view should replay the cursor.
  }, [view])

  const onPointerMove = (e: ReactPointerEvent) => {
    if (touchDevice && e.pointerType === 'touch') return touchMove(e)
    lastPointer.current = pointer(e)
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
    if (touchDevice && e.pointerType === 'touch') return touchUp(e)
    if (e.pointerType === 'pen') penDown.current = false
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
          <HatchLayer hatches={hatches} selection={selection} scale={view.scale} dark={darkSheet} />
          <ShapesLayer shapes={geometryShapes} strokesNear={strokesNear} selection={selection} editingId={editingText} scale={view.scale} dark={darkSheet} />
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
      {flash && (
        <div className="float animate-pop pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium text-ink">
          {flash}
        </div>
      )}
    </div>
  )
}
