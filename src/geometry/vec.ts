import type { Vec } from '../types'

export const EPS = 1e-9
export const TAU = Math.PI * 2

export const vec = (x: number, y: number): Vec => ({ x, y })
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k })
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x
export const length = (a: Vec): number => Math.hypot(a.x, a.y)
export const normalize = (a: Vec): Vec => {
  const l = length(a)
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }
}
/** Rotates 90° (counter-clockwise in a y-up frame, clockwise on screen). */
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x })
export const fromAngle = (theta: number, r = 1): Vec => ({ x: Math.cos(theta) * r, y: Math.sin(theta) * r })
export const rotate = (a: Vec, theta: number): Vec => {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c }
}
export const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
export const equals = (a: Vec, b: Vec, tol = 1e-6): boolean => Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol

/** Normalizes an angle to [0, 2π). */
export const normAngle = (theta: number): number => {
  const t = theta % TAU
  return t < 0 ? t + TAU : t
}

/** Normalizes an angle difference to (-π, π]. */
export const wrapAngle = (theta: number): number => {
  let t = normAngle(theta)
  if (t > Math.PI) t -= TAU
  return t
}

export const toDeg = (rad: number): number => (rad * 180) / Math.PI
export const toRad = (deg: number): number => (deg * Math.PI) / 180
