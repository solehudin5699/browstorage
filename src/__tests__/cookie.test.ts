import { describe, it, expect, beforeEach } from 'vitest'
import { CookieStorage } from '../storage/cookie'

// document.cookie is mocked by happy-dom

describe('CookieStorage', () => {
  beforeEach(() => {
    // Hapus semua cookie
    document.cookie.split('; ').forEach((c) => {
      const name = c.split('=')[0]
      document.cookie = `${name}=; max-age=0`
    })
  })

  it('sets and gets a string value', () => {
    const storage = new CookieStorage<string>('test-cookie', {
      encrypt: false,
      encryptionKey: '',
      path: '/',
    })
    storage.set('hello')
    expect(storage.get()).toBe('hello')
  })

  it('sets and gets an object value', () => {
    const storage = new CookieStorage<{ foo: string }>('obj-cookie', {
      encrypt: false,
      encryptionKey: '',
      path: '/',
    })
    storage.set({ foo: 'bar' })
    expect(storage.get()).toEqual({ foo: 'bar' })
  })

  it('sets and gets a number', () => {
    const storage = new CookieStorage<number>('num-cookie', {
      encrypt: false,
      encryptionKey: '',
      path: '/',
    })
    storage.set(42)
    expect(storage.get()).toBe(42)
  })

  it('returns undefined for non-existent cookie', () => {
    const storage = new CookieStorage<string>('missing', {
      encrypt: false,
      encryptionKey: '',
      path: '/',
    })
    expect(storage.get()).toBeUndefined()
  })

  it('removes a cookie', () => {
    const storage = new CookieStorage<string>('remove-cookie', {
      encrypt: false,
      encryptionKey: '',
      path: '/',
    })
    storage.set('value')
    expect(storage.get()).toBe('value')
    storage.remove()
    expect(storage.get()).toBeUndefined()
  })

  it('encrypts and decrypts value', () => {
    const storage = new CookieStorage<string>('enc-cookie', {
      encrypt: true,
      encryptionKey: 'secret',
      path: '/',
    })
    storage.set('hidden message')
    expect(storage.get()).toBe('hidden message')
  })

  it('removes encrypted value', () => {
    const storage = new CookieStorage<string>('enc-remove', {
      encrypt: true,
      encryptionKey: 'secret',
      path: '/',
    })
    storage.set('value')
    expect(storage.get()).toBe('value')
    storage.remove()
    expect(storage.get()).toBeUndefined()
  })

  it('returns undefined for wrong encryption key', () => {
    const storage1 = new CookieStorage<string>('wrong-key', {
      encrypt: true,
      encryptionKey: 'correct-key',
      path: '/',
    })
    storage1.set('secret data')

    const storage2 = new CookieStorage<string>('wrong-key', {
      encrypt: true,
      encryptionKey: 'wrong-key',
      path: '/',
    })
    expect(storage2.get()).toBeUndefined()
  })

  it('sets cookie with custom options', () => {
    const storage = new CookieStorage<string>('opt-cookie', {
      encrypt: false,
      encryptionKey: '',
      path: '/',
      sameSite: 'strict',
      secure: true,
    })
    storage.set('value')
    expect(storage.get()).toBe('value')
  })

  it('overrides options per set call', () => {
    const storage = new CookieStorage<string>('override-cookie', {
      encrypt: false,
      encryptionKey: '',
      path: '/',
    })
    storage.set('value', { path: '/' })
    expect(storage.get()).toBe('value')
  })

  it('handles ttl expiry via set options', () => {
    const storage = new CookieStorage<string>('ttl-cookie', {
      encrypt: false,
      encryptionKey: '',
      path: '/',
    })
    storage.set('value', { ttl: -1 })
    expect(storage.get()).toBeUndefined()
  })

  it('SSR guard returns undefined', () => {
    const doc = globalThis.document
    ;(globalThis as any).document = undefined

    const storage = new CookieStorage<string>('ssr-cookie', {
      encrypt: false,
      encryptionKey: '',
    })
    expect(storage.get()).toBeUndefined()
    expect(() => storage.set('value')).not.toThrow()
    expect(() => storage.remove()).not.toThrow()

    globalThis.document = doc
  })
})
