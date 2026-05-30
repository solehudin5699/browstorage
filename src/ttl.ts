import type { Unit, TTL } from './types'

/**
 * Parse various TTL formats into milliseconds.
 *
 * @param ttl - TTL in one of these formats: number (ms), string with unit (`'30s'`, `'2h'`, `'7d'`, `'1w'`), or a `Date` object.
 * @returns Milliseconds, or `undefined` if no TTL is provided.
 */
export function parseTTL(ttl: TTL | undefined): number | undefined {
  if (ttl === undefined) return undefined
  if (ttl instanceof Date) return ttl.getTime() - Date.now()

  if (typeof ttl === 'number') return ttl

  const match = ttl.match(/^(-?\d+)(ms|s|m|h|d|w)$/)
  if (!match) {
    console.warn(`[webshelf] Invalid TTL format: "${ttl}"`)
    return undefined
  }

  const value = parseInt(match[1], 10)
  const unit = match[2] as Unit

  const multipliers: Record<Unit, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 3600 * 1000,
    d: 86400 * 1000,
    w: 7 * 86400 * 1000,
  }

  return value * multipliers[unit]
}
