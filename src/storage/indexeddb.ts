import { encrypt, decrypt } from '../encryption'
import type {
  IndexedDBConfig,
  ObjectStoreSchema,
  SecureStoreSchema,
  SecureKeyOptions,
  SecureSetOptions,
  ResolvedDBOptions,
} from '../types'
import { parseTTL } from '../ttl'

// ===== Connection Pool =====

const connections = new Map<string, Promise<IDBDatabase>>()
const activeInstances = new Set<string>()

/** @internal Exposed for testing only. */
export function _clearConnections(): void {
  connections.clear()
}

/** @internal Exposed for testing only. */
export function _clearInstances(): void {
  activeInstances.clear()
}

async function readMeta(
  db: IDBDatabase,
): Promise<{ version: number; schema: ObjectStoreSchema[] } | null> {
  if (!db.objectStoreNames.contains('_meta')) return null
  return new Promise((resolve, reject) => {
    const tx = db.transaction('_meta', 'readonly')
    const req = tx.objectStore('_meta').get('schema')
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function writeMeta(
  db: IDBDatabase,
  schema: readonly ObjectStoreSchema[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('_meta', 'readwrite')
    tx.objectStore('_meta').put({
      key: 'schema',
      schema: schema as ObjectStoreSchema[],
      version: db.version,
    })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function schemasEqual(
  a: readonly ObjectStoreSchema[],
  b: readonly ObjectStoreSchema[],
): boolean {
  if (a.length !== b.length) return false

  const key = (s: ObjectStoreSchema) =>
    `${s.name}|${s.keyPath}|${s.autoIncrement ?? false}|${
      JSON.stringify(
        (s.indexes ?? []).map(i => ({
          n: i.name,
          k: i.keyPath,
          u: i.unique ?? false,
          m: i.multiEntry ?? false,
        })).sort((x, y) => x.n.localeCompare(y.n)),
      )
    }`

  const keysA = a.map(key).sort()
  const keysB = b.map(key).sort()
  return keysA.every((k, i) => k === keysB[i])
}

async function indexesMismatch(
  db: IDBDatabase,
  schema: readonly ObjectStoreSchema[],
): Promise<boolean> {
  for (const s of schema) {
    if (!db.objectStoreNames.contains(s.name)) continue
    const tx = db.transaction(s.name)
    const store = tx.objectStore(s.name)
    const actual = Array.from(store.indexNames).sort()
    const expected = (s.indexes ?? []).map(i => i.name).sort()
    if (
      actual.length !== expected.length
      || actual.some((n, i) => n !== expected[i])
    ) {
      return true
    }

    for (const idx of s.indexes ?? []) {
      const actualIdx = store.index(idx.name)
      if (
        actualIdx.unique !== (idx.unique ?? false)
        || actualIdx.multiEntry !== (idx.multiEntry ?? false)
        ||         JSON.stringify(actualIdx.keyPath) !== JSON.stringify(idx.keyPath)
      ) {
        return true
      }
    }
  }
  return false
}

function openDB(
  dbName: string,
  schema: readonly ObjectStoreSchema[],
  version?: number,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = version !== undefined
      ? indexedDB.open(dbName, version)
      : indexedDB.open(dbName)

    req.onupgradeneeded = () => {
      const db = req.result

      if (!db.objectStoreNames.contains('_meta')) {
        db.createObjectStore('_meta', { keyPath: 'key' })
      }

      for (const s of schema) {
        if (db.objectStoreNames.contains(s.name)) {
          const store = req.transaction!.objectStore(s.name)

          for (const idxName of Array.from(store.indexNames)) {
            if (!s.indexes?.some(i => i.name === idxName)) {
              store.deleteIndex(idxName)
            }
          }

          if (s.indexes) {
            for (const idx of s.indexes) {
              if (store.indexNames.contains(idx.name)) {
                const existing = store.index(idx.name)
                const changed =
                  existing.unique !== (idx.unique ?? false) ||
                  existing.multiEntry !== (idx.multiEntry ?? false) ||
                  JSON.stringify(existing.keyPath) !== JSON.stringify(idx.keyPath)
                if (changed) {
                  store.deleteIndex(idx.name)
                  store.createIndex(idx.name, idx.keyPath, {
                    unique: idx.unique ?? false,
                    multiEntry: idx.multiEntry ?? false,
                  })
                }
              } else {
                store.createIndex(idx.name, idx.keyPath, {
                  unique: idx.unique ?? false,
                  multiEntry: idx.multiEntry ?? false,
                })
              }
            }
          }
          continue
        }

        const store = db.createObjectStore(s.name, {
          keyPath: s.keyPath,
          autoIncrement: s.autoIncrement ?? false,
        })

        if (s.indexes) {
          for (const idx of s.indexes) {
            store.createIndex(idx.name, idx.keyPath, {
              unique: idx.unique ?? false,
              multiEntry: idx.multiEntry ?? false,
            })
          }
        }
      }
    }

    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => {
        db.close()
        connections.delete(dbName)
      }
      resolve(db)
    }

    req.onerror = () => {
      connections.delete(dbName)
      reject(req.error)
    }

    req.onblocked = () => {
      console.warn('[browstorage] IndexedDB blocked by another tab')
    }
  })
}

async function getConnection(
  dbName: string,
  schema: readonly ObjectStoreSchema[],
): Promise<IDBDatabase> {
  const cached = connections.get(dbName)
  if (cached) return cached

  const promise = (async () => {
    const db = await openDB(dbName, schema)
    const stored = await readMeta(db)

    if (stored === null) {
      if (db.objectStoreNames.contains('_meta')) {
        if (await indexesMismatch(db, schema)) {
          const newVersion = db.version + 1
          db.close()
          const upgradedPromise = openDB(dbName, schema, newVersion)
          const upgradedDb = await upgradedPromise
          await writeMeta(upgradedDb, schema)
          return upgradedDb
        }
        await writeMeta(db, schema)
        return db
      }
      const newVersion = db.version + 1
      db.close()
      const upgradedDb = await openDB(dbName, schema, newVersion)
      await writeMeta(upgradedDb, schema)
      return upgradedDb
    }

    if (schemasEqual(stored.schema, schema)) return db

    const newVersion = stored.version + 1
    db.close()

    const upgradedPromise = openDB(dbName, schema, newVersion)
    const upgradedDb = await upgradedPromise
    await writeMeta(upgradedDb, schema)
    return upgradedDb
  })()

  connections.set(dbName, promise)

  try {
    return await promise
  } catch (err) {
    connections.delete(dbName)
    throw err
  }
}

// ===== Generic Transaction Helper =====

function withStore<T>(
  dbName: string,
  storeName: string,
  mode: IDBTransactionMode,
  schema: readonly ObjectStoreSchema[],
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return getConnection(dbName, schema).then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const req = fn(tx.objectStore(storeName))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

// ===== Secure Value Helpers =====

function prepareSecureValue<T>(
  value: T,
  encryptionKey: string,
  ttlMs?: number,
): Record<string, unknown> {
  const record: Record<string, unknown> = {
    $data: encrypt(JSON.stringify(value), encryptionKey),
  }
  if (ttlMs !== undefined) {
    record.$exp = Date.now() + ttlMs
  }
  return record
}

async function extractSecureValue<T>(
  record: any,
  encryptionKey: string,
  del: () => Promise<void>,
): Promise<T | undefined> {
  if (record.$exp !== undefined && Date.now() > record.$exp) {
    await del()
    return undefined
  }

  const decrypted = decrypt(record.$data, encryptionKey)
  if (decrypted === null) {
    await del()
    return undefined
  }

  try {
    return JSON.parse(decrypted) as T
  } catch {
    return decrypted as unknown as T
  }
}

// ===== Internal Schema Merge =====

function mergeSchemas(
  stores: readonly ObjectStoreSchema[],
  secureStores: readonly SecureStoreSchema[],
): readonly ObjectStoreSchema[] {
  return [
    ...stores,
    ...secureStores.map(s => ({
      name: s.name,
      keyPath: 'key' as const,
      autoIncrement: false,
    })),
  ]
}

// ===== Config =====

function resolveConfig<
  const S extends readonly ObjectStoreSchema[] = readonly [],
  const K extends readonly SecureStoreSchema[] = readonly [],
>(
  config: IndexedDBConfig<S, K>,
): ResolvedDBOptions<S, K> {
  return {
    dbName: config.dbName,
    stores: (config?.stores ?? []) as S,
    secureStores: (config?.secureStores ?? []) as K,
  }
}

// ===== Factory =====

export class IndexedDB<
  const S extends readonly ObjectStoreSchema[] = readonly [],
  const K extends readonly SecureStoreSchema[] = readonly [],
> {
  #config: ResolvedDBOptions<S, K>

  /**
   * Create an IndexedDB-backed storage instance.
   *
   * Eagerly opens the database connection and runs pending migrations.
   * Only one instance per `dbName` is allowed.
   *
   * @param config - Schema configuration (dbName, stores, secureStores).
   *
   * @throws {Error} If another instance with the same `dbName` already exists.
   */
  constructor(config: IndexedDBConfig<S, K>) {
    this.#config = resolveConfig(config)

    if (!this.#config.dbName) {
      console.error('[browstorage] dbName is required and must be non-empty.')
      throw new Error('[browstorage] dbName is required and must be non-empty.')
    }

    if (activeInstances.has(this.#config.dbName)) {
      console.error(
        `[browstorage] Database name "${this.#config.dbName}" is already in use. ` +
        `Each IndexedDB instance must have a unique dbName.`
      )
      throw new Error(
        `[browstorage] Database name "${this.#config.dbName}" is already in use. ` +
        `Each IndexedDB instance must have a unique dbName.`
      )
    }
    activeInstances.add(this.#config.dbName)

    if (typeof indexedDB !== 'undefined') {
      const allSchemas = mergeSchemas(this.#config.stores, this.#config.secureStores)
      getConnection(this.#config.dbName, allSchemas)
    }
  }

  /**
   * Get an object store for CRUD operations and secondary index queries.
   *
   * @param name - Store name (must match a `stores` entry in the config).
   * @returns An ObjectStore scoped to the given store name.
   *
   * @throws {Error} If the store name is not defined in the schema config.
   */
  objectStore<T>(name: S[number]['name']): ObjectStore<T> {
    const schema = this.#config.stores.find(s => s.name === name)
    if (!schema) {
      console.error(`[browstorage] Store not found: "${name}"`)
      throw new Error(`[browstorage] Store not found: "${name}"`)
    }
    const allSchemas = mergeSchemas(this.#config.stores, this.#config.secureStores)
    return new ObjectStore<T>(name, schema, this.#config.dbName, allSchemas)
  }

  /**
   * Get a secure store for encrypted key-value access.
   *
   * @param name - Secure store name (must match a `secureStores` entry in the config).
   * @returns A SecureStore scoped to the given store name.
   *
   * @throws {Error} If the secure store name is not defined in the schema config.
   */
  secureStore(name: K[number]['name']): SecureStore {
    const schema = this.#config.secureStores.find(s => s.name === name)
    if (!schema) {
      console.error(`[browstorage] Secure store not found: "${name}"`)
      throw new Error(`[browstorage] Secure store not found: "${name}"`)
    }
    const allSchemas = mergeSchemas(this.#config.stores, this.#config.secureStores)
    return new SecureStore(name, schema, this.#config.dbName, allSchemas)
  }

  /**
   * Remove all data from every store (excluding the internal `_meta` store).
   */
  async clear(): Promise<void> {
    if (typeof indexedDB === 'undefined') return

    const allSchemas = mergeSchemas(this.#config.stores, this.#config.secureStores)
    const db = await getConnection(this.#config.dbName, allSchemas)
    const storeNames = Array.from(db.objectStoreNames).filter(
      n => n !== '_meta',
    )

    for (const name of storeNames) {
      await withStore(
        this.#config.dbName, name, 'readwrite', allSchemas,
        store => store.clear(),
      )
    }
  }

  /**
   * Total number of records across all stores.
   */
  async size(): Promise<number> {
    if (typeof indexedDB === 'undefined') return 0

    const allSchemas = mergeSchemas(this.#config.stores, this.#config.secureStores)
    let total = 0
    for (const s of allSchemas) {
      const count = await withStore(
        this.#config.dbName, s.name, 'readonly', allSchemas,
        store => store.count(),
      )
      total += count
    }
    return total
  }

  /**
   * Close the database connection.
   *
   * After calling `close()`, the instance is removed from the connection pool.
   * A new `IndexedDB` instance must be created to interact with the database again.
   */
  async close(): Promise<void> {
    activeInstances.delete(this.#config.dbName)

    const promise = connections.get(this.#config.dbName)
    if (!promise) return

    const db = await promise
    db.close()
    connections.delete(this.#config.dbName)
  }
}

// ===== Object Store =====

/**
 * An object store for CRUD operations with secondary index support.
 *
 * Each ObjectStore maps to a single IndexedDB object store defined in the schema.
 */
export class ObjectStore<T> {
  #name: string
  #dbName: string
  #schemaList: readonly ObjectStoreSchema[]

  constructor(
    name: string,
    _schema: ObjectStoreSchema,
    dbName: string,
    schemaList: readonly ObjectStoreSchema[],
  ) {
    this.#name = name
    this.#dbName = dbName
    this.#schemaList = schemaList
  }

  /**
   * Insert a new record.
   *
   * @param record - The record to add. Must include the primary key unless `autoIncrement` is enabled.
   * @returns The primary key of the inserted record.
   *
   * @throws {Error} If a record with the same key already exists.
   */
  async add(record: T): Promise<IDBValidKey> {
    if (typeof indexedDB === 'undefined') return undefined as unknown as IDBValidKey

    return withStore(
      this.#dbName, this.#name, 'readwrite', this.#schemaList,
      store => store.add(record as any),
    )
  }

  /**
   * Insert or replace a record.
   *
   * Unlike `add()`, `put()` will overwrite an existing record with the same key.
   *
   * @param record - The record to store.
   * @returns The primary key.
   */
  async put(record: T): Promise<IDBValidKey> {
    if (typeof indexedDB === 'undefined') return undefined as unknown as IDBValidKey

    return withStore(
      this.#dbName, this.#name, 'readwrite', this.#schemaList,
      store => store.put(record as any),
    )
  }

  /**
   * Retrieve a record by its primary key.
   *
   * @param key - The primary key value.
   * @returns The record, or `undefined` if not found.
   */
  async get(key: IDBValidKey): Promise<T | undefined> {
    if (typeof indexedDB === 'undefined') return undefined

    const record = await withStore(
      this.#dbName, this.#name, 'readonly', this.#schemaList,
      store => store.get(key),
    )
    return record as T | undefined
  }

  /**
   * Delete a record by its primary key.
   *
   * @param key - The primary key value.
   */
  async delete(key: IDBValidKey): Promise<void> {
    if (typeof indexedDB === 'undefined') return

    await withStore(
      this.#dbName, this.#name, 'readwrite', this.#schemaList,
      store => store.delete(key),
    )
  }

  /**
   * Retrieve all records in the store.
   */
  async getAll(): Promise<T[]> {
    if (typeof indexedDB === 'undefined') return []

    return withStore(
      this.#dbName, this.#name, 'readonly', this.#schemaList,
      store => store.getAll(),
    ) as Promise<T[]>
  }

  /**
   * Retrieve all primary keys in the store.
   */
  async getAllKeys(): Promise<IDBValidKey[]> {
    if (typeof indexedDB === 'undefined') return []

    return withStore(
      this.#dbName, this.#name, 'readonly', this.#schemaList,
      store => store.getAllKeys(),
    ) ?? []
  }

  /**
   * Count the number of records in the store.
   */
  async count(): Promise<number> {
    if (typeof indexedDB === 'undefined') return 0

    return withStore(
      this.#dbName, this.#name, 'readonly', this.#schemaList,
      store => store.count(),
    )
  }

  /**
   * Remove all records from this store.
   */
  async clear(): Promise<void> {
    if (typeof indexedDB === 'undefined') return

    await withStore(
      this.#dbName, this.#name, 'readwrite', this.#schemaList,
      store => store.clear(),
    )
  }

  /**
   * Access a secondary index for querying records by index values.
   *
   * @param name - The index name (must be defined in the store schema).
   * @returns An Index scoped to this store and index.
   */
  index(name: string): Index<T> {
    return new Index<T>(this.#name, name, this.#dbName, this.#schemaList)
  }
}

// ===== Index =====

/**
 * A secondary index on an object store for querying by index values.
 *
 * Indexes are defined statically in the store schema and cannot be created at runtime.
 */
export class Index<T> {
  #storeName: string
  #indexName: string
  #dbName: string
  #schemaList: readonly ObjectStoreSchema[]

  constructor(
    storeName: string,
    indexName: string,
    dbName: string,
    schemaList: readonly ObjectStoreSchema[],
  ) {
    this.#storeName = storeName
    this.#indexName = indexName
    this.#dbName = dbName
    this.#schemaList = schemaList
  }

  /**
   * Retrieve the first record matching the given index value.
   *
   * @param value - The index value to match.
   * @returns The first matching record, or `undefined` if none found.
   */
  async get(value: IDBValidKey): Promise<T | undefined> {
    if (typeof indexedDB === 'undefined') return undefined

    const record = await withStore(
      this.#dbName, this.#storeName, 'readonly', this.#schemaList,
      store => store.index(this.#indexName).get(value),
    )
    return record as T | undefined
  }

  /**
   * Retrieve all records matching the given index value.
   *
   * @param value - The index value to match (optional — omitting returns all records).
   * @returns An array of matching records.
   */
  async getAll(value?: IDBValidKey | IDBKeyRange): Promise<T[]> {
    if (typeof indexedDB === 'undefined') return []

    const records = await withStore(
      this.#dbName, this.#storeName, 'readonly', this.#schemaList,
      store => store.index(this.#indexName).getAll(value),
    )
    return (records ?? []) as T[]
  }

  /**
   * Retrieve all primary keys for records matching the given index value.
   *
   * @param value - The index value to match (optional).
   * @returns An array of primary keys.
   */
  async getAllKeys(value?: IDBValidKey | IDBKeyRange): Promise<IDBValidKey[]> {
    if (typeof indexedDB === 'undefined') return []

    return withStore(
      this.#dbName, this.#storeName, 'readonly', this.#schemaList,
      store => store.index(this.#indexName).getAllKeys(value),
    ) ?? []
  }

  /**
   * Count records matching the given index value.
   *
   * @param value - The index value to match (optional — omitting counts all records).
   * @returns The number of matching records.
   */
  async count(value?: IDBValidKey | IDBKeyRange): Promise<number> {
    if (typeof indexedDB === 'undefined') return 0

    return withStore(
      this.#dbName, this.#storeName, 'readonly', this.#schemaList,
      store => store.index(this.#indexName).count(value ?? undefined as any),
    )
  }
}

// ===== Secure Store =====

/**
 * An encrypted key-value store backed by IndexedDB.
 *
 * Each value is encrypted with AES-CBC (via crypto-js) before being stored.
 * TTL can be configured at the schema level, per-key, or per-set.
 */
export class SecureStore {
  #name: string
  #schema: SecureStoreSchema
  #dbName: string
  #allSchemas: readonly ObjectStoreSchema[]

  constructor(
    name: string,
    schema: SecureStoreSchema,
    dbName: string,
    allSchemas: readonly ObjectStoreSchema[],
  ) {
    this.#name = name
    this.#schema = schema
    this.#dbName = dbName
    this.#allSchemas = allSchemas
  }

  /**
   * Create a per-key binding for the given key.
   *
   * @param key - Key identifier used to store/retrieve the encrypted record.
   * @param options - Per-key options (TTL overrides schema default).
   * @returns A SecureKey scoped to the given key.
   */
  key<T>(key: IDBValidKey, options?: SecureKeyOptions): SecureKey<T> {
    let ttlMs: number | undefined
    if (options?.ttl !== undefined) {
      ttlMs = parseTTL(options.ttl)
    } else if (this.#schema.ttl !== undefined) {
      ttlMs = parseTTL(this.#schema.ttl)
    }

    return new SecureKey<T>(
      this.#name,
      key,
      this.#schema.encryptionKey,
      this.#dbName,
      this.#allSchemas,
      ttlMs,
    )
  }
}

/**
 * A single encrypted key-value binding with TTL support.
 *
 * All values are encrypted at rest using AES-CBC + EvpKDF key derivation (crypto-js).
 * `has()` checks existence and expiry without decrypting.
 */
export class SecureKey<T> {
  #storeName: string
  #key: IDBValidKey
  #encryptionKey: string
  #dbName: string
  #allSchemas: readonly ObjectStoreSchema[]
  #ttlMs?: number

  constructor(
    storeName: string,
    key: IDBValidKey,
    encryptionKey: string,
    dbName: string,
    allSchemas: readonly ObjectStoreSchema[],
    ttlMs?: number,
  ) {
    this.#storeName = storeName
    this.#key = key
    this.#encryptionKey = encryptionKey
    this.#dbName = dbName
    this.#allSchemas = allSchemas
    this.#ttlMs = ttlMs
  }

  /**
   * Encrypt and store a value.
   *
   * @param value - The value to store. Passing `undefined` is equivalent to calling `remove()`.
   * @param options - Per-set options (TTL overrides key-level and schema defaults).
   */
  async set(value: T, options?: SecureSetOptions): Promise<void> {
    if (typeof indexedDB === 'undefined') return
    if (value === undefined) { await this.remove(); return }

    const ttlMs = options?.ttl !== undefined ? parseTTL(options.ttl) : this.#ttlMs
    const record = prepareSecureValue(value, this.#encryptionKey, ttlMs)
    record.key = this.#key

    await withStore(
      this.#dbName, this.#storeName, 'readwrite', this.#allSchemas,
      store => store.put(record),
    )
  }

  /**
   * Retrieve and decrypt the stored value.
   *
   * Automatically removes the key if expired or if the encryption key is incorrect.
   *
   * @returns The decrypted value, or `undefined` if missing / expired / wrong key.
   */
  async get(): Promise<T | undefined> {
    if (typeof indexedDB === 'undefined') return undefined

    const record = await withStore(
      this.#dbName, this.#storeName, 'readonly', this.#allSchemas,
      store => store.get(this.#key),
    )
    if (!record) return undefined

    return extractSecureValue<T>(record, this.#encryptionKey, async () => {
      await withStore(
        this.#dbName, this.#storeName, 'readwrite', this.#allSchemas,
        store => store.delete(this.#key),
      )
    })
  }

  /**
   * Check if the key exists and has not expired.
   *
   * Automatically removes the key if expired or if the encryption key is incorrect.
   *
   * @returns `true` if the key exists and is still valid.
   */
  async has(): Promise<boolean> {
    if (typeof indexedDB === 'undefined') return false

    const record = await withStore(
      this.#dbName, this.#storeName, 'readonly', this.#allSchemas,
      store => store.get(this.#key),
    )
    if (!record) return false

    if (record.$exp !== undefined && Date.now() > record.$exp) {
      await withStore(
        this.#dbName, this.#storeName, 'readwrite', this.#allSchemas,
        store => store.delete(this.#key),
      )
      return false
    }

    const decrypted = decrypt(record.$data, this.#encryptionKey)
    if (decrypted === null) {
      await withStore(
        this.#dbName, this.#storeName, 'readwrite', this.#allSchemas,
        store => store.delete(this.#key),
      )
      return false
    }

    return true
  }

  /**
   * Delete the key and its encrypted value from the store.
   */
  async remove(): Promise<void> {
    if (typeof indexedDB === 'undefined') return

    await withStore(
      this.#dbName, this.#storeName, 'readwrite', this.#allSchemas,
      store => store.delete(this.#key),
    )
  }
}
