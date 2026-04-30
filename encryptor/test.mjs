#!/usr/bin/env node

import { encryptData, decryptData } from './src/crypto.js';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { encryptDirectory } from './src/fileProcessor.js';

async function runTests() {
  console.log('Running encryptor tests...\n');

  try {
    // Test data
    const testCases = [
      'Hello World!',
      'This is a test string with special characters: !@#$%^&*()',
      'A'.repeat(100), // Small file
      'B'.repeat(10000), // Larger file
      JSON.stringify({
        name: 'test',
        data: [1, 2, 3, 4, 5],
        nested: { key: 'value' }
      })
    ];

    const key = 'test-encryption-key-12345';

    for (let i = 0; i < testCases.length; i++) {
      const originalData = new TextEncoder().encode(testCases[i]);
      console.log(`Test ${i + 1}: ${testCases[i].substring(0, 50)}${testCases[i].length > 50 ? '...' : ''}`);

      // Encrypt
      const encrypted = await encryptData(originalData, key);

      // Verify format
      const magic = new TextDecoder().decode(encrypted.slice(0, 8));
      if (magic !== 'DRXENC01') {
        throw new Error(`Invalid magic bytes: ${magic}`);
      }

      const ivLen = encrypted[8];
      if (ivLen !== 12) {
        throw new Error(`Invalid IV length: ${ivLen}`);
      }

      // Decrypt
      const decrypted = await decryptData(encrypted, key);
      const decryptedText = new TextDecoder().decode(decrypted);

      // Verify
      if (decryptedText !== testCases[i]) {
        throw new Error(`Decryption failed for test ${i + 1}`);
      }

      console.log(`  ✓ Passed (${originalData.length} bytes -> ${encrypted.length} bytes encrypted)\n`);
    }

    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'encrypt-cdn-'));
    const inputDir = path.join(tempRoot, 'site');
    const outputDir = path.join(tempRoot, 'enc');

    try {
      await mkdir(inputDir, { recursive: true });
      await writeFile(path.join(inputDir, 'index.html'), '<!doctype html><h1>Hello</h1>');
      await writeFile(path.join(inputDir, 'space page.html'), '<!doctype html><h1>Space</h1>');

      await encryptDirectory(inputDir, outputDir, key, { manifest: true });
      const manifest = JSON.parse(await readFile(path.join(outputDir, 'manifest.json'), 'utf8'));
      const indexEntry = manifest.files['/index.html'];
      const spaceEntry = manifest.files['/space%20page.html'];

      if (manifest.version !== '2.0' || !indexEntry?.encrypted_path || !spaceEntry?.encrypted_path) {
        throw new Error('Manifest v2 output is invalid');
      }

      if (indexEntry.encrypted_path === 'index.html.enc') {
        throw new Error('Manifest should use hashed encrypted paths');
      }

      await readFile(path.join(outputDir, indexEntry.encrypted_path));
      console.log('Manifest test passed\n');
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }

    console.log('All tests passed!');

  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
