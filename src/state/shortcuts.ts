import { createStore } from './createStore'

/** Actions whose key each user can choose. */
export const SHORTCUT_ACTIONS = [
  { id: 'select', label: 'Seleccionar', key: 'v' },
  { id: 'point', label: 'Punto', key: '.' },
  { id: 'line', label: 'Línea', key: 'l' },
  { id: 'perpendicular', label: 'Perpendicular', key: 'p' },
  { id: 'parallel', label: 'Paralela', key: 'r' },
  { id: 'bisector', label: 'Mediatriz', key: 'd' },
  { id: 'compass', label: 'Compás', key: 'c' },
  { id: 'arc', label: 'Arco', key: 'a' },
  { id: 'escuadra', label: 'Escuadra', key: 'e' },
  { id: 'cartabon', label: 'Cartabón', key: 't' },
  { id: 'measure-distance', label: 'Medir distancia y ángulo', key: 'm' },
  { id: 'flip', label: 'Voltear la escuadra o el cartabón', key: 'f' },
  { id: 'loupe', label: 'Lupa de precisión', key: 'z' },
] as const

export type ShortcutId = (typeof SHORTCUT_ACTIONS)[number]['id']
export type ShortcutKeys = Record<ShortcutId, string>

const STORAGE_KEY = 'lamina:shortcuts'

const defaults = (): ShortcutKeys =>
  Object.fromEntries(SHORTCUT_ACTIONS.map((a) => [a.id, a.key])) as ShortcutKeys

/** The keys chosen on this browser, over the defaults. */
const load = (): ShortcutKeys => {
  const keys = defaults()
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    for (const a of SHORTCUT_ACTIONS) {
      const key = saved[a.id]
      if (typeof key === 'string' && isBindable(key)) keys[a.id] = key
    }
  } catch {
    /* storage unavailable or damaged: the defaults apply */
  }
  return keys
}

/** A single printable character; Space, Esc, Supr and the like keep their fixed meaning. */
export const isBindable = (key: string) => key.length === 1 && key !== ' '

export const shortcutStore = createStore<{ keys: ShortcutKeys }>({ keys: load() })

const save = (keys: ShortcutKeys) => {
  shortcutStore.set({ keys })
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
  } catch {
    /* storage unavailable: the choice lasts until the page is closed */
  }
}

/** Gives `key` to an action. If another action had it, the two swap keys. */
export const setShortcut = (id: ShortcutId, key: string) => {
  const keys = { ...shortcutStore.get().keys }
  const other = SHORTCUT_ACTIONS.find((a) => a.id !== id && keys[a.id] === key)
  if (other) keys[other.id] = keys[id]
  keys[id] = key
  save(keys)
}

export const resetShortcuts = () => save(defaults())

export const isDefaultShortcuts = (keys: ShortcutKeys) => SHORTCUT_ACTIONS.every((a) => keys[a.id] === a.key)

/** The action bound to a pressed key (already lower-cased). */
export const shortcutFor = (key: string): ShortcutId | null =>
  SHORTCUT_ACTIONS.find((a) => shortcutStore.get().keys[a.id] === key)?.id ?? null

/** How a key is shown in tooltips and in the controls menu. */
export const shortcutLabel = (key: string) => key.toUpperCase()
