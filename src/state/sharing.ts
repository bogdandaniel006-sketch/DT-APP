import { SENT_TAG } from './classes'
import { getSession } from '../pdf/session'
import { appStore } from './appStore'
import { createStore } from './createStore'
import { documentStore } from './documentStore'

/**
 * Sending sheets to the author, for people who accept it in the consent notice: what they do in
 * the app (open, export, save) and copies of what they work on, the original file and their
 * strokes as they stand. Nothing at all leaves the browser without that yes, and saying no later
 * deletes what was sent. Received at /registro/… by the worker (see worker/registro.js).
 */

const CONSENT_KEY = 'lamina:consentimiento'
const DEVICE_KEY = 'lamina:dispositivo'
const SENT_KEY = 'lamina:enviados'
/** Set by the creator's panel: the author's own browser never sends anything. */
const CREATOR_KEY = 'lamina:creador'
/** Version of the notice: a new one, saying something else, asks again. */
const NOTICE = 1
/** Strokes go out this long after the last change, so a drawing session sends a few times, not at every stroke. */
const DRAWING_DELAY_MS = 20_000

export type Choice = 'si' | 'no'

export interface SharingState {
  choice: Choice | null
  /** The notice is open again, to change the choice (from "Privacidad"). */
  reviewing: boolean
}

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* storage unavailable: the choice lasts until the page is closed */
  }
}

const loadChoice = (): Choice | null => {
  if (read(CREATOR_KEY)) return 'no'
  try {
    const saved = JSON.parse(read(CONSENT_KEY) ?? 'null') as { choice?: string; version?: number } | null
    return saved?.version === NOTICE && (saved.choice === 'si' || saved.choice === 'no') ? saved.choice : null
  } catch {
    return null
  }
}

export const sharingStore = createStore<SharingState>({ choice: loadChoice(), reviewing: false })

export const isCreator = () => read(CREATOR_KEY) !== null
const accepted = () => sharingStore.get().choice === 'si' && !isCreator()

/** A random id for this browser, so its sheets go together and can be deleted together. */
const device = () => {
  let id = read(DEVICE_KEY)
  if (!id || !/^[a-z0-9-]{8,40}$/.test(id)) {
    id = crypto.randomUUID()
    write(DEVICE_KEY, id)
  }
  return id
}

