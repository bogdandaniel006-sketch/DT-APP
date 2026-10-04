import type { Shape } from '../types'
import { createStore } from './createStore'

const HISTORY_LIMIT = 300

interface DocumentState {
  shapes: readonly Shape[]
  past: readonly (readonly Shape[])[]
  future: readonly (readonly Shape[])[]
}

export const documentStore = createStore<DocumentState>({ shapes: [], past: [], future: [] })

/** Snapshot taken when a gesture (move, erase stroke…) starts; the gesture becomes one undo step. */
let gestureBase: readonly Shape[] | null = null

const apply = (next: readonly Shape[]) => {
  if (gestureBase) {
    documentStore.set({ shapes: next })
    return
  }
  const { shapes, past } = documentStore.get()
  if (next === shapes) return
  documentStore.set({ shapes: next, past: [...past, shapes].slice(-HISTORY_LIMIT), future: [] })
}

export const documentActions = {
  add(shapes: readonly Shape[]) {
    if (shapes.length) apply([...documentStore.get().shapes, ...shapes])
  },

  remove(ids: readonly string[]) {
    if (!ids.length) return
    const drop = new Set(ids)
    const { shapes } = documentStore.get()
    const next = shapes.filter((s) => !drop.has(s.id))
    if (next.length !== shapes.length) apply(next)
  },

  update(ids: readonly string[], change: (shape: Shape) => Shape) {
    const target = new Set(ids)
    apply(documentStore.get().shapes.map((s) => (target.has(s.id) ? change(s) : s)))
  },

  beginGesture() {
    gestureBase = documentStore.get().shapes
  },

  endGesture() {
    const base = gestureBase
    gestureBase = null
    if (!base) return
    const { shapes, past } = documentStore.get()
    if (shapes !== base) documentStore.set({ past: [...past, base].slice(-HISTORY_LIMIT), future: [] })
  },

  cancelGesture() {
    if (gestureBase) documentStore.set({ shapes: gestureBase })
    gestureBase = null
  },

  undo() {
    if (gestureBase) return
    const { shapes, past, future } = documentStore.get()
    const previous = past[past.length - 1]
    if (!previous) return
    documentStore.set({ shapes: previous, past: past.slice(0, -1), future: [shapes, ...future] })
  },

  redo() {
    if (gestureBase) return
    const { shapes, past, future } = documentStore.get()
    const next = future[0]
    if (!next) return
    documentStore.set({ shapes: next, past: [...past, shapes], future: future.slice(1) })
  },

  /** Replaces the whole drawing (opening a file), clearing history. */
  load(shapes: readonly Shape[]) {
    gestureBase = null
    documentStore.set({ shapes, past: [], future: [] })
  },
}
