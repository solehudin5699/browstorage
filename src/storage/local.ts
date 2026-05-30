import { encrypt, decrypt } from '../encryption'
import { parseTTL } from '../ttl'
import type { ResolvedStorageOptions, SetStorageOptions } from '../types'

/**
 * `localStorage`-backed storage instance with TTL and encryption support.
 */
export class LocalStorage<T> {
  #name: string
  #encrypt: boolean
  #encryptionKey: string
  #ttlMs?: number

  constructor(name: string, options: ResolvedStorageOptions) {
    this.#name = name
    this.#encrypt = options.encrypt
    this.#encryptionKey = options.encryptionKey
    this.#ttlMs = options.ttlMs
  }

  /**
   * Store a value in localStorage.
   *
   * @param value - Value to store (string, number, boolean, object).
   * @param options - Per-set override options (ttl, encrypt).
   */
  set(value: T, options?: SetStorageOptions): void {
    if (typeof window === 'undefined') return

    const ttlMs = options?.ttl !== undefined ? parseTTL(options.ttl) : this.#ttlMs
    const shouldEncrypt = options?.encrypt ?? this.#encrypt

    const exp = ttlMs !== undefined ? Date.now() + ttlMs : undefined
    let storedValue: unknown = value
    if (shouldEncrypt) {
      storedValue = encrypt(JSON.stringify(value), this.#encryptionKey)
    }
    const payload: Record<string, unknown> = { value: storedValue }
    if (exp !== undefined) payload.exp = exp

    try {
      localStorage.setItem(this.#name, JSON.stringify(payload))
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn(`[webshelf] Quota exceeded for key "${this.#name}"`)
      } else {
        throw e
      }
    }
  }

  /**
   * Retrieve a value from localStorage.
   *
   * Automatically removes the item if it has expired.
   *
   * @returns The stored value, or `undefined` if missing / expired / corrupt.
   */
  get(): T | undefined {
    if (typeof window === 'undefined') return undefined

    const cached = localStorage.getItem(this.#name)
    if (!cached) return undefined

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cached)
    } catch {
      this.remove()
      return undefined
    }

    const { value, exp } = parsed

    if (exp !== undefined && Date.now() > (exp as number)) {
      this.remove()
      return undefined
    }

    if (this.#encrypt) {
      const decrypted = decrypt(value as string, this.#encryptionKey)
      if (decrypted === null) {
        this.remove()
        return undefined
      }
      try {
        return JSON.parse(decrypted) as T
      } catch {
        return decrypted as unknown as T
      }
    }

    return value as T
  }

  /**
   * Remove data from localStorage.
   */
  remove(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(this.#name)
  }

  /**
   * Clear all localStorage data.
   */
  clear(): void {
    if (typeof window === 'undefined') return
    localStorage.clear()
  }
}
