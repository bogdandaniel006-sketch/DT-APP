import { Moon, Sun } from 'lucide-react'
import { useStore } from '../state/createStore'
import { themeStore, toggleTheme } from '../state/theme'

/** Switches between the light interface (the usual one) and the dark one. */
export const ThemeToggle = ({ className = '' }: { className?: string }) => {
  const dark = useStore(themeStore, (s) => s.theme === 'oscuro')
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={dark}
      className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-2.5 text-[12.5px] font-medium text-ink/75 outline-none transition-colors hover:bg-black/[0.035] hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40 ${className}`}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      <span className="hidden sm:inline">{dark ? 'Modo claro' : 'Modo oscuro'}</span>
    </button>
  )
}
