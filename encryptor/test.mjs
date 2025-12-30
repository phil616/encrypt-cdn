#!/usr/bin/env node

import { encryptData, decryptData } from './src/crypto.js';

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

    console.log('All tests passed!');

  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
