import { encrypt, decrypt } from '../encryption'
import { parseTTL } from '../ttl'
import type {
  CookieConfig,
  CookieOptions,
  SetCookieOptions,
  ResolvedCookieOptions,
} from '../types'

const MAX_COOKIE_SIZE = 4096

function encodeCookieValue(name: string, value: string): string {
  return `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
}

function parseCookieString(cookie: string): Record<string, string> {
  const result: Record<string, string> = {}
  const items = cookie.split('; ')
  for (const item of items) {
    const eqIdx = item.indexOf('=')
    if (eqIdx === -1) continue
    const key = decodeURIComponent(item.slice(0, eqIdx))
    const value = decodeURIComponent(item.slice(eqIdx + 1))
    result[key] = value
  }
  return result
}

function setCookie(
  name: string,
  value: string,
  options: {
    domain?: string
    path?: string
    secure?: boolean
    sameSite?: 'strict' | 'lax' | 'none'
    httpOnly?: boolean
    ttlMs?: number
  },
): void {
  if (typeof document === 'undefined') return

  let cookie = encodeCookieValue(name, value)

  if (options.ttlMs !== undefined) {
    cookie += `; max-age=${Math.floor(options.ttlMs / 1000)}`
  }
  if (options.domain) cookie += `; domain=${options.domain}`
  if (options.path) cookie += `; path=${options.path}`
  if (options.secure) cookie += `; secure`
  if (options.sameSite) cookie += `; samesite=${options.sameSite}`
  if (options.httpOnly) cookie += `; httponly`

  if (cookie.length > MAX_COOKIE_SIZE) {
    console.warn(
      `[webshelf] Cookie "${name}" exceeds size limit ` +
      `(${cookie.length} > ${MAX_COOKIE_SIZE} bytes)`,
    )
    return
  }

  document.cookie = cookie
}

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const cookies = parseCookieString(document.cookie)
  const value = cookies[name]
  if (value === '' || value === undefined) return undefined
  return value
}

function removeCookie(
  name: string,
  options?: { domain?: string; path?: string },
): void {
  setCookie(name, '', { ...options, ttlMs: 0 })
}

// ===== Helpers =====

function resolveConfig(config?: CookieConfig): ResolvedCookieOptions {
  return {
    encrypt: config?.encrypt ?? false,
    encryptionKey: config?.encryptionKey ?? '',
    ttlMs: config?.ttl !== undefined ? parseTTL(config.ttl) : undefined,
    domain: config?.domain,
    path: config?.path ?? '/',
    secure: config?.secure ?? false,
    sameSite: config?.sameSite ?? 'lax',
    httpOnly: config?.httpOnly ?? false,
  }
}

function mergeOptions(
  base: ResolvedCookieOptions,
  override?: CookieOptions,
): ResolvedCookieOptions {
  return {
    encrypt: override?.encrypt ?? base.encrypt,
    encryptionKey: base.encryptionKey,
    ttlMs: override?.ttl !== undefined ? parseTTL(override.ttl) : base.ttlMs,
    domain: override?.domain ?? base.domain,
    path: override?.path ?? base.path,
    secure: override?.secure ?? base.secure,
    sameSite: override?.sameSite ?? base.sameSite,
    httpOnly: override?.httpOnly ?? base.httpOnly,
  }
}

// ===== Factory =====

/**
 * Factory for creating cookie-backed per-key bindings.
 */
export class CookieStorage {
  #config: ResolvedCookieOptions

  constructor(config?: CookieConfig) {
    this.#config = resolveConfig(config)
  }

  /**
   * Create a per-key binding.
   *
   * @param name - Cookie name.
   * @param override - Per-key options (overrides factory config).
   */
  key<T = string>(name: string, override?: CookieOptions): CookieKey<T> {
    return new CookieKey<T>(name, mergeOptions(this.#config, override))
  }

  /**
   * Clear all cookies accessible from the current path.
   */
  clear(): void {
    if (typeof document === 'undefined') return
    const cookies = parseCookieString(document.cookie)
    for (const name of Object.keys(cookies)) {
      setCookie(name, '', { path: '/', ttlMs: 0 })
    }
  }

  /**
   * Total length of the cookie string in bytes.
   */
  size(): number {
    if (typeof document === 'undefined') return 0
    return document.cookie.length
  }
}

// ===== Per-Key Binding =====

/**
 * A cookie key-value binding with TTL and encryption support.
 */
export class CookieKey<T> {
  #name: string
  #encrypt: boolean
  #encryptionKey: string
  #defaults: ResolvedCookieOptions

  constructor(name: string, options: ResolvedCookieOptions) {
    this.#name = name
    this.#encrypt = options.encrypt
    this.#encryptionKey = options.encryptionKey
    this.#defaults = options
  }

  /**
   * Set a cookie value.
   *
   * @param value - Value to store (string, number, boolean, object).
   * @param options - Cookie options (ttl, encrypt, domain, path, secure, sameSite, httpOnly).
   */
  set(value: T, options?: SetCookieOptions): void {
    const ttlMs =
      options?.ttl !== undefined ? parseTTL(options.ttl) : this.#defaults.ttlMs
    const shouldEncrypt = options?.encrypt ?? this.#encrypt

    let stringValue: string
    if (typeof value === 'string') {
      stringValue = value
    } else {
      stringValue = JSON.stringify(value)
    }

    if (shouldEncrypt) {
      stringValue = encrypt(stringValue, this.#encryptionKey)
    }

    setCookie(this.#name, stringValue, {
      domain: options?.domain ?? this.#defaults.domain,
      path: options?.path ?? this.#defaults.path,
      secure: options?.secure ?? this.#defaults.secure,
      sameSite: options?.sameSite ?? this.#defaults.sameSite,
      httpOnly: options?.httpOnly ?? this.#defaults.httpOnly,
      ttlMs,
    })
  }

  /**
   * Get the cookie value.
   *
   * @returns The stored value, or `undefined` if missing.
   */
  get(): T | undefined {
    const value = getCookie(this.#name)
    if (value === undefined) return undefined

    let finalValue = value
    if (this.#encrypt) {
      const decrypted = decrypt(value, this.#encryptionKey)
      if (decrypted === null) return undefined
      finalValue = decrypted
    }

    try {
      return JSON.parse(finalValue) as T
    } catch {
      return finalValue as unknown as T
    }
  }

  /**
   * Delete the cookie.
   *
   * @param options - Domain/path options (must match the ones used when setting).
   */
  remove(options?: { domain?: string; path?: string }): void {
    removeCookie(this.#name, {
      domain: options?.domain ?? this.#defaults.domain,
      path: options?.path ?? this.#defaults.path,
    })
  }

  /**
   * Check if the cookie exists.
   */
  has(): boolean {
    return getCookie(this.#name) !== undefined
  }

}
