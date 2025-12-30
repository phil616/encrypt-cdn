// Test Service Worker functionality
self.addEventListener('message', async (event) => {
  const { type, testData } = event.data;

  if (type === 'TEST_DECRYPTION') {
    try {
      // Import crypto functions
      importScripts('./crypto.js');

      // Test decryption
      const result = await decryptData(testData.encrypted, testData.key);

      // Send result back
      event.ports[0].postMessage({
        success: true,
        result: new TextDecoder().decode(result)
      });
    } catch (error) {
      event.ports[0].postMessage({
        success: false,
        error: error.message
      });
    }
  }
});
