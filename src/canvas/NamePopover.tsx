import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { deskToDocument, deskToScreen } from '../geometry/coords'
import { appStore } from '../state/appStore'
import { useStore } from '../state/createStore'
import { documentActions } from '../state/documentStore'
import type { Shape, View } from '../types'
import { newId } from '../utils/id'
import { MAX_NAME_LENGTH, normalizePointName } from '../utils/pointNames'

/**
 * "Nombrar punto": a small field next to a point. Naming a detected PDF point
 * turns it into a real point at its exact coordinates; naming an existing point renames it.
 * (Writing a text has its own box on the sheet: see TextEditor.)
 */
export const NamePopover = ({ view }: { view: View }) => {
  const request = useStore(appStore, (s) => s.naming)
  const naming = request?.text ? null : request
  const [value, setValue] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!naming) return
    setValue(naming.value)
    requestAnimationFrame(() => input.current?.select())
  }, [naming])

  if (!naming) return null
  const at = deskToScreen(view, naming.p)

  const save = () => {
    const name = normalizePointName(value)
    const close = { naming: null }
    if (!name) return appStore.set(close)
    if (naming.id) {
      documentActions.update([naming.id], (s) => ({ ...s, name }))
      appStore.set(close)
      return
    }
    const { pageRects, pencil, layer } = appStore.get()
    const { page, p } = deskToDocument(pageRects, naming.p)
    const point = { kind: 'point', p, id: newId(), page, layer, pencil, name } as Shape
    documentActions.add([point])
    appStore.set({ ...close, selection: [point.id], tool: 'select' })
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
        {naming.id ? 'Nombre' : 'Nombrar punto'}
      </label>
      <input
        id="point-name"
        ref={input}
        value={value}
        maxLength={MAX_NAME_LENGTH}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') appStore.set({ naming: null })
          e.stopPropagation()
        }}
        autoComplete="off"
        spellCheck={false}
        className="h-7 w-16 rounded-md bg-black/[0.04] px-2 text-center text-[13px] font-semibold text-ink outline-none focus:bg-accent-soft focus:text-accent"
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
