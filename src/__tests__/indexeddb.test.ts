import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { IndexedDB } from '../storage/indexeddb'

async function deleteDB(name: string): Promise<void> {
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

    const db2 = new IndexedDB({
      dbName: 'test-db',
      secureStores: [{ name: 'sessions', encryptionKey: 'wrong' }],
    })
    const s2 = db2.secureStore('sessions')
    expect(await s2.key('test').get()).toBeUndefined()
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

  it('throws for unknown secure store', () => {
    const db = createDB()
    expect(() => db.secureStore('ghost' as any)).toThrow('Secure store not found')
  })
})
