import { useRef, useState, type ReactNode } from 'react'

type Side = 'right' | 'bottom' | 'top'

const placement: Record<Side, string> = {
  right: 'left-full top-1/2 ml-3 -translate-y-1/2',
  bottom: 'top-full left-1/2 mt-2.5 -translate-x-1/2',
  top: 'bottom-full left-1/2 mb-2.5 -translate-x-1/2',
}

interface Props {
  label: string
  shortcut?: string
  side?: Side
  children: ReactNode
}

/** Small delayed tooltip; the only place keyboard shortcuts are shown. */
export const Tooltip = ({ label, shortcut, side = 'bottom', children }: Props) => {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const show = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), 380)
  }
  const hide = () => {
    clearTimeout(timer.current)
    setOpen(false)
  }
  return (
    <div className="relative" onPointerEnter={show} onPointerLeave={hide} onPointerDown={hide} onFocus={show} onBlur={hide}>
      {children}
      {open && (
        <div
          role="tooltip"
          className={`animate-pop pointer-events-none absolute z-50 flex items-center gap-2 whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-ink shadow-[0_6px_24px_rgba(15,23,42,0.14)] ${placement[side]}`}
        >
          {label}
          {shortcut && (
            <kbd className="rounded-[5px] bg-accent-soft px-1.5 py-px font-sans text-[10.5px] font-semibold text-accent">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  )
}
