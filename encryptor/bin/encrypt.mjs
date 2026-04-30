#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import { encryptDirectory } from '../src/fileProcessor.js';
import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';

const program = new Command();

program
  .name('encryptor')
  .description('Encrypt static site assets with AES-GCM')
  .version('1.0.0');

program
  .command('keygen')
  .description('Generate a high-entropy encryption key')
  .option('-b, --bytes <number>', 'Number of random bytes', '32')
  .action((options) => {
    const byteLength = Number.parseInt(options.bytes, 10);
    if (!Number.isInteger(byteLength) || byteLength < 32) {
      console.error('Error: key size must be at least 32 bytes.');
      process.exit(1);
    }

    console.log(randomBytes(byteLength).toString('base64url'));
  });

program
  .command('encrypt')
  .description('Encrypt a directory of static assets')
  .requiredOption('-i, --in <directory>', 'Input directory containing plain assets')
  .requiredOption('-o, --out <directory>', 'Output directory for encrypted files')
  .option('-k, --key <string>', 'Encryption key string')
  .option('--key-file <file>', 'File containing encryption key')
  .option('--key-env <env_var>', 'Environment variable containing key', 'ENCRYPTION_KEY')
  .option('-c, --clean', 'Clean output directory before encryption', false)
  .option('--no-manifest', 'Skip manifest.json generation')
  .action(async (options) => {
    try {
      // Resolve input and output paths
      const inputDir = path.resolve(options.in);
      const outputDir = path.resolve(options.out);

      // Get encryption key
      let keyString = options.key;

      if (!keyString && options.keyFile) {
        keyString = readFileSync(options.keyFile, 'utf8').trim();
      }

      if (!keyString && process.env[options.keyEnv]) {
        keyString = process.env[options.keyEnv];
      }

      if (!keyString) {
        console.error('Error: No encryption key provided. Use --key, --key-file, or set environment variable.');
        process.exit(1);
      }

      console.log(`Input directory: ${inputDir}`);
      console.log(`Output directory: ${outputDir}`);
      console.log('Using key: [redacted]');

      await encryptDirectory(inputDir, outputDir, keyString, {
        clean: options.clean,
        manifest: options.manifest
      });

      console.log('Encryption completed successfully!');

    } catch (error) {
      console.error('Encryption failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Run self-test to verify encryption/decryption consistency')
  .option('-k, --key <string>', 'Test key string', 'test-key-12345')
  .action(async (options) => {
    const { encryptData, decryptData } = await import('../src/crypto.js');

    try {
      console.log('Running encryption/decryption test...');

      // Test with different data sizes
      const testData = [
        'Hello World',
        'A'.repeat(100),
        'B'.repeat(1000),
        'C'.repeat(10000),
        JSON.stringify({ test: 'data', number: 12345 })
      ];

      for (let i = 0; i < testData.length; i++) {
        const data = new TextEncoder().encode(testData[i]);
        console.log(`Testing data size: ${data.length} bytes`);

        const encrypted = await encryptData(data, options.key);
        const decrypted = await decryptData(encrypted, options.key);
        const decryptedText = new TextDecoder().decode(decrypted);

        if (decryptedText !== testData[i]) {
          throw new Error(`Test ${i + 1} failed: decrypted data doesn't match original`);
        }

        console.log(`✓ Test ${i + 1} passed`);
      }

      console.log('All tests passed!');

    } catch (error) {
      console.error('Test failed:', error.message);
      process.exit(1);
    }
  });

program.parse();
