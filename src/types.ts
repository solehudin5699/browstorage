type Unit = 'ms' | 's' | 'm' | 'h' | 'd' | 'w'

/** TTL format: number (ms), string unit, or absolute Date. */
type TTL = number | `${number}${Unit}` | Date

/** Global configuration for WebShelf. */
interface WebShelfConfig {
  /** Enable encryption for all storage instances. */
  encrypt?: boolean
  /** Global encryption key. */
  encryptionKey?: string
  /** Default TTL for all storage instances. */
  ttl?: TTL
}

/** Per-storage options (local/session). */
interface StorageOptions {
  /** Override encryption for this storage. */
  encrypt?: boolean
  /** Override TTL for this storage. */
  ttl?: TTL
}

/** Per-storage cookie options. */
interface CookieOptions extends StorageOptions {
  domain?: string
  path?: string
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  httpOnly?: boolean
}

/** Per-set options for local/session storage. */
interface SetStorageOptions {
  encrypt?: boolean
  ttl?: TTL
}

/** Per-set options for cookies. */
interface SetCookieOptions extends SetStorageOptions {
  domain?: string
  path?: string
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  httpOnly?: boolean
}

/** Internal resolved options (global + per-storage merged). */
interface ResolvedStorageOptions {
  encrypt: boolean
  encryptionKey: string
  ttlMs?: number
}

/** Internal resolved cookie options. */
interface ResolvedCookieOptions extends ResolvedStorageOptions {
  domain?: string
  path?: string
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  httpOnly?: boolean
}

export type {
  Unit,
  TTL,
  WebShelfConfig,
  StorageOptions,
  CookieOptions,
  SetStorageOptions,
  SetCookieOptions,
  ResolvedStorageOptions,
  ResolvedCookieOptions,
}
