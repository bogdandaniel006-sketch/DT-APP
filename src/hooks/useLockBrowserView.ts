import { useEffect } from 'react'
import { viewActions } from '../state/appStore'
import { localPoint } from '../utils/localPoint'
import { wheelZoomFactor } from '../utils/wheel'

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
      if (!(e.ctrlKey || e.metaKey) || e.defaultPrevented) return
      e.preventDefault()
      const workspace = document.querySelector('[data-testid="workspace"]')
      if (!workspace) return
      viewActions.zoomAt(localPoint(workspace, e.clientX, e.clientY), wheelZoomFactor(e))
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
