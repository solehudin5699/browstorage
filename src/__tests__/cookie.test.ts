import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CookieStorage, CookieKey } from '../storage/cookie'

describe('CookieKey', () => {
  beforeEach(() => {
    document.cookie.split('; ').forEach((c) => {
      const name = c.split('=')[0]
      document.cookie = `${name}=; max-age=0; path=/`
    })
  })

  function key<T = string>(name: string): CookieKey<T> {
    return new CookieKey<T>(name, {
      encrypt: false,
      encryptionKey: '',
      ttlMs: undefined,
      domain: undefined,
      path: '/',
      secure: false,
      sameSite: 'lax',
      httpOnly: false,
    })
  }

  it('sets and gets a string value', () => {
    const k = key('test-cookie')
    k.set('hello')
    expect(k.get()).toBe('hello')
  })

  it('sets and gets an object value', () => {
    const k = key<{ foo: string }>('obj-cookie')
    k.set({ foo: 'bar' })
    expect(k.get()).toEqual({ foo: 'bar' })
  })

  it('sets and gets a number', () => {
    const k = key<number>('num-cookie')
    k.set(42)
    expect(k.get()).toBe(42)
  })

  it('returns undefined for non-existent cookie', () => {
    expect(key('missing').get()).toBeUndefined()
  })

  it('removes a cookie', () => {
    const k = key('remove-cookie')
    k.set('value')
    expect(k.get()).toBe('value')
    k.remove()
    expect(k.get()).toBeUndefined()
  })

  it('encrypts and decrypts value', () => {
    const k = new CookieKey<string>('enc-cookie', {
      encrypt: true,
      encryptionKey: 'secret',
      ttlMs: undefined,
      domain: undefined,
      path: '/',
      secure: false,
      sameSite: 'lax',
      httpOnly: false,
    })
    k.set('hidden message')
    expect(k.get()).toBe('hidden message')
  })

  it('removes encrypted value', () => {
    const k = new CookieKey<string>('enc-remove', {
      encrypt: true,
      encryptionKey: 'secret',
      ttlMs: undefined,
      domain: undefined,
      path: '/',
      secure: false,
      sameSite: 'lax',
      httpOnly: false,
    })
    k.set('value')
    expect(k.get()).toBe('value')
    k.remove()
    expect(k.get()).toBeUndefined()
  })

  it('returns undefined for wrong encryption key', () => {
    const k1 = new CookieKey<string>('wrong-key', {
      encrypt: true,
      encryptionKey: 'correct-key',
      ttlMs: undefined,
      domain: undefined,
      path: '/',
      secure: false,
      sameSite: 'lax',
      httpOnly: false,
    })
    k1.set('secret data')

    const k2 = new CookieKey<string>('wrong-key', {
      encrypt: true,
      encryptionKey: 'wrong-key',
      ttlMs: undefined,
      domain: undefined,
      path: '/',
      secure: false,
      sameSite: 'lax',
      httpOnly: false,
    })
    expect(k2.get()).toBeUndefined()
  })

  it('sets cookie with custom options', () => {
    const k = new CookieKey<string>('opt-cookie', {
      encrypt: false,
      encryptionKey: '',
      ttlMs: undefined,
      domain: undefined,
      path: '/',
      secure: true,
      sameSite: 'strict',
      httpOnly: false,
    })
    k.set('value')
    expect(k.get()).toBe('value')
  })

  it('overrides options per set call', () => {
    const k = key('override-cookie')
    k.set('value', { path: '/' })
    expect(k.get()).toBe('value')
  })

  it('handles ttl expiry via set options', () => {
    const k = key('ttl-cookie')
    k.set('value', { ttl: -1 })
    expect(k.get()).toBeUndefined()
  })

  it('has() returns true for existing cookie', () => {
    const k = key('has-cookie')
    k.set('value')
    expect(k.has()).toBe(true)
  })

  it('has() returns false for missing cookie', () => {
    expect(key('missing').has()).toBe(false)
  })

  it('has() returns false after remove', () => {
    const k = key('remove-has')
    k.set('value')
    k.remove()
    expect(k.has()).toBe(false)
  })

  it('warns when cookie exceeds size limit', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const k = key('big-cookie')
    k.set('x'.repeat(5000))
    expect(warn).toHaveBeenCalled()
    expect(k.get()).toBeUndefined()
    warn.mockRestore()
  })

  it('stores cookie within size limit', () => {
    const k = key('small-cookie')
    k.set('small-value')
    expect(k.get()).toBe('small-value')
  })

  it('SSR guard returns undefined', () => {
    const doc = globalThis.document
    ;(globalThis as any).document = undefined

    const k = key('ssr-cookie')
    expect(k.get()).toBeUndefined()
    expect(() => k.set('value')).not.toThrow()
    expect(() => k.remove()).not.toThrow()

    globalThis.document = doc
  })

  it('SSR guard has() returns false', () => {
    const doc = globalThis.document
    ;(globalThis as any).document = undefined
    expect(key('ssr-has').has()).toBe(false)
    globalThis.document = doc
  })

})

describe('CookieStorage (factory)', () => {
  beforeEach(() => {
    document.cookie.split('; ').forEach((c) => {
      const name = c.split('=')[0]
      document.cookie = `${name}=; max-age=0; path=/`
    })
  })

  it('creates a per-key binding via .key()', () => {
    const cookie = new CookieStorage()
    const k = cookie.key<string>('token', { path: '/' })
    k.set('value')
    expect(k.get()).toBe('value')
  })

  it('size() returns cookie string length', () => {
    const cookie = new CookieStorage()
    const k = cookie.key<string>('size-cookie', { path: '/' })
    k.set('hello')
    expect(cookie.size()).toBeGreaterThan(0)
  })
})
