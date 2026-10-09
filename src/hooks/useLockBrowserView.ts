import { useEffect } from 'react'
import { viewActions } from '../state/appStore'
import { localPoint } from '../utils/localPoint'
import { wheelDelta, wheelZoomFactor } from '../utils/wheel'

/**
 * Whether the wheel over `target` belongs to something that scrolls by itself (a list, a menu,
 * a dialog) rather than to the desk. Only what lies over the desk's area is handed to the desk.
 */
const scrollsItself = (target: EventTarget | null, workspace: Element): boolean => {
  if (!(target instanceof Element)) return true
  const area = workspace.getBoundingClientRect()
  for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
    const style = getComputedStyle(el)
    const scrollable = /(auto|scroll)/.test(style.overflowY + style.overflowX)
    if (scrollable && (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)) return true
    if (el.matches('input, textarea, select, [role="dialog"], [role="menu"], [role="listbox"]')) return true
  }
  // Only bars that float over the desk: the top bar and the tabs keep their own behaviour.
  const r = target.getBoundingClientRect()
  return r.top < area.top || r.bottom > area.bottom + 1
}

/**
 * The app is a fixed desk: the browser must never zoom or scroll the page
 * itself, or the bars end up off-screen. Ctrl/⌘ + wheel and trackpad pinches
 * anywhere (also over the bars) zoom the drawing instead; touch pinches, Safari
 * gestures and middle-click autoscroll are blocked, and a zoom that slips
 * through anyway is cancelled out visually.
 */
export const useLockBrowserView = () => {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.defaultPrevented) return
      const workspace = document.querySelector('[data-testid="workspace"]')
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        if (workspace) viewActions.zoomAt(localPoint(workspace, e.clientX, e.clientY), wheelZoomFactor(e))
        return
      }
      // Over the bars floating on the desk (pencil, hints, pages…) the wheel still scrolls the sheet:
      // a construction reaching the edge of the screen can go on without leaving them first.
      // Lists and menus that scroll on their own keep their wheel.
      if (!workspace || scrollsItself(e.target, workspace)) return
      e.preventDefault()
      const d = wheelDelta(e)
      if (e.shiftKey && !d.x) viewActions.pan(-d.y, 0)
      else viewActions.pan(-d.x, -d.y)
    }
    const block = (e: Event) => e.preventDefault()
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault()
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    // Anything that still scrolls the page (focus, find-in-page…) is undone.
    const onScroll = () => {
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0)
    }

    // If the browser zooms anyway (some touchpads, touch screens), counter-scale the
    // whole app onto the visible area so the bars always stay on screen.
    const vv = window.visualViewport
    const root = document.getElementById('root')
    const compensate = () => {
      if (!vv || !root) return
      const zoomed = Math.abs(vv.scale - 1) > 1e-3 || vv.offsetLeft !== 0 || vv.offsetTop !== 0
      root.style.transformOrigin = '0 0'
      root.style.transform = zoomed ? `translate(${vv.offsetLeft}px, ${vv.offsetTop}px) scale(${1 / vv.scale})` : ''
    }
    compensate()
    vv?.addEventListener('resize', compensate)
    vv?.addEventListener('scroll', compensate)

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('gesturestart', block)
    window.addEventListener('gesturechange', block)
    window.addEventListener('scroll', onScroll)
    return () => {
      vv?.removeEventListener('resize', compensate)
      vv?.removeEventListener('scroll', compensate)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('gesturestart', block)
      window.removeEventListener('gesturechange', block)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])
}
