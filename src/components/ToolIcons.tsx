import type { ReactNode, SVGProps } from 'react'

/** Drawing-specific icons drawn in the same style as Lucide (24px grid, 2px round strokes). */
const Icon = ({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...props}
  >
    {children}
  </svg>
)

export const PerpendicularIcon = () => (
  <Icon>
    <path d="M4 20h16" />
    <path d="M12 20V4" />
    <path d="M12 16h4v4" strokeWidth={1.6} />
  </Icon>
)

export const ParallelIcon = () => (
  <Icon>
    <path d="M5 15 15 5" />
    <path d="M9 19 19 9" />
  </Icon>
)

export const BisectorIcon = () => (
  <Icon>
    <path d="M6 14h12" />
    <path d="M12 4v17" />
    <circle cx="5" cy="14" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="19" cy="14" r="1.7" fill="currentColor" stroke="none" />
  </Icon>
)

export const ArcIcon = () => (
  <Icon>
    <path d="M4 18a10 10 0 0 1 16-8" />
    <circle cx="12" cy="18" r="1.2" fill="currentColor" stroke="none" />
    <path d="M12 18 20 10" strokeDasharray="2 2.5" strokeWidth={1.4} />
  </Icon>
)

export const EscuadraIcon = () => (
  <Icon>
    <path d="M4 20V4l16 16Z" />
    <path d="M8 16v-4.3l4.3 4.3Z" strokeWidth={1.5} />
  </Icon>
)

export const CartabonIcon = () => (
  <Icon>
    <path d="M4 20V10l17.3 10Z" />
    <path d="M7.3 17.5v-2.6l4.5 2.6Z" strokeWidth={1.5} />
  </Icon>
)

export const PointIcon = () => (
  <Icon>
    <circle cx="9" cy="15" r="2.6" fill="currentColor" stroke="none" />
    <path d="M13.5 10.5 17 4l3.5 6.5M14.6 8.5h4.8" strokeWidth={1.7} />
  </Icon>
)
