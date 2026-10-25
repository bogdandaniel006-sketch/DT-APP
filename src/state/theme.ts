import { createStore } from './createStore'

/**
 * Light or dark interface. Light always comes first: the dark one only by choice, with the button
 * of the top bar, and then remembered. The sheets and PDFs stay paper either way.
 * index.html applies the remembered one before the page is drawn, so it never flashes.
 */
export type Theme = 'claro' | 'oscuro'

const KEY = 'lamina:tema'

const remembered = (): Theme => {
  try {
    return localStorage.getItem(KEY) === 'oscuro' ? 'oscuro' : 'claro'
  } catch {
    return 'claro'
  }
}

export const themeStore = createStore<{ theme: Theme }>({ theme: remembered() })

const apply = (theme: Theme) => {
  document.documentElement.dataset.theme = theme === 'oscuro' ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'oscuro' ? '#1c1f24' : '#ffffff')
}
apply(themeStore.get().theme)

export const toggleTheme = () => {
  const theme: Theme = themeStore.get().theme === 'oscuro' ? 'claro' : 'oscuro'
  themeStore.set({ theme })
  apply(theme)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* not remembered: it still changes now */
  }
}
