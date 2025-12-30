const MAGIC = 'DRXENC01';
const IV_LENGTH = 12;

/**
 * Derive AES key from string key using SHA-256
 */
export async function deriveKey(keyString: string): Promise<CryptoKey> {
  const keyData = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(keyString));
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
}

/**
 * Parse encrypted file format and decrypt
 */
export async function decryptData(encryptedData: ArrayBuffer, keyString: string): Promise<ArrayBuffer> {
  const key = await deriveKey(keyString);

  // Parse the encrypted file format
  const dataView = new DataView(encryptedData);
  const magicBytes = new Uint8Array(encryptedData, 0, 8);
  const magic = new TextDecoder().decode(magicBytes);

  if (magic !== MAGIC) {
    throw new Error('Invalid encrypted file format');
  }

  const ivLen = dataView.getUint8(8);
  if (ivLen !== IV_LENGTH) {
    throw new Error('Unsupported IV length');
  }

  const iv = new Uint8Array(encryptedData, 9, IV_LENGTH);
  const ciphertext = encryptedData.slice(9 + IV_LENGTH);

  try {
    return await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
  } catch (error) {
    throw new Error('Decryption failed. Invalid key or corrupted file.');
  }
}

/**
 * Get MIME type based on file extension
 */
export function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'ico': 'image/x-icon'
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}
