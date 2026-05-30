import { encrypt, decrypt } from '../encryption'
import { parseTTL } from '../ttl'
import type { StorageConfig, StorageOptions, SetStorageOptions, ResolvedStorageOptions } from '../types'

// ===== Helpers =====

function resolveConfig(config?: StorageConfig): ResolvedStorageOptions {
  return {
    encrypt: config?.encrypt ?? false,
    encryptionKey: config?.encryptionKey ?? '',
    ttlMs: config?.ttl !== undefined ? parseTTL(config.ttl) : undefined,
  }
}

function mergeOptions(
  base: ResolvedStorageOptions,
  override?: StorageOptions,
): ResolvedStorageOptions {
  return {
    encrypt: override?.encrypt ?? base.encrypt,
    encryptionKey: base.encryptionKey,
    ttlMs: override?.ttl !== undefined ? parseTTL(override.ttl) : base.ttlMs,
  }
}

// ===== Factory =====

/**
 * Factory for creating `sessionStorage`-backed per-key bindings.
 */
export class SessionStorage {
  #config: ResolvedStorageOptions

  constructor(config?: StorageConfig) {
    this.#config = resolveConfig(config)
  }

  /**
   * Create a per-key binding.
   *
   * @param name - Storage key.
   * @param override - Per-key options (overrides factory config).
   */
  key<T = string>(name: string, override?: StorageOptions): SessionKey<T> {
    return new SessionKey<T>(name, mergeOptions(this.#config, override))
  }

  /**
   * Clear all sessionStorage data.
   */
  clear(): void {
    if (typeof window === 'undefined') return
    sessionStorage.clear()
  }

  /**
   * Estimated total size of all sessionStorage data in bytes.
   */
  size(): number {
    if (typeof window === 'undefined') return 0
    let total = 0
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key === null) continue
      const value = sessionStorage.getItem(key)
      total += key.length + (value?.length ?? 0)
    }
    return total
  }
}

// ===== Per-Key Binding =====

/**
 * A `sessionStorage` key-value binding with TTL and encryption support.
 */
export class SessionKey<T> {
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
   * Store a value in sessionStorage.
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
      sessionStorage.setItem(this.#name, JSON.stringify(payload))
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn(`[webshelf] Quota exceeded for key "${this.#name}"`)
      } else {
        throw e
      }
    }
  }

  /**
   * Retrieve a value from sessionStorage.
   *
   * Automatically removes the item if it has expired.
   *
   * @returns The stored value, or `undefined` if missing / expired / corrupt.
   */
  get(): T | undefined {
    if (typeof window === 'undefined') return undefined

    const cached = sessionStorage.getItem(this.#name)
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
   * Remove data from sessionStorage.
   */
  remove(): void {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(this.#name)
  }

  /**
   * Check if the key exists and is not expired.
   */
  has(): boolean {
    if (typeof window === 'undefined') return false
    const cached = sessionStorage.getItem(this.#name)
    if (!cached) return false
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cached)
    } catch {
      return false
    }
    const exp = parsed.exp as number | undefined
    if (exp !== undefined && Date.now() > exp) return false
    return true
  }

}
