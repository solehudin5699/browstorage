type Unit = 'ms' | 's' | 'm' | 'h' | 'd' | 'w'

/** TTL format: number (ms), string unit, or absolute Date. */
type TTL = number | `${number}${Unit}` | Date

/** Factory config for local/session storage (includes encryptionKey). */
interface StorageConfig {
  /** Enable encryption. */
  encrypt?: boolean
  /** Encryption key (required if encrypt is true). */
  encryptionKey?: string
  /** Default TTL. */
  ttl?: TTL
}

/** Per-key / per-set options for local/session — NO encryptionKey. */
interface StorageOptions {
  /** Override encryption. */
  encrypt?: boolean
  /** Override TTL. */
  ttl?: TTL
}

/** Factory config for cookies (includes encryptionKey + cookie options). */
interface CookieConfig extends StorageConfig {
  domain?: string
  path?: string
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  httpOnly?: boolean
}

/** Per-key / per-set options for cookies — NO encryptionKey. */
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

/** Internal resolved options (factory + per-key merged). */
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
  StorageConfig,
  StorageOptions,
  CookieConfig,
  CookieOptions,
  SetStorageOptions,
  SetCookieOptions,
  ResolvedStorageOptions,
  ResolvedCookieOptions,
}
