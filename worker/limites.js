/**
 * A first brake on bots: how many requests each address may make in a minute, counted in the
 * memory of the worker. Each Cloudflare machine counts on its own and forgets on restart, so it
 * is not exact, but one machine hammering a path is cut off at once and costs nothing to count.
 * The firm limits are Cloudflare's own rules, set in its dashboard.
 */
const WINDOW = 60 * 1000
const seen = new Map()

/** Equal strings, compared in a time that does not tell how much of them matched. */
const same = (a, b) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** The visitor's address of each request that came through our own proxy (see proxy/Caddyfile). */
const throughProxy = new WeakMap()

/**
 * Visits may come through our own server (a VPS that keeps the site reachable when Cloudflare's
 * shared addresses are blocked): then Cloudflare sees that server's address, and the visitor's
 * comes in X-Client-IP. It is believed only with X-Proxy-Key equal to the PROXY_KEY secret, so
 * nobody else can pass for another address. Called once per request, before anything counts it.
 */
export const noteClient = (request, env) => {
  const key = env.PROXY_KEY
  const given = request.headers.get('X-Proxy-Key')
  const client = request.headers.get('X-Client-IP')?.trim()
  if (key && given && client && same(given, key)) throughProxy.set(request, client.slice(0, 64))
}

export const addressOf = (request) => throughProxy.get(request) ?? request.headers.get('CF-Connecting-IP') ?? 'desconocida'

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
