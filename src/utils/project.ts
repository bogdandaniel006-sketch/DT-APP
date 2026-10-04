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
