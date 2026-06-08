# Documentation

browstorage — browser storage library for localStorage, sessionStorage, cookies, and IndexedDB with **TTL (expiration)** and **encryption** support.

## Installation

```bash
npm install browstorage
```

## Quick Start

```ts
import { LocalStorage, SessionStorage, CookieStorage, IndexedDB } from 'browstorage'

// --- Local Storage ---
const local = new LocalStorage({ encrypt: true, encryptionKey: 'my-secret-key' })
const token = local.key<string>('token', { ttl: '7d' })

token.set('Bearer eyJ...')
token.get()       // 'Bearer eyJ...'
token.remove()
token.has()       // true / false

// --- Session Storage ---
const session = new SessionStorage()
const cart = session.key<{ items: number }>('cart')

cart.set({ items: 3 })
cart.get()        // { items: 3 }

// --- Cookie ---
const cookie = new CookieStorage({ path: '/', sameSite: 'lax' })
const sess = cookie.key<string>('session')

sess.set('abc123')
sess.get()        // 'abc123'
sess.remove()

// --- IndexedDB ---
const db = new IndexedDB({
  dbName: 'my-db',
  stores: [{ name: 'users', keyPath: 'id', autoIncrement: true }],
  secureStores: [{ name: 'sessions', encryptionKey: 'secret', ttl: '24h' }],
})
const users = db.objectStore<User>('users')
await users.add({ name: 'John Done' })
const all = await users.getAll()

const sessions = db.secureStore('sessions')
const userRole = sessions.key<Role>('userRole')
await userRole.set({ role: 'admin' })

// --- Factory methods ---
local.clear()     // localStorage.clear()
local.size()      // estimated total bytes
```

## TTL (Time-To-Live)

Set expiration time at factory level or per-key:

```ts
const local = new LocalStorage({ ttl: '1h' })   // default TTL for all keys

const token = local.key<string>('token', { ttl: '7d' })  // per-key override
token.set('value')                                        // expires in 7 days
token.set('value', { ttl: 3600 })                         // per-set override
```

TTL format:

| Input | Description |
|-------|-------------|
| `1000` | Milliseconds |
| `'500ms'` | Milliseconds |
| `'30s'` | Seconds |
| `'15m'` | Minutes |
| `'2h'` | Hours |
| `'7d'` | Days |
| `'1w'` | Weeks |
| `new Date('2026-12-31')` | Absolute date |
| `null` | No TTL (override factory/key default) |

### Default Behavior

When no TTL is set, each storage type behaves according to its inherent lifetime:

| Storage | Default lifetime |
|---------|-----------------|
| `LocalStorage` | Persistent until explicitly removed |
| `SessionStorage` | Cleared when tab/window closes |
| `CookieStorage` | Session cookie (cleared when browser closes) |
| `IndexedDB` (ObjectStore) | Persistent until explicitly removed |
| `IndexedDB` (SecureStore) | Persistent until explicitly removed |

## Encryption

Data is encrypted using **AES-CBC** via crypto-js, with a SHA-256 checksum to detect wrong keys or corrupted data.

```ts
const local = new LocalStorage({
  encrypt: true,
  encryptionKey: 'my-secret-key',
})

const token = local.key<string>('token')
token.set('sensitive-data')
token.get()     // 'sensitive-data' (auto-decrypted)
```

Encryption can be overridden per-key:

```ts
const local = new LocalStorage({ encrypt: true, encryptionKey: 'global-key' })
const token = local.key<string>('token', { encrypt: false })   // no encryption
```

**Note:** `encrypt: true` without `encryptionKey` will log a warning and automatically disable encryption. It will **not** throw an error. This applies to all storage types (local, session, cookie, SecureStore).

## LocalStorage / SessionStorage

### API Reference

#### `LocalStorage`

| Method | Description |
|--------|-------------|
| `key<T>(name, options?)` | Create a per-key binding (`LocalKey<T>`) |
| `clear()` | Clear all localStorage data |
| `size()` | Estimated total data size in bytes |

#### `LocalKey<T>`

| Method | Description |
|--------|-------------|
| `set(value, options?)` | Store a value (override ttl) |
| `get()` | Retrieve value, `undefined` if expired or missing |
| `remove()` | Remove data |
| `has()` | Check if key exists and is not expired |

#### `SessionStorage` / `SessionKey<T>`

