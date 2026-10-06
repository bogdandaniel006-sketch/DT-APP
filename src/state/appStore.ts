import type { InstrumentKind, InstrumentState, LayerId, Pencil, SnapMode, ToolId, Vec, View } from '../types'
import { pageAt, type PageRect } from '../geometry/layout'
import { mmToPt, PX_PER_PT } from '../geometry/units'
import { LAYER_PENCIL } from '../canvas/style'
import type { StoredTab } from '../utils/storage'
import { createStore } from './createStore'

export type Phase = 'boot' | 'start' | 'loading' | 'ready'

export interface AppState {
  phase: Phase
  error: string | null
  fileName: string
  fingerprint: string
  /** Open documents, in the order of their tabs. */
  tabs: readonly StoredTab[]
  /** The tab on the desk. */
  activeTab: string | null
  /** Page under the centre of the viewport. */
  page: number
  pageCount: number
  /** Where each page lies on the desk. */
  pageRects: readonly PageRect[]
  viewport: { w: number; h: number }
  view: View
  tool: ToolId
  pencil: Pencil
  layer: LayerId
  hiddenLayers: readonly LayerId[]
  pdfVisible: boolean
  selection: readonly string[]
  instruments: Record<InstrumentKind, InstrumentState>
  /** Distance memorised by the compass ("tomar medida"), in world units. */
  compassRadius: number | null
  measuring: boolean
  savedAt: number | null
  /** The last autosave could not be written (storage full or blocked). */
  saveFailed: boolean
  snapMode: SnapMode
  /** Precision loupe following the cursor. */
  loupe: boolean
  /** Measurement labels layer. */
  measuresVisible: boolean
  /** Naming popover: a detected point (no id) or an existing point (id). Desk coordinates. */
  naming: NamingRequest | null
}

export interface NamingRequest {
  p: Vec
  id?: string
  value: string
}

const defaultInstrument = (size: number): InstrumentState => ({
  visible: false,
  pos: { x: 0, y: 0 },
  rotation: 0,
  size,
  flipped: false,
})

export const appStore = createStore<AppState>({
  phase: 'boot',
  error: null,
  fileName: '',
  fingerprint: '',
  tabs: [],
  activeTab: null,
  page: 0,
  pageCount: 0,
  pageRects: [],
  viewport: { w: 1, h: 1 },
  view: { scale: 1, x: 0, y: 0 },
  tool: 'line',
  pencil: { width: 0.25, hardness: '2H' },
  layer: 'construccion',
  hiddenLayers: [],
  pdfVisible: true,
  selection: [],
  instruments: { escuadra: defaultInstrument(mmToPt(150)), cartabon: defaultInstrument(mmToPt(180)) },
  compassRadius: null,
  measuring: false,
  savedAt: null,
  saveFailed: false,
  snapMode: 'normal',
  loupe: false,
  measuresVisible: true,
  naming: null,
})

export const MIN_SCALE = 0.1
export const MAX_SCALE = 16
const FIT_MARGIN = 56

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

/**
 * Keeps the sheets in reach: any edge of the stack of pages can be brought to
 * the middle of the screen (room to work right at the border), never further.
 */
const clampView = (view: View): View => {
  const { viewport, pageRects } = appStore.get()
  if (!pageRects.length || viewport.w <= 1) return view
  const minX = Math.min(...pageRects.map((r) => r.x))
  const maxX = Math.max(...pageRects.map((r) => r.x + r.w))
  const minY = pageRects[0]!.y
  const last = pageRects[pageRects.length - 1]!
  const maxY = last.y + last.h
  const cx = viewport.w / 2
  const cy = viewport.h / 2
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  return {
    scale: view.scale,
    x: clamp(view.x, cx - maxX * view.scale, cx - minX * view.scale),
    y: clamp(view.y, cy - maxY * view.scale, cy - minY * view.scale),
  }
}

export const zoomPercent = (view: View): number => Math.round((view.scale / PX_PER_PT) * 100)

