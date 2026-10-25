import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Room kept between a menu and the edge of the window. */
const EDGE = 8

interface Props {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  side?: 'bottom' | 'right' | 'top'
}

/** A small floating menu that closes on outside click or Escape. */
export const Popover = ({ trigger, children, align = 'left', side = 'bottom' }: Props) => {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  // How far the menu is moved sideways to stay inside the window: near an edge it opens the other way.
  const [shift, setShift] = useState(0)

  useLayoutEffect(() => {
    if (!open) return setShift(0)
    const el = menu.current
    if (!el) return
    const place = () => {
      // Measured where it would be unmoved.
      const moved = parseFloat(el.style.translate) || 0
      // By its centre and its own width: the opening animation scales it a little meanwhile.
      const box = el.getBoundingClientRect()
      const left = (box.left + box.right) / 2 - el.offsetWidth / 2 - moved
      const over = left + el.offsetWidth - (window.innerWidth - EDGE)
      const under = EDGE - left
      setShift(over > 0 ? Math.max(-over, under) : Math.max(under, 0))
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const position =
    side === 'right'
      ? 'left-full bottom-0 ml-3'
      : side === 'top'
        ? `bottom-full mb-2 ${align === 'right' ? 'right-0' : 'left-0'}`
        : `top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'}`

  return (
    <div ref={root} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          ref={menu}
          role="menu"
          style={{ translate: shift ? `${shift}px 0` : undefined }}
          className={`animate-pop absolute z-40 min-w-48 rounded-xl bg-white p-1.5 shadow-[0_10px_36px_rgba(15,23,42,0.14)] ${position}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

interface ItemProps {
  icon?: ReactNode
  label: string
  hint?: string
  /** Second line under the label. */
  description?: string
  onSelect: () => void
  checked?: boolean
}

export const MenuItem = ({ icon, label, hint, description, onSelect, checked }: ItemProps) => (
  <button
    type="button"
    role="menuitem"
    onClick={onSelect}
    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink outline-none transition-colors hover:bg-black/[0.04] focus-visible:bg-black/[0.04]"
  >
    {icon && <span className={checked ? 'text-accent' : 'text-ink/60'}>{icon}</span>}
    <span className={`flex-1 ${checked ? 'font-medium text-accent' : ''}`}>
      {label}
      {description && <span className="block text-[11.5px] font-normal leading-snug text-muted">{description}</span>}
    </span>
    {hint && <span className="text-[11px] text-faint">{hint}</span>}
  </button>
)
