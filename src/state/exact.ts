import { bumpTools, getDeskApi, tools } from '../tools/registry'
import { appStore } from './appStore'
import { createStore } from './createStore'

/**
 * A figure typed in while drawing (a length, a radius, an angle), as in a CAD program. It stays
 * out of sight: the box opens only once a step that takes one is under way and a digit is typed,
 * or its small button in the bottom bar is pressed.
 */
export const exactStore = createStore<{ open: boolean; text: string }>({ open: false, text: '' })

/** What can be typed at this step of the current tool, if anything. */
export const exactPrompt = () => tools[appStore.get().tool].exact?.() ?? null

export const openExact = (text = '') => {
  if (exactPrompt()) exactStore.set({ open: true, text })
}

export const closeExact = () => exactStore.set({ open: false, text: '' })

/** "20", "12,5", "7.25" → a positive number; anything else → null. */
export const parseFigure = (text: string): number | null => {
  const clean = text.trim().replace(',', '.')
  if (!/^\d*\.?\d+$|^\d+\.$/.test(clean)) return null
  const value = Number(clean)
  return Number.isFinite(value) && value > 0 ? value : null
}

/** Finishes the step with the figure typed. Returns false (and keeps the box open) when it is not one. */
export const commitExact = (): boolean => {
  const value = parseFigure(exactStore.get().text)
  const tool = tools[appStore.get().tool]
  const api = getDeskApi()
  if (value === null || !tool.exact?.() || !tool.applyExact || !api) return false
  tool.applyExact(value, api)
  closeExact()
  bumpTools()
  return true
}