Same as LocalStorage/LocalKey but backed by `sessionStorage`.

### Usage Pattern

#### storage.ts — reusable definitions

Create a centralized module to define all storage instances and keys:

```ts
import { LocalStorage, SessionStorage } from 'browstorage';

// --- INSTANCES ---
export const localStorage = new LocalStorage({
  encrypt: true,
  encryptionKey: import.meta.env.VITE_STORAGE_KEY,
  ttl: '7d', // default TTL for all keys (optional)
});
export const sessionStorage = new SessionStorage({
  encrypt: true,
  encryptionKey: import.meta.env.VITE_STORAGE_KEY,
  ttl: '1h', // default TTL for all keys (optional)
});

// TYPES
interface User {
  id: number;
  name: string;
  email: string;
}
interface CartItem {
  productId: string;
  qty: number;
}

// ---DEFINE KEYS---
export const token = localStorage.key<string>('token', {
  ttl: '15m', // override TTL per-key (optional)
});
export const user = localStorage.key<User>('currentUser', {
  ttl: '24h',
  encrypt: false, // override encryption per-key (optional)
});
export const cart = sessionStorage.key<CartItem[]>('cart', { ttl: '1h' });
export const returnUrl = sessionStorage.key<string>('returnUrl');
```

#### Usage in other files

```ts
// auth.ts
import { token, user } from './storage'

export function login(tokenStr: string, userData: User) {
  token.set(tokenStr)
  user.set(userData)
}

export function logout() {
  token.remove()
  user.remove()
}
```

```ts
// cart.ts
import { cart } from './storage'

export function addToCart(productId: string) {
  const items = cart.get() ?? []
  items.push({ productId, qty: 1 })
  cart.set(items, { ttl: '30m' })  // per-set TTL override
}
```

```ts
// utils.ts
import { localStorage, sessionStorage, token } from './storage'

export function clearAll() {
  localStorage.clear()
  sessionStorage.clear()
}

// SSR safe — returns undefined on server
export function getToken(): string | undefined {
  return token.get()
}
```

## CookieStorage

### API Reference

#### `CookieStorage`

| Method | Description |
|--------|-------------|
| `key<T>(name, options?)` | Create a per-key binding (`CookieKey<T>`) |
| `size()` | Total cookie string length in bytes |

#### `CookieKey<T>`

| Method | Description |
|--------|-------------|
| `set(value, options?)` | Set a cookie (ttl, path, domain, secure, sameSite, httpOnly) |
| `get()` | Get cookie value |
| `remove(options?)` | Delete cookie |
| `has()` | Check if cookie exists |

### Cookie options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ttl` | `TTL` | — | Cookie expiration |
| `path` | `string` | `'/'` | Cookie path |
| `domain` | `string` | — | Cookie domain |
| `secure` | `boolean` | `false` | Send only via HTTPS |
| `sameSite` | `'strict' \| 'lax' \| 'none'` | `'lax'` | SameSite policy |
| `httpOnly` | `boolean` | `false` | Not accessible via JS |

### Usage Pattern

#### storage.ts — reusable definitions

```ts
import { CookieStorage } from 'browstorage';

// --- INSTANCES ---
export const cookie = new CookieStorage({
  path: '/',
  sameSite: 'lax',
  encrypt: true,
  encryptionKey: import.meta.env.VITE_STORAGE_KEY,
});

// TYPES
interface Preferences {
  theme: string
  locale: string
}

// ---DEFINE KEYS---
export const session = cookie.key<string>('session');
export const prefs = cookie.key<Preferences>('preferences');
```

#### Usage in other files

```ts
// auth.ts
import { session } from './storage'

export function setSession(token: string) {
  session.set(token, { ttl: '7d', httpOnly: true })
}

export function getSession(): string | undefined {
  return session.get()
}

export function clearSession() {
  session.remove()
}
```

```ts
// prefs.ts
import { prefs } from './storage'

export function setTheme(theme: string) {
  const current = prefs.get() ?? { theme: 'light', locale: 'en' }
  prefs.set({ ...current, theme }, { ttl: '365d' })
}
```

## IndexedDB

IndexedDB is an async storage with two types of stores: **ObjectStore** (table-style, structured clone, secondary indexes) and **SecureStore** (encrypted key-value, TTL).

### Schema Definition

#### IndexedDBConfig

