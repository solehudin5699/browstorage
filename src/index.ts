export { LocalStorage } from './storage/local'
export type { LocalKey } from './storage/local'

export { SessionStorage } from './storage/session'
export type { SessionKey } from './storage/session'

export { CookieStorage } from './storage/cookie'
export type { CookieKey } from './storage/cookie'

export { IndexedDB, ObjectStore, Index, SecureStore } from './storage/indexeddb'
export type { SecureKey } from './storage/indexeddb'

export { parseTTL } from './ttl'
export { encrypt, decrypt } from './encryption'

export type {
  TTL,
  StorageConfig,
  StorageOptions,
  CookieConfig,
  CookieOptions,
  SetStorageOptions,
  SetCookieOptions,
  IndexedDBOptions,
  ObjectStoreSchema,
  SecureStoreSchema,
  SecureKeyOptions,
  IndexOptions,
} from './types'
