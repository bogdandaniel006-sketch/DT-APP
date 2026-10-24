/**
 * A first brake on bots: how many requests each address may make in a minute, counted in the
 * memory of the worker. Each Cloudflare machine counts on its own and forgets on restart, so it
 * is not exact, but one machine hammering a path is cut off at once and costs nothing to count.
 * The firm limits are Cloudflare's own rules, set in its dashboard.
 */
const WINDOW = 60 * 1000
const seen = new Map()

export const addressOf = (request) => request.headers.get('CF-Connecting-IP') ?? 'desconocida'

/** True when this address has already made `max` requests of this kind in the last minute. */
export const tooMany = (request, kind, max) => {
  const now = Date.now()
  // Old counts are dropped now and then, so the memory never grows without end.
  if (seen.size > 5000) for (const [key, entry] of seen) if (now - entry.start > WINDOW) seen.delete(key)
  const key = `${kind}:${addressOf(request)}`
  const entry = seen.get(key)
  if (!entry || now - entry.start > WINDOW) {
    seen.set(key, { start: now, count: 1 })
    return false
  }
  entry.count++
  return entry.count > max
}

export const slowDown = () =>
  new Response('Demasiadas peticiones seguidas. Espera un minuto.', { status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } })
