import Crypto from 'crypto-js'

const PREFIX = 'ws:'

/**
 * Encrypt a string using AES (CBC + PKCS7).
 *
 * @param value - String to encrypt.
 * @param key - Encryption key.
 * @returns Base64 ciphertext.
 */
export function encrypt(value: string, key: string): string {
  return Crypto.AES.encrypt(PREFIX + value, key, {
    padding: Crypto.pad.Pkcs7,
    mode: Crypto.mode.CBC,
  }).toString()
}

/**
 * Decrypt a ciphertext produced by `encrypt()`.
 *
 * @param value - Base64 ciphertext.
 * @param key - Decryption key (must match the one used for encryption).
 * @returns Original string, or `null` if the key is wrong or data is corrupt.
 */
export function decrypt(value: string, key: string): string | null {
  try {
    const bytes = Crypto.AES.decrypt(value, key)
    const result = bytes.toString(Crypto.enc.Utf8)
    if (!result || !result.startsWith(PREFIX)) return null
    return result.slice(PREFIX.length)
  } catch {
    return null
  }
}
