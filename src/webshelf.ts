import { parseTTL } from './ttl'
import { LocalStorage } from './storage/local'
import { SessionStorage } from './storage/session'
import { CookieStorage } from './storage/cookie'
import type {
  WebShelfConfig,
  StorageOptions,
  CookieOptions,
  ResolvedStorageOptions,
  ResolvedCookieOptions,
} from './types'

/**
 * Entry point for creating and managing browser storage instances.
 *
 * @example
 * ```ts
 * const storage = new WebShelf({ encrypt: true, encryptionKey: 'secret' })
 *
 * const token = storage.local<string>('token', { ttl: '7d' })
 * token.set('Bearer eyJ...')
 * token.get()
 *
 * const cart = storage.session<Cart>('cart')
 * const session = storage.cookie('session', { sameSite: 'lax' })
 * ```
 */
export class WebShelf {
  #encrypt: boolean
  #encryptionKey: string
  #ttlMs?: number

  /**
   * @param config - Global configuration inherited by all storage instances.
   */
  constructor(config: WebShelfConfig = {}) {
    this.#encrypt = config.encrypt ?? false
    this.#encryptionKey = config.encryptionKey ?? ''
    this.#ttlMs = config.ttl !== undefined ? parseTTL(config.ttl) : undefined
  }

  /**
   * Create a `localStorage`-backed storage instance.
   *
   * @param name - Storage key.
   * @param options - Storage-specific options (overrides global).
   */
  local<T = string>(name: string, options?: StorageOptions): LocalStorage<T> {
    return new LocalStorage<T>(name, this.#resolveOptions(options))
  }

  /**
   * Create a `sessionStorage`-backed storage instance.
   *
   * @param name - Storage key.
   * @param options - Storage-specific options (overrides global).
   */
  session<T = string>(name: string, options?: StorageOptions): SessionStorage<T> {
    return new SessionStorage<T>(name, this.#resolveOptions(options))
  }

  /**
   * Create a cookie (`document.cookie`)-backed storage instance.
   *
   * @param name - Cookie name.
   * @param options - Cookie-specific options (path, domain, sameSite, etc.).
   */
  cookie<T = string>(name: string, options?: CookieOptions): CookieStorage<T> {
    return new CookieStorage<T>(name, this.#resolveCookieOptions(options))
  }

  #resolveOptions(override?: StorageOptions): ResolvedStorageOptions {
    return {
      encrypt: override?.encrypt ?? this.#encrypt,
      encryptionKey: this.#encryptionKey,
      ttlMs: override?.ttl !== undefined ? parseTTL(override.ttl) : this.#ttlMs,
    }
  }

  #resolveCookieOptions(override?: CookieOptions): ResolvedCookieOptions {
    return {
      encrypt: override?.encrypt ?? this.#encrypt,
      encryptionKey: this.#encryptionKey,
      ttlMs: override?.ttl !== undefined ? parseTTL(override.ttl) : this.#ttlMs,
      domain: override?.domain,
      path: override?.path,
      secure: override?.secure,
      sameSite: override?.sameSite,
      httpOnly: override?.httpOnly,
    }
  }
}
