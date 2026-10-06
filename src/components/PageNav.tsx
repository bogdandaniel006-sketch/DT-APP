import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { addBlankPage, goToPage } from '../state/actions'
import { appStore } from '../state/appStore'
import { useStore } from '../state/createStore'
import { IconButton } from './ui/IconButton'

/** Moves between the pages of the document (when it has several) and adds blank ones. */
export const PageNav = () => {
  const page = useStore(appStore, (s) => s.page)
  const count = useStore(appStore, (s) => s.pageCount)
  return (
    <div className="float absolute bottom-5 right-5 z-20 flex items-center gap-0.5 rounded-xl p-1">
      {count > 1 && (
        <>
          <IconButton
            label="Página anterior"
            shortcut="RePág"
            tooltipSide="top"
            disabled={page === 0}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft size={17} />
          </IconButton>
          <span className="min-w-14 text-center text-[12.5px] font-medium tabular-nums text-ink/80" data-testid="page-indicator">
            {page + 1} <span className="text-faint">/ {count}</span>
          </span>
          <IconButton
            label="Página siguiente"
            shortcut="AvPág"
            tooltipSide="top"
            disabled={page >= count - 1}
            onClick={() => goToPage(page + 1)}
          >
            <ChevronRight size={17} />
          </IconButton>
          <div className="mx-0.5 h-5 w-px bg-black/[0.07]" />
        </>
      )}
      <IconButton label="Añadir una página en blanco" tooltipSide="top" onClick={() => void addBlankPage()}>
        <Plus size={17} />
      </IconButton>
    </div>
  )
}