```ts
interface IndexedDBConfig<
  const S extends ObjectStoreSchema[],
  const K extends SecureStoreSchema[],
> {
  dbName: string;
  stores?: S;
  secureStores?: K;
}
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `dbName` | `string` | ✔ | Database name. Each instance must have a unique name. |
| `stores` | `ObjectStoreSchema[]` | — | List of object stores (plain, indexes, structured clone) |
| `secureStores` | `SecureStoreSchema[]` | — | List of secure stores (encrypted, TTL) |

#### ObjectStoreSchema

```ts
interface ObjectStoreSchema {
  name: string;
  keyPath: string | string[];
  autoIncrement?: boolean;
  indexes?: IndexOptions[];
}
```

| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `name` | `string` | — | Store name. `__bs_meta__` is reserved and will throw an error if used. |
| `keyPath` | `string \| string[]` | — | Primary key. Use an array for composite keys |
| `autoIncrement` | `boolean` | `false` | Auto-increment key |
| `indexes` | `IndexOptions[]` | — | Secondary indexes |

#### IndexOptions

```ts
interface IndexOptions {
  name: string;
  keyPath: string | string[];
  unique?: boolean;
  multiEntry?: boolean;
}
```

| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `name` | `string` | — | Index name |
| `keyPath` | `string \| string[]` | — | Field to index |
| `unique` | `boolean` | `false` | Unique constraint |
| `multiEntry` | `boolean` | `false` | Index each array element |

**Note:** If `multiEntry: true` and the field contains an array, each array element becomes a separate index entry. Useful for tags, categories, etc.

#### SecureStoreSchema

```ts
interface SecureStoreSchema {
  name: string;
  encryptionKey: string;
  ttl?: TTL;
}
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `name` | `string` | ✔ | Store name |
| `encryptionKey` | `string` | ✔ | AES encryption key. If empty, a warning is logged and encryption is disabled. |
| `ttl` | `TTL` | — | Default TTL for all keys in this store. Without TTL, data persists indefinitely. Use `null` to override to no TTL. |

### Key Path

#### Simple Key

Key based on a single field:

```ts
stores: [{ name: 'products', keyPath: 'sku' }];

await products.add({ sku: 'a1', name: 'Apple' });
await products.get('a1');
```

#### Composite Key

Combined key from multiple fields (`string[]`). IndexedDB uses the field values as a composite key.

```ts
stores: [{ name: 'orders', keyPath: ['region', 'id'] }];

interface Order {
  region: string;
  id: number;
  total: number;
}

await orders.add({ region: 'US', id: 1, total: 50 });
await orders.get(['US', 1]);
```

Ideal for grouping, e.g. querying all orders from a region via `byRegion` index.

### ObjectStore CRUD

#### Instance & Store

```ts
const db = new IndexedDB({
  dbName: 'shop',
  stores: [
    {
      name: 'products',
      keyPath: 'sku',
      indexes: [
        { name: 'byCategory', keyPath: 'category' },
        { name: 'byPrice', keyPath: 'price' },
      ],
    },
    {
      name: 'orders',
      keyPath: ['region', 'id'], // composite key
      indexes: [{ name: 'byRegion', keyPath: 'region' }],
    },
  ],
});

interface Product {
  sku: string;
  name: string;
  category: string;
  price: number;
}

interface Order {
  region: string;
  id: number;
  total: number;
}

const products = db.objectStore<Product>('products');
const orders = db.objectStore<Order>('orders');
```

#### Method Table

| Method | Return | Description |
| ------ | ------ | ----------- |
| `add(record)` | `Promise<IDBValidKey \| undefined>` | Insert a record. Throws if the key already exists. |
| `put(record)` | `Promise<IDBValidKey \| undefined>` | Insert or update. |
| `get(key)` | `Promise<T \| undefined>` | Retrieve a record by key. |
| `getAll()` | `Promise<T[]>` | All records. |
| `getAllKeys()` | `Promise<IDBValidKey[]>` | All keys. |
| `delete(key)` | `Promise<void>` | Delete by key. |
| `count()` | `Promise<number>` | Number of records. |
| `clear()` | `Promise<void>` | Delete all records in this store. |
| `index(name)` | `Index<T>` | Access a secondary index. |

#### `add(record)`

Insert new data. Throws if the key already exists.

