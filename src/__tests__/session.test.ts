import { describe, it, expect, beforeEach } from 'vitest'
import { SessionStorage } from '../storage/session'

describe('SessionStorage', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('sets and gets a string value', () => {
    const storage = new SessionStorage<string>('test-key', {
      encrypt: false,
      encryptionKey: '',
    })
    storage.set('hello')
    expect(storage.get()).toBe('hello')
  })

  it('sets and gets an object value', () => {
    const storage = new SessionStorage<{ foo: string }>('obj-key', {
      encrypt: false,
      encryptionKey: '',
    })
    storage.set({ foo: 'bar' })
    expect(storage.get()).toEqual({ foo: 'bar' })
  })

  it('returns undefined for non-existent key', () => {
    const storage = new SessionStorage<string>('missing', {
      encrypt: false,
      encryptionKey: '',
    })
    expect(storage.get()).toBeUndefined()
  })

  it('removes a value', () => {
    const storage = new SessionStorage<string>('remove-key', {
      encrypt: false,
      encryptionKey: '',
    })
    storage.set('value')
    storage.remove()
    expect(storage.get()).toBeUndefined()
  })

  it('handles expired value', () => {
    const storage = new SessionStorage<string>('exp-key', {
      encrypt: false,
      encryptionKey: '',
      ttlMs: -1,
    })
    storage.set('value')
    expect(storage.get()).toBeUndefined()
  })

  it('encrypts and decrypts value', () => {
    const storage = new SessionStorage<string>('enc-key', {
      encrypt: true,
      encryptionKey: 'secret',
    })
    storage.set('hidden message')
    expect(storage.get()).toBe('hidden message')

    const raw = sessionStorage.getItem('enc-key')
    const parsed = JSON.parse(raw!)
    expect(parsed.value).not.toBe('hidden message')
  })

  it('removes corrupted data', () => {
    sessionStorage.setItem('corrupt', 'not-json')
    const storage = new SessionStorage<string>('corrupt', {
      encrypt: false,
      encryptionKey: '',
    })
    expect(storage.get()).toBeUndefined()
    expect(sessionStorage.getItem('corrupt')).toBeNull()
  })

  it('clears all sessionStorage data', () => {
    const a = new SessionStorage<string>('a', {
      encrypt: false,
      encryptionKey: '',
    })
    const b = new SessionStorage<string>('b', {
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

    const storage = new SessionStorage<string>('ssr-clear', {
      encrypt: false,
      encryptionKey: '',
    })
    expect(() => storage.clear()).not.toThrow()

    globalThis.window = win
  })

  it('SSR guard returns undefined', () => {
    const win = globalThis.window
    ;(globalThis as any).window = undefined

    const storage = new SessionStorage<string>('ssr-key', {
      encrypt: false,
      encryptionKey: '',
    })
    storage.set('value')
    expect(storage.get()).toBeUndefined()

    globalThis.window = win
  })
})
