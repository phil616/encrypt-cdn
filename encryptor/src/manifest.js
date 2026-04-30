import path from 'path';

export const MANIFEST_VERSION = '2.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon'
};

export function normalizeManifestPath(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  const encoded = normalized
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return encoded.startsWith('/') ? encoded : `/${encoded}`;
}

export function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

export function createEncryptedPath(contentHash) {
  return `${contentHash.slice(0, 2)}/${contentHash}.enc`;
}

export function createManifest() {
  return {
    version: MANIFEST_VERSION,
    encryption: {
      format: 'DRXENC01',
      algorithm: 'AES-GCM',
      iv_length: 12,
      key_derivation: 'SHA-256'
    },
    files: {}
  };
}
