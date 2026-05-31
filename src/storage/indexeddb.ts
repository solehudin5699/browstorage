import { encrypt, decrypt } from '../encryption'
import type {
  IndexedDBOptions,
  ObjectStoreSchema,
  SecureStoreSchema,
  SecureKeyOptions,
  ResolvedDBOptions,
} from '../types'
import { parseTTL } from '../ttl'

// ===== Connection Pool =====

const connections = new Map<string, Promise<IDBDatabase>>()

async function ensureSchema(
  db: IDBDatabase,
  dbName: string,
  schema: readonly ObjectStoreSchema[],
): Promise<void> {
  const stored = await getStoredMeta(db)
  if (!stored) return

  if (schemasEqual(stored.schema, schema)) return

  db.close()
  connections.delete(dbName)

  const newVersion = (stored.version ?? 0) + 1
  const promise = openDB(dbName, schema, newVersion)
  connections.set(dbName, promise)
  await promise
}

function getStoredMeta(
  db: IDBDatabase,
): Promise<{ version: number; schema: ObjectStoreSchema[] } | null> {
  if (!db.objectStoreNames.contains('_meta')) return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const tx = db.transaction('_meta', 'readonly')
    const req = tx.objectStore('_meta').get('schema')
    req.onsuccess = () => resolve(req.result?.value ?? null)
    req.onerror = () => reject(req.error)
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
        if (db.objectStoreNames.contains(s.name)) continue

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
    await ensureSchema(db, dbName, schema)
    return db
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
  const S extends readonly ObjectStoreSchema[] = readonly ObjectStoreSchema[],
  const K extends readonly SecureStoreSchema[] = readonly SecureStoreSchema[],
>(
  config?: IndexedDBOptions<S, K>,
): ResolvedDBOptions<S, K> {
  return {
    dbName: config?.dbName ?? 'browstorage',
    stores: (config?.stores ?? []) as S,
    secureStores: (config?.secureStores ?? []) as K,
  }
}

// ===== Factory =====

export class IndexedDB<
  const S extends readonly ObjectStoreSchema[] = readonly ObjectStoreSchema[],
  const K extends readonly SecureStoreSchema[] = readonly SecureStoreSchema[],
> {
  #config: ResolvedDBOptions<S, K>

  constructor(config?: IndexedDBOptions<S, K>) {
    this.#config = resolveConfig(config)
  }

  objectStore<T>(name: S[number]['name']): ObjectStore<T> {
    const schema = this.#config.stores.find(s => s.name === name)
    if (!schema) {
      throw new Error(`[browstorage] Store not found: "${name}"`)
    }
    const allSchemas = mergeSchemas(this.#config.stores, this.#config.secureStores)
    return new ObjectStore<T>(name, schema, this.#config.dbName, allSchemas)
  }

  secureStore<T>(name: K[number]['name']): SecureStore<T> {
    const schema = this.#config.secureStores.find(s => s.name === name)
    if (!schema) {
      throw new Error(`[browstorage] Secure store not found: "${name}"`)
    }
    const allSchemas = mergeSchemas(this.#config.stores, this.#config.secureStores)
    return new SecureStore<T>(name, schema, this.#config.dbName, allSchemas)
  }

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
}

// ===== Object Store =====

export class ObjectStore<T> {
  #name: string
  #schema: ObjectStoreSchema
  #dbName: string
  #schemaList: readonly ObjectStoreSchema[]

  constructor(
    name: string,
    schema: ObjectStoreSchema,
    dbName: string,
    schemaList: readonly ObjectStoreSchema[],
  ) {
    this.#name = name
    this.#schema = schema
    this.#dbName = dbName
    this.#schemaList = schemaList
  }

  async add(record: T): Promise<IDBValidKey> {
    if (typeof indexedDB === 'undefined') return undefined as unknown as IDBValidKey

    return withStore(
      this.#dbName, this.#name, 'readwrite', this.#schemaList,
      store => store.add(record as any),
    )
  }

  async put(record: T): Promise<IDBValidKey> {
    if (typeof indexedDB === 'undefined') return undefined as unknown as IDBValidKey

    return withStore(
      this.#dbName, this.#name, 'readwrite', this.#schemaList,
      store => store.put(record as any),
    )
  }

  async get(key: IDBValidKey): Promise<T | undefined> {
    if (typeof indexedDB === 'undefined') return undefined

    const record = await withStore(
      this.#dbName, this.#name, 'readonly', this.#schemaList,
      store => store.get(key),
    )
    return record as T | undefined
  }

  async delete(key: IDBValidKey): Promise<void> {
    if (typeof indexedDB === 'undefined') return

    await withStore(
      this.#dbName, this.#name, 'readwrite', this.#schemaList,
      store => store.delete(key),
    )
  }

  async getAll(): Promise<T[]> {
    if (typeof indexedDB === 'undefined') return []

    return withStore(
      this.#dbName, this.#name, 'readonly', this.#schemaList,
      store => store.getAll(),
    ) as Promise<T[]>
  }

  async getAllKeys(): Promise<IDBValidKey[]> {
    if (typeof indexedDB === 'undefined') return []

    return withStore(
      this.#dbName, this.#name, 'readonly', this.#schemaList,
      store => store.getAllKeys(),
    ) ?? []
  }

  async count(): Promise<number> {
    if (typeof indexedDB === 'undefined') return 0

    return withStore(
      this.#dbName, this.#name, 'readonly', this.#schemaList,
      store => store.count(),
    )
  }

  async clear(): Promise<void> {
    if (typeof indexedDB === 'undefined') return

    await withStore(
      this.#dbName, this.#name, 'readwrite', this.#schemaList,
      store => store.clear(),
    )
  }

  index(name: string): Index<T> {
    return new Index<T>(this.#name, name, this.#dbName, this.#schemaList)
  }
}

// ===== Index =====

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

  async get(value: IDBValidKey): Promise<T | undefined> {
    if (typeof indexedDB === 'undefined') return undefined

    const record = await withStore(
      this.#dbName, this.#storeName, 'readonly', this.#schemaList,
      store => store.index(this.#indexName).get(value),
    )
    return record as T | undefined
  }

  async getAll(value?: IDBValidKey | IDBKeyRange): Promise<T[]> {
    if (typeof indexedDB === 'undefined') return []

    const records = await withStore(
      this.#dbName, this.#storeName, 'readonly', this.#schemaList,
      store => store.index(this.#indexName).getAll(value),
    )
    return (records ?? []) as T[]
  }

  async getAllKeys(value?: IDBValidKey | IDBKeyRange): Promise<IDBValidKey[]> {
    if (typeof indexedDB === 'undefined') return []

    return withStore(
      this.#dbName, this.#storeName, 'readonly', this.#schemaList,
      store => store.index(this.#indexName).getAllKeys(value),
    ) ?? []
  }

  async count(value?: IDBValidKey | IDBKeyRange): Promise<number> {
    if (typeof indexedDB === 'undefined') return 0

    return withStore(
      this.#dbName, this.#storeName, 'readonly', this.#schemaList,
      store => store.index(this.#indexName).count(value ?? undefined as any),
    )
  }
}

// ===== Secure Store =====

export class SecureStore<T> {
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

  key(key: IDBValidKey, options?: SecureKeyOptions): SecureKey<T> {
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

  async set(value: T): Promise<void> {
    if (typeof indexedDB === 'undefined') return

    const record = prepareSecureValue(value, this.#encryptionKey, this.#ttlMs)
    record.key = this.#key

    await withStore(
      this.#dbName, this.#storeName, 'readwrite', this.#allSchemas,
      store => store.put(record),
    )
  }

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

    return true
  }

  async remove(): Promise<void> {
    if (typeof indexedDB === 'undefined') return

    await withStore(
      this.#dbName, this.#storeName, 'readwrite', this.#allSchemas,
      store => store.delete(this.#key),
    )
  }
}
