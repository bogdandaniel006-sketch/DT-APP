import { layoutPages } from '../geometry/layout'
import { flushAutosave } from '../hooks/useAutosave'
import { startDetection } from '../pdf/detect'
import { blankPdf, imagePdf, withBlankPage, type SheetFormat } from '../pdf/make'
import { getSession, openPdf, pageSizes } from '../pdf/session'
import { cancelAllTools } from '../tools/registry'
import type { Shape } from '../types'
import { baseName, downloadBlob } from '../utils/download'
import { newId } from '../utils/id'
import {
  decodeProject,
  encodeProjectPage,
  fromBase64,
  HANDED_PROJECT_ID,
  isProject,
  projectFromPage,
  WEB_PROJECT_EXTENSION,
} from '../utils/project'
import {
  deleteDrawing,
  deleteTabFile,
  forgetLastPdf,
  loadDrawing,
  loadLastPdf,
  loadTabFile,
  loadTabs,
  saveDrawing,
  saveTabFile,
  saveTabs,
  type StoredTab,
} from '../utils/storage'
import { appStore, viewActions } from './appStore'
import { documentActions, documentStore } from './documentStore'

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)))

type Drawing = { shapes: Shape[]; page: number }

/** Remembers which documents are open, so they are there on the next visit. */
const rememberTabs = () => {
  const { tabs, activeTab } = appStore.get()
  saveTabs(tabs, activeTab)
}

/** Puts the open PDF on the desk as the given tab, with its drawing. */
const show = async (tab: StoredTab, drawing?: Drawing) => {
  const session = getSession()
  if (!session) return
  const saved = drawing ?? loadDrawing(session.fingerprint)
  const pageCount = session.doc.numPages
  const page = Math.min(saved?.page ?? 0, pageCount - 1)
  const pageRects = layoutPages(await pageSizes())
  cancelAllTools()
  documentActions.load(saved?.shapes ?? [])
  appStore.set({
    fileName: tab.name,
    fingerprint: session.fingerprint,
    activeTab: tab.id,
    pageCount,
    page,
    pageRects,
    selection: [],
    phase: 'ready',
  })
  rememberTabs()
  await nextFrame()
  viewActions.fitPage(page)
  void startDetection(session.fingerprint, pageCount)
}

/**
 * Opens a PDF in a tab of its own (or goes to the tab that already has it) and restores the
 * drawing previously made on it, if any. `own` marks documents made here: blank sheets, pictures.
 */
export const loadPdf = async (bytes: Uint8Array, name: string, options: { drawing?: Drawing; own?: boolean } = {}) => {
  const previousPhase = appStore.get().phase
  flushAutosave()
  appStore.set({ phase: 'loading', error: null })
  try {
    const session = await openPdf(bytes, name)
    const { tabs } = appStore.get()
    let tab = tabs.find((t) => t.fingerprint === session.fingerprint)
    if (!tab) {
      tab = { id: newId(), name, fingerprint: session.fingerprint, ...(options.own && { own: true }) }
      appStore.set({ tabs: [...tabs, tab] })
      await saveTabFile(tab.id, { name, bytes })
    }
    await show(tab, options.drawing)
  } catch (err) {
    console.error(err)
    appStore.set({
      phase: previousPhase === 'ready' ? 'ready' : 'start',
      error: 'No se ha podido abrir el archivo. ¿Es un PDF o una imagen válidos?',
    })
  }
}

const isPdf = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF-')

const isImage = (file: File) => file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name)

