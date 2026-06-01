import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { IndexedDB, _clearConnections, _clearInstances } from '../storage/indexeddb'

async function deleteDB(name: string): Promise<void> {
  _clearInstances()
  _clearConnections()
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

interface User {
  id: number
  name: string
  age: number
}

interface Product {
  sku: string
  name: string
  category: string
  price: number
}

function createDB(stores?: any, secureStores?: any) {
  return new IndexedDB({
    dbName: 'test-db',
    stores: stores ?? [
      { name: 'users', keyPath: 'id', autoIncrement: true },
      { name: 'products', keyPath: 'sku', indexes: [{ name: 'byCat', keyPath: 'category' }] },
    ],
    secureStores: secureStores ?? [
      { name: 'sessions', encryptionKey: 'secret-key' },
    ],
  })
}

// ===== ObjectStore =====

describe('ObjectStore — basic CRUD', () => {
  beforeEach(async () => {
    await deleteDB('test-db')
  })

  it('adds and gets a record', async () => {
    const db = createDB()
    const users = db.objectStore<User>('users')
    const id = await users.add({ id: 1, name: 'Alice', age: 30 })
    const got = await users.get(id)
    expect(got).toEqual({ id: 1, name: 'Alice', age: 30 })
  })

  it('adds with auto-increment key', async () => {
    const db = createDB()
    const users = db.objectStore<User>('users')
    const id1 = await users.add({ name: 'Alice', age: 30 } as any)
    const id2 = await users.add({ name: 'Bob', age: 25 } as any)
    expect(id1).toBe(1)
    expect(id2).toBe(2)
  })

  it('updates a record with put', async () => {
    const db = createDB()
    const users = db.objectStore<User>('users')
    await users.add({ id: 1, name: 'Alice', age: 30 })
    await users.put({ id: 1, name: 'Alice Updated', age: 31 })
    const got = await users.get(1)
    expect(got).toEqual({ id: 1, name: 'Alice Updated', age: 31 })
  })

  it('deletes a record', async () => {
    const db = createDB()
    const users = db.objectStore<User>('users')
    await users.add({ id: 1, name: 'Alice', age: 30 })
    await users.delete(1)
    expect(await users.get(1)).toBeUndefined()
  })

  it('getAll returns all records', async () => {
    const db = createDB()
    const users = db.objectStore<User>('users')
    await users.add({ id: 1, name: 'Alice', age: 30 })
    await users.add({ id: 2, name: 'Bob', age: 25 })
    const all = await users.getAll()
    expect(all).toHaveLength(2)
    expect(all.find(u => u.id === 1)!.name).toBe('Alice')
    expect(all.find(u => u.id === 2)!.name).toBe('Bob')
  })

  it('getAllKeys returns all keys', async () => {
    const db = createDB()
    const users = db.objectStore<User>('users')
    await users.add({ id: 1, name: 'Alice', age: 30 })
    await users.add({ id: 5, name: 'Bob', age: 25 })
    const keys = await users.getAllKeys()
    expect(keys).toEqual([1, 5])
  })

  it('count returns number of records', async () => {
    const db = createDB()
    const users = db.objectStore<User>('users')
    expect(await users.count()).toBe(0)
    await users.add({ id: 1, name: 'Alice', age: 30 })
    expect(await users.count()).toBe(1)
    await users.add({ id: 2, name: 'Bob', age: 25 })
    expect(await users.count()).toBe(2)
  })

  it('clear removes all records', async () => {
    const db = createDB()
    const users = db.objectStore<User>('users')
    await users.add({ id: 1, name: 'Alice', age: 30 })
    await users.add({ id: 2, name: 'Bob', age: 25 })
    await users.clear()
    expect(await users.count()).toBe(0)
  })

  it('returns undefined for missing key', async () => {
    const db = createDB()
    const users = db.objectStore<User>('users')
    expect(await users.get(999)).toBeUndefined()
  })

  it('throws for unknown store', () => {
    const db = createDB()
    expect(() => db.objectStore('ghost' as any)).toThrow('Store not found')
  })
})

describe('ObjectStore — Index', () => {
  beforeEach(async () => {
    await deleteDB('test-db')
  })

  it('index.get() looks up by index value', async () => {
    const db = createDB()
    const products = db.objectStore<Product>('products')
    await products.add({ sku: 'a', name: 'Apple', category: 'fruit', price: 1 })
    await products.add({ sku: 'b', name: 'Banana', category: 'fruit', price: 2 })
    await products.add({ sku: 'c', name: 'Carrot', category: 'veggie', price: 3 })

    const byCat = products.index('byCat')
    const result = await byCat.get('fruit')
    expect(result).toBeTruthy()
    expect(result!.category).toBe('fruit')
  })

  it('index.getAll() returns all matching records', async () => {
    const db = createDB()
    const products = db.objectStore<Product>('products')
    await products.add({ sku: 'a', name: 'Apple', category: 'fruit', price: 1 })
    await products.add({ sku: 'b', name: 'Banana', category: 'fruit', price: 2 })
    await products.add({ sku: 'c', name: 'Carrot', category: 'veggie', price: 3 })

    const byCat = products.index('byCat')
    const fruits = await byCat.getAll('fruit')
    expect(fruits).toHaveLength(2)
    expect(fruits.map(f => f.sku).sort()).toEqual(['a', 'b'])

    const veggies = await byCat.getAll('veggie')
    expect(veggies).toHaveLength(1)
    expect(veggies[0].sku).toBe('c')
  })

  it('index.getAllKeys() returns keys for matching entries', async () => {
    const db = createDB()
    const products = db.objectStore<Product>('products')
    await products.add({ sku: 'a', name: 'Apple', category: 'fruit', price: 1 })
    await products.add({ sku: 'b', name: 'Banana', category: 'fruit', price: 2 })

    const byCat = products.index('byCat')
    const keys = await byCat.getAllKeys('fruit')
    expect(keys).toEqual(['a', 'b'])
  })

  it('index.count() returns count for matching entries', async () => {
    const db = createDB()
    const products = db.objectStore<Product>('products')
    await products.add({ sku: 'a', name: 'Apple', category: 'fruit', price: 1 })
    await products.add({ sku: 'b', name: 'Banana', category: 'fruit', price: 2 })
    await products.add({ sku: 'c', name: 'Carrot', category: 'veggie', price: 3 })

    const byCat = products.index('byCat')
    expect(await byCat.count('fruit')).toBe(2)
    expect(await byCat.count('veggie')).toBe(1)
    expect(await byCat.count('unknown')).toBe(0)
  })

  it('index.get() returns undefined for missing value', async () => {
    const db = createDB()
    const products = db.objectStore<Product>('products')
    const byCat = products.index('byCat')
    expect(await byCat.get('nonexistent')).toBeUndefined()
  })
})

// ===== IndexedDB Factory =====

describe('IndexedDB (factory)', () => {
  beforeEach(async () => {
    await deleteDB('test-db')
  })

  it('clear() removes all data from all stores', async () => {
    const db = createDB()
    const users = db.objectStore<User>('users')
    const products = db.objectStore<Product>('products')
    await users.add({ id: 1, name: 'Alice', age: 30 })
    await products.add({ sku: 'a', name: 'Apple', category: 'fruit', price: 1 })
    await db.clear()
    expect(await users.count()).toBe(0)
    expect(await products.count()).toBe(0)
  })

  it('size() returns 0 for empty storage', async () => {
    const db = createDB()
    expect(await db.size()).toBe(0)
  })

  it('size() increases after adding records', async () => {
    const db = createDB()
    const users = db.objectStore<User>('users')
    expect(await db.size()).toBe(0)
    await users.add({ id: 1, name: 'Alice', age: 30 })
    expect(await db.size()).toBe(1)
    await users.add({ id: 2, name: 'Bob', age: 25 })
    expect(await db.size()).toBe(2)
  })

  it('size() includes secure store records', async () => {
    const db = createDB()
    const sessions = db.secureStore('sessions')
    await sessions.key('alice').set({ role: 'admin' })
    expect(await db.size()).toBe(1)
  })

  it('clear() removes secure store records too', async () => {
    const db = createDB()
    const sessions = db.secureStore('sessions')
    await sessions.key('alice').set({ role: 'admin' })
    await db.clear()
    expect(await db.size()).toBe(0)
  })

  it('throws when creating second instance with same dbName', async () => {
    const db1 = createDB()
    expect(() => new IndexedDB({ dbName: 'test-db' })).toThrow(
      'Database name "test-db" is already in use',
    )
    // Cleanup
    await db1.close()
  })
})

// ===== SSR Guard =====

describe('SSR guard', () => {
  beforeEach(async () => {
    await deleteDB('test-db')
  })

  it('objectStore methods are safe', async () => {
    const idb = globalThis.indexedDB
    ;(globalThis as any).indexedDB = undefined

    const db = createDB()
    const users = db.objectStore<User>('users')
    expect(await users.get(1)).toBeUndefined()
    expect(await users.getAll()).toEqual([])
    expect(await users.getAllKeys()).toEqual([])
    expect(await users.count()).toBe(0)
    expect(await users.add({ id: 1, name: 'Alice', age: 30 })).toBeUndefined()
    await expect(users.delete(1)).resolves.toBeUndefined()
    await expect(users.clear()).resolves.toBeUndefined()

    const products = db.objectStore<Product>('products')
    const byCat = products.index('byCat')
    expect(await byCat.get('fruit')).toBeUndefined()
    expect(await byCat.getAll('fruit')).toEqual([])
    expect(await byCat.getAllKeys('fruit')).toEqual([])
    expect(await byCat.count('fruit')).toBe(0)

    globalThis.indexedDB = idb
  })

  it('secure store methods are safe', async () => {
    const idb = globalThis.indexedDB
    ;(globalThis as any).indexedDB = undefined

    const db = createDB()
    const sessions = db.secureStore('sessions')
    const key = sessions.key('test')
    await expect(key.set('value')).resolves.toBeUndefined()
    expect(await key.get()).toBeUndefined()
    expect(await key.has()).toBe(false)
    await expect(key.remove()).resolves.toBeUndefined()

    globalThis.indexedDB = idb
  })

  it('factory clear() and size() are safe', async () => {
    const idb = globalThis.indexedDB
    ;(globalThis as any).indexedDB = undefined

    const db = createDB()
    await expect(db.clear()).resolves.toBeUndefined()
    expect(await db.size()).toBe(0)

    globalThis.indexedDB = idb
  })
})

// ===== Migration =====

describe('Migration', () => {
  beforeEach(async () => {
    await deleteDB('mig-test')
  })

  it('adds index to existing store via migration', async () => {
    const db1 = new IndexedDB({
      dbName: 'mig-test',
      stores: [{ name: 'users', keyPath: 'id' }],
    })
    const users1 = db1.objectStore<User>('users')
    await users1.add({ id: 1, name: 'Alice', age: 30 })
    await users1.add({ id: 2, name: 'Bob', age: 25 })
    await db1.close()

    const db2 = new IndexedDB({
      dbName: 'mig-test',
      stores: [{
        name: 'users', keyPath: 'id',
        indexes: [{ name: 'byName', keyPath: 'name' }],
      }],
    })
    const users2 = db2.objectStore<User>('users')

    const found = await users2.index('byName').get('Bob')
    expect(found).toEqual({ id: 2, name: 'Bob', age: 25 })
    expect(await users2.get(1)).toEqual({ id: 1, name: 'Alice', age: 30 })
    await db2.close()
  })

  it('adds new store via migration', async () => {
    const db1 = new IndexedDB({
      dbName: 'mig-test',
      stores: [{ name: 'users', keyPath: 'id' }],
    })
    await db1.objectStore('users').add({ id: 1, name: 'Alice', age: 30 })
    await db1.close()

    const db2 = new IndexedDB({
      dbName: 'mig-test',
      stores: [
        { name: 'users', keyPath: 'id' },
        { name: 'products', keyPath: 'sku' },
      ],
    })
    await db2.objectStore('products').add({
      sku: 'p1', name: 'Widget', category: 'tools', price: 10,
    })

    expect(await db2.objectStore('users').count()).toBe(1)
    expect(await db2.objectStore('products').count()).toBe(1)
    await db2.close()
  })

  it('data persists when schema unchanged', async () => {
    const db1 = new IndexedDB({
      dbName: 'mig-test',
      stores: [{ name: 'users', keyPath: 'id' }],
    })
    await db1.objectStore('users').add({ id: 1, name: 'Alice', age: 30 })
    await db1.close()

    const db2 = new IndexedDB({
      dbName: 'mig-test',
      stores: [{ name: 'users', keyPath: 'id' }],
    })
    expect(await db2.objectStore('users').get(1)).toEqual({
      id: 1, name: 'Alice', age: 30,
    })
    await db2.close()
  })

  it('meta version increments on schema change', async () => {
    const db1 = new IndexedDB({
      dbName: 'mig-test',
      stores: [{ name: 'items', keyPath: 'id' }],
    })
    await db1.objectStore('items').add({ id: 1 })
    await db1.close()

    const db2 = new IndexedDB({
      dbName: 'mig-test',
      stores: [{
        name: 'items', keyPath: 'id',
        indexes: [{ name: 'byVal', keyPath: 'value' }],
      }],
    })
    await db2.objectStore('items').count()
    await db2.close()

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('mig-test')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const meta = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction('_meta', 'readonly')
      const req = tx.objectStore('_meta').get('schema')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    expect(meta.version).toBe(2)
    expect(meta.schema).toHaveLength(1)
    expect(meta.schema[0].indexes).toEqual([{ name: 'byVal', keyPath: 'value' }])
  })

  it('supports multiple sequential migrations', async () => {
    const db1 = new IndexedDB({
      dbName: 'mig-test',
      stores: [{ name: 'doc', keyPath: 'id' }],
    })
    await db1.objectStore('doc').add({ id: 1, title: 'First' })
    await db1.close()

    const db2 = new IndexedDB({
      dbName: 'mig-test',
      stores: [{
        name: 'doc', keyPath: 'id',
        indexes: [{ name: 'byTitle', keyPath: 'title' }],
      }],
    })
    await db2.objectStore('doc').add({ id: 2, title: 'Second' })
    await db2.close()

    const db3 = new IndexedDB({
      dbName: 'mig-test',
      stores: [{
        name: 'doc', keyPath: 'id',
        indexes: [
          { name: 'byTitle', keyPath: 'title' },
          { name: 'byId', keyPath: 'id' },
        ],
      }],
    })
    const docs = db3.objectStore('doc')
    expect(await docs.index('byTitle').get('First')).toEqual({
      id: 1, title: 'First',
    })
    expect(await docs.index('byId').get(2)).toEqual({
      id: 2, title: 'Second',
    })
    await db3.close()
  })

  it('removes index from existing store via migration', async () => {
    const db1 = new IndexedDB({
      dbName: 'mig-test',
      stores: [{
        name: 'users', keyPath: 'id',
        indexes: [{ name: 'byName', keyPath: 'name' }],
      }],
    })
    await db1.objectStore('users').add({ id: 1, name: 'Alice' })
    await db1.close()

    const db2 = new IndexedDB({
      dbName: 'mig-test',
      stores: [{ name: 'users', keyPath: 'id' }],
    })
    await expect(db2.objectStore('users').count()).resolves.toBe(1)
    expect(await db2.objectStore('users').get(1)).toEqual({ id: 1, name: 'Alice' })
    await db2.close()
  })

  it('adds and removes indexes in same migration', async () => {
    const db1 = new IndexedDB({
      dbName: 'mig-test',
      stores: [{
        name: 'docs', keyPath: 'id',
        indexes: [
          { name: 'byTitle', keyPath: 'title' },
          { name: 'byAuthor', keyPath: 'author' },
        ],
      }],
    })
    await db1.objectStore('docs').add({ id: 1, title: 'A', author: 'X' })
    await db1.objectStore('docs').add({ id: 2, title: 'B', author: 'Y' })
    await db1.close()

    const db2 = new IndexedDB({
      dbName: 'mig-test',
      stores: [{
        name: 'docs', keyPath: 'id',
        indexes: [
          { name: 'byAuthor', keyPath: 'author' },
          { name: 'byId', keyPath: 'id' },
        ],
      }],
    })
    const docs = db2.objectStore('docs')
    expect(await docs.index('byAuthor').get('X')).toEqual({ id: 1, title: 'A', author: 'X' })
    expect(await docs.index('byId').get(2)).toEqual({ id: 2, title: 'B', author: 'Y' })
    await expect(docs.index('byTitle').get('A')).rejects.toThrow()
    await db2.close()
  })

  it('migrates index removal when _meta lacks schema record (old code compat)', async () => {
    await deleteDB('mig-test-old')

    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('mig-test-old', 1)
      req.onupgradeneeded = () => {
        const db = req.result
        const store = db.createObjectStore('users', { keyPath: 'id' })
        store.createIndex('byName', 'name')
        store.createIndex('byRole', 'role')
        store.createIndex('byEmail', 'email')
        db.createObjectStore('_meta', { keyPath: 'key' })
      }
      req.onsuccess = () => {
        req.result.close()
        resolve()
      }
      req.onerror = () => reject(req.error)
    })

    const db = new IndexedDB({
      dbName: 'mig-test-old',
      stores: [{
        name: 'users', keyPath: 'id',
        indexes: [
          { name: 'byName', keyPath: 'name' },
          { name: 'byRole', keyPath: 'role' },
        ],
      }],
    })

    const users = db.objectStore('users')
    await users.add({ id: 1, name: 'Alice', role: 'admin', email: 'alice@x.com' })

    await expect(users.index('byEmail').get('alice@x.com')).rejects.toThrow()
    expect(await users.index('byName').get('Alice')).toEqual({
      id: 1, name: 'Alice', role: 'admin', email: 'alice@x.com',
    })
    expect(await users.index('byRole').get('admin')).toEqual({
      id: 1, name: 'Alice', role: 'admin', email: 'alice@x.com',
    })

    await db.close()
    await deleteDB('mig-test-old')
  })

  it('removes all indexes (writeMeta path) — verified via raw indexNames', async () => {
    await deleteDB('mig-test-idx')

    const db1 = new IndexedDB({
      dbName: 'mig-test-idx',
      stores: [{
        name: 'users', keyPath: 'id',
        indexes: [
          { name: 'byName', keyPath: 'name' },
          { name: 'byRole', keyPath: 'role' },
          { name: 'byEmail', keyPath: 'email' },
        ],
      }],
    })
    await db1.objectStore('users').add({ id: 1, name: 'A' })
    await db1.close()

    const db2 = new IndexedDB({
      dbName: 'mig-test-idx',
      stores: [{ name: 'users', keyPath: 'id' }],
    })
    await db2.objectStore('users').get(1)
    await db2.close()

    const raw = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('mig-test-idx')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const idxNames = Array.from(raw.transaction('users').objectStore('users').indexNames)
    raw.close()
    await deleteDB('mig-test-idx')
    expect(idxNames).toEqual([])
  })

  it('removes partial indexes (writeMeta path) — verified via raw indexNames', async () => {
    await deleteDB('mig-test-idx')

    const db1 = new IndexedDB({
      dbName: 'mig-test-idx',
      stores: [{
        name: 'users', keyPath: 'id',
        indexes: [
          { name: 'byName', keyPath: 'name' },
          { name: 'byRole', keyPath: 'role' },
          { name: 'byEmail', keyPath: 'email' },
        ],
      }],
    })
    await db1.objectStore('users').add({ id: 1, name: 'A' })
    await db1.close()

    const db2 = new IndexedDB({
      dbName: 'mig-test-idx',
      stores: [{
        name: 'users', keyPath: 'id',
        indexes: [
          { name: 'byName', keyPath: 'name' },
          { name: 'byEmail', keyPath: 'email' },
        ],
      }],
    })
    await db2.objectStore('users').get(1)
    await db2.close()

    const raw = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('mig-test-idx')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const idxNames = Array.from(raw.transaction('users').objectStore('users').indexNames).sort()
    raw.close()
    await deleteDB('mig-test-idx')
    expect(idxNames).toEqual(['byEmail', 'byName'])
  })

  it('removes all indexes (first-time / old code path) — verified via raw indexNames', async () => {
    await deleteDB('mig-test-old-idx')

    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('mig-test-old-idx', 1)
      req.onupgradeneeded = () => {
        const db = req.result
        const store = db.createObjectStore('users', { keyPath: 'id' })
        store.createIndex('byName', 'name')
        store.createIndex('byRole', 'role')
        store.createIndex('byEmail', 'email')
        db.createObjectStore('_meta', { keyPath: 'key' })
      }
      req.onsuccess = () => { req.result.close(); resolve() }
      req.onerror = () => reject(req.error)
    })

    const db = new IndexedDB({
      dbName: 'mig-test-old-idx',
      stores: [{ name: 'users', keyPath: 'id' }],
    })
    await db.objectStore('users').add({ id: 1, name: 'A' })
    await db.close()

    const raw = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('mig-test-old-idx')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const idxNames = Array.from(raw.transaction('users').objectStore('users').indexNames)
    raw.close()
    await deleteDB('mig-test-old-idx')
    expect(idxNames).toEqual([])
  })

  it('user scenario: autoIncrement + secureStores + 0 indexes — verified via raw indexNames', async () => {
    await deleteDB('mig-test-user')

    const db1 = new IndexedDB({
      dbName: 'mig-test-user',
      stores: [{
        name: 'users', keyPath: 'id', autoIncrement: true,
        indexes: [
          { name: 'name', keyPath: 'name' },
          { name: 'role_idx', keyPath: 'role' },
          { name: 'address_idx', keyPath: 'address' },
        ],
      }],
      secureStores: [{ name: 'sessions', encryptionKey: 'secret', ttl: '24h' }],
    })
    await db1.objectStore('users').add({ name: 'A' } as any)
    await db1.close()

    const db2 = new IndexedDB({
      dbName: 'mig-test-user',
      stores: [{
        name: 'users', keyPath: 'id', autoIncrement: true,
      }],
      secureStores: [{ name: 'sessions', encryptionKey: 'secret', ttl: '24h' }],
    })
    await db2.objectStore('users').add({ name: 'B' } as any)
    await db2.close()

    const raw = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('mig-test-user')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const idxNames = Array.from(raw.transaction('users').objectStore('users').indexNames)
    raw.close()
    await deleteDB('mig-test-user')
    expect(idxNames).toEqual([])
  })
})

