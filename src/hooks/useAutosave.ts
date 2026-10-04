import { useEffect } from 'react'
import { appStore, type AppState } from '../state/appStore'
import { documentStore } from '../state/documentStore'
import { loadSettings, saveDrawing, saveSettings } from '../utils/storage'

const DELAY_MS = 400

type Settings = Pick<AppState, 'pencil' | 'layer' | 'snapMode' | 'loupe' | 'measuresVisible'>

/** Persists the drawing (per PDF) and the pencil/layer choice to localStorage. */
export const useAutosave = () => {
  useEffect(() => {
    const settings = loadSettings<Settings>()
    if (settings.pencil) appStore.set({ pencil: settings.pencil })
    if (settings.layer) appStore.set({ layer: settings.layer })
    if (settings.snapMode) appStore.set({ snapMode: settings.snapMode })
    if (typeof settings.loupe === 'boolean') appStore.set({ loupe: settings.loupe })
    if (typeof settings.measuresVisible === 'boolean') appStore.set({ measuresVisible: settings.measuresVisible })

    let timer: ReturnType<typeof setTimeout> | undefined
    const snapshot = () => {
      const { page, pencil, layer, snapMode, loupe, measuresVisible } = appStore.get()
      return { shapes: documentStore.get().shapes, page, pencil, layer, snapMode, loupe, measuresVisible }
    }
    let last = snapshot()

    const schedule = () => {
      const { phase, fingerprint } = appStore.get()
      if (phase !== 'ready' || !fingerprint) return
      const now = snapshot()
      if ((Object.keys(now) as (keyof typeof now)[]).every((k) => now[k] === last[k])) return
      last = now
      clearTimeout(timer)
      timer = setTimeout(() => {
        const { pencil, layer, snapMode, loupe, measuresVisible } = now
        saveSettings({ pencil, layer, snapMode, loupe, measuresVisible } satisfies Settings)
        if (saveDrawing(fingerprint, now.shapes, now.page)) appStore.set({ savedAt: Date.now() })
      }, DELAY_MS)
    }

    const unsubDoc = documentStore.subscribe(schedule)
    const unsubApp = appStore.subscribe(schedule)
    return () => {
      unsubDoc()
      unsubApp()
      clearTimeout(timer)
    }
  }, [])
}
