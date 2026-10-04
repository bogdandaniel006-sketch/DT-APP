/** The author's credit: a small four-point star next to the name. Sized by the font size. */
export const Credit = ({ className = '' }: { className?: string }) => (
  <span className={`pointer-events-none inline-flex select-none items-center gap-[0.4em] whitespace-nowrap font-medium text-accent ${className}`}>
    <svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path d="M12 1.5c.9 6.2 4.3 9.6 10.5 10.5-6.2.9-9.6 4.3-10.5 10.5C11.1 16.3 7.7 12.9 1.5 12 7.7 11.1 11.1 7.7 12 1.5z" fill="currentColor" />
    </svg>
    <span>
      Hecho por <span className="font-semibold">Dani de Miguel</span>
    </span>
  </span>
)
