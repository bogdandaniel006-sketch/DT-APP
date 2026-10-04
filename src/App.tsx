import { useEffect, useState, type DragEvent } from 'react'
import { Workspace } from './canvas/Workspace'
import { ContextBar } from './components/ContextBar'
import { Credit } from './components/Credit'
import { PageNav } from './components/PageNav'
import { StartScreen } from './components/StartScreen'
import { Toolbar } from './components/Toolbar'
import { TopBar } from './components/TopBar'
import { useAutosave } from './hooks/useAutosave'
import { useKeyboard } from './hooks/useKeyboard'
import { useLockBrowserView } from './hooks/useLockBrowserView'
import { loadPdfFile, restoreLastSession } from './state/actions'
import { appStore } from './state/appStore'
import { useStore } from './state/createStore'

const droppedPdf = (e: DragEvent) =>
  [...e.dataTransfer.files].find((f) => f.type === 'application/pdf' || /\.(pdf|lamina)$/i.test(f.name))

export const App = () => {
  const phase = useStore(appStore, (s) => s.phase)
  const error = useStore(appStore, (s) => s.error)
  const [hasWorkspace, setHasWorkspace] = useState(false)
  useAutosave()
  useLockBrowserView()

  useEffect(() => {
    void restoreLastSession()
  }, [])

  useEffect(() => {
    if (phase === 'ready') setHasWorkspace(true)
    else if (phase === 'start') setHasWorkspace(false)
  }, [phase])

  const ready = hasWorkspace && (phase === 'ready' || phase === 'loading')
  const spaceDown = useKeyboard(ready)

  // Error after the workspace exists (e.g. opening a broken file): show briefly.
  useEffect(() => {
    if (!error || !ready) return
    const t = setTimeout(() => appStore.set({ error: null }), 4000)
    return () => clearTimeout(t)
  }, [error, ready])

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const file = droppedPdf(e)
    if (file) void loadPdfFile(file)
  }

  if (phase === 'boot')
    return (
      <div className="desk flex h-full items-end justify-center pb-7">
        <Credit className="text-[13px] opacity-75" />
      </div>
    )

  return (
    <div className="flex h-full flex-col overflow-clip" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      {ready ? (
        <>
          <TopBar />
          <div className="relative min-h-0 flex-1 overflow-clip">
            <Workspace spaceDown={spaceDown} />
            <Toolbar />
            <ContextBar />
            <PageNav />
            <div className="pointer-events-none absolute bottom-4 left-5 z-10 hidden sm:block">
              <Credit className="text-[12.5px] opacity-75" />
            </div>
            {error && (
              <div className="animate-rise float absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-xl px-4 py-2 text-[13px] text-red-600">
                {error}
              </div>
            )}
          </div>
        </>
      ) : (
        <StartScreen />
      )}
    </div>
  )
}
