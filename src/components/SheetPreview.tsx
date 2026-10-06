import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { pdfjs, type PDFDocumentProxy } from '../pdf/pdfjs'
import { IconButton } from './ui/IconButton'

/** Widest the preview is drawn, in CSS pixels: enough to judge a sheet, light to render. */
const MAX_WIDTH = 900

interface Props {
  /** Address of the PDF, served by this site. */
  url: string
  name: string
  /** Where the sheet comes from. */
  site: string
  opening: boolean
  onOpen: () => void
  onBack: () => void
}

/** A look at a sheet before putting it on the desk: its pages, one at a time. */
export const SheetPreview = ({ url, name, site, opening, onOpen, onBack }: Props) => {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setDoc(null)
    setPage(1)
    setFailed(false)
    const task = pdfjs.getDocument({ url })
    let closed = false
    task.promise.then(
      (loaded) => (closed ? void loaded.loadingTask.destroy() : setDoc(loaded)),
      () => closed || setFailed(true),
    )
    return () => {
      closed = true
      void task.destroy()
    }
  }, [url])

  useEffect(() => {
    const target = canvas.current
    if (!doc || !target) return
    let cancelled = false
    let task: { cancel(): void } | null = null
    void (async () => {
      const pdfPage = await doc.getPage(page)
      if (cancelled) return
      const base = pdfPage.getViewport({ scale: 1 })
      const width = Math.min(MAX_WIDTH, window.innerWidth - 24)
      const viewport = pdfPage.getViewport({ scale: (width / base.width) * (window.devicePixelRatio || 1) })
      // Drawn apart and swapped in when done, so turning pages never shows a half-drawn sheet.
      const buffer = document.createElement('canvas')
      buffer.width = Math.floor(viewport.width)
      buffer.height = Math.floor(viewport.height)
      const render = pdfPage.render({ canvas: buffer, viewport })
      task = render
      try {
        await render.promise
      } catch {
        return // cancelled by a newer page
      }
      if (cancelled) return
      target.width = buffer.width
      target.height = buffer.height
      target.style.width = `${width}px`
      target.getContext('2d')?.drawImage(buffer, 0, 0)
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, page])

  const pages = doc?.numPages ?? 0

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={`Vista previa de ${name}`}>
      <header className="flex h-12 shrink-0 items-center gap-2 px-3 shadow-[0_1px_0_rgba(15,23,42,0.05),0_4px_18px_rgba(15,23,42,0.04)]">
        <IconButton label="Volver a la lista" onClick={onBack}>
          <ArrowLeft size={18} />
        </IconButton>
        <p className="min-w-0 flex-1 truncate text-[13px] text-muted">
          <span className="font-medium text-ink">{name}</span> · {site}
        </p>
        {pages > 1 && (
          <div className="flex items-center gap-0.5">
            <IconButton label="Página anterior" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft size={17} />
            </IconButton>
            <span className="min-w-12 text-center text-[12.5px] font-medium tabular-nums text-ink/80">
              {page} <span className="text-faint">/ {pages}</span>
            </span>
            <IconButton label="Página siguiente" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              <ChevronRight size={17} />
            </IconButton>
          </div>
        )}
        <button
          type="button"
          onClick={onOpen}
          disabled={opening}
          className="flex h-9 items-center whitespace-nowrap rounded-[10px] bg-accent px-3.5 text-[12.5px] font-medium text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60"
        >
          {opening ? 'Abriendo…' : 'Abrir en la mesa'}
        </button>
      </header>
      <div className="desk min-h-0 flex-1 overflow-auto p-3">
        {failed ? (
          <p className="py-16 text-center text-[13px] text-red-600">No se ha podido cargar la vista previa.</p>
        ) : (
          <>
            {!doc && <p className="py-16 text-center text-[13px] text-muted">Cargando la vista previa…</p>}
            <canvas ref={canvas} className="mx-auto block bg-white shadow-[var(--shadow-float)]" style={{ display: doc ? 'block' : 'none' }} />
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
