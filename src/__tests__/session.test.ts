import { describe, it, expect, beforeEach } from 'vitest'
import { SessionStorage, SessionKey } from '../storage/session'

describe('SessionKey', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  function key<T = string>(name: string): SessionKey<T> {
    return new SessionKey<T>(name, {
      encrypt: false,
      encryptionKey: '',
      ttlMs: undefined,
    })
  }

  it('sets and gets a string value', () => {
    const k = key('test-key')
    k.set('hello')
    expect(k.get()).toBe('hello')
  })

  it('sets and gets an object value', () => {
    const k = key<{ foo: string }>('obj-key')
    k.set({ foo: 'bar' })
    expect(k.get()).toEqual({ foo: 'bar' })
  })

  it('returns undefined for non-existent key', () => {
    expect(key('missing').get()).toBeUndefined()
  })

  it('removes a value', () => {
    const k = key('remove-key')
    k.set('value')
    k.remove()
    expect(k.get()).toBeUndefined()
  })

  it('handles expired value', () => {
    const k = new SessionKey<string>('exp-key', {
      encrypt: false,
      encryptionKey: '',
      ttlMs: -1,
    })
    k.set('value')
    expect(k.get()).toBeUndefined()
  })

  it('encrypts and decrypts value', () => {
    const k = new SessionKey<string>('enc-key', {
      encrypt: true,
      encryptionKey: 'secret',
      ttlMs: undefined,
    })
    k.set('hidden message')
    expect(k.get()).toBe('hidden message')

    const raw = sessionStorage.getItem('enc-key')
    const parsed = JSON.parse(raw!)
    expect(parsed.value).not.toBe('hidden message')
  })

  it('removes corrupted data', () => {
    sessionStorage.setItem('corrupt', 'not-json')
    const k = key('corrupt')
    expect(k.get()).toBeUndefined()
    expect(sessionStorage.getItem('corrupt')).toBeNull()
  })

  it('has() returns true for existing key', () => {
    const k = key('has-key')
    k.set('value')
    expect(k.has()).toBe(true)
  })

  it('has() returns false for missing key', () => {
    expect(key('missing').has()).toBe(false)
  })

  it('has() returns false for expired key', () => {
    const k = new SessionKey<string>('exp-has', {
      encrypt: false,
      encryptionKey: '',
      ttlMs: -1,
    })
    k.set('value')
    expect(k.has()).toBe(false)
  })

  it('SSR guard returns undefined', () => {
    const win = globalThis.window
    ;(globalThis as any).window = undefined

    const k = key('ssr-key')
    k.set('value')
    expect(k.get()).toBeUndefined()

    globalThis.window = win
  })

  it('SSR guard has() returns false', () => {
    const win = globalThis.window
    ;(globalThis as any).window = undefined
    expect(key('ssr-has').has()).toBe(false)
    globalThis.window = win
  })

})

describe('SessionStorage (factory)', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('creates a per-key binding via .key()', () => {
    const session = new SessionStorage()
    const k = session.key<string>('token')
    k.set('value')
    expect(k.get()).toBe('value')
  })

  it('clear() removes all sessionStorage data', () => {
    const session = new SessionStorage()
    const a = session.key<string>('a')
    const b = session.key<string>('b')
    a.set('val-a')
    b.set('val-b')
    expect(a.get()).toBe('val-a')
    expect(b.get()).toBe('val-b')
    session.clear()
    expect(a.get()).toBeUndefined()
    expect(b.get()).toBeUndefined()
  })

  it('size() returns 0 for empty storage', () => {
    const session = new SessionStorage()
    expect(session.size()).toBe(0)
  })

  it('SSR guard on clear() does not throw', () => {
    const win = globalThis.window
    ;(globalThis as any).window = undefined
    const session = new SessionStorage()
    expect(() => session.clear()).not.toThrow()
    expect(session.size()).toBe(0)
    globalThis.window = win
  })
})
