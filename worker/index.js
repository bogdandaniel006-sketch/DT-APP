/**
 * Hands the exercise sheets of dtecnico.com to the app. The browser cannot read them
 * itself: that site is only served over http and this one over https.
 * Only the sheets of the library can be requested; everything else is the app.
 */
const SOURCE = 'http://dtecnico.com/'
const SHEET = /^\/ejercicios\/((?:doc|pau)\/[a-z0-9-]+\.pdf)$/

export default {
  async fetch(request, env) {
    const match = SHEET.exec(new URL(request.url).pathname)
    if (!match || request.method !== 'GET') return env.ASSETS.fetch(request)
    const original = await fetch(SOURCE + match[1], { cf: { cacheEverything: true, cacheTtl: 86400 } })
    if (!original.ok) return new Response('No se ha podido obtener la ficha.', { status: 502 })
    return new Response(original.body, {
      headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'public, max-age=86400' },
    })
  },
}
