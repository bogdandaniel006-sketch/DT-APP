import { pdfjs, type PDFDocumentProxy } from './pdfjs'

/** The open PDF. Kept out of React state: it is large and never changes while open. */
interface PdfSession {
  doc: PDFDocumentProxy
  /** Untouched original bytes, used for exporting. */
  bytes: Uint8Array
  name: string
  fingerprint: string
}

let current: PdfSession | null = null

export const getSession = (): PdfSession | null => current

export const openPdf = async (bytes: Uint8Array, name: string): Promise<PdfSession> => {
  // pdf.js transfers the buffer to its worker, so hand it a copy.
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
  const previous = current
  current = { doc, bytes, name, fingerprint: doc.fingerprints[0] ?? `${name}:${bytes.length}` }
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
