import { useEffect, useRef, useState } from 'react'
import { deskToDocument, deskToScreen } from '../geometry/coords'
import { LINE_HEIGHT, MAX_TEXT_LENGTH, textLines, textSize } from '../geometry/text'
import { appStore, type NamingRequest } from '../state/appStore'
import { useStore } from '../state/createStore'
import { documentActions, documentStore } from '../state/documentStore'
import type { Shape, View } from '../types'
import { newId } from '../utils/id'
import { pencilStroke } from './style'

/** Where the baseline of the first line falls below the top of the box, as a fraction of the letter size (Inter). */
const BASELINE = 1.01

/** Keeps what was written: a new text, a changed one, or — when everything was erased — none. */
const commit = (request: NamingRequest, written: string) => {
  const text = written.replace(/\s+$/, '').slice(0, MAX_TEXT_LENGTH)
  if (request.id) {
    const existing = documentStore.get().shapes.find((s) => s.id === request.id)
    if (!existing || existing.name === text) return
    if (text) documentActions.update([request.id], (s) => ({ ...s, name: text }))
    else documentActions.remove([request.id])
    return
  }
  if (!text) return
  const { pageRects, pencil, layer, textSize: size } = appStore.get()
  const { page, p } = deskToDocument(pageRects, request.p)
  documentActions.add([{ kind: 'point', p, id: newId(), page, layer, pencil, name: text, text: true, size } as Shape])
}

/**
 * The text box: a see-through field right on the sheet, where the text will be, at the size
 * and colour it will have. Enter starts a new line; clicking elsewhere keeps what was written
 * and Esc leaves it as it was.
 */
export const TextEditor = ({ view }: { view: View }) => {
  const naming = useStore(appStore, (s) => s.naming)
  const request = naming?.text ? naming : null
  const [value, setValue] = useState('')
  const latest = useRef('')
  const abandoned = useRef(false)
  const field = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!request) return
    setValue(request.value)
    latest.current = request.value
    abandoned.current = false
    requestAnimationFrame(() => {
      field.current?.focus()
      field.current?.setSelectionRange(request.value.length, request.value.length)
    })
    // Leaving the box in any way (another click, another tool, another text) keeps the writing.
    return () => {
      if (!abandoned.current) commit(request, latest.current)
    }
  }, [request])

  if (!request) return null

  const editing = request.id ? documentStore.get().shapes.find((s) => s.id === request.id) : undefined
  const { pencil, textSize: newSize } = appStore.get()
  const size = textSize(editing ? editing.size : newSize) * view.scale
  const at = deskToScreen(view, request.p)
  const lines = textLines(value)

  return (
    <textarea
      // A box of its own for each text: clicking elsewhere on the sheet closes one and opens the
      // next, and the focus the old one loses must not be taken for the new one being left.
      key={`${request.id ?? ''}@${request.p.x},${request.p.y}`}
      ref={field}
      value={value}
      maxLength={MAX_TEXT_LENGTH}
      rows={lines.length}
      // A little room after the longest line, so the box grows ahead of the writing.
      cols={Math.max(12, ...lines.map((l) => l.length + 2))}
      wrap="off"
      spellCheck={false}
      placeholder="Escribe…"
      aria-label="Texto"
      data-testid="text-editor"
      onChange={(e) => {
        setValue(e.target.value)
        latest.current = e.target.value
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key !== 'Escape') return
        abandoned.current = true
        appStore.set({ naming: null })
      }}
      onBlur={() => appStore.get().naming === request && appStore.set({ naming: null })}
      className="point-name absolute z-30 resize-none overflow-hidden whitespace-pre rounded-[3px] bg-transparent p-0 outline outline-1 outline-offset-4 outline-accent/50 placeholder:text-faint"
      style={{
        left: at.x,
        top: at.y - size * BASELINE,
        fontSize: size,
        lineHeight: LINE_HEIGHT,
        color: pencilStroke(editing ? editing.pencil : pencil).color,
      }}
    />
  )
}