```ts
// Insert succeeds
await products.add({ sku: 'a1', name: 'Apple', category: 'fruit', price: 1 });

// Error — key 'a1' already exists
await products.add({ sku: 'a1', name: 'Duplicated' }); // throws
```

#### `put(record)`

Insert or update. Does not throw if the key already exists (overwrites).

```ts
// Insert if not present
await products.put({ sku: 'b1', name: 'Banana', category: 'fruit', price: 2 });

// Update if already present
await products.put({ sku: 'a1', name: 'Green Apple', category: 'fruit', price: 3 });
```

#### `get(key)`

Retrieve record by primary key. Returns `undefined` if not found.

```ts
const product = await products.get('a1'); // Product | undefined
const notFound = await products.get('xxx'); // undefined
```

For composite keys, use an array:

```ts
const order = await orders.get(['US', 1]); // Order | undefined
```

#### `getAll()`

All records in the store.

```ts
const all = await products.getAll(); // Product[]

// Filter in JS after getting data
const cheap = all.filter((p) => p.price < 5);
```

#### `getAllKeys()`

All primary keys.

```ts
const keys = await products.getAllKeys(); // ['a1', 'b1', ...]
```

Useful for batch operations like bulk delete:

```ts
const keys = await products.getAllKeys();
for (const key of keys) {
  await products.delete(key);
}
```

#### `delete(key)`

Delete record by primary key.

```ts
await products.delete('a1');

// Composite key
await orders.delete(['US', 1]);
```

#### `count()`

Number of records in the store.

```ts
const total = await products.count(); // number
```

#### `clear()`

Delete all records in the store (does not delete the store itself).

```ts
await products.clear(); // all records deleted
```

#### `index(name)`

