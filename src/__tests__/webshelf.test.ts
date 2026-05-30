import { describe, it, expect, beforeEach } from 'vitest'
import { WebShelf } from '../webshelf'

describe('WebShelf', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    document.cookie.split('; ').forEach((c) => {
      const name = c.split('=')[0]
      document.cookie = `${name}=; max-age=0`
    })
  })

  it('creates a WebShelf instance with default config', () => {
    const ws = new WebShelf()
    expect(ws).toBeInstanceOf(WebShelf)
  })

  it('creates a WebShelf instance with custom config', () => {
    const ws = new WebShelf({
      encrypt: true,
      encryptionKey: 'my-key',
      ttl: '1h',
    })
    expect(ws).toBeInstanceOf(WebShelf)
  })

  it('.local() returns a LocalStorage', () => {
    const ws = new WebShelf()
    const storage = ws.local('test')
    storage.set('value')
    expect(storage.get()).toBe('value')
  })

  it('.session() returns a SessionStorage', () => {
    const ws = new WebShelf()
    const storage = ws.session('test')
    storage.set('value')
    expect(storage.get()).toBe('value')
  })

  it('.cookie() returns a CookieStorage', () => {
    const ws = new WebShelf()
    const storage = ws.cookie('test')
    storage.set('value')
    expect(storage.get()).toBe('value')
  })

  it('merges global encrypt with per-storage override', () => {
    const ws = new WebShelf({ encrypt: true, encryptionKey: 'global' })
    const storage = ws.local<string>('test', { encrypt: false })
    storage.set('value')

    const raw = localStorage.getItem('test')
    const parsed = JSON.parse(raw!)
    expect(parsed.value).toBe('value')
  })

  it('merges global ttl with per-storage ttl', () => {
    const ws = new WebShelf({ ttl: '1h' })
    const storage = ws.local<string>('test', { ttl: '30m' })
    storage.set('value')
    expect(storage.get()).toBe('value')
  })

  it('merges global ttl with no per-storage ttl', () => {
    const ws = new WebShelf({ ttl: '1h' })
    const storage = ws.local<string>('test')
    storage.set('value')
    expect(storage.get()).toBe('value')
  })

  it('supports generic type inference', () => {
    const ws = new WebShelf()
    const storage = ws.local<{ id: number; name: string }>('user')
    storage.set({ id: 1, name: 'Alice' })
    const user = storage.get()
    expect(user).toEqual({ id: 1, name: 'Alice' })
  })

  it('handles multiple named storages', () => {
    const ws = new WebShelf()
    const a = ws.local<string>('a')
    const b = ws.local<string>('b')

    a.set('value-a')
    b.set('value-b')

    expect(a.get()).toBe('value-a')
    expect(b.get()).toBe('value-b')
  })

  it('passes cookie options through to CookieStorage', () => {
    const ws = new WebShelf()
    const storage = ws.cookie('test', {
      path: '/',
      sameSite: 'strict',
    })
    storage.set('value')
    expect(storage.get()).toBe('value')

    storage.remove()
    expect(storage.get()).toBeUndefined()
  })
})
