import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Tooltip } from './Tooltip'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  shortcut?: string
  tooltipSide?: 'right' | 'bottom' | 'top'
  active?: boolean
  /** Small dot showing a feature is "on" (e.g. an instrument left on the desk). */
  dot?: boolean
  variant?: 'floating' | 'plain'
  children: ReactNode
}

export const IconButton = ({
  label,
  shortcut,
  tooltipSide = 'bottom',
  active = false,
  dot = false,
  variant = 'plain',
  className = '',
  children,
  ...rest
}: Props) => (
  <Tooltip label={label} shortcut={shortcut} side={tooltipSide}>
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={[
        'relative grid h-9 w-9 place-items-center rounded-[10px] outline-none transition-all duration-150',
        'focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-35',
        active ? 'bg-accent-soft text-accent' : 'text-ink/75 hover:text-ink',
        variant === 'floating'
          ? 'bg-white shadow-[var(--shadow-float)] hover:shadow-[var(--shadow-float-hover)] disabled:hover:shadow-[var(--shadow-float)]'
          : !active && 'hover:bg-black/[0.035] disabled:hover:bg-transparent',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
      {dot && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />}
    </button>
  </Tooltip>
)
