const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Next free name in the sequence A, B, … Z, A1, B1, … Z1, A2… */
export const nextPointName = (used: ReadonlySet<string>): string => {
  for (let round = 0; ; round++) {
    for (const letter of LETTERS) {
      const name = round === 0 ? letter : `${letter}${round}`
      if (!used.has(name)) return name
    }
  }
}

export const MAX_NAME_LENGTH = 8

/**
 * Cleans a typed name: typographic primes become ', spaces are dropped.
 * Any short name is valid: A, A', A'', O', P1, A2, M…
 */
export const normalizePointName = (raw: string): string =>
  raw
    .replace(/[’′´`‘]/g, "'")
    .replace(/″/g, "''")
    .replace(/\s+/g, '')
    .slice(0, MAX_NAME_LENGTH)
