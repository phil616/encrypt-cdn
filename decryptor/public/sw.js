/**
 * Service Worker for handling encrypted static site content
 * Intercepts fetch requests and decrypts AES-GCM encrypted files
 */

importScripts('./crypto.js');

let decryptionKey = null;

// Check if request should be handled by SW
function shouldInterceptRequest(url) {
  // Get the Service Worker scope to handle relative paths correctly
  const scope = self.registration ? self.registration.scope : '/';
  const scopeUrl = new URL(scope, location.origin);
  const relativePath = url.pathname.replace(scopeUrl.pathname.replace(/\/$/, ''), '');

  // Don't intercept SW itself, oauth callback, crypto.js, bootstrap.js, config files, and app scripts
  const plainPaths = [
    '/sw.js',
    '/oauth/callback.html',
    '/oauth-config.js',
    '/oauth.js',
    '/crypto.js',
    '/bootstrap.js',
    '/consult.html',
    '/shop.html',
    '/test-decryption.html',
    '/test-sw.js'
  ];

  // Check both absolute paths and relative paths
  if (plainPaths.some(path => url.pathname === path || relativePath === path)) {
    return false;
  }

  // Check if this path has a corresponding encrypted file
  // Only intercept if we have the decryption key
  if (!decryptionKey) {
    return false;
  }

  // Intercept HTML, CSS, JS files and static assets
  const interceptPatterns = [
    /\.html$/,
    /\.css$/,
    /\.js$/,
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.gif$/,
    /\.svg$/,
    /\.ico$/,
    /\.woff$/,
    /\.woff2$/,
    /\.ttf$/,
    /^\/assets\//,
    /^\/img\//
  ];

  return interceptPatterns.some(pattern => pattern.test(url.pathname));
}

// Handle fetch events
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Check if this request should be intercepted
  if (!shouldInterceptRequest(url)) {
    console.log('SW: Not intercepting request:', url.pathname);
    return;
  }

  console.log('SW: Intercepting request:', url.pathname);
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const originalPath = url.pathname;

  // If no decryption key is available, let the request pass through to the server
  if (!decryptionKey) {
    return fetch(request);
  }

  // Map to encrypted file path
  // Use the Service Worker's scope as base path to handle different deployment paths
  const scope = self.registration ? self.registration.scope : '/';
  const baseUrl = new URL(scope, location.origin);
  const encryptedPath = `enc${originalPath}.enc`;
  const encryptedUrl = new URL(encryptedPath, baseUrl);

  try {
    // Fetch encrypted file
    const encryptedResponse = await fetch(encryptedUrl);

    if (!encryptedResponse.ok) {
      console.error('SW: Encrypted file not found:', encryptedResponse.status, encryptedResponse.statusText);
      return createErrorResponse(`File not found: ${originalPath}`, 404, originalPath);
    }

    // Get encrypted data
    const encryptedData = await encryptedResponse.arrayBuffer();

    // Decrypt data

    const decryptedData = await decryptData(encryptedData, decryptionKey);

    // For HTML files, inject necessary scripts and logout button
    if (originalPath.endsWith('.html') || originalPath === '/') {
      const htmlContent = new TextDecoder().decode(decryptedData);

      // Inject bootstrap script and logout button
      const modifiedHtml = injectBootstrapContent(htmlContent, originalPath);

      return new Response(modifiedHtml, {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // Return decrypted response with correct MIME type
    return new Response(decryptedData, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': getMimeType(originalPath),
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (error) {
    console.error('SW: Decryption error for', originalPath, ':', error);
    console.error('SW: Error details:', error.message, error.stack);

    // If decryption failed, clear the key and redirect to home for re-entry
    if (decryptionKey) {
      decryptionKey = null;

      // For HTML requests, redirect to home page to allow key re-entry
      if (originalPath.endsWith('.html') || originalPath === '/') {
        return Response.redirect(new URL('/index.html', location.origin), 302);
      }
    }

    return createErrorResponse('密钥无效，请重新输入正确密钥', 401, originalPath);
  }
}

// Create error response
function createErrorResponse(message, status, originalPath) {
  const isHtml = originalPath.endsWith('.html') || originalPath === '/';

  if (isHtml) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Decryption Error</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #d32f2f; background: #ffebee; padding: 20px; border-radius: 8px; }
          button { padding: 10px 20px; margin: 10px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; }
          button:hover { background: #1565c0; }
          .warning { color: #f57c00; background: #fff3e0; padding: 15px; border-radius: 4px; margin: 20px 0; }
        </style>
        <script>
          function resetSystem() {
            // Clear all service workers
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) {
                  registration.unregister();
                }
              });
            }

            // Clear cookies
            document.cookie.split(";").forEach(function(c) {
              document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });

            // Clear storage
            localStorage.clear();
            sessionStorage.clear();

            // Redirect to home
            setTimeout(function() {
              window.location.href = '/index.html';
            }, 500);
          }

          function goHome() {
            resetSystem();
          }
        </script>
      </head>
      <body>
        <div class="error">
          <h1>🔐 解密错误</h1>
          <p>${message}</p>
        </div>

        <div class="warning">
          <strong>⚠️ 系统将重置以允许重新输入密钥</strong><br>
          这将清除所有缓存的密钥和服务工作线程。
        </div>

        <div>
          <button onclick="resetSystem()">🔄 重置系统并重新输入密钥</button>
          <button onclick="goHome()">🏠 返回首页</button>
        </div>

        <div style="margin-top: 30px; color: #666; font-size: 14px;">
          如果问题持续，请完全关闭浏览器并重新打开。
        </div>
      </body>
      </html>
    `;
    return new Response(html, {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } else {
    return new Response(`Decryption Error: ${message}`, {
      status: status === 404 ? 404 : 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('SW: Received message:', event.data.type);
  const { type, key } = event.data;

  if (type === 'SET_KEY') {
    console.log('SW: Setting decryption key');
    decryptionKey = key;

    // Send confirmation back through the message port
    if (event.ports && event.ports[0]) {
      console.log('SW: Sending key confirmation');
      event.ports[0].postMessage({ type: 'KEY_SET', success: true });
    } else {
      console.warn('SW: No message port available for key confirmation');
    }
  } else if (type === 'CLEAR_KEY') {
    console.log('SW: Clearing decryption key');
    decryptionKey = null;
  } else if (type === 'PING') {
    console.log('SW: Received PING, key available:', !!decryptionKey);
    if (event.ports && event.ports[0]) {
      console.log('SW: Sending PONG response');
      event.ports[0].postMessage({ type: 'PONG', keyAvailable: !!decryptionKey });
    } else {
      console.warn('SW: No message port available for PING response');
    }
  }
});

// Inject bootstrap content into decrypted HTML
function injectBootstrapContent(htmlContent, originalPath) {
  // Simple string replacement to ensure bootstrap script is present
  // Remove any existing bootstrap script first
  htmlContent = htmlContent.replace(/<script[^>]*bootstrap\.js[^>]*><\/script>/gi, '');

  // Add bootstrap script before </head>
  const headEndPattern = /<\/head>/i;
  const bootstrapScript = '<script src="/bootstrap.js"></script>';

  if (headEndPattern.test(htmlContent)) {
    htmlContent = htmlContent.replace(headEndPattern, bootstrapScript + '</head>');
  }

  return htmlContent;
}

// Service worker lifecycle
// Service Worker lifecycle events
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    clients.claim()
  );
});
