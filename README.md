# browstorage

Browser storage library for localStorage, sessionStorage, cookies, and IndexedDB — with **TTL (expiration)** and **encryption** support.

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
await users.add({ name: 'John Doe' })
const all = await users.getAll()

const sessions = db.secureStore('sessions')
const userRole = sessions.key<Role>('userRole')
await userRole.set({ role: 'admin' })

// --- Factory methods ---
local.clear()     // localStorage.clear()
local.size()      // estimated total bytes
```

For detailed documentation, see the 👉 [DOCUMENTATION](https://github.com/solehudin5699/browstorage/blob/main/docs/index.md).

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

### How it works

TTL expiration is enforced by the library, not by the browser. Expired data is lazily checked and cleaned up on every `.get()` or `.has()` call. The raw data remains in storage until the library processes it — except for CookieStorage, where the browser enforces expiration via the `max-age` attribute.

## Encryption

Data is encrypted using **AES-CBC** via [crypto-js](https://github.com/brix/crypto-js), with a SHA-256 checksum to detect wrong keys or corrupted data.

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

## API Reference

### `LocalStorage`

| Method | Description |
|--------|-------------|
| `key<T>(name, options?)` | Create a per-key binding (`LocalKey<T>`) |
| `clear()` | Clear all localStorage data |
| `size()` | Estimated total data size in bytes |

### `LocalKey<T>`

| Method | Description |
|--------|-------------|
| `set(value, options?)` | Store a value (override ttl) |
| `get()` | Retrieve value, `undefined` if expired or missing |
| `remove()` | Remove data |
| `has()` | Check if key exists and is not expired |

### `SessionStorage` / `SessionKey<T>`

Same as LocalStorage/LocalKey but backed by `sessionStorage`.

### `CookieStorage`

| Method | Description |
|--------|-------------|
| `key<T>(name, options?)` | Create a per-key binding (`CookieKey<T>`) |
| `size()` | Total cookie string length in bytes |

### `CookieKey<T>`

| Method | Description |
|--------|-------------|
| `set(value, options?)` | Set a cookie (ttl, path, domain, secure, sameSite, httpOnly) |
| `get()` | Get cookie value |
| `remove(options?)` | Delete cookie |
| `has()` | Check if cookie exists |

Cookie options:

| Option | Type | Default |
|--------|------|---------|
| `domain` | `string` | — |
| `path` | `string` | `'/'` |
| `secure` | `boolean` | `false` |
| `sameSite` | `'strict' \| 'lax' \| 'none'` | `'lax'` |
| `httpOnly` | `boolean` | `false` |
| `ttl` | `TTL` | — |
| `encrypt` | `boolean` | — |

### `IndexedDB`

Async storage with two types of stores:

- **`ObjectStore<T>`** — table-style, structured clone, secondary indexes. No encryption.
- **`SecureStore`** → **`SecureKey<T>`** — encrypted key-value via `.key()`, optional TTL.

#### `IndexedDB` (factory)

| Method | Description |
|--------|-------------|
| `objectStore<T>(name)` | Get an object store by name (plain, indexes) |
| `secureStore<T>(name)` | Get a secure store by name (encrypted) |
| `clear()` | Delete all records from all stores |
| `size()` | Total record count across all stores |
| `close()` | Close the database connection and release the dbName |

IndexedDB constructor options:

| Option | Type | Description |
|--------|------|-------------|
| `dbName` | `string` | Database name (must be unique per instance) |
| `stores` | `ObjectStoreSchema[]` | Plain object stores (table-style, indexes, no encryption) |
| `secureStores` | `SecureStoreSchema[]` | Encrypted key-value stores (with optional TTL) |

```ts
interface ObjectStoreSchema {
  name: string
  keyPath: string | string[]
  autoIncrement?: boolean
  indexes?: IndexOptions[]
}

interface IndexOptions {
  name: string
  keyPath: string | string[]
  unique?: boolean
  multiEntry?: boolean
}

interface SecureStoreSchema {
  name: string
  encryptionKey: string
  ttl?: TTL
}
```

**Note:** Each `IndexedDB` instance must have a unique `dbName`. Creating a second instance with the same `dbName` in the same session throws an error.

#### `ObjectStore<T>` (table-style)

| Method | Description |
|--------|-------------|
| `add(record)` | Insert a record, returns the primary key |
| `put(record)` | Insert or update a record, returns the primary key |
| `get(key)` | Retrieve record by key |
| `getAll()` | Retrieve all records |
| `getAllKeys()` | Retrieve all keys |
| `delete(key)` | Delete record by key |
| `count()` | Number of records |
| `clear()` | Delete all records in this store |
| `index(name)` | Get a secondary index by name |

#### `Index<T>` (query by index)

| Method | Description |
|--------|-------------|
| `get(value)` | First record matching index value |
| `getAll(value?)` | All records matching index value |
| `getAllKeys(value?)` | All keys matching index value |
| `count(value?)` | Count records matching index value |

#### `SecureStore` → `SecureKey<T>` (encrypted key-value)

| Method | Description |
|--------|-------------|
| `key(key, options?)` | Create a per-key binding (`SecureKey<T>`) |

#### `SecureKey<T>`

| Method | Description |
|--------|-------------|
| `set(value, options?)` | Store encrypted value (async) |
| `get()` | Retrieve & decrypt, `undefined` if expired or wrong key |
| `has()` | Check if key exists and not expired |
| `remove()` | Delete record |

```ts
const db = new IndexedDB({
  dbName: 'shop',
  stores: [
    {
      name: 'products',
      keyPath: 'sku',
      indexes: [{ name: 'byCat', keyPath: 'category' }],
    },
  ],
  secureStores: [
    { name: 'sessions', encryptionKey: 'secret', ttl: '24h' },
  ],
})

// ObjectStore — plain, indexed
const products = db.objectStore<Product>('products')
await products.add({ sku: 'a', name: 'Apple', category: 'fruit', price: 1 })
const byCat = products.index('byCat')
const fruits = await byCat.getAll('fruit')

// SecureStore — encrypted, TTL
const sessions = db.secureStore('sessions')
const alice = sessions.key<Session>('alice')
await alice.set({ role: 'admin', lastLogin: new Date() })
await alice.get()    // { role: 'admin', lastLogin: Date }
await alice.has()    // true
await alice.remove()
```

### Options Hierarchy

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

## SSR Safety

All methods are safe to call on the server:
- `.set()` — no-op on the server
- `.get()` — returns `undefined`
- `.remove()` — no-op on the server
- `.has()` — returns `false`
- `.clear()` — no-op on the server
- `.size()` — returns 0

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
