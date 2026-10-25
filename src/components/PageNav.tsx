import { ChevronLeft, ChevronRight, Hand, Maximize, Plus } from 'lucide-react'
import { addBlankPage, goToPage } from '../state/actions'
import { appStore, viewActions } from '../state/appStore'
import { useStore } from '../state/createStore'
import { touchDevice } from '../utils/device'
import { openTouchHelp } from './TouchHelp'
import { IconButton } from './ui/IconButton'

/** Moves between the pages of the document (when it has several) and adds blank ones. */
export const PageNav = () => {
  const page = useStore(appStore, (s) => s.page)
  const count = useStore(appStore, (s) => s.pageCount)
  return (
    // On a phone at the top right: clear of the tools and the pencil along the bottom.
    <div className="float absolute bottom-5 right-5 z-20 flex items-center gap-0.5 rounded-xl p-1 max-sm:bottom-auto max-sm:right-2 max-sm:top-2 short:bottom-auto short:right-2 short:top-2">
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
      {touchDevice && (
        // With fingers there is no Ctrl 0 nor zoom menu at hand: the whole sheet, and the gestures.
        <>
          <div className="mx-0.5 h-5 w-px bg-black/[0.07]" />
          <IconButton label="Ver la hoja entera" onClick={() => viewActions.fitPage()}>
            <Maximize size={16} />
          </IconButton>
          <IconButton label="Controles táctiles" onClick={openTouchHelp}>
            <Hand size={17} />
          </IconButton>
        </>
      )}
    </div>
  )
}
