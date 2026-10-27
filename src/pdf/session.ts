import { DARK_SHEET_MARK } from './make'
import { pdfjs, type PDFDocumentProxy } from './pdfjs'

/** The open PDF. Kept out of React state: it is large and never changes while open. */
interface PdfSession {
  doc: PDFDocumentProxy
  /** Untouched original bytes, used for exporting. */
  bytes: Uint8Array
  name: string
  fingerprint: string
  /** A black sheet made here (see DARK_SHEET_MARK): drawn on in white. */
  dark: boolean
}

let current: PdfSession | null = null

export const getSession = (): PdfSession | null => current

/**
 * `tag` gives the document an identity of its own: a pupil's sheet sent on an exercise is the
 * exercise's very PDF, yet its drawing must not land on the teacher's own copy of it.
 */
export const openPdf = async (bytes: Uint8Array, name: string, tag?: string): Promise<PdfSession> => {
  // pdf.js transfers the buffer to its worker, so hand it a copy.
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
  const previous = current
  const keywords = String(((await doc.getMetadata().catch(() => null))?.info as { Keywords?: unknown } | undefined)?.Keywords ?? '')
  current = { doc, bytes, name, fingerprint: (doc.fingerprints[0] ?? `${name}:${bytes.length}`) + (tag ? `#${tag}` : ''), dark: keywords.includes(DARK_SHEET_MARK) }
  if (previous && previous.doc !== doc) void previous.doc.loadingTask.destroy()
  return current
}

/** Size of every page at scale 1 (PDF points, rotation applied). */
export const pageSizes = async (): Promise<{ w: number; h: number }[]> => {
  if (!current) return []
  const { doc } = current
  return Promise.all(
    Array.from({ length: doc.numPages }, async (_, i) => {
      const vp = (await doc.getPage(i + 1)).getViewport({ scale: 1 })
      return { w: vp.width, h: vp.height }
    }),
  )
}
