/**
 * Hands the sheets of the exercise library to the app, which cannot read them from the
 * browser: their sites do not let other pages read their files, and the main one is only
 * served over http. Only PDFs of the sites listed here can be requested, each fetched from
 * its original when asked for; nothing is stored. Everything else is the app.
 *
 *   /ejercicios/doc/…  /ejercicios/pau/…   the main library (dtecnico.com)
 *   /ejercicios/<id>/…                     the other sites of src/data/exercises.ts
 */
const MAIN = 'http://dtecnico.com/'
const MAIN_SHEET = /^(?:doc|pau)\/[a-z0-9-]+\.pdf$/

/** Base address of each other source, by the id it has in the data. */
const OTHERS = {
  laslaminas: 'https://www.laslaminas.es/',
  ibiguridt: 'https://ibiguridt.wordpress.com/wp-content/uploads/',
  dibujotecnico: 'https://www.dibujotecnico.com/Ejercicios/',
  educacionplastica: 'https://www.educacionplastica.net/pdfs/',
}
/** A plain path to a PDF: letters, digits and - _ . / only, so it cannot leave the source's folder. */
const SHEET = /^[A-Za-z0-9_\-/.]+\.pdf$/

/** Address of the original PDF for a path under /ejercicios/, or null when it is not a sheet. */
const originalOf = (path) => {
  if (MAIN_SHEET.test(path)) return MAIN + path
  const slash = path.indexOf('/')
  const base = OTHERS[path.slice(0, slash)]
  const file = path.slice(slash + 1)
  if (slash < 1 || !base || !SHEET.test(file) || file.includes('..') || file.startsWith('/')) return null
  return base + file
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    const original = request.method === 'GET' && pathname.startsWith('/ejercicios/') ? originalOf(pathname.slice(12)) : null
    if (!original) return env.ASSETS.fetch(request)

    const sheet = await fetch(original, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Lamina; +https://danidemiguel.aldanidaniel12.workers.dev)' },
      cf: { cacheEverything: true, cacheTtl: 86400 },
    })
    if (!sheet.ok || !(sheet.headers.get('content-type') ?? '').includes('pdf')) {
      return new Response('No se ha podido obtener la ficha.', { status: 502 })
    }
    return new Response(sheet.body, {
      headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'public, max-age=86400' },
    })
  },
}
