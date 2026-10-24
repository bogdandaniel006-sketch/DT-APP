import { CornerDownLeft, Ruler } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { appStore } from '../state/appStore'
import { useStore } from '../state/createStore'
import { closeExact, commitExact, exactPrompt, exactStore, openExact } from '../state/exact'
import { toolTick } from '../tools/registry'

/**
 * Typing an exact figure while drawing. Out of the way until a step can take one: then a small
 * "Medida exacta" button shows next to the hint, and typing a digit opens the box directly.
 */
export const ExactEntry = () => {
  useStore(toolTick, (s) => s.n)
  useStore(appStore, (s) => s.tool)
  const { open, text } = useStore(exactStore, (s) => s)
  const prompt = exactPrompt()
  const input = useRef<HTMLInputElement>(null)
  const [wrong, setWrong] = useState(false)

  // The step it was for is over (clicked, cancelled, another tool): the box goes with it.
  useEffect(() => {
    if (open && !prompt) closeExact()
  }, [open, prompt])

  useEffect(() => {
    if (!open) return
    setWrong(false)
    const el = input.current
    el?.focus()
    // Carry on after the digit that opened it.
    el?.setSelectionRange(el.value.length, el.value.length)
  }, [open])

  if (!prompt) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => openExact()}
        className="pointer-events-auto flex h-7 items-center gap-1.5 rounded-full bg-white/85 px-2.5 text-[12px] font-medium text-muted shadow-[0_2px_10px_rgba(15,23,42,0.06)] outline-none backdrop-blur transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <Ruler size={13} />
        Medida exacta
      </button>
    )
  }

  return (
    <form
      className="animate-pop float pointer-events-auto flex items-center gap-2 rounded-2xl py-1.5 pl-3 pr-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        setWrong(!commitExact())
      }}
    >
      <label htmlFor="exact-figure" className="text-[11px] font-medium uppercase tracking-wider text-faint">
        {prompt.label}
      </label>
      <input
        ref={input}
        id="exact-figure"
        value={text}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        placeholder="0"
        onChange={(e) => {
          setWrong(false)
          exactStore.set({ text: e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10) })
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') closeExact()
        }}
        className={`h-7 w-20 rounded-md px-2 text-right text-[14px] font-semibold tabular-nums outline-none ${
          wrong ? 'bg-red-50 text-red-600' : 'bg-accent-soft text-accent'
        }`}
      />
      <span className="text-[13px] text-muted">{prompt.unit}</span>
      <button
        type="submit"
        aria-label="Aplicar la medida"
        className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-white outline-none transition-colors hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <CornerDownLeft size={14} />
      </button>
    </form>
  )
}
