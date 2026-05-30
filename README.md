# webshelf

Browser storage library for localStorage, sessionStorage, and cookies — with **TTL (expiration)** and **encryption** support.

## Installation

```bash
npm install webshelf
```

## Quick Start

```ts
import WebShelf from 'webshelf'

const storage = new WebShelf()

// --- Local Storage ---
const token = storage.local<string>('token')
token.set('Bearer eyJ...')
token.get()       // 'Bearer eyJ...'
token.remove()

// --- Session Storage ---
const cart = storage.session<{ items: number }>('cart')
cart.set({ items: 3 })
cart.get()        // { items: 3 }

// --- Cookie ---
const session = storage.cookie('session', { sameSite: 'lax' })
session.set('abc123')
session.get()     // 'abc123'
session.remove()
```

## TTL (Time-To-Live)

Set expiration time at initialization or per-set:

```ts
const storage = new WebShelf({ ttl: '1h' })  // default TTL for all storage

const token = storage.local<string>('token', { ttl: '7d' })
token.set('value')                                // expires in 7 days
token.set('value', { ttl: 3600 })                 // override: expires in 3600ms
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

## Encryption

```ts
const storage = new WebShelf({
  encrypt: true,
  encryptionKey: 'my-secret-key',
})

const token = storage.local<string>('token')
token.set('sensitive-data')
token.get()     // 'sensitive-data' (auto-decrypted)
// Data in storage is encrypted (AES-CBC)
```

Encryption can be overridden per-storage or per-set:

```ts
const storage = new WebShelf({ encrypt: true, encryptionKey: 'global-key' })
const token = storage.local<string>('token', { encrypt: false })  // non-encrypted
token.set('value', { encrypt: true })                              // override: encrypt
```

## API Reference

### `new WebShelf(config?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `encrypt` | `boolean` | `false` | Enable encryption |
| `encryptionKey` | `string` | `''` | Encryption key |
| `ttl` | `TTL` | `undefined` | Default TTL for all storage |

### `.local<T>(name, options?)` → `LocalStorage<T>`

| Method | Description |
|--------|-------------|
| `set(value, options?)` | Store a value (override ttl/encrypt) |
| `get()` | Retrieve value, `undefined` if expired or missing |
| `remove()` | Remove data |

### `.session<T>(name, options?)` → `SessionStorage<T>`

Same as `.local()` but backed by `sessionStorage`.

### `.cookie<T>(name, options?)` → `CookieStorage<T>`

| Method | Description |
|--------|-------------|
| `set(value, options?)` | Set a cookie (ttl, path, domain, secure, sameSite, httpOnly) |
| `get()` | Get cookie value |
| `remove(options?)` | Delete cookie |

Cookie options:

| Option | Type | Default |
|--------|------|---------|
| `domain` | `string` | — |
| `path` | `string` | `'/'` |
| `secure` | `boolean` | — |
| `sameSite` | `'strict' \| 'lax' \| 'none'` | `'lax'` |
| `httpOnly` | `boolean` | — |

### Hierarchy Options

All levels are overridable:

```
Global (constructor) → Per-storage (.local / .session / .cookie) → Per-set (.set)
```

## TypeScript

Full generic type support:

```ts
interface User {
  id: number
  name: string
  email: string
}

const storage = new WebShelf()
const userStorage = storage.local<User>('user')

userStorage.set({ id: 1, name: 'Alice', email: 'alice@example.com' })
const user = userStorage.get()  // User | undefined
```

## SSR Safety

All methods are safe to call on the server (Next.js, Remix, etc.):
- `.set()` — no-op on the server
- `.get()` — returns `undefined`
- `.remove()` — no-op on the server

## License

MIT
