import fs from 'fs/promises';
import path from 'path';
import { encryptData } from './crypto.js';

const EXCLUDE_PATTERNS = [
  /^\./,  // Hidden files
  /node_modules/,
  /\.git/
];

const ENCRYPT_EXTENSIONS = [
  '.html', '.css', '.js', '.json',
  '.png', '.jpg', '.jpeg', '.svg', '.webp',
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
  const { clean = false, manifest = false } = options;

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
  const manifestData = {
    version: '1.0',
    key_hash: createHash('sha256').update(keyString).digest('hex'),
    files: []
  };

  // Encrypt files
  for (const filePath of encryptableFiles) {
    const relativePath = path.relative(inputDir, filePath);
    const outputPath = path.join(outputDir, relativePath + '.enc');

    // Ensure output subdirectory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    await encryptFile(filePath, outputPath, keyString, relativePath);

    if (manifest) {
      const inputStats = await fs.stat(filePath);
      const outputStats = await fs.stat(outputPath);

      const { createHash } = await import('crypto');
      manifestData.files.push({
        original_path: relativePath,
        encrypted_path: relativePath + '.enc',
        original_size: inputStats.size,
        encrypted_size: outputStats.size,
        original_hash: createHash('sha256').update(await fs.readFile(filePath)).digest('hex')
      });
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
