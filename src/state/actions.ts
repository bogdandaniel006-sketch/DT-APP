import { layoutPages } from '../geometry/layout'
import { startDetection } from '../pdf/detect'
import { openPdf, pageSizes } from '../pdf/session'
import { cancelAllTools } from '../tools/registry'
import { loadDrawing, loadLastPdf, saveLastPdf } from '../utils/storage'
import { appStore, viewActions } from './appStore'
import { documentActions } from './documentStore'

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)))

/** Opens a PDF and restores the drawing previously made on it, if any. */
export const loadPdf = async (bytes: Uint8Array, name: string, options: { remember?: boolean } = {}) => {
  const previousPhase = appStore.get().phase
  appStore.set({ phase: 'loading', error: null })
  try {
    const session = await openPdf(bytes, name)
    const saved = loadDrawing(session.fingerprint)
    const pageCount = session.doc.numPages
    const page = Math.min(saved?.page ?? 0, pageCount - 1)
    const pageRects = layoutPages(await pageSizes())
    cancelAllTools()
    documentActions.load(saved?.shapes ?? [])
    appStore.set({
      fileName: name,
      fingerprint: session.fingerprint,
      pageCount,
      page,
      pageRects,
      selection: [],
      phase: 'ready',
    })
    await nextFrame()
    viewActions.fitPage(page)
    void startDetection(session.fingerprint, pageCount)
    if (options.remember !== false) void saveLastPdf({ name, bytes })
  } catch (err) {
    console.error(err)
    appStore.set({
      phase: previousPhase === 'ready' ? 'ready' : 'start',
      error: 'No se ha podido abrir el archivo. ¿Es un PDF válido?',
    })
  }
}

export const loadPdfFile = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer())
  await loadPdf(bytes, file.name)
}

/** On start-up, reopen the last PDF so accidental closes lose nothing. */
export const restoreLastSession = async () => {
  const last = await loadLastPdf()
  if (!last) {
    appStore.set({ phase: 'start' })
    return
  }
  await loadPdf(last.bytes, last.name, { remember: false })
}

/** Brings a sheet into view. Constructions in progress are kept: pages share one desk. */
export const goToPage = (page: number) => {
  const { pageCount } = appStore.get()
  if (page < 0 || page >= pageCount) return
  viewActions.fitPage(page)
}
