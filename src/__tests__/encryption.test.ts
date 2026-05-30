import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../encryption'

const KEY = 'test-key-123'

describe('encrypt / decrypt', () => {
  it('encrypts and decrypts a string', () => {
    const original = 'hello world'
    const encrypted = encrypt(original, KEY)
    expect(encrypted).not.toBe(original)
    expect(encrypted).toBeTruthy()

    const decrypted = decrypt(encrypted, KEY)
    expect(decrypted).toBe(original)
  })

  it('encrypts and decrypts JSON string', () => {
    const original = JSON.stringify({ foo: 'bar', num: 42 })
    const encrypted = encrypt(original, KEY)
    const decrypted = decrypt(encrypted, KEY)
    expect(decrypted).toBe(original)
    expect(JSON.parse(decrypted!)).toEqual({ foo: 'bar', num: 42 })
  })

  it('returns null for wrong key', () => {
    const original = 'secret data'
    const encrypted = encrypt(original, KEY)
    const decrypted = decrypt(encrypted, 'wrong-key')
    expect(decrypted).toBeNull()
  })

  it('returns null for empty ciphertext', () => {
    const result = decrypt('', KEY)
    expect(result).toBeNull()
  })

  it('returns null for garbage ciphertext', () => {
    const result = decrypt('garbage-base64!!!', KEY)
    expect(result).toBeNull()
  })

  it('produces different ciphertext for same input (due to IV)', () => {
    const original = 'same value'
    const encrypted1 = encrypt(original, KEY)
    const encrypted2 = encrypt(original, KEY)
    expect(encrypted1).not.toBe(encrypted2)

    expect(decrypt(encrypted1, KEY)).toBe(original)
    expect(decrypt(encrypted2, KEY)).toBe(original)
  })

  it('encrypts empty string', () => {
    const encrypted = encrypt('', KEY)
    const decrypted = decrypt(encrypted, KEY)
    expect(decrypted).toBe('')
  })

  it('works with different keys', () => {
    const value = 'test'
    const key1 = 'key1'
    const key2 = 'key2'

    const e1 = encrypt(value, key1)
    const e2 = encrypt(value, key2)

    expect(decrypt(e1, key1)).toBe(value)
    expect(decrypt(e2, key2)).toBe(value)
    expect(decrypt(e1, key2)).toBeNull()
    expect(decrypt(e2, key1)).toBeNull()
  })
})
