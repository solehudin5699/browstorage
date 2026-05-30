import { describe, it, expect, beforeEach } from 'vitest'
import { LocalStorage } from '../storage/local'

describe('LocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('sets and gets a string value', () => {
    const storage = new LocalStorage<string>('test-key', {
      encrypt: false,
      encryptionKey: '',
    })
    storage.set('hello')
    expect(storage.get()).toBe('hello')
  })

  it('sets and gets an object value', () => {
    const storage = new LocalStorage<{ foo: string }>('obj-key', {
      encrypt: false,
      encryptionKey: '',
    })
    storage.set({ foo: 'bar' })
    expect(storage.get()).toEqual({ foo: 'bar' })
  })

  it('sets and gets a number', () => {
    const storage = new LocalStorage<number>('num-key', {
      encrypt: false,
      encryptionKey: '',
    })
    storage.set(42)
    expect(storage.get()).toBe(42)
  })

  it('sets and gets a boolean', () => {
    const storage = new LocalStorage<boolean>('bool-key', {
      encrypt: false,
      encryptionKey: '',
    })
    storage.set(true)
    expect(storage.get()).toBe(true)
  })

  it('returns undefined for non-existent key', () => {
    const storage = new LocalStorage<string>('missing', {
      encrypt: false,
      encryptionKey: '',
    })
    expect(storage.get()).toBeUndefined()
  })

  it('removes a value', () => {
    const storage = new LocalStorage<string>('remove-key', {
      encrypt: false,
      encryptionKey: '',
    })
    storage.set('value')
    expect(storage.get()).toBe('value')
    storage.remove()
    expect(storage.get()).toBeUndefined()
  })

  it('handles expired value', () => {
    const storage = new LocalStorage<string>('exp-key', {
      encrypt: false,
      encryptionKey: '',
      ttlMs: -1,
    })
    storage.set('value')
    expect(storage.get()).toBeUndefined()
  })

  it('returns value before expiry', () => {
    const storage = new LocalStorage<string>('not-exp-key', {
      encrypt: false,
      encryptionKey: '',
      ttlMs: 10000,
    })
    storage.set('value')
    expect(storage.get()).toBe('value')
  })

  it('overrides ttl per set', () => {
    const storage = new LocalStorage<string>('override-key', {
      encrypt: false,
      encryptionKey: '',
      ttlMs: 10000,
    })
    storage.set('value', { ttl: -1 })
    expect(storage.get()).toBeUndefined()
  })

  it('encrypts and decrypts value', () => {
    const storage = new LocalStorage<string>('enc-key', {
      encrypt: true,
      encryptionKey: 'secret',
    })
    storage.set('hidden message')
    expect(storage.get()).toBe('hidden message')

    const raw = localStorage.getItem('enc-key')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.value).not.toBe('hidden message')
  })

  it('removes corrupted data', () => {
    localStorage.setItem('corrupt', 'not-json')
    const storage = new LocalStorage<string>('corrupt', {
      encrypt: false,
      encryptionKey: '',
    })
    expect(storage.get()).toBeUndefined()
    expect(localStorage.getItem('corrupt')).toBeNull()
  })

  it('handles quota exceeded gracefully', () => {
    const storage = new LocalStorage<string>('quota-key', {
      encrypt: false,
      encryptionKey: '',
    })

    const setItem = localStorage.setItem
    localStorage.setItem = () => {
      const err = new DOMException('Quota exceeded', 'QuotaExceededError')
      throw err
    }

    expect(() => storage.set('value')).not.toThrow()

    localStorage.setItem = setItem
  })

  it('clears all localStorage data', () => {
    const a = new LocalStorage<string>('a', {
      encrypt: false,
      encryptionKey: '',
    })
    const b = new LocalStorage<string>('b', {
      encrypt: false,
      encryptionKey: '',
    })
    a.set('val-a')
    b.set('val-b')
    expect(a.get()).toBe('val-a')
    expect(b.get()).toBe('val-b')
    a.clear()
    expect(a.get()).toBeUndefined()
    expect(b.get()).toBeUndefined()
  })

  it('SSR guard does not throw on clear', () => {
    const win = globalThis.window
    ;(globalThis as any).window = undefined

    const storage = new LocalStorage<string>('ssr-clear', {
      encrypt: false,
      encryptionKey: '',
    })
    expect(() => storage.clear()).not.toThrow()

    globalThis.window = win
  })

  it('SSR guard returns undefined', () => {
    const win = globalThis.window
    ;(globalThis as any).window = undefined

    const storage = new LocalStorage<string>('ssr-key', {
      encrypt: false,
      encryptionKey: '',
    })
    storage.set('value')
    expect(storage.get()).toBeUndefined()
    expect(() => storage.remove()).not.toThrow()

    globalThis.window = win
  })
})
