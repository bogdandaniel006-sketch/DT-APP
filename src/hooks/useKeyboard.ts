import { useEffect, useState } from 'react'
import { openPdfDialog } from '../components/TopBar'
import { duplicateSelection, goToPage } from '../state/actions'
import { appStore, flipInstrument, setLayer, setTool, viewActions } from '../state/appStore'
import { documentActions } from '../state/documentStore'
import { bumpTools, tools } from '../tools/registry'
import { shortcutFor } from '../state/shortcuts'

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/** Global shortcuts. Returns whether Space (temporary pan) is held. */
export const useKeyboard = (enabled: boolean): boolean => {
  const [spaceDown, setSpaceDown] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (mod) {
        if (key === 'z') documentActions[e.shiftKey ? 'redo' : 'undo']()
        else if (key === 'y') documentActions.redo()
        else if (key === 'o') void openPdfDialog()
        else if (key === 'd') duplicateSelection()
        else if (key === '0') viewActions.fitPage()
        else if (key === '1') viewActions.setPercent(100)
        else if (key === '=' || key === '+') viewActions.zoomBy(1.25)
        else if (key === '-') viewActions.zoomBy(0.8)
        else if (key === 's') {
          /* Work is saved continuously; just keep the browser's save dialog away. */
        } else return
        e.preventDefault()
        return
      }

      if (e.key === ' ') {
        e.preventDefault()
        if (!e.repeat) setSpaceDown(true)
        return
      }
      if (e.key === 'Escape') {
        tools[appStore.get().tool].cancel()
        bumpTools()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selection } = appStore.get()
        if (selection.length) {
          documentActions.remove(selection)
          appStore.set({ selection: [] })
        } else setTool('eraser')
        e.preventDefault()
        return
      }
      if (e.key === 'PageDown' || e.key === 'PageUp') {
        e.preventDefault()
        return goToPage(appStore.get().page + (e.key === 'PageDown' ? 1 : -1))
      }
      if (e.altKey || e.shiftKey) return
      const current = appStore.get().tool
      const action = shortcutFor(key)
      if (!action) return
      if (action === 'measure-distance') return setTool(current === 'measure-distance' ? 'measure-angle' : 'measure-distance')
      if (action === 'loupe') return appStore.set({ loupe: !appStore.get().loupe })
      if (action === 'flip') {
        if (current === 'escuadra' || current === 'cartabon') flipInstrument(current)
        return
      }
      if (action === 'layer-construccion') return setLayer('construccion')
      if (action === 'layer-auxiliares') return setLayer('auxiliares')
      if (action === 'layer-resultado') return setLayer('resultado')
      setTool(action)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setSpaceDown(false)
    }
    const onBlur = () => setSpaceDown(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [enabled])

  return spaceDown
}
