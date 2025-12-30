import { createHash } from 'crypto';
import { webcrypto } from 'crypto';

// Polyfill for WebCrypto API in Node.js
const crypto = webcrypto;

export const MAGIC = 'DRXENC01';
export const IV_LENGTH = 12;

/**
 * Derive AES key from string key using SHA-256
 */
export async function deriveKey(keyString) {
  const keyData = createHash('sha256').update(keyString, 'utf8').digest();
  return crypto.subtle.importKey(
    'raw',
    new Uint8Array(keyData),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
}

/**
 * Encrypt data using AES-GCM with the specified format
 * Format: magic(8) + ivLen(1) + iv(12) + ciphertext
 */
export async function encryptData(data, keyString) {
  const key = await deriveKey(keyString);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Build the encrypted file format
  const magicBytes = new TextEncoder().encode(MAGIC);
  const ivLenByte = new Uint8Array([IV_LENGTH]);

  // Combine all parts
  const result = new Uint8Array(
    magicBytes.length + ivLenByte.length + iv.length + encrypted.byteLength
  );

  let offset = 0;
  result.set(magicBytes, offset);
  offset += magicBytes.length;
  result.set(ivLenByte, offset);
  offset += ivLenByte.length;
  result.set(iv, offset);
  offset += iv.length;
  result.set(new Uint8Array(encrypted), offset);

  return result;
}

/**
 * Decrypt data using AES-GCM (for testing purposes)
 */
export async function decryptData(encryptedData, keyString) {
  const key = await deriveKey(keyString);
  // For decryption, we need to re-derive with decrypt usage
  const decryptKey = await crypto.subtle.importKey(
    'raw',
    createHash('sha256').update(keyString, 'utf8').digest(),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Parse the encrypted file format
  const dataView = new DataView(encryptedData.buffer);
  const magic = new TextDecoder().decode(encryptedData.slice(0, 8));
  if (magic !== MAGIC) {
    throw new Error('Invalid encrypted file format');
  }

  const ivLen = dataView.getUint8(8);
  if (ivLen !== IV_LENGTH) {
    throw new Error('Unsupported IV length');
  }

  const iv = encryptedData.slice(9, 9 + IV_LENGTH);
  const ciphertext = encryptedData.slice(9 + IV_LENGTH);

  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    decryptKey,
    ciphertext
  );
}