// ===== SecureStore / SecureKey =====

describe('SecureStore', () => {
  beforeEach(async () => {
    await deleteDB('test-db')
  })

  it('sets and gets a string value', async () => {
    const db = createDB()
    const sessions = db.secureStore('sessions')
    await sessions.key('token').set('hello')
    expect(await sessions.key('token').get()).toBe('hello')
  })

  it('sets and gets an object', async () => {
    const db = createDB()
    const sessions = db.secureStore('sessions')
    await sessions.key('alice').set({ role: 'admin', score: 100 })
    const got = await sessions.key('alice').get()
    expect(got).toEqual({ role: 'admin', score: 100 })
  })

  it('has() returns true for existing key', async () => {
    const db = createDB()
    const sessions = db.secureStore('sessions')
    await sessions.key('test').set('value')
    expect(await sessions.key('test').has()).toBe(true)
  })

  it('has() returns false for missing key', async () => {
    const db = createDB()
    const sessions = db.secureStore('sessions')
    expect(await sessions.key('missing').has()).toBe(false)
  })

  it('has() returns false for expired key', async () => {
    const db = new IndexedDB({
      dbName: 'test-db',
      secureStores: [{ name: 'sessions', encryptionKey: 'key' }],
    })
    const sessions = db.secureStore('sessions')
    await sessions.key('exp', { ttl: -1 }).set('value')
    expect(await sessions.key('exp').has()).toBe(false)
  })

  it('get() returns undefined for expired key', async () => {
    const db = new IndexedDB({
      dbName: 'test-db',
      secureStores: [{ name: 'sessions', encryptionKey: 'key' }],
    })
    const sessions = db.secureStore('sessions')
    await sessions.key('exp', { ttl: -1 }).set('value')
    expect(await sessions.key('exp').get()).toBeUndefined()
  })

  it('remove() deletes the key', async () => {
    const db = createDB()
    const sessions = db.secureStore('sessions')
    await sessions.key('rm').set('value')
    expect(await sessions.key('rm').get()).toBe('value')
    await sessions.key('rm').remove()
    expect(await sessions.key('rm').get()).toBeUndefined()
  })

  it('multiple keys are independent', async () => {
    const db = createDB()
    const sessions = db.secureStore('sessions')
    await sessions.key('a').set('value-a')
    await sessions.key('b').set('value-b')
    expect(await sessions.key('a').get()).toBe('value-a')
    expect(await sessions.key('b').get()).toBe('value-b')
  })

  it('encrypts and decrypts with correct key', async () => {
    const db = createDB()
    const sessions = db.secureStore('sessions')
    await sessions.key('secret').set('hidden message')
    expect(await sessions.key('secret').get()).toBe('hidden message')
  })

  it('returns undefined for wrong encryption key', async () => {
    const db1 = new IndexedDB({
      dbName: 'test-db',
      secureStores: [{ name: 'sessions', encryptionKey: 'correct' }],
    })
    const s1 = db1.secureStore('sessions')
    await s1.key('test').set('secret')
    await db1.close()

    const db2 = new IndexedDB({
      dbName: 'test-db',
      secureStores: [{ name: 'sessions', encryptionKey: 'wrong' }],
    })
    const s2 = db2.secureStore('sessions')
    expect(await s2.key('test').get()).toBeUndefined()
    await db2.close()
  })

  it('TTL from schema default', async () => {
    const db = new IndexedDB({
      dbName: 'test-db',
      secureStores: [{ name: 'cache', encryptionKey: 'key', ttl: '1h' }],
    })
    const cache = db.secureStore('cache')
    await cache.key('x').set('value')
    expect(await cache.key('x').get()).toBe('value')
  })

  it('overrides ttl at set() level over schema/key TTL', async () => {
    const db = new IndexedDB({
      dbName: 'test-db',
      secureStores: [{ name: 'cache', encryptionKey: 'key', ttl: '1h' }],
    })
    const cache = db.secureStore('cache')
    const k = cache.key('x', { ttl: '30m' })
    await k.set('value', { ttl: -1 })
    expect(await k.get()).toBeUndefined()
    expect(await k.has()).toBe(false)
  })

  it('overrides ttl at set() level even without schema/key TTL', async () => {
    const db = new IndexedDB({
      dbName: 'test-db',
      secureStores: [{ name: 'cache', encryptionKey: 'key' }],
    })
    const cache = db.secureStore('cache')
    const k = cache.key('x')
    await k.set('value', { ttl: -1 })
    expect(await k.get()).toBeUndefined()
    expect(await k.has()).toBe(false)
  })

  it('stores correct $exp when ttl overridden at set() level (user scenario)', async () => {
    const db = new IndexedDB({
      dbName: 'test-db',
      secureStores: [{ name: 'sessions', encryptionKey: 'secret', ttl: '24h' }],
    })
    const sessions = db.secureStore('sessions')
    const k = sessions.key<{ name: string }>('user-session', { ttl: '1d' })
    await k.set({ name: 'Ahmad' }, { ttl: '15m' })

    const raw: any = await new Promise((resolve, reject) => {
      const req = indexedDB.open('test-db')
      req.onsuccess = () => {
        const r = req.result
        const tx = r.transaction('sessions', 'readonly')
        const getReq = tx.objectStore('sessions').get('user-session')
        getReq.onsuccess = () => {
          resolve(getReq.result)
          r.close()
        }
        getReq.onerror = () => reject(getReq.error)
      }
      req.onerror = () => reject(req.error)
    })

    expect(raw).toBeDefined()
    expect(raw.key).toBe('user-session')
    const now = Date.now()
    expect(raw.$exp).toBeGreaterThan(now + 800000)  // ~13.3min
    expect(raw.$exp).toBeLessThan(now + 1000000)    // ~16.6min
  })

  it('stores correct $exp with short string TTL at set() level', async () => {
    const db = new IndexedDB({
      dbName: 'test-db',
      secureStores: [{ name: 'cache', encryptionKey: 'key', ttl: '24h' }],
    })
    const cache = db.secureStore('cache')
    const k = cache.key('x', { ttl: '1d' })
    const before = Date.now()
    await k.set('value', { ttl: '10ms' })
    const after = Date.now()

    const raw: any = await new Promise((resolve, reject) => {
      const req = indexedDB.open('test-db')
      req.onsuccess = () => {
        const r = req.result
        const tx = r.transaction('cache', 'readonly')
        const getReq = tx.objectStore('cache').get('x')
        getReq.onsuccess = () => {
          resolve(getReq.result)
          r.close()
        }
        getReq.onerror = () => reject(getReq.error)
      }
      req.onerror = () => reject(req.error)
    })

    expect(raw).toBeDefined()
    expect(raw.key).toBe('x')
    expect(raw.$exp).toBeGreaterThanOrEqual(before + 10)
    expect(raw.$exp).toBeLessThanOrEqual(after + 10)

    await new Promise(r => setTimeout(r, 20))
    expect(await k.get()).toBeUndefined()
    expect(await k.has()).toBe(false)
  })

  it('throws for unknown secure store', () => {
    const db = createDB()
    expect(() => db.secureStore('ghost' as any)).toThrow('Secure store not found')
  })
})
