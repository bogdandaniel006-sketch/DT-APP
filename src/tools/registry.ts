import { createStore } from '../state/createStore'
import { createTools } from '.'
import type { ToolApi } from './types'

/** Single tool instances; their internal state survives re-renders. */
export const tools = createTools()

/** Bumped whenever a tool's internal state changes so overlays re-render. */
export const toolTick = createStore({ n: 0 })
export const bumpTools = () => toolTick.set((s) => ({ n: s.n + 1 }))

export const cancelAllTools = () => {
  Object.values(tools).forEach((t) => t.cancel())
  bumpTools()
}

/** The desk's tool API, for steps finished from outside the canvas (a figure typed in). */
let deskApi: ToolApi | null = null
export const setDeskApi = (api: ToolApi | null) => {
  deskApi = api
}
export const getDeskApi = () => deskApi
