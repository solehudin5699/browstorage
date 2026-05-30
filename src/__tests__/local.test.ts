import { describe, it, expect, beforeEach } from 'vitest'
import { LocalStorage, LocalKey } from '../storage/local'

describe('LocalKey', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  function key<T = string>(name: string): LocalKey<T> {
    return new LocalKey<T>(name, {
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

  it('sets and gets a number', () => {
    const k = key<number>('num-key')
    k.set(42)
    expect(k.get()).toBe(42)
  })

  it('sets and gets a boolean', () => {
    const k = key<boolean>('bool-key')
    k.set(true)
    expect(k.get()).toBe(true)
  })

  it('returns undefined for non-existent key', () => {
    expect(key('missing').get()).toBeUndefined()
  })

  it('removes a value', () => {
    const k = key('remove-key')
    k.set('value')
    expect(k.get()).toBe('value')
    k.remove()
    expect(k.get()).toBeUndefined()
  })

  it('handles expired value', () => {
    const k = new LocalKey<string>('exp-key', {
      encrypt: false,
      encryptionKey: '',
      ttlMs: -1,
    })
    k.set('value')
    expect(k.get()).toBeUndefined()
  })

  it('returns value before expiry', () => {
    const k = new LocalKey<string>('not-exp-key', {
      encrypt: false,
      encryptionKey: '',
      ttlMs: 10000,
    })
    k.set('value')
    expect(k.get()).toBe('value')
  })

  it('overrides ttl per set', () => {
    const k = new LocalKey<string>('override-key', {
      encrypt: false,
      encryptionKey: '',
      ttlMs: 10000,
    })
    k.set('value', { ttl: -1 })
    expect(k.get()).toBeUndefined()
  })

  it('encrypts and decrypts value', () => {
    const k = new LocalKey<string>('enc-key', {
      encrypt: true,
      encryptionKey: 'secret',
      ttlMs: undefined,
    })
    k.set('hidden message')
    expect(k.get()).toBe('hidden message')

    const raw = localStorage.getItem('enc-key')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.value).not.toBe('hidden message')
  })

  it('removes corrupted data', () => {
    localStorage.setItem('corrupt', 'not-json')
    const k = key('corrupt')
    expect(k.get()).toBeUndefined()
    expect(localStorage.getItem('corrupt')).toBeNull()
  })

  it('handles quota exceeded gracefully', () => {
    const k = key('quota-key')

    const setItem = localStorage.setItem
    localStorage.setItem = () => {
      const err = new DOMException('Quota exceeded', 'QuotaExceededError')
      throw err
    }

    expect(() => k.set('value')).not.toThrow()

    localStorage.setItem = setItem
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
    const k = new LocalKey<string>('exp-has', {
      encrypt: false,
      encryptionKey: '',
      ttlMs: -1,
    })
    k.set('value')
    expect(k.has()).toBe(false)
  })

  it('has() works with encrypted value', () => {
    const k = new LocalKey<string>('enc-has', {
      encrypt: true,
      encryptionKey: 'secret',
      ttlMs: undefined,
    })
    k.set('hidden')
    expect(k.has()).toBe(true)
  })

  it('SSR guard returns undefined', () => {
    const win = globalThis.window
    ;(globalThis as any).window = undefined

    const k = key('ssr-key')
    k.set('value')
    expect(k.get()).toBeUndefined()
    expect(() => k.remove()).not.toThrow()

    globalThis.window = win
  })

  it('SSR guard has() returns false', () => {
    const win = globalThis.window
    ;(globalThis as any).window = undefined
    expect(key('ssr-has').has()).toBe(false)
    globalThis.window = win
  })

})

describe('LocalStorage (factory)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('creates a per-key binding via .key()', () => {
    const local = new LocalStorage({ encrypt: false, encryptionKey: '' })
    const k = local.key<string>('token')
    k.set('value')
    expect(k.get()).toBe('value')
  })

  it('merges factory config with .key() override', () => {
    const local = new LocalStorage({ encrypt: true, encryptionKey: 'global', ttl: '1h' })
    const k = local.key<string>('test', { encrypt: false })
    k.set('value')

    const raw = localStorage.getItem('test')
    const parsed = JSON.parse(raw!)
    expect(parsed.value).toBe('value')
  })

  it('clear() removes all localStorage data', () => {
    const local = new LocalStorage()
    const a = local.key<string>('a')
    const b = local.key<string>('b')
    a.set('val-a')
    b.set('val-b')
    expect(a.get()).toBe('val-a')
    expect(b.get()).toBe('val-b')
    local.clear()
    expect(a.get()).toBeUndefined()
    expect(b.get()).toBeUndefined()
  })

  it('size() returns 0 for empty storage', () => {
    const local = new LocalStorage()
    expect(local.size()).toBe(0)
  })

  it('size() increases after set', () => {
    const local = new LocalStorage()
    const k = local.key<string>('size-key')
    const before = local.size()
    k.set('hello')
    expect(local.size()).toBeGreaterThan(before)
  })

  it('SSR guard on clear() does not throw', () => {
    const win = globalThis.window
    ;(globalThis as any).window = undefined
    const local = new LocalStorage()
    expect(() => local.clear()).not.toThrow()
    expect(local.size()).toBe(0)
    globalThis.window = win
  })
})
