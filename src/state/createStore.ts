import { useSyncExternalStore } from 'react'

export interface Store<T> {
  get(): T
  set(patch: Partial<T> | ((state: T) => Partial<T>)): void
  subscribe(listener: () => void): () => void
}

export const createStore = <T extends object>(initial: T): Store<T> => {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch
      state = { ...state, ...next }
      listeners.forEach((l) => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** Subscribes to a slice of a store. The selector must return stable references. */
export const useStore = <T extends object, S>(store: Store<T>, selector: (state: T) => S): S =>
  useSyncExternalStore(store.subscribe, () => selector(store.get()))
