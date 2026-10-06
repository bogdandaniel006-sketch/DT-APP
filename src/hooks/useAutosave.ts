import { useEffect } from 'react'
import { appStore, type AppState } from '../state/appStore'
import { documentStore } from '../state/documentStore'
import { loadSettings, saveDrawing, saveSettings } from '../utils/storage'

const DELAY_MS = 400

type Settings = Pick<AppState, 'pencil' | 'layer' | 'snapMode' | 'loupe' | 'measuresVisible'>

let flushNow: (() => void) | null = null

/** Writes at once the save that is waiting for its delay (before changing or closing a document). */
export const flushAutosave = () => flushNow?.()

/** Persists the drawing (per PDF) and the pencil/layer choice to localStorage. */
export const useAutosave = () => {
  useEffect(() => {
    const settings = loadSettings<Settings>()
    // Dashes and colour are never picked automatically, not even from the last session.
    if (settings.pencil) {
      const { width, hardness } = settings.pencil
      appStore.set({ pencil: { width, hardness } })
    }
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

    /** The save waiting for its delay, if any. */
    let pending: (() => void) | null = null
    let askedToPersist = false

    const flush = () => {
      clearTimeout(timer)
      pending?.()
      pending = null
    }

    const schedule = () => {
      const { phase, fingerprint } = appStore.get()
      if (phase !== 'ready' || !fingerprint) return
      const now = snapshot()
      if ((Object.keys(now) as (keyof typeof now)[]).every((k) => now[k] === last[k])) return
      last = now
      clearTimeout(timer)
      pending = () => {
        const { pencil, layer, snapMode, loupe, measuresVisible } = now
        saveSettings({ pencil, layer, snapMode, loupe, measuresVisible } satisfies Settings)
        const ok = saveDrawing(fingerprint, now.shapes, now.page)
        appStore.set(ok ? { savedAt: Date.now(), saveFailed: false } : { saveFailed: true })
        // Ask the browser not to evict the saved work when it runs short of space.
        if (ok && !askedToPersist) {
          askedToPersist = true
          void navigator.storage?.persist?.().catch(() => false)
        }
      }
      timer = setTimeout(flush, DELAY_MS)
    }

    // Closing or leaving the tab must not lose the strokes still waiting for the delay.
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    flushNow = flush
    const unsubDoc = documentStore.subscribe(schedule)
    const unsubApp = appStore.subscribe(schedule)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      unsubDoc()
      unsubApp()
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
      flush()
      flushNow = null
    }
  }, [])
}