Access a secondary index for queries. See [Secondary Indexes](#secondary-indexes).

```ts
const byCategory = products.index('byCategory');
const fruits = await byCategory.getAll('fruit');
```

### Secondary Indexes

Indexes are defined in the schema and accessed via `objectStore.index(name)`.

Using the `products` store defined in [ObjectStore CRUD](#objectstore-crud):

```ts
const byCategory = products.index('byCategory');
const byPrice = products.index('byPrice');
```

#### Method Table

| Method | Return | Description |
| ------ | ------ | ----------- |
| `get(value)` | `Promise<T \| undefined>` | First matching record. |
| `getAll(value?)` | `Promise<T[]>` | All matching records. Without argument = all records. |
| `getAllKeys(value?)` | `Promise<IDBValidKey[]>` | All matching keys. |
| `count(value?)` | `Promise<number>` | Count matching records. |

#### `get(value)`

First record matching the index value. `undefined` if none found.

```ts
const fruit = await byCategory.get('fruit'); // Product | undefined
const notFound = await byPrice.get(100); // undefined (no price 100)
```

#### `getAll(value?)`

All matching records. Without argument = all records (ordered by index).

```ts
const fruits = await byCategory.getAll('fruit'); // Product[]
const all = await byCategory.getAll(); // Product[] (all, ordered by category)
```

#### `getAllKeys(value?)`

All matching primary keys.

```ts
const fruitKeys = await byCategory.getAllKeys('fruit'); // ['a1', 'b2', ...]
```

Useful for batch delete:

```ts
const keys = await byCategory.getAllKeys('fruit');
for (const key of keys) {
  await products.delete(key);
}
```

#### `count(value?)`

Count matching records.

```ts
const fruitCount = await byCategory.count('fruit'); // number
const total = await byCategory.count(); // all records
```

#### multiEntry

For fields containing arrays:

```ts
stores: [
  {
    name: 'articles',
    keyPath: 'id',
    indexes: [{ name: 'byTags', keyPath: 'tags', multiEntry: true }],
  },
];

interface Article {
  id: string;
  tags: string[];
  title: string;
}

await articles.add({ id: '1', tags: ['js', 'ts', 'react'], title: '...' });
const byTags = articles.index('byTags');
const jsArticles = await byTags.getAll('js'); // all articles with tag 'js'
```


#### Composite Index (`keyPath: string[]`)

The index key consists of a combination of multiple fields, defined with `keyPath: string[]`.

```ts
stores: [{
  name: 'products',
  keyPath: 'sku',
  indexes: [
    { name: 'byLocation', keyPath: ['city', 'country'] },
  ],
}]

interface Product {
  sku: string
  city: string
  country: string
  name: string
}

const byLocation = products.index('byLocation')

// getAll — all matching records
const results = await byLocation.getAll(['Jakarta', 'Indonesia'])
// city === 'Jakarta' AND country === 'Indonesia'

const jakartaResults = await byLocation.getAll(['Jakarta'])
// Prefix match — all records with city === 'Jakarta' (any country)

// get — first matching record
const result = await byLocation.get(['Jakarta', 'Indonesia'])
// First Product with city === 'Jakarta' AND country === 'Indonesia'

const jakartaResult = await byLocation.get(['Jakarta'])
// First Product with city === 'Jakarta'
```

**Note:** Prefix matching only works starting from the first field. Queries like `getAll(['', 'Indonesia'])` will not produce a prefix match.

### Usage Pattern: Centralized Definitions

Create a single `storage.ts` module to define your database instance and export all object stores:

```ts
// storage.ts
import { IndexedDB } from 'browstorage';

// --- INSTANCE ---
export const db = new IndexedDB({
  dbName: 'shop',
  stores: [
    {
      name: 'products',
      keyPath: 'sku',
      indexes: [
        { name: 'byCategory', keyPath: 'category' },
        { name: 'byPrice', keyPath: 'price' },
      ],
    },
    {
      name: 'orders',
      keyPath: ['region', 'id'],  // composite key
      indexes: [{ name: 'byRegion', keyPath: 'region' }],
    },
  ],
});

// TYPES
interface Product {
  sku: string
  name: string
  category: string
  price: number
}
interface Order {
  region: string
  id: number
  total: number
}

// ---DEFINE STORES---
export const products = db.objectStore<Product>('products');
export const orders = db.objectStore<Order>('orders');
```

Then import and use in other files:

```ts
// products.ts
import { products } from './storage'

export async function createProduct(data: Product) {
  await products.add(data)
}

export async function updateProduct(data: Product) {
  await products.put(data)
}

export async function getProduct(sku: string) {
  return products.get(sku)
}

export async function getByCategory(category: string) {
  const byCat = products.index('byCategory')
  return byCat.getAll(category)
}
```

```ts
// orders.ts
import { orders } from './storage'

export async function getOrdersByRegion(region: string) {
  const byRegion = orders.index('byRegion')
  return byRegion.getAll(region)
}
```

### SecureStore & SecureKey

SecureStore stores data as encrypted key-value pairs. TTL can be set at 3 levels:

```ts
// Level 1: store schema
secureStores: [{ name: 'sessions', encryptionKey: 'secret', ttl: '24h' }];

// Level 2: per-key (.key())
const key = store.key<Session>('alice', { ttl: '7d' });

// Level 3: per-set (.set())
await key.set(data, { ttl: '1h' });
```

#### SecureKey Methods

```ts
const sessions = db.secureStore('sessions');
const key = sessions.key<Session>('user');
```

| Method | Return | Description |
| ------ | ------ | ----------- |
| `set(value, options?)` | `Promise<void>` | Store an encrypted value. |
| `get()` | `Promise<T \| undefined>` | Retrieve & decrypt. `undefined` if expired or wrong key. |
| `has()` | `Promise<boolean>` | Check if key exists and is not expired. |
| `remove()` | `Promise<void>` | Delete record. |

Example:

```ts
interface Session {
  userId: number;
  role: 'admin' | 'user';
  lastLogin: Date;
}

const key = sessions.key<Session>('alice', { ttl: '7d' });

await key.set({ userId: 1, role: 'admin', lastLogin: new Date() });
const data = await key.get(); // Session | undefined
await key.has(); // true
await key.remove();
```

**Note:** `set(undefined)` is equivalent to `remove()` — the data is deleted, not stored as `null`.

### Usage Pattern: Centralized Definitions

Add SecureStore definitions to your `storage.ts` module:

```ts
export const db = new IndexedDB({
  dbName: 'auth',
  secureStores: [
    { name: 'sessions', encryptionKey: import.meta.env.VITE_STORAGE_KEY, ttl: '24h' },
  ],
});

// TYPES
interface Session {
  userId: number
  role: 'admin' | 'user'
  lastLogin: Date
}

// ---DEFINE STORES---
export const sessions = db.secureStore('sessions');
// ---DEFINE KEYS---
export const userSession = sessions.key<Session>('currentUser', { ttl: '7d' });
```

Usage in other files:

```ts
// auth.ts
import { userSession } from './storage'

export async function login(userId: number, role: Session['role']) {
  await userSession.set({ userId, role, lastLogin: new Date() })
}

export async function getSession(): Promise<Session | undefined> {
  return userSession.get()
}

export async function logout() {
  await userSession.remove()
}

// TTL override per-set
export async function extendSession() {
  const data = await userSession.get()
  if (data) {
    await userSession.set(data, { ttl: '7d' })
  }
}
```

### Migration System

Migration happens automatically when the schema changes.

#### How it works

1. The database stores a `__bs_meta__` record containing `version` + a snapshot of the `schema`
2. Each `getConnection()` compares the requested schema vs. the stored schema
3. If different → version is bumped, `onupgradeneeded` fires
4. New indexes are created, indexes not in the new schema are deleted
5. Store data remains intact (only version bump, not delete database)

#### Example

```ts
const db = new IndexedDB({
  dbName: 'shop',
  stores: [
    {
      name: 'products',
      keyPath: 'sku',
      indexes: [{ name: 'byCategory', keyPath: 'category' }], // new index
    },
  ],
});
```

After initialization, `__bs_meta__` will contain `{ version: 1, schema: [...] }`. If you add an index or store, the version increases to 2, and the `onupgradeneeded` migration applies the changes.

**Note:** Changing `keyPath` or `autoIncrement` on an existing store will delete **all data** in that store. Changes to index options (`unique`, `multiEntry`, `keyPath`) on existing indexes are detected and the index is recreated automatically — existing data is preserved.

#### Limitations

- Removing a store from the config does **not** delete it from the database — use native `indexedDB.deleteDatabase('dbName')` if needed
- If the browser blocks an upgrade (`onblocked`), the promise will hang indefinitely (no timeout yet)

### `const` Type Parameter (TS 5.0+)

Use `as const` for type-safe store names:

```ts
const db = new IndexedDB({
  dbName: 'shop',
  stores: [
    { name: 'products', keyPath: 'sku' },
    { name: 'orders', keyPath: ['region', 'id'] },
  ],
  secureStores: [{ name: 'sessions', encryptionKey: 'secret', ttl: '24h' }],
} as const);
//  ^^^^^^^^ important!

// Type-safe — only 'products' | 'orders' are valid
const products = db.objectStore('products');
const orders = db.objectStore('orders');

// Type-safe secure store name — only 'sessions' is valid
const sessions = db.secureStore('sessions');
```

Without `as const`, the `name` argument is typed as `string` (no autocomplete / error for typos).

### `close()` & dbName Uniqueness

Each `IndexedDB` instance must have a unique `dbName` within a session:

```ts
const db1 = new IndexedDB({ dbName: 'shop' }); // ok
const db2 = new IndexedDB({ dbName: 'shop' }); // ERROR: dbName already in use
```

Use `close()` to release the name and create a new instance:

```ts
const db = new IndexedDB({ dbName: 'shop' });
await db.close(); // release name

const db2 = new IndexedDB({ dbName: 'shop' }); // ok
```

After `close()`, the database connection is closed and all store references are no longer usable.

### Best Practices

1. **ObjectStore for structured data** — data that needs to be queried with indexes (products, users, posts)
2. **SecureStore for sensitive data** — tokens, sessions, credentials. AES encryption is automatic
3. **EncryptionKey from environment** — don't hardcode. Load it from an environment variable during build time.
4. **Don't store SecureStore key in localStorage** — use an env variable or prompt the user
5. **SSR safety** — all methods are safe to call on the server (no-op / return undefined)
6. **`close()` when done** — especially in tests, or when you need to open a database with the same name
7. **Use `as const`** — for type-safe store names

## SSR Safety

All methods are safe to call on the server:
- `.set()` — no-op on the server
- `.get()` — returns `undefined`
- `.remove()` — no-op on the server
- `.has()` — returns `false`
- `.clear()` — no-op on the server
- `.size()` — returns 0

## Options Hierarchy

All levels are overridable:

```
Factory (constructor) → Per-key (.key()) → Per-set (.set())
```

## TypeScript

Full generic type support:

```ts
interface User {
  id: number
  name: string
  email: string
}

const local = new LocalStorage()
const user = local.key<User>('user')

user.set({ id: 1, name: 'John Doe', email: 'johndoe@example.com' })
const data = user.get()  // User | undefined
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
