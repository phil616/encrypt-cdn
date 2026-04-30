import fs from 'fs/promises';
import path from 'path';
import { encryptData } from './crypto.js';
import { createEncryptedPath, createManifest, getMimeType, normalizeManifestPath } from './manifest.js';

const EXCLUDE_PATTERNS = [
  /^\./,  // Hidden files
  /node_modules/,
  /\.git/
];

const ENCRYPT_EXTENSIONS = [
  '.html', '.css', '.js', '.json',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
  '.woff', '.woff2', '.ttf', '.ico'
];

/**
 * Check if a file should be encrypted based on extension
 */
export function shouldEncrypt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ENCRYPT_EXTENSIONS.includes(ext);
}

/**
 * Check if a path should be excluded
 */
export function shouldExclude(filePath) {
  const fileName = path.basename(filePath);
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(fileName));
}

/**
 * Recursively get all files in a directory
 */
export async function getAllFiles(dirPath) {
  const files = [];

  async function traverse(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (shouldExclude(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await traverse(dirPath);
  return files;
}

/**
 * Encrypt a single file
 */
export async function encryptFile(inputPath, outputPath, keyString, relativePath) {
  console.log(`Encrypting: ${relativePath}`);

  const data = await fs.readFile(inputPath);
  const encrypted = await encryptData(data, keyString);

  await fs.writeFile(outputPath, encrypted);
}

/**
 * Process directory encryption
 */
export async function encryptDirectory(inputDir, outputDir, keyString, options = {}) {
  const { clean = false, manifest = true } = options;

  // Clean output directory if requested
  if (clean) {
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  }

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Get all files to encrypt
  const files = await getAllFiles(inputDir);
  const encryptableFiles = files.filter(shouldEncrypt);

  console.log(`Found ${encryptableFiles.length} files to encrypt`);

  const { createHash } = await import('crypto');
  const manifestData = createManifest();

  // Encrypt files
  for (const filePath of encryptableFiles) {
    const relativePath = path.relative(inputDir, filePath);
    const plainData = await fs.readFile(filePath);
    const originalHash = createHash('sha256').update(plainData).digest('hex');
    const encryptedRelativePath = createEncryptedPath(originalHash);
    const outputPath = path.join(outputDir, encryptedRelativePath);

    // Ensure output subdirectory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    console.log(`Encrypting: ${relativePath}`);
    const encrypted = await encryptData(plainData, keyString);
    await fs.writeFile(outputPath, encrypted);

    if (manifest) {
      const outputStats = await fs.stat(outputPath);
      const manifestPath = normalizeManifestPath(relativePath);
      manifestData.files[manifestPath] = {
        encrypted_path: encryptedRelativePath,
        content_type: getMimeType(relativePath),
        original_size: plainData.byteLength,
        encrypted_size: outputStats.size,
        sha256: originalHash
      };
    }
  }

  // Generate manifest if requested
  if (manifest) {
    const manifestPath = path.join(outputDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifestData, null, 2));
    console.log(`Generated manifest: ${manifestPath}`);
  }

  console.log(`Encryption completed. ${encryptableFiles.length} files encrypted.`);
}
