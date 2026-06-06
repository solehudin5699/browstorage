type Unit = 'ms' | 's' | 'm' | 'h' | 'd' | 'w'

/** TTL format: number (ms), string unit, absolute Date, or null (no TTL). */
type TTL = number | `${number}${Unit}` | Date | null

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
interface StorageKeyOptions {
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
interface CookieKeyOptions extends StorageKeyOptions {
  domain?: string
  path?: string
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  httpOnly?: boolean
}

/** Per-set options for local/session storage. */
interface SetStorageOptions {
  ttl?: TTL
}

/** Per-set options for cookies. */
interface SetCookieOptions {
  ttl?: TTL
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
  /** Store name. Used to reference the store via `objectStore()` and `secureStore()`. */
  name: string
  /**
   * Primary key field path. Can be a single field (string) or composite key (string array).
   * Changing this on an existing store will delete all data and recreate the store during migration.
   */
  keyPath: string | string[]
  /** @default false. Changing this will delete all data and recreate the store during migration. */
  autoIncrement?: boolean
  /** Secondary indexes for querying by non-key fields. */
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

/** Per-set options for SecureKey. */
interface SecureSetOptions {
  ttl?: TTL
}

/** Factory config for IndexedDB. */
interface IndexedDBConfig<
  S extends readonly ObjectStoreSchema[] = readonly [],
  K extends readonly SecureStoreSchema[] = readonly [],
> {
  dbName: string
  stores?: S
  secureStores?: K
}

/** Internal resolved IndexedDB options. */
interface ResolvedDBOptions<
  S extends readonly ObjectStoreSchema[] = readonly [],
  K extends readonly SecureStoreSchema[] = readonly [],
> {
  dbName: string
  stores: S
  secureStores: K
}

export type {
  Unit,
  TTL,
  StorageConfig,
  StorageKeyOptions,
  CookieConfig,
  CookieKeyOptions,
  SetStorageOptions,
  SetCookieOptions,
  IndexOptions,
  ObjectStoreSchema,
  SecureStoreSchema,
  SecureKeyOptions,
  SecureSetOptions,
  IndexedDBConfig,
  ResolvedStorageOptions,
  ResolvedCookieOptions,
  ResolvedDBOptions,
}
