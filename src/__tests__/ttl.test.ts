import { describe, it, expect } from 'vitest'
import { parseTTL } from '../ttl'

describe('parseTTL', () => {
  it('returns undefined for undefined input', () => {
    expect(parseTTL(undefined)).toBeUndefined()
  })

  it('parses number as milliseconds', () => {
    expect(parseTTL(500)).toBe(500)
    expect(parseTTL(0)).toBe(0)
    expect(parseTTL(100000)).toBe(100000)
  })

  it('parses ms unit', () => {
    expect(parseTTL('500ms')).toBe(500)
    expect(parseTTL('0ms')).toBe(0)
  })

  it('parses seconds', () => {
    expect(parseTTL('30s')).toBe(30000)
    expect(parseTTL('1s')).toBe(1000)
  })

  it('parses minutes', () => {
    expect(parseTTL('15m')).toBe(900000)
    expect(parseTTL('1m')).toBe(60000)
  })

  it('parses hours', () => {
    expect(parseTTL('2h')).toBe(7200000)
    expect(parseTTL('1h')).toBe(3600000)
  })

  it('parses days', () => {
    expect(parseTTL('7d')).toBe(604800000)
    expect(parseTTL('1d')).toBe(86400000)
  })

  it('parses weeks', () => {
    expect(parseTTL('1w')).toBe(604800000)
    expect(parseTTL('2w')).toBe(1209600000)
  })

  it('parses Date object', () => {
    const future = new Date(Date.now() + 5000)
    const result = parseTTL(future)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(10000)
  })

  it('returns negative for past Date', () => {
    const past = new Date(Date.now() - 5000)
    expect(parseTTL(past)).toBeLessThan(0)
  })

  it('handles negative numbers', () => {
    expect(parseTTL(-1000)).toBe(-1000)
  })

  it('warns and returns undefined for invalid string format', () => {
    const warn = console.warn
    const warnings: string[] = []
    console.warn = (msg: string) => warnings.push(msg)

    expect(parseTTL('abc' as any)).toBeUndefined()
    expect(parseTTL('10' as any)).toBeUndefined()
    expect(parseTTL('10x' as any)).toBeUndefined()

    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain('Invalid TTL')

    console.warn = warn
  })
})
