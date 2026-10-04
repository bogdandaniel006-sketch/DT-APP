/** Wheel deltas in pixels, whatever unit the device reports. */
export const wheelDelta = (e: WheelEvent) => {
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
  return { x: e.deltaX * unit, y: e.deltaY * unit }
}

/** Zoom factor for a Ctrl/⌘ + wheel event or a trackpad pinch. */
export const wheelZoomFactor = (e: WheelEvent) => {
  const { y } = wheelDelta(e)
  // Trackpad pinches arrive as small fractional deltas; mouse notches are ~100px.
  const isPinch = Math.abs(y) < 40 && !Number.isInteger(y)
  return Math.exp(-y * (isPinch ? 0.01 : 0.0018))
}
