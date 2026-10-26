import { screenToDesk } from '../geometry/coords'
import { pageAt, pageOffset } from '../geometry/layout'
import { anchorOf, bounds, translateGeometry } from '../geometry/shapes'
import type { Shape, Vec } from '../types'
import { newId } from '../utils/id'
import { appStore } from './appStore'
import { documentActions, documentStore } from './documentStore'

/**
 * Copying and pasting strokes (Ctrl C, Ctrl X, Ctrl V), also into another tab or another window.
 * They go on the system clipboard as text behind a mark, so that whatever was copied last wins:
 * strokes paste as strokes, a picture copied afterwards opens as a picture.
 */
const MARK = 'lamina-trazos:'

/** Where the cursor last was over the desk: pasted strokes are centred there. */
let deskCursor: Vec | null = null
export const setDeskCursor = (p: Vec | null) => {
  deskCursor = p
}

type Copied = Omit<Shape, 'id' | 'page'>

/** The selection as clipboard text, centred on the origin; null when nothing is selected. */
const selectionText = (): string | null => {
  const ids = new Set(appStore.get().selection)
  const { pageRects } = appStore.get()
  const picked = documentStore.get().shapes.filter((s) => ids.has(s.id))
  if (!picked.length) return null
  // On the desk, so that strokes taken from several pages keep where they lie to each other.
  const onDesk = picked.map((s) => translateGeometry(s, pageOffset(pageRects, s.page)))
  const box = onDesk.map(bounds).reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }))
  const centre = { x: -(box.minX + box.maxX) / 2, y: -(box.minY + box.maxY) / 2 }
  const shapes: Copied[] = onDesk.map((s) => {
    const { id: _id, page: _page, ...rest } = translateGeometry(s, centre)
    return rest
  })
  return MARK + JSON.stringify({ version: 1, shapes })
}

/** Copies (or cuts) the selection into the clipboard of a copy or cut event. */
export const copySelection = (data: DataTransfer, cut: boolean): boolean => {
  const text = selectionText()
  if (!text) return false
  data.setData('text/plain', text)
  if (cut) {
    documentActions.remove(appStore.get().selection)
    appStore.set({ selection: [] })
  }
  return true
}

const KINDS = new Set(['segment', 'circle', 'arc', 'point', 'conic', 'stroke', 'distance', 'angle', 'hatch'])

/** Pastes strokes copied here, centred on the cursor (or the middle of the screen). False when the text is not ours. */
export const pasteText = (text: string): boolean => {
  if (!text.startsWith(MARK)) return false
  let shapes: Copied[]
  try {
    const parsed = JSON.parse(text.slice(MARK.length)) as { shapes?: unknown }
    shapes = (Array.isArray(parsed.shapes) ? parsed.shapes : []).filter(
      (s): s is Copied => typeof s === 'object' && s !== null && KINDS.has((s as { kind?: unknown }).kind as string),
    )
  } catch {
    return true
  }
  if (!shapes.length) return true
  const { pageRects, view, viewport, hiddenLayers } = appStore.get()
  const at = deskCursor ?? screenToDesk(view, { x: viewport.w / 2, y: viewport.h / 2 })
  const pasted = shapes.map((s) => {
    const placed = translateGeometry(s as Shape, at)
    // Each stroke goes to the sheet it lands on, as one drawn there.
    const page = pageAt(pageRects, anchorOf(placed))
    const o = pageOffset(pageRects, page)
    return { ...translateGeometry(placed, { x: -o.x, y: -o.y }), id: newId(), page } as Shape
  })
  documentActions.add(pasted)
  const layers = new Set(pasted.map((s) => s.layer))
  // Selected, ready to be moved; their layers shown if they were hidden.
  appStore.set({ tool: 'select', selection: pasted.map((s) => s.id), hiddenLayers: hiddenLayers.filter((l) => !layers.has(l)) })
  return true
}