export const viewActions = {
  zoomAt(screen: Vec, factor: number) {
    const { view } = appStore.get()
    const scale = clampScale(view.scale * factor)
    const k = scale / view.scale
    appStore.set({ view: clampView({ scale, x: screen.x - (screen.x - view.x) * k, y: screen.y - (screen.y - view.y) * k }) })
  },

  /** Zooms to a percentage of real size, keeping the viewport centre fixed. */
  setPercent(percent: number) {
    viewActions.zoomBy(((percent / 100) * PX_PER_PT) / appStore.get().view.scale)
  },

  /** Zooms around the viewport centre. */
  zoomBy(factor: number) {
    const { viewport } = appStore.get()
    viewActions.zoomAt({ x: viewport.w / 2, y: viewport.h / 2 }, factor)
  },

  pan(dx: number, dy: number) {
    const { view } = appStore.get()
    appStore.set({ view: clampView({ ...view, x: view.x + dx, y: view.y + dy }) })
  },

  /** Fits a page (the current one by default) in the viewport. */
  fitPage(index = appStore.get().page) {
    const { viewport, pageRects } = appStore.get()
    const r = pageRects[index]
    // Before the workspace is measured there is nothing sensible to fit to.
    if (!r || viewport.w <= 1 || viewport.h <= 1) return
    viewFitted = true
    const scale = clampScale(Math.min((viewport.w - FIT_MARGIN * 2) / r.w, (viewport.h - FIT_MARGIN * 2) / r.h))
    appStore.set({
      page: index,
      view: { scale, x: (viewport.w - r.w * scale) / 2 - r.x * scale, y: (viewport.h - r.h * scale) / 2 - r.y * scale },
    })
  },
}

/** Set by the first real fit: until then the view is meaningless. */
let viewFitted = false

/** Keeps `page` pointing at the sheet under the centre of the screen. */
appStore.subscribe(() => {
  const { view, viewport, pageRects, page, phase } = appStore.get()
  if (!viewFitted || phase !== 'ready' || !pageRects.length) return
  const center = { x: (viewport.w / 2 - view.x) / view.scale, y: (viewport.h / 2 - view.y) / view.scale }
  const current = pageAt(pageRects, center)
  if (current !== page) appStore.set({ page: current })
})

export const setTool = (tool: ToolId) => {
  const { instruments } = appStore.get()
  const patch: Partial<AppState> = { tool, measuring: false, naming: null }
  if (tool !== 'select') patch.selection = []
  if ((tool === 'escuadra' || tool === 'cartabon') && !instruments[tool].visible) {
    patch.instruments = { ...instruments, [tool]: placeInstrument(tool) }
  }
  appStore.set(patch)
}

/** Makes a layer the active one (and visible). Switching also picks its usual pencil; the picker can still override it. */
export const setLayer = (id: LayerId) => {
  const { layer, hiddenLayers } = appStore.get()
  appStore.set({
    layer: id,
    hiddenLayers: hiddenLayers.filter((h) => h !== id),
    ...(id !== layer && { pencil: LAYER_PENCIL[id] }),
  })
}

/** Places an instrument in the middle of what the user is looking at. */
const placeInstrument = (kind: InstrumentKind): InstrumentState => {
  const { view, viewport, instruments } = appStore.get()
  const current = instruments[kind]
  const visibleWorld = Math.min(viewport.w, viewport.h) / view.scale
  const size = Math.min(current.size, visibleWorld * 0.55)
  const center = { x: (viewport.w / 2 - view.x) / view.scale, y: (viewport.h / 2 - view.y) / view.scale }
  const offset = kind === 'escuadra' ? 0.35 : 0.25
  return {
    ...current,
    visible: true,
    size,
    pos: { x: center.x - size * offset, y: center.y + size * offset },
  }
}

export const hideInstrument = (kind: InstrumentKind) => {
  const { instruments, tool } = appStore.get()
  appStore.set({
    instruments: { ...instruments, [kind]: { ...instruments[kind], visible: false } },
    tool: tool === kind ? 'line' : tool,
  })
}

export const flipInstrument = (kind: InstrumentKind) => {
  const current = appStore.get().instruments[kind]
  updateInstrument(kind, { flipped: !current.flipped })
}

export const updateInstrument = (kind: InstrumentKind, patch: Partial<InstrumentState>) => {
  const { instruments } = appStore.get()
  appStore.set({ instruments: { ...instruments, [kind]: { ...instruments[kind], ...patch } } })
}