/** Opens whatever the user hands over: a PDF, a project (.lamina) or a picture. */
export const loadPdfFile = async (file: File) => {
  const given = new Uint8Array(await file.arrayBuffer())
  // A project saved as a web file carries the same project inside.
  const bytes = projectFromPage(given) ?? given
  if (isProject(bytes)) {
    const project = decodeProject(bytes)
    if (!project) {
      appStore.set({ error: 'No se ha podido abrir el proyecto. El archivo está dañado.' })
      return
    }
    return loadPdf(project.bytes, project.name, { drawing: project })
  }
  if (isPdf(bytes) || !isImage(file)) return loadPdf(bytes, file.name)
  try {
    const name = `${file.name.replace(/\.[a-z0-9]+$/i, '') || 'Imagen'}.pdf`
    await loadPdf(await imagePdf(file), name, { own: true })
  } catch (err) {
    console.error(err)
    appStore.set({ error: 'No se ha podido abrir la imagen.' })
  }
}

/** First free name of the kind "Hoja en blanco", "Hoja en blanco 2"… among the open tabs. */
const freeName = (base: string) => {
  const taken = new Set(appStore.get().tabs.map((t) => t.name))
  for (let n = 1; ; n++) {
    const name = `${base}${n > 1 ? ` ${n}` : ''}.pdf`
    if (!taken.has(name)) return name
  }
}

/** A blank sheet to draw freely on, in a tab of its own. */
export const newBlankSheet = async (format: SheetFormat = 'a4-portrait') => {
  try {
    await loadPdf(await blankPdf(format), freeName('Hoja en blanco'), { own: true })
  } catch (err) {
    console.error(err)
    appStore.set({ error: 'No se ha podido crear la hoja.' })
  }
}

/** Adds a blank page after the last one of the open document. The drawing stays as it is. */
export const addBlankPage = async () => {
  const session = getSession()
  const { activeTab, tabs, phase } = appStore.get()
  const tab = tabs.find((t) => t.id === activeTab)
  if (!session || !tab || phase !== 'ready') return
  try {
    const bytes = await withBlankPage(session.bytes)
    flushAutosave()
    const previous = session.fingerprint
    const next = await openPdf(bytes, tab.name)
    const { shapes } = documentStore.get()
    // The file changed: its drawing follows it to the new identity before anything else is saved.
    saveDrawing(next.fingerprint, shapes, appStore.get().page)
    if (tab.own && previous !== next.fingerprint) deleteDrawing(previous)
    const pageCount = next.doc.numPages
    appStore.set({
      fingerprint: next.fingerprint,
      pageCount,
      pageRects: layoutPages(await pageSizes()),
      tabs: appStore.get().tabs.map((t) => (t.id === tab.id ? { ...t, fingerprint: next.fingerprint } : t)),
    })
    void saveTabFile(tab.id, { name: tab.name, bytes })
    rememberTabs()
    await nextFrame()
    viewActions.fitPage(pageCount - 1)
    void startDetection(next.fingerprint, pageCount)
  } catch (err) {
    console.error(err)
    appStore.set({ error: 'No se ha podido añadir la página a este documento.' })
  }
}

/** Brings another open document onto the desk. */
export const activateTab = async (id: string) => {
  const { tabs, activeTab, phase } = appStore.get()
  const tab = tabs.find((t) => t.id === id)
  if (!tab || phase === 'loading') return
  if (id === activeTab && getSession()?.fingerprint === tab.fingerprint) return resumeWorkspace()
  flushAutosave()
  const file = await loadTabFile(id)
  if (!file) {
    appStore.set({ tabs: tabs.filter((t) => t.id !== id), error: `No se ha podido recuperar «${tab.name}».` })
    rememberTabs()
    return
  }
  const previousPhase = phase
  appStore.set({ phase: 'loading', error: null })
  try {
    await openPdf(file.bytes, tab.name)
    await show(tab)
  } catch (err) {
    console.error(err)
    appStore.set({ phase: previousPhase === 'ready' ? 'ready' : 'start', error: `No se ha podido abrir «${tab.name}».` })
  }
}

