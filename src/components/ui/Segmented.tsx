interface Option<T extends string | number> {
  value: T
  label: string
}

interface Props<T extends string | number> {
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
  label: string
}

export const Segmented = <T extends string | number>({ value, options, onChange, label }: Props<T>) => (
  <div role="radiogroup" aria-label={label} className="flex rounded-[9px] bg-black/[0.035] p-0.5">
    {options.map((o) => {
      const active = o.value === value
      return (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(o.value)}
          className={`rounded-[7px] px-2.5 py-1 text-xs font-medium tabular-nums outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent/40 ${
            active ? 'bg-white text-accent shadow-[0_1px_4px_rgba(15,23,42,0.12)]' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      )
    })}
  </div>
)
