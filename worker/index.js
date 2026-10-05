/**
 * The two things the app cannot do from the browser:
 *
 * - /ejercicios/…  hands over the exercise sheets of dtecnico.com. The browser cannot read
 *   them itself: that site is only served over http and this one over https. Only the
 *   sheets of the library can be requested.
 * - /buscar?q=…    searches the web for exercises. The key of the search service stays here,
 *   in the secret BRAVE_SEARCH_API_KEY, and never reaches the browser.
 *
 * Everything else is the app.
 */
const SOURCE = 'http://dtecnico.com/'
const SHEET = /^\/ejercicios\/((?:doc|pau)\/[a-z0-9-]+\.pdf)$/

const SEARCH_API = 'https://api.search.brave.com/res/v1/web/search'
const MAX_RESULTS = 10
const MAX_QUERY = 120
/** How long a resource's server gets to say what it is before the result is shown as "original only". */
const INSPECT_MS = 4000

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })

/** Search snippets come with highlighting tags and HTML entities. */
const plainText = (text) =>
  (text ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * What the resource's own server allows, read from its response headers alone:
 * - embed: it may be shown inside another page (no X-Frame-Options, no frame-ancestors).
 * - desk:  it is a PDF that any page may read (open CORS), so it can go onto the drawing desk.
 * Anything unclear, refused or slow counts as "not allowed": the result keeps only its original link.
 */
const inspect = async (url) => {
  const closed = { pdf: /\.pdf($|[?#])/i.test(url), embed: false, desk: false }
  if (!url.startsWith('https://')) return closed
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(INSPECT_MS) })
    if (!response.ok) return closed
    const header = (name) => response.headers.get(name) ?? ''
    const type = header('content-type')
    const pdf = type.includes('application/pdf')
    const page = type.includes('text/html')
    const framingLimited = response.headers.has('x-frame-options') || /frame-ancestors/i.test(header('content-security-policy'))
    const download = /attachment/i.test(header('content-disposition'))
    return {
      pdf,
      embed: (pdf || page) && !framingLimited && !download,
      desk: pdf && header('access-control-allow-origin') === '*',
    }
  } catch {
    return closed
  }
}

const search = async (request, env, ctx) => {
  // Only the app itself may spend searches.
  if (request.headers.get('sec-fetch-site') !== 'same-origin') return json({ error: 'forbidden' }, 403)
  const query = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY)
  if (query.length < 3) return json({ results: [] })
  if (!env.BRAVE_SEARCH_API_KEY) return json({ error: 'not-configured' }, 503)

  const cacheKey = new Request('https://buscar.cache/' + encodeURIComponent(query.toLowerCase()))
  const cached = await caches.default.match(cacheKey)
  if (cached) return cached

  const api = new URL(SEARCH_API)
  // The library is about technical drawing: keep the search on the subject.
  api.searchParams.set('q', /dibujo\s+t[eé]cnico/i.test(query) ? query : `${query} dibujo técnico ejercicios`)
  api.searchParams.set('count', String(MAX_RESULTS))
  api.searchParams.set('country', 'ES')
  api.searchParams.set('search_lang', 'es')
  api.searchParams.set('safesearch', 'strict')
  const found = await fetch(api, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': env.BRAVE_SEARCH_API_KEY },
  })
  if (!found.ok) return json({ error: 'search-failed' }, 502)

  const data = await found.json()
  const items = (data.web?.results ?? []).filter((r) => /^https?:\/\//.test(r.url ?? '')).slice(0, MAX_RESULTS)
  const results = await Promise.all(
    items.map(async (r) => ({
      title: plainText(r.title),
      url: r.url,
      source: hostOf(r.url),
      description: plainText(r.description),
      ...(await inspect(r.url)),
    })),
  )

  const response = json({ results }, 200, { 'Cache-Control': 'public, max-age=86400' })
  ctx.waitUntil(caches.default.put(cacheKey, response.clone()))
  return response
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url)
    if (request.method !== 'GET') return env.ASSETS.fetch(request)
    if (pathname === '/buscar') return search(request, env, ctx)

    const sheet = SHEET.exec(pathname)
    if (!sheet) return env.ASSETS.fetch(request)
    const original = await fetch(SOURCE + sheet[1], { cf: { cacheEverything: true, cacheTtl: 86400 } })
    if (!original.ok) return new Response('No se ha podido obtener la ficha.', { status: 502 })
    return new Response(original.body, {
      headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'public, max-age=86400' },
    })
  },
}
