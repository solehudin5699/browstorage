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

/** Defines a secondary index on an object store. */
interface IndexOptions {
  name: string
  keyPath: string | string[]
  unique?: boolean
  multiEntry?: boolean
}

/** Defines an object store schema (plain, structured clone, supports indexes). */
interface ObjectStoreSchema {
  name: string
  keyPath: string | string[]
  autoIncrement?: boolean
  indexes?: IndexOptions[]
}

/** Defines a secure store schema (encrypted key-value). */
interface SecureStoreSchema {
  name: string
  encryptionKey: string
  ttl?: TTL
}

/** Per-key options for SecureStore. */
interface SecureKeyOptions {
  ttl?: TTL
}

/** Factory config for IndexedDB. */
interface IndexedDBOptions<
  S extends readonly ObjectStoreSchema[] = readonly ObjectStoreSchema[],
  K extends readonly SecureStoreSchema[] = readonly SecureStoreSchema[],
> {
  dbName?: string
  stores?: S
  secureStores?: K
}

/** Internal resolved IndexedDB options. */
interface ResolvedDBOptions<
  S extends readonly ObjectStoreSchema[] = readonly ObjectStoreSchema[],
  K extends readonly SecureStoreSchema[] = readonly SecureStoreSchema[],
> {
  dbName: string
  stores: S
  secureStores: K
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
  IndexOptions,
  ObjectStoreSchema,
  SecureStoreSchema,
  SecureKeyOptions,
  IndexedDBOptions,
  ResolvedStorageOptions,
  ResolvedCookieOptions,
  ResolvedDBOptions,
}
