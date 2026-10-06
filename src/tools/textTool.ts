import { appStore } from '../state/appStore'
import { isText } from '../types'
import type { Tool } from './types'

/** Texto: click where the writing starts and type it; click an existing text to change it. */
export const createTextTool = (): Tool => {
  let over = false

  return {
    down(e, api) {
      const existing = api.hit(e.world, isText)
      if (existing && existing.kind === 'point') {
        appStore.set({ naming: { p: existing.p, id: existing.id, value: existing.name ?? '', text: true } })
        return
      }
      appStore.set({ naming: { p: e.world, value: '', text: true } })
    },
    move(e, api) {
      over = api.hit(e.world, isText) !== null
    },
    up() {},
    cancel() {
      if (!appStore.get().naming) return false
      appStore.set({ naming: null })
      return true
    },
    overlays() {
      return []
    },
    hint() {
      return 'Clic donde empieza el texto y escribe · clic sobre un texto para cambiarlo'
    },
    cursor() {
      return over ? 'pointer' : 'text'
    },
  }
}
