import type { Shape } from '../types'

/**
 * A project file (.lamina): the original PDF plus the editable drawing, in one
 * file the user keeps. Layout: magic, 4-byte length of the JSON header, header, PDF bytes.
 */
const MAGIC = new TextEncoder().encode('LAMINA1\n')

export const PROJECT_EXTENSION = '.lamina'

export interface Project {
  name: string
  bytes: Uint8Array
  shapes: Shape[]
  page: number
}

export const encodeProject = (project: Project): Blob => {
  const { name, shapes, page } = project
  const header = new TextEncoder().encode(JSON.stringify({ version: 1, name, shapes, page }))
  const length = new Uint8Array(4)
  new DataView(length.buffer).setUint32(0, header.length)
  return new Blob([MAGIC, length, header, project.bytes] as BlobPart[], { type: 'application/octet-stream' })
}

/*
 * The project as a web file (.lamina.html): the same bytes inside a small web page. Opened from
 * the file explorer, any browser shows the page, which hands the project straight to this site.
 */
export const WEB_PROJECT_EXTENSION = '.lamina.html'

const WEB_MARKER = '<meta name="generator" content="lamina-project">'
const WEB_DATA_START = '<textarea name="data" hidden>'
const WEB_DATA_END = '</textarea>'
/** Where the page sends the project; the site answers with the app and the project in it. */
export const OPEN_PATH = '/abrir'
/** Element in which the site hands a project sent to OPEN_PATH back to the app, as base64. */
export const HANDED_PROJECT_ID = 'lamina-open'

const toBase64 = (bytes: Uint8Array) => {
  let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(text)
}

export const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

/** The project wrapped in a web page that opens it on `site` (the address of this app). */
export const encodeProjectPage = async (project: Project, site: string): Promise<Blob> => {
  const data = toBase64(new Uint8Array(await encodeProject(project).arrayBuffer()))
  const name = escapeHtml(project.name.replace(/\.pdf$/i, ''))
  const page = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
${WEB_MARKER}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} · Lámina</title>
<style>body{margin:0;height:100vh;display:grid;place-items:center;font:15px system-ui,sans-serif;color:#1f2329;background:#f3f4f6}button{font:inherit;padding:.6em 1.2em;border:0;border-radius:12px;background:#2563eb;color:#fff;cursor:pointer}</style>
</head>
<body>
<form id="lamina" method="post" action="${escapeHtml(site)}${OPEN_PATH}">
<p>Abriendo «${name}» en Lámina…</p>
<noscript><button>Abrir en Lámina</button></noscript>
${WEB_DATA_START}${data}${WEB_DATA_END}
</form>
<script>document.getElementById('lamina').submit()</script>
</body>
</html>
`
  return new Blob([page], { type: 'text/html' })
}

/** The project bytes inside a web project file, or null when the file is not one. */
export const projectFromPage = (bytes: Uint8Array): Uint8Array | null => {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 512))
  if (!head.includes(WEB_MARKER)) return null
  const text = new TextDecoder('latin1').decode(bytes)
  const start = text.indexOf(WEB_DATA_START)
  const end = text.indexOf(WEB_DATA_END, start)
  if (start < 0 || end < 0) return null
  try {
    return fromBase64(text.slice(start + WEB_DATA_START.length, end).trim())
  } catch {
    return null
  }
}

export const isProject = (bytes: Uint8Array) => bytes.length > MAGIC.length + 4 && MAGIC.every((b, i) => bytes[i] === b)

export const decodeProject = (bytes: Uint8Array): Project | null => {
  if (!isProject(bytes)) return null
  try {
    const start = MAGIC.length + 4
    const length = new DataView(bytes.buffer, bytes.byteOffset + MAGIC.length, 4).getUint32(0)
    const header = JSON.parse(new TextDecoder().decode(bytes.subarray(start, start + length)))
    if (header.version !== 1 || !Array.isArray(header.shapes)) return null
    return {
      name: typeof header.name === 'string' && header.name ? header.name : 'lamina.pdf',
      bytes: bytes.slice(start + length),
      shapes: header.shapes,
      page: typeof header.page === 'number' ? header.page : 0,
    }
  } catch {
    return null
  }
}
