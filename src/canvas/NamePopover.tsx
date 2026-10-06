import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { deskToDocument, deskToScreen } from '../geometry/coords'
import { MAX_TEXT_LENGTH } from '../geometry/text'
import { appStore } from '../state/appStore'
import { useStore } from '../state/createStore'
import { documentActions } from '../state/documentStore'
import type { Shape, View } from '../types'
import { newId } from '../utils/id'
import { MAX_NAME_LENGTH, normalizePointName } from '../utils/pointNames'

/**
 * A small field next to a point of the desk, for two things: "Nombrar punto" (naming a detected
 * PDF point turns it into a real point at its exact coordinates; naming an existing point renames
 * it) and writing a text, which is stored as a point without a dot whose name is what is written.
 */
export const NamePopover = ({ view }: { view: View }) => {
  const naming = useStore(appStore, (s) => s.naming)
  const [value, setValue] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!naming) return
    setValue(naming.value)
    requestAnimationFrame(() => input.current?.select())
  }, [naming])

  if (!naming) return null
  const at = deskToScreen(view, naming.p)
  const writing = naming.text === true

  const save = () => {
    const name = writing ? value.trim().slice(0, MAX_TEXT_LENGTH) : normalizePointName(value)
    const close = { naming: null }
    if (!name) return appStore.set(close)
    if (naming.id) {
      documentActions.update([naming.id], (s) => ({ ...s, name }))
      appStore.set(close)
      return
    }
    const { pageRects, pencil, layer } = appStore.get()
    const { page, p } = deskToDocument(pageRects, naming.p)
    const point = { kind: 'point', p, id: newId(), page, layer, pencil, name, ...(writing && { text: true }) } as Shape
    documentActions.add([point])
    // A named point is left selected to carry on with it; after a text, the next text can follow.
    appStore.set(writing ? close : { ...close, selection: [point.id], tool: 'select' })
  }

  return (
    <form
      className="float animate-pop absolute z-30 flex items-center gap-1.5 rounded-xl py-1.5 pl-3 pr-1.5"
      style={{ left: at.x + 14, top: at.y + 14 }}
      onPointerDown={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      data-testid="name-popover"
    >
      <label className="text-[11px] font-medium uppercase tracking-wider text-faint" htmlFor="point-name">
        {writing ? 'Texto' : naming.id ? 'Nombre' : 'Nombrar punto'}
      </label>
      <input
        id="point-name"
        ref={input}
        value={value}
        maxLength={writing ? MAX_TEXT_LENGTH : MAX_NAME_LENGTH}
        placeholder={writing ? 'Escribe y pulsa Enter' : undefined}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') appStore.set({ naming: null })
          e.stopPropagation()
        }}
        autoComplete="off"
        spellCheck={false}
        className={`h-7 rounded-md bg-black/[0.04] px-2 text-[13px] text-ink outline-none focus:bg-accent-soft focus:text-accent ${
          writing ? 'w-64' : 'w-16 text-center font-semibold'
        }`}
      />
      <button
        type="submit"
        aria-label="Guardar"
        className="grid h-7 w-7 place-items-center rounded-md text-accent outline-none transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <Check size={15} strokeWidth={2.4} />
      </button>
    </form>
  )
}