/** Fingerprints whose original has been sent from this browser. */
const sentFiles = (): Set<string> => {
  try {
    return new Set(JSON.parse(read(SENT_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/** The fingerprint of the open PDF as a short hex code, the same the server files it under. */
const printOf = async (fingerprint: string) => {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint))
  return [...new Uint8Array(hash)].slice(0, 20).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const post = (path: string, body: object) =>
  fetch(`/registro/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: path === 'evento',
  }).catch(() => undefined)

/**
 * Largest original sent. The author keeps everything in a small free database: blank sheets and
 * light PDFs fit, bigger files are known by their name and strokes only.
 */
const MAX_FILE = 256 * 1024

/** Where each sheet of the exercise library on the desk was opened from, by fingerprint. */
const origins = new Map<string, string>()

/** A sheet as it stood at some moment: the file and the strokes on it. */
interface Sheet {
  fingerprint: string
  name: string
  bytes: Uint8Array
  shapes: unknown[]
  page: number
  pageCount: number
}

/** The sheet on the desk, as it stands now. A pupil's sheet open in a teacher's class is the pupil's: never sent. */
const current = (): Sheet | null => {
  const session = getSession()
  if (!session || session.fingerprint.includes(`#${SENT_TAG}`)) return null
  const { page, pageCount } = appStore.get()
  return { fingerprint: session.fingerprint, name: session.name, bytes: session.bytes, shapes: [...documentStore.get().shapes], page, pageCount }
}

const markSent = (sent: Set<string>, print: string) => {
  sent.add(print)
  write(SENT_KEY, JSON.stringify([...sent]))
}

/**
 * Sends the original of a sheet, once. Sheets of the library are not sent (their address is
 * enough), nor big files; nor, once the author's room is full, any more.
 */
const sendFile = async (sheet: Sheet, print: string) => {
  const sent = sentFiles()
  if (sent.has(print)) return
  if (origins.has(sheet.fingerprint) || sheet.bytes.length > MAX_FILE) return markSent(sent, print)
  const query = new URLSearchParams({ d: device(), f: print, n: sheet.name })
  const reply = await fetch(`/registro/archivo?${query}`, { method: 'PUT', body: sheet.bytes as BlobPart }).catch(() => null)
  // Kept, or refused for good (too big, no room): either way it is not sent again. Otherwise it is tried next time.
  if (reply && (reply.ok || reply.status === 413 || reply.status === 507)) markSent(sent, print)
}

/** Sends a sheet (by default the one on the desk): its original, once, and its strokes. */
const sendSheet = async (sheet = current()) => {
  if (!accepted() || !sheet) return
  const print = await printOf(sheet.fingerprint)
  await sendFile(sheet, print)
  await post('dibujo', {
    d: device(),
    f: print,
    n: sheet.name,
    paginas: sheet.pageCount,
    pagina: sheet.page,
    dibujo: sheet.shapes,
    origen: origins.get(sheet.fingerprint),
  })
}

export type OpenedKind = 'pdf' | 'imagen' | 'blanco' | 'proyecto' | 'ejercicio'

/** Something done in the app, with the sheet it was done on. */
const note = async (type: string, detail: Record<string, unknown>) => {
  const session = getSession()
  if (!accepted() || !session || session.fingerprint.includes(`#${SENT_TAG}`)) return
  await post('evento', { d: device(), t: type, f: await printOf(session.fingerprint), x: { nombre: session.name, ...detail } })
}

/** A document has just been put on the desk; `origin` is its address, for a sheet of the library. */
export const noteOpened = (kind: OpenedKind, origin?: string) => {
  const session = getSession()
  if (origin && session) origins.set(session.fingerprint, origin)
  if (!accepted()) return
  void note('abrir', { tipo: kind, paginas: appStore.get().pageCount })
  void sendSheet()
}

/** The sheet has been taken out of the app: exported or saved as a project. */
export const noteExported = (format: 'pdf' | 'png' | 'proyecto') => {
  if (!accepted()) return
  void note(format === 'proyecto' ? 'guardar' : 'exportar', format === 'proyecto' ? {} : { formato: format })
  void sendSheet()
}

let timer: ReturnType<typeof setTimeout> | undefined
/** The sheet whose latest strokes are waiting to go, as it stood after them. */
let waiting: Sheet | null = null
let watching = false

/** Sends the strokes a while after they change, while the person accepts. */
export const watchDrawing = () => {
  if (watching) return
  watching = true
  let shapes = documentStore.get().shapes
  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    if (waiting) void sendSheet(waiting)
    waiting = null
  }
  documentStore.subscribe(() => {
    const now = documentStore.get().shapes
    if (now === shapes) return
    shapes = now
    const fingerprint = getSession()?.fingerprint
    // Another sheet is being put on the desk: what was waiting is of the previous one, and goes now.
    if (waiting && waiting.fingerprint !== fingerprint) return flush()
    if (!accepted() || appStore.get().phase !== 'ready') return
    waiting = current()
    clearTimeout(timer)
    timer = setTimeout(flush, DRAWING_DELAY_MS)
  })
  // Leaving the page sends what is waiting rather than losing it.
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())
}

/** Records the answer to the notice. Saying no after a yes deletes everything that was sent. */
export const choose = async (choice: Choice) => {
  const before = sharingStore.get().choice
  write(CONSENT_KEY, JSON.stringify({ choice, version: NOTICE, at: Date.now() }))
  sharingStore.set({ choice, reviewing: false })
  if (choice === 'si' && before !== 'si') {
    await post('evento', { d: device(), t: 'aceptar' })
    if (appStore.get().phase === 'ready') void sendSheet()
  }
  if (choice === 'no' && before === 'si') await forget()
}

/** Deletes on the server everything this browser sent, and starts afresh with a new id. */
export const forget = async () => {
  const id = read(DEVICE_KEY)
  if (id) await post('borrar', { d: id })
  write(DEVICE_KEY, null)
  write(SENT_KEY, null)
}

export const reviewSharing = () => sharingStore.set({ reviewing: true })
export const closeReview = () => sharingStore.set({ reviewing: false })
