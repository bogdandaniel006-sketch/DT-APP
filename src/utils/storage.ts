import type { Shape } from '../types'

const DB_NAME = 'lamina'
const STORE = 'files'
const LAST_PDF_KEY = 'last-pdf'
const DRAWING_PREFIX = 'lamina:drawing:'
const SETTINGS_KEY = 'lamina:settings'

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

const withStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).finally(() => db.close())
}

export interface StoredPdf {
  name: string
  bytes: Uint8Array
}

/** The last opened PDF lives in IndexedDB: it is usually too large for localStorage. */
export const saveLastPdf = (pdf: StoredPdf) => withStore('readwrite', (s) => s.put(pdf, LAST_PDF_KEY)).catch(() => undefined)

export const loadLastPdf = async (): Promise<StoredPdf | null> => {
  try {
    const value = await withStore<StoredPdf | undefined>('readonly', (s) => s.get(LAST_PDF_KEY))
    return value && value.bytes instanceof Uint8Array ? value : null
  } catch {
    return null
  }
}

interface StoredDrawing {
  version: 1
  shapes: Shape[]
  page: number
}

export const saveDrawing = (fingerprint: string, shapes: readonly Shape[], page: number): boolean => {
  try {
    const data: StoredDrawing = { version: 1, shapes: [...shapes], page }
    localStorage.setItem(DRAWING_PREFIX + fingerprint, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export const loadDrawing = (fingerprint: string): { shapes: Shape[]; page: number } | null => {
  try {
    const raw = localStorage.getItem(DRAWING_PREFIX + fingerprint)
    if (!raw) return null
    const data = JSON.parse(raw) as StoredDrawing
    return data.version === 1 && Array.isArray(data.shapes) ? { shapes: data.shapes, page: data.page ?? 0 } : null
  } catch {
    return null
  }
}

export const saveSettings = (settings: object) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* storage unavailable: settings simply are not remembered */
  }
}

export const loadSettings = <T>(): Partial<T> => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<T>
  } catch {
    return {}
  }
}
