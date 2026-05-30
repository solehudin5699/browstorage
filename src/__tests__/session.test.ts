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
