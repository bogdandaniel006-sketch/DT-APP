import { memo, useEffect, useRef, useState } from 'react'
import type { PageRect } from '../geometry/layout'
import { getSession } from '../pdf/session'
import { appStore } from '../state/appStore'
import { useStore } from '../state/createStore'
import type { View } from '../types'

const MAX_CANVAS_PIXELS = 16_000_000
const RERENDER_DELAY_MS = 140
/** Pages this far outside the viewport (in screen px) are still kept rendered. */
const PRELOAD_PX = 600

interface PageProps {
  index: number
  rect: PageRect
  fingerprint: string
  scale: number
  near: boolean
  visible: boolean
}

/**
 * One sheet. It is rasterised at the current zoom (debounced) while near the
 * viewport; in between, the previous bitmap is stretched by CSS. Far away it
 * stays a blank sheet and frees its bitmap.
 */
const PdfPage = memo(({ index, rect, fingerprint, scale, near, visible }: PageProps) => {
  const holder = useRef<HTMLDivElement>(null)
  const [renderScale, setRenderScale] = useState(scale)

  useEffect(() => {
    const t = setTimeout(() => setRenderScale(scale), RERENDER_DELAY_MS)
    return () => clearTimeout(t)
  }, [scale])

  useEffect(() => {
    const session = getSession()
    const target = holder.current
    if (!session || !target) return
    if (!near) {
      target.replaceChildren()
      return
    }
    let cancelled = false
    let task: { cancel(): void } | null = null

    void (async () => {
      const pdfPage = await session.doc.getPage(index + 1)
      if (cancelled) return
      const dpr = window.devicePixelRatio || 1
      const base = pdfPage.getViewport({ scale: 1 })
      const maxScale = Math.sqrt(MAX_CANVAS_PIXELS / (base.width * base.height))
      const viewport = pdfPage.getViewport({ scale: Math.min(renderScale * dpr, maxScale) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.className = 'absolute inset-0 h-full w-full'
      const render = pdfPage.render({ canvas, viewport })
      task = render
      try {
        await render.promise
      } catch {
        return // cancelled by a newer render
      }
      if (!cancelled) target.replaceChildren(canvas)
    })()

    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [index, fingerprint, renderScale, near])

  return (
    <div
      className="sheet absolute bg-white"
      style={{ left: rect.x * scale, top: rect.y * scale, width: rect.w * scale, height: rect.h * scale }}
      data-page={index}
    >
      <div ref={holder} className="absolute inset-0 transition-opacity duration-200" style={{ opacity: visible ? 1 : 0 }} />
    </div>
  )
})
PdfPage.displayName = 'PdfPage'

interface Props {
  rects: readonly PageRect[]
  fingerprint: string
  view: View
  visible: boolean
}

/** All sheets of the PDF lying on the desk: a locked background. */
export const PdfPages = ({ rects, fingerprint, view, visible }: Props) => {
  const viewport = useStore(appStore, (s) => s.viewport)
  const isNear = (r: PageRect) => {
    const top = r.y * view.scale + view.y
    const left = r.x * view.scale + view.x
    return (
      top < viewport.h + PRELOAD_PX &&
      top + r.h * view.scale > -PRELOAD_PX &&
      left < viewport.w + PRELOAD_PX &&
      left + r.w * view.scale > -PRELOAD_PX
    )
  }
  return (
    <div
      className="pointer-events-none absolute left-0 top-0"
      style={{ transform: `translate(${view.x}px, ${view.y}px)` }}
    >
      {rects.map((r, i) => (
        <PdfPage
          key={i}
          index={i}
          rect={r}
          fingerprint={fingerprint}
          scale={view.scale}
          near={isNear(r)}
          visible={visible}
        />
      ))}
    </div>
  )
}
