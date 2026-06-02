import { encrypt, decrypt } from '../encryption'
import { parseTTL } from '../ttl'
import type { StorageConfig, StorageKeyOptions, SetStorageOptions, ResolvedStorageOptions } from '../types'

// ===== Helpers =====

function resolveConfig(config?: StorageConfig): ResolvedStorageOptions {
  let encrypt = config?.encrypt ?? false
  const encryptionKey = config?.encryptionKey ?? ''

  if (encrypt && !encryptionKey) {
    console.warn('[browstorage] encryptionKey is missing. Encryption disabled.')
    encrypt = false
  }

  return {
    encrypt,
    encryptionKey,
    ttlMs: config?.ttl !== undefined ? parseTTL(config.ttl) : undefined,
  }
}

function mergeOptions(
  base: ResolvedStorageOptions,
  override?: StorageKeyOptions,
): ResolvedStorageOptions {
  let encrypt = override?.encrypt ?? base.encrypt

  if (encrypt && !base.encryptionKey) {
    console.warn('[browstorage] encryptionKey not configured at factory level. Encryption disabled for this key.')
    encrypt = false
  }

  return {
    encrypt,
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

  /**
   * Create a `sessionStorage`-backed storage instance.
   *
   * @param config - Factory options (encrypt, encryptionKey, ttl).
   */
  constructor(config?: StorageConfig) {
    this.#config = resolveConfig(config)
  }

  /**
   * Create a per-key binding.
   *
   * @param name - Storage key.
   * @param options - Per-key options (encrypt, ttl). Overrides factory config.
   * @returns A SessionKey scoped to the given key name.
   */
  key<T = string>(name: string, options?: StorageKeyOptions): SessionKey<T> {
    return new SessionKey<T>(name, mergeOptions(this.#config, options))
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
   *
   * @returns Estimated total data size in bytes.
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
   * @param value - The value to store. Passing `undefined` is equivalent to calling `remove()`.
   * @param options - Per-set options (TTL overrides key-level and factory defaults).
   */
  set(value: T, options?: SetStorageOptions): void {
    if (typeof window === 'undefined') return
    if (value === undefined) { this.remove(); return }

    const ttlMs = options?.ttl !== undefined ? parseTTL(options.ttl) : this.#ttlMs

    const exp = ttlMs !== undefined ? Date.now() + ttlMs : undefined
    let storedValue: unknown = value
    if (this.#encrypt) {
      storedValue = encrypt(JSON.stringify(value), this.#encryptionKey)
    }
    const payload: Record<string, unknown> = { value: storedValue }
    if (exp !== undefined) payload.exp = exp

    try {
      sessionStorage.setItem(this.#name, JSON.stringify(payload))
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn(`[browstorage] Quota exceeded for key "${this.#name}"`)
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
   *
   * @returns `true` if the key exists and is not expired.
   */
  has(): boolean {
    if (typeof window === 'undefined') return false
    const cached = sessionStorage.getItem(this.#name)
    if (!cached) return false
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cached)
    } catch {
      this.remove()
      return false
    }
    const exp = parsed.exp as number | undefined
    if (exp !== undefined && Date.now() > exp) {
      this.remove()
      return false
    }
    return true
  }

}
