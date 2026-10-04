import { layoutPages } from '../geometry/layout'
import { startDetection } from '../pdf/detect'
import { getSession, openPdf, pageSizes } from '../pdf/session'
import { cancelAllTools } from '../tools/registry'
import type { Shape } from '../types'
import { baseName, downloadBlob } from '../utils/download'
import { decodeProject, encodeProject, isProject, PROJECT_EXTENSION } from '../utils/project'
import { loadDrawing, loadLastPdf, saveLastPdf } from '../utils/storage'
import { appStore, viewActions } from './appStore'
import { documentActions, documentStore } from './documentStore'

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)))

/** Opens a PDF and restores the drawing previously made on it, if any. */
export const loadPdf = async (
  bytes: Uint8Array,
  name: string,
  options: { remember?: boolean; drawing?: { shapes: Shape[]; page: number } } = {},
) => {
  const previousPhase = appStore.get().phase
  appStore.set({ phase: 'loading', error: null })
  try {
    const session = await openPdf(bytes, name)
    const saved = options.drawing ?? loadDrawing(session.fingerprint)
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
  if (!isProject(bytes)) return loadPdf(bytes, file.name)
  const project = decodeProject(bytes)
  if (!project) {
    appStore.set({ error: 'No se ha podido abrir el proyecto. El archivo está dañado.' })
    return
  }
  await loadPdf(project.bytes, project.name, { drawing: project })
}

/** Downloads the open PDF and its editable drawing as one project file. */
export const saveProject = () => {
  const session = getSession()
  if (!session) return
  const project = { name: session.name, bytes: session.bytes, shapes: [...documentStore.get().shapes], page: appStore.get().page }
  downloadBlob(encodeProject(project), baseName(session.name) + PROJECT_EXTENSION)
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

/** Leaves the desk for the start screen. The PDF stays open so the work can be resumed. */
export const goToStart = () => {
  cancelAllTools()
  appStore.set({ phase: 'start', error: null, selection: [], naming: null, measuring: false })
}

/** Back to the desk from the start screen, on the PDF that was left open. */
export const resumeWorkspace = async () => {
  const { fingerprint, page } = appStore.get()
  if (!fingerprint) return
  appStore.set({ phase: 'ready', error: null })
  await nextFrame()
  viewActions.fitPage(page)
}

/** Brings a sheet into view. Constructions in progress are kept: pages share one desk. */
export const goToPage = (page: number) => {
  const { pageCount } = appStore.get()
  if (page < 0 || page >= pageCount) return
  viewActions.fitPage(page)
}
