/**
 * Where big files go: the D1 databases bound as CLASES1…CLASES7 (classes) and ARCHIVOS1…ARCHIVOS2
 * (originals of the sheets people send, see registro.js). A database holds at most 500 MB on the
 * free plan, so each file goes, in pieces of 1 MB (a row holds at most 2 MB), to the first one with
 * room; the main database (DB) only keeps which one that was. How much each holds is counted in the
 * `uso` table of DB, under 'clases-1', 'archivos-2'…
 */

export const PIECE = 1024 * 1024
/** Room used in each database, a little under its 500 MB. */
const PER_STORE = 480 * 1024 * 1024
const COUNT = { clases: 7, archivos: 2 }
const BINDING = { clases: 'CLASES', archivos: 'ARCHIVOS' }

const prepared = new Set()

/** The database number `index` (1…) of a kind, with its table made the first time. */
const store = async (env, kind, index) => {
  const db = env[BINDING[kind] + index]
  if (!db) return null
  if (!prepared.has(kind + index)) {
    await db.prepare('CREATE TABLE IF NOT EXISTS trozos (dueno TEXT NOT NULL, n INTEGER NOT NULL, datos BLOB NOT NULL, PRIMARY KEY (dueno, n))').run()
    prepared.add(kind + index)
  }
  return db
}

const key = (kind, index) => `${kind}-${index}`

/** Bytes held by each database of a kind, from the counts in DB. */
const usage = async (env, kind) => {
  const rows = (await env.DB.prepare("SELECT clave, bytes FROM uso WHERE clave LIKE ?1 || '-%'").bind(kind).all()).results
  const held = new Map(rows.map((r) => [r.clave, r.bytes]))
  return Array.from({ length: COUNT[kind] }, (_, i) => ({ index: i + 1, bytes: held.get(key(kind, i + 1)) ?? 0 })).filter((s) => env[BINDING[kind] + s.index])
}

/** Room left in all the databases of a kind together. */
export const roomLeft = async (env, kind) => (await usage(env, kind)).reduce((n, s) => n + Math.max(0, PER_STORE - s.bytes), 0)

const count = (env, kind, index, delta) =>
  env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO uso (clave, bytes) VALUES (?1, 0)').bind(key(kind, index)),
    env.DB.prepare('UPDATE uso SET bytes = MAX(0, bytes + ?2) WHERE clave = ?1').bind(key(kind, index), delta),
  ])

/**
 * Keeps a file under `owner` in the first database of the kind with room for it, and returns that
 * database's number; null when none has room. Each files' pieces are written one by one, so a big
 * file never travels to the database in a single request.
 */
export const put = async (env, kind, owner, bytes) => {
  const free = (await usage(env, kind)).find((s) => s.bytes + bytes.length <= PER_STORE)
  if (!free) return null
  const db = await store(env, kind, free.index)
  try {
    for (let i = 0, n = 0; i < Math.max(bytes.length, 1); i += PIECE, n++) {
      await db.prepare('INSERT OR REPLACE INTO trozos (dueno, n, datos) VALUES (?1, ?2, ?3)').bind(owner, n, bytes.subarray(i, i + PIECE)).run()
    }
  } catch (err) {
    await db.prepare('DELETE FROM trozos WHERE dueno = ?1').bind(owner).run()
    throw err
  }
  await count(env, kind, free.index, bytes.length)
  return free.index
}

/** How many pieces a file has. */
const pieces = async (db, owner) => (await db.prepare('SELECT COUNT(*) AS n FROM trozos WHERE dueno = ?1').bind(owner).first())?.n ?? 0

const piece = async (db, owner, n) => {
  const row = await db.prepare('SELECT datos FROM trozos WHERE dueno = ?1 AND n = ?2').bind(owner, n).first()
  return row ? new Uint8Array(row.datos) : null
}

/**
 * A file, as a stream read piece by piece (big files never sit whole in the worker's memory),
 * after `head` if given. Null when it is not there.
 */
export const stream = async (env, kind, index, owner, head) => {
  const db = await store(env, kind, index)
  const total = db ? await pieces(db, owner) : 0
  if (!total) return null
  let n = head ? -1 : 0
  return new ReadableStream({
    async pull(controller) {
      if (n === -1) {
        controller.enqueue(head)
        n = 0
        return
      }
      const part = await piece(db, owner, n++)
      if (part) controller.enqueue(part)
      if (!part || n >= total) controller.close()
    },
  })
}

/** A small file (strokes), whole. */
export const read = async (env, kind, index, owner) => {
  const db = await store(env, kind, index)
  const total = db ? await pieces(db, owner) : 0
  if (!total) return null
  const parts = []
  for (let n = 0; n < total; n++) parts.push((await piece(db, owner, n)) ?? new Uint8Array())
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** Deletes a file and gives its room back. */
export const drop = async (env, kind, index, owner, bytes) => {
  const db = await store(env, kind, index)
  if (!db) return
  await db.prepare('DELETE FROM trozos WHERE dueno = ?1').bind(owner).run()
  await count(env, kind, index, -bytes)
}

/** Room of every database, for the creator's panel. */
export const allUsage = async (env) =>
  [...(await usage(env, 'clases')).map((s) => ({ ...s, kind: 'clases' })), ...(await usage(env, 'archivos')).map((s) => ({ ...s, kind: 'archivos' }))].map((s) => ({ ...s, room: PER_STORE }))