/** Closes a document. What was drawn on a sheet made here goes with it, so that one asks first. */
export const closeTab = async (id: string) => {
  const { tabs, activeTab } = appStore.get()
  const index = tabs.findIndex((t) => t.id === id)
  const tab = tabs[index]
  if (!tab) return
  const active = id === activeTab
  if (tab.own) {
    const drawn = active ? documentStore.get().shapes.length : (loadDrawing(tab.fingerprint)?.shapes.length ?? 0)
    if (drawn > 0 && !window.confirm(`¿Cerrar «${baseName(tab.name)}»? Se perderá lo dibujado en ella. Guarda antes el proyecto si quieres conservarlo.`)) return
  }
  flushAutosave()
  const rest = tabs.filter((t) => t.id !== id)
  void deleteTabFile(id)
  if (!active) {
    appStore.set({ tabs: rest })
    if (tab.own) deleteDrawing(tab.fingerprint)
    rememberTabs()
    return
  }
  const neighbour = rest[index] ?? rest[index - 1]
  if (neighbour) {
    appStore.set({ tabs: rest })
    await activateTab(neighbour.id)
  } else {
    // Leaving the desk first: nothing may be saved under the document that is going away.
    cancelAllTools()
    appStore.set({ tabs: rest, activeTab: null, fileName: '', fingerprint: '', phase: 'start', error: null, selection: [], naming: null, measuring: false })
    documentActions.load([])
    rememberTabs()
  }
  if (tab.own) deleteDrawing(tab.fingerprint)
}

/** Opens a PDF served by this site (an exercise sheet) on the desk. False when it could not be fetched. */
export const loadPdfFromUrl = async (url: string, name: string): Promise<boolean> => {
  try {
    const response = await fetch(url)
    // Without the sheet service every path answers with the app's own page: that is not a PDF.
    if (!response.ok || !response.headers.get('content-type')?.includes('pdf')) return false
    await loadPdf(new Uint8Array(await response.arrayBuffer()), name)
    return true
  } catch {
    return false
  }
}

/**
 * Downloads the open PDF and its editable drawing as one project file. It is a web file:
 * a double click on it opens the browser, and the page inside brings the project to this site.
 */
export const saveProject = async () => {
  const session = getSession()
  if (!session) return
  const project = { name: session.name, bytes: session.bytes, shapes: [...documentStore.get().shapes], page: appStore.get().page }
  downloadBlob(await encodeProjectPage(project, location.origin), baseName(session.name) + WEB_PROJECT_EXTENSION)
}

/**
 * Opens the project the site handed over with the page (a web project file was opened from the
 * file explorer). Once it is safely in its tab, the address is cleaned so a reload does not send it again.
 */
export const openHandedProject = async () => {
  const handed = document.getElementById(HANDED_PROJECT_ID)?.textContent
  if (!handed) return
  try {
    await loadPdfFile(new File([fromBase64(handed) as BlobPart], 'proyecto.lamina'))
  } catch (err) {
    console.error(err)
    appStore.set({ error: 'No se ha podido abrir el proyecto.' })
    return
  }
  if (appStore.get().phase !== 'ready') return
  flushAutosave()
  location.replace('/')
}

/** On start-up, reopen the documents that were open, so accidental closes lose nothing. */
export const restoreLastSession = async () => {
  const { tabs, active } = loadTabs()
  if (!tabs.length) {
    // Earlier versions remembered a single PDF: it becomes the first tab.
    const last = await loadLastPdf()
    if (last) {
      await loadPdf(last.bytes, last.name)
      if (appStore.get().tabs.length) void forgetLastPdf()
      else appStore.set({ phase: 'start', error: null })
      return
    }
    appStore.set({ phase: 'start' })
    return
  }
  appStore.set({ tabs, phase: 'start' })
  const first = tabs.find((t) => t.id === active) ?? tabs[0]!
  await activateTab(first.id)
  // A document that could not be recovered was dropped: try the next one rather than an empty desk.
  const now = appStore.get()
  if (!now.activeTab && now.tabs[0]) await activateTab(now.tabs[0].id)
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
