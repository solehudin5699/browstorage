# webshelf

Browser storage library for localStorage, sessionStorage, and cookies — with **TTL (expiration)** and **encryption** support.

> Note: This project is unrelated to [webshelf.app](https://webshelf.app).

## Installation

```bash
npm install webshelf
```

## Quick Start

```ts
import { LocalStorage, SessionStorage, CookieStorage } from 'webshelf'

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
const sess = cookie.key('session')

sess.set('abc123')
sess.get()        // 'abc123'
sess.remove()

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

## Encryption

```ts
const local = new LocalStorage({
  encrypt: true,
  encryptionKey: 'my-secret-key',
})

const token = local.key<string>('token')
token.set('sensitive-data')
token.get()     // 'sensitive-data' (auto-decrypted)
```

Encryption can be overridden per-key or per-set:

```ts
const local = new LocalStorage({ encrypt: true, encryptionKey: 'global-key' })
const token = local.key<string>('token', { encrypt: false })   // no encryption
token.set('value', { encrypt: true })                           // override: encrypt
```

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
| `set(value, options?)` | Store a value (override ttl/encrypt) |
| `get()` | Retrieve value, `undefined` if expired or missing |
| `remove()` | Remove data |
| `has()` | Check if key exists and is not expired |

### `SessionStorage` / `SessionKey<T>`

Same as LocalStorage/LocalKey but backed by `sessionStorage`.

### `CookieStorage`

| Method | Description |
|--------|-------------|
| `key<T>(name, options?)` | Create a per-key binding (`CookieKey<T>`) |
| `clear()` | Clear all cookies accessible from the current path |
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

user.set({ id: 1, name: 'Alice', email: 'alice@example.com' })
const data = user.get()  // User | undefined
```

## SSR Safety

All methods are safe to call on the server:
- `.set()` — no-op on the server
- `.get()` — returns `undefined`
- `.remove()` — no-op on the server
- `.has()` — returns `false`
- `.clear()` / `.size()` — no-op / returns 0

## License

MIT
