/**
 * Bootstrap script for the encrypted static site application.
 * Handles authentication, Service Worker registration, and content decryption.
 */

// Global error handlers for production monitoring
window.addEventListener('error', (event) => {
  console.error('Application error:', event.error);
  console.error('Error message:', event.message);
  // Only log stack in development
  if (window.location.hostname === 'localhost') {
    console.error('Error stack:', event.error?.stack);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  if (window.location.hostname === 'localhost') {
    console.error('Rejection stack:', event.reason?.stack);
  }
});

/**
 * Main application initialization
 * Runs when DOM content is loaded
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('=== DOMContentLoaded fired ===');

  // Check if this is a SW-triggered reload
  const swReloadFlag = sessionStorage.getItem('sw_reload_in_progress');
  if (swReloadFlag) {
    console.log('=== SW-triggered reload detected, loading decrypted content ===');
    sessionStorage.removeItem('sw_reload_in_progress');

    // Mark that content has been loaded to prevent re-triggering reload
    sessionStorage.setItem('content_loaded', 'true');

    // SW should now intercept requests, but we need to trigger content loading
    loadDecryptedContent();
    return;
  }

  // Check if content has already been loaded in this session
  const contentLoaded = sessionStorage.getItem('content_loaded');
  if (contentLoaded) {
    console.log('=== Content already loaded in this session, skipping initialization ===');
    return;
  }

  try {
    console.log('=== Starting bootstrap initialization ===');
    // Check if we already have a decryption key from cookie
    const existingKey = getCookie('dec_key');
    console.log('Cookie check result:', existingKey ? `key found (${existingKey.length} chars)` : 'no key');

    // Validate key format (should be non-empty string)
    const hasValidKey = existingKey && typeof existingKey === 'string' && existingKey.trim().length > 0;
    console.log('Key validation:', hasValidKey ? 'valid' : 'invalid');

    // Check if this is a redirect from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const fromOAuth = urlParams.has('oauth_success');
    console.log('OAuth redirect check:', fromOAuth);
    if (fromOAuth) {
      console.log('Detected OAuth redirect, cleaning up URL');
      // Clean up OAuth redirect marker
      urlParams.delete('oauth_success');
      const newUrl = urlParams.toString() ?
        `${window.location.pathname}?${urlParams.toString()}` :
        window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      // Force content loading for OAuth redirects with valid key
      if (hasValidKey) {
        console.log('OAuth redirect with valid key, forcing content load');
        setTimeout(async () => {
          await forceContentLoad();
        }, 500);
        return;
      }
    }

    if (hasValidKey) {
      console.log('Has valid key, checking Service Worker status');
      // Check if Service Worker is already active
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        console.log('Service Worker is active, checking key status');
        // Try to ping Service Worker to see if it has the key
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration && registration.active) {
            // Ping SW to check key status
            console.log('Sending PING to Service Worker...');
            const channel = new MessageChannel();
            const pingPromise = new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                console.error('SW ping timeout after 5000ms');
                reject(new Error('SW ping timeout'));
              }, 5000); // Increase timeout to 5 seconds

              channel.port1.onmessage = (event) => {
                console.log('Received response from SW:', event.data);
                clearTimeout(timeout);
                resolve(event.data);
              };

              channel.port1.onmessageerror = (error) => {
                console.error('Message channel error:', error);
                clearTimeout(timeout);
                reject(error);
              };
            });

            registration.active.postMessage({ type: 'PING' }, [channel.port2]);

            console.log('Waiting for SW response...');
            const response = await pingPromise;
            console.log('SW ping response received:', response);

            if (response.keyAvailable) {
              console.log('SW already has key, checking if content needs loading');

              // Check if content has already been loaded
              const contentLoaded = sessionStorage.getItem('content_loaded');
              if (contentLoaded) {
                console.log('Content already loaded, no need to reload');
                addLogoutButton();
                return;
              }

              console.log('Content not loaded yet, triggering reload for decryption');
              addLogoutButton();
              // Use location.replace to ensure SW intercepts the navigation
              console.log('Using location.replace to trigger SW content decryption...');
              sessionStorage.setItem('sw_reload_in_progress', 'true');
              setTimeout(() => {
                window.location.replace(window.location.href);
              }, 100);
              return;
            } else {
              console.log('SW does not have key, sending key...');
              // Send key to existing Service Worker
              registration.active.postMessage({ type: 'SET_KEY', key: existingKey });
              addLogoutButton();
              console.log('Key sent to SW, waiting for content...');
              return;
            }
          }
        } catch (error) {
          console.warn('SW ping failed:', error);
          console.log('Falling back to Service Worker re-registration...');
          // Fall back to re-registration
        }
      }

      // Register new Service Worker if not active or ping failed
      try {
        const registration = await registerServiceWorker(existingKey);
        addLogoutButton();

      } catch (error) {
        console.error('Service Worker 设置失败:', error);
        showError('Service Worker 设置失败，请刷新页面重试');
      }

      return;
    }

    // No existing key, show input UI
    console.log('No valid key found, showing input UI');
    showKeyInputUI();

  } catch (error) {
    console.error('=== BOOTSTRAP ERROR ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    showError('初始化失败: ' + error.message);
    // Fallback: show input UI after error
    setTimeout(() => showKeyInputUI(), 1000);
  }
});

// Show loading state
function showLoadingState(message) {
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'loading-state';
  loadingDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    text-align: center;
    z-index: 10000;
  `;
  loadingDiv.innerHTML = `
    <div style="margin-bottom: 10px;">🔄</div>
    <div>${message}</div>
  `;
  document.body.appendChild(loadingDiv);
}


/**
 * Force content loading by checking Service Worker status and triggering reload if needed
 * Used for OAuth redirects to ensure content loads properly
 */
async function forceContentLoad() {
  try {
    // Check if Service Worker is active
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.active) {
        // Ping Service Worker to check key status
        const channel = new MessageChannel();
        const pingPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Service Worker ping timeout')), 2000);
          channel.port1.onmessage = (event) => {
            clearTimeout(timeout);
            resolve(event.data);
          };
        });

        registration.active.postMessage({ type: 'PING' }, [channel.port2]);
        const response = await pingPromise;

        if (response.keyAvailable) {
          // Service Worker has key, trigger refresh to ensure content loads
          setTimeout(() => {
            window.location.reload();
          }, 100);
        } else {
          // Send key to Service Worker
          const key = getCookie('dec_key');
          if (key) {
            registration.active.postMessage({ type: 'SET_KEY', key });
            setTimeout(() => {
              window.location.reload();
            }, 300);
          }
        }
      }
    } else {
      // No active Service Worker, register new one
      const key = getCookie('dec_key');
      if (key) {
        await registerServiceWorker(key);
        setTimeout(() => {
          window.location.reload();
        }, 300);
      }
    }
  } catch (error) {
    console.error('Force content load failed:', error);
    // Fallback: just reload
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
}

// Get cookie value
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Set cookie
function setCookie(name, value, days = 30) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  const cookieString = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  document.cookie = cookieString;
}

// Register service worker with key
/**
 * Register and configure Service Worker for content decryption
 * @param {string} key - The decryption key
 */
async function registerServiceWorker(key) {
  if (!('serviceWorker' in navigator)) {
    throw new Error('您的浏览器不支持 Service Worker，无法使用此应用。');
  }

  try {
    // Check if SW is already registered
    let registration = await navigator.serviceWorker.getRegistration('/sw.js');

    if (!registration) {
      // Register new Service Worker
      registration = await navigator.serviceWorker.register('/sw.js');
    } else {
      // Update existing registration
      registration.update();
    }

    // Wait for SW to be ready with timeout
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Service Worker 初始化超时')), 10000);
    });

    await Promise.race([readyPromise, timeoutPromise]);

/**
 * Verify decryption key by attempting to decrypt a test file
 * @param {string} key - The key to verify
 * @returns {boolean} True if key is valid
 */
const verifyKeyWithTestFile = async (key) => {
  try {
    // Fetch and decrypt the index.html.enc file as a test
    const response = await fetch('/enc/index.html.enc');
    if (!response.ok) {
      throw new Error('Cannot fetch test file');
    }

    const encryptedData = await response.arrayBuffer();

    // Try to decrypt with the provided key using Web Crypto API directly
    const keyData = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Parse the encrypted file format
    const dataView = new DataView(encryptedData);
    const magicBytes = new Uint8Array(encryptedData, 0, 8);
    const magic = new TextDecoder().decode(magicBytes);

    if (magic !== 'DRXENC01') {
      throw new Error('Invalid encrypted file format');
    }

    const ivLen = dataView.getUint8(8);
    if (ivLen !== 12) {
      throw new Error('Unsupported IV length');
    }

    const iv = new Uint8Array(encryptedData, 9, 12);
    const ciphertext = encryptedData.slice(21);

    // Try to decrypt
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );

    return true;
  } catch (error) {
    console.error('Key verification failed:', error.message);
    return false;
  }
};

// Send key to SW with verification
const sendKeyWithVerification = async (sw, key) => {
  if (!sw) return false;


  // Create message channel for verification
  const channel = new MessageChannel();
  const verificationPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('SW key confirmation timeout')), 3000);

    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      if (event.data.type === 'KEY_SET' && event.data.success) {
        resolve(true);
      } else {
        reject(new Error('SW key confirmation failed'));
      }
    };
  });

  // Send key with verification channel
  sw.postMessage({ type: 'SET_KEY', key }, [channel.port2]);

  try {
    await verificationPromise;
    return true;
  } catch (error) {
    console.error('SW key confirmation failed:', error);
    return false;
  }
};

    // Verify the key can actually decrypt files
    const isKeyValid = await verifyKeyWithTestFile(key);

    if (!isKeyValid) {
      // Clear the invalid cookie
      setCookie('dec_key', '', -1);
      showError('提供的解密密钥无效');
      setTimeout(() => showKeyInputUI(), 2000);
      return;
    }

    // Send to active SW first (most important)
    let keySent = false;
    if (registration.active) {
      keySent = await sendKeyWithVerification(registration.active, key);
    }

    // Also try waiting and installing SWs
    if (!keySent && registration.waiting) {
      keySent = await sendKeyWithVerification(registration.waiting, key);
    }
    if (!keySent && registration.installing) {
      keySent = await sendKeyWithVerification(registration.installing, key);
    }

    if (keySent) {
    } else {
      console.error('Failed to send key to any Service Worker');
      showError('无法将密钥传递给系统，请刷新页面重试');
      return;
    }
    return registration;

  } catch (error) {
    console.error('Service Worker registration failed:', error);
    throw error;
  }
}

// Unregister service worker
async function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
  }
}

// Show key input UI
/**
 * Display the key input user interface
 * Shows manual key input form and OAuth login option
 */
function showKeyInputUI() {
  if (!document.body) {
    // Retry if document body is not ready
    setTimeout(showKeyInputUI, 100);
    return;
  }

  const ui = document.createElement('div');
  ui.id = 'decryption-ui';
  ui.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #f5f7fb;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 16px;
    ">
      <div style="
        width: min(760px, 100%);
      ">
        <div style="
          background: #fff;
          border: 1px solid #eef0f3;
          border-radius: 16px;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
          padding: 28px 32px;
        ">
          <h2 style="margin: 0 0 10px; font-size: 28px; font-weight: 700; color: #111827;">需要解密密钥</h2>
          <p style="margin: 0 0 18px; color: #4b5563; font-size: 15px;">
            此站点的内容已被加密。请提供解密密钥或使用 OAuth 登录获取密钥。
          </p>

          <div id="error-message" style="
            color: #dc2626;
            margin-bottom: 15px;
            display: none;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 10px;
            padding: 12px;
            font-size: 14px;
          "></div>

          <div style="margin-bottom: 24px;">
            <label style="
              display: block;
              margin-bottom: 8px;
              font-weight: 600;
              color: #111827;
              font-size: 14px;
            ">手动输入密钥:</label>
            <input
              type="password"
              id="key-input"
              placeholder="输入解密密钥"
              style="
                width: 100%;
                padding: 12px;
                border: 1px solid #d1d5db;
                border-radius: 10px;
                font-size: 14px;
                box-sizing: border-box;
                background: #fff;
              "
            />
          </div>

          <div style="display: flex; gap: 12px; flex-direction: column;">
            <button
              id="manual-key-btn"
              style="
                border: none;
                border-radius: 10px;
                padding: 0 18px;
                height: 42px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                background: #111;
                color: #fff;
                box-shadow: 0 10px 30px rgba(17, 17, 17, 0.15);
                width: 100%;
              "
              onmouseover="this.style.background='#000'; this.style.transform='translateY(-1px)';"
              onmouseout="this.style.background='#111'; this.style.transform='translateY(0)';"
            >
              使用手动密钥
            </button>

            <button
              id="oauth-btn"
              style="
                border: none;
                border-radius: 10px;
                padding: 0 18px;
                height: 42px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                background: #2f7bbf;
                color: #fff;
                box-shadow: 0 10px 30px rgba(47,123,191,0.15);
                width: 100%;
              "
              onmouseover="this.style.background='#2563eb'; this.style.transform='translateY(-1px)';"
              onmouseout="this.style.background='#2f7bbf'; this.style.transform='translateY(0)';"
            >
              使用 OAuth 登录获取密钥
            </button>
          </div>

          <div style="margin-top: 18px; text-align: center;">
            <small style="color: #6b7280; font-size: 13px;">
              密钥将在本地存储，有效期 30 天
            </small>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(ui);

  // Bind events
  const manualKeyBtn = document.getElementById('manual-key-btn');
  if (manualKeyBtn) {
    manualKeyBtn.addEventListener('click', async (event) => {
      event.preventDefault(); // Prevent any default form submission

      const key = document.getElementById('key-input').value.trim();

      if (!key) {
        showError('请输入解密密钥');
        return;
      }

      try {
        hideError();
        setCookie('dec_key', key);

        await registerServiceWorker(key);

        // Show success message and reload
        alert('🎉 密钥验证成功！\n\n正在加载解密内容...');

        // Auto-reload with delay
        setTimeout(() => {
          try {
            ui.remove();
            window.location.reload();
          } catch (removeError) {
            window.location.reload();
          }
        }, 200);

      } catch (error) {
        console.error('密钥设置失败:', error.message);
        showError('密钥设置失败: ' + error.message);
      }
    });
  } else {
    console.error('Manual key button not found!');
  }

  document.getElementById('oauth-btn').addEventListener('click', async () => {
    try {
      hideError();
      await startOAuthFlow();
    } catch (error) {
      showError('OAuth login initiation failed: ' + error.message);
    }
  });

  // Handle Enter key in input
  document.getElementById('key-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('manual-key-btn').click();
    }
  });
}

// Start OAuth flow
async function startOAuthFlow() {
  try {
    // Import oauth module dynamically
    const { startAuthorization } = await import('./oauth.js');
    await startAuthorization();
  } catch (error) {
    console.error('OAuth module import failed:', error);
    throw new Error('OAuth module loading failed, please check network connection');
  }
}

// Show error message
function showError(message) {
  const errorEl = document.getElementById('error-message');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

// Hide error message
function hideError() {
  const errorEl = document.getElementById('error-message');
  if (errorEl) {
    errorEl.style.display = 'none';
  }
}

// Logout function (can be called from console or UI)
/**
 * Log out the user by clearing authentication data and resetting the application
 */
window.logout = async function() {
  // Clear decryption key from cookie
  setCookie('dec_key', '', -1);

  // Clear tokens and session state
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('auth_state');
  sessionStorage.removeItem('content_loaded'); // Clear content loaded flag
  sessionStorage.removeItem('sw_reload_in_progress'); // Clear any pending reload flags

  // Notify Service Worker to clear key
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_KEY' });
  }

  // Wait a moment for SW to process
  await new Promise(resolve => setTimeout(resolve, 100));

  // Unregister Service Worker
  await unregisterServiceWorker();

  // Reload page
  window.location.reload();
};

// Add logout button to page (if needed)
function addLogoutButton() {
  // Check if DOM is ready and logout button doesn't already exist
  if (!document.body || document.getElementById('logout-btn')) {
    return;
  }

  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'logout-btn';
  logoutBtn.textContent = 'Logout';
  logoutBtn.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 8px 16px;
    background: #f44336;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    z-index: 1000;
  `;
  logoutBtn.onclick = window.logout;
  document.body.appendChild(logoutBtn);
}

/**
 * Manually load and display decrypted content when SW is ready
 */
async function loadDecryptedContent() {
  console.log('Loading decrypted content manually...');

  try {
    // Load the decrypted index.html content
    const response = await fetch('/index.html');
    if (!response.ok) {
      throw new Error('Failed to load decrypted content');
    }

    const htmlContent = await response.text();
    console.log('Decrypted content loaded, length:', htmlContent.length);

    // Replace the current page content with decrypted content
    document.open();
    document.write(htmlContent);
    document.close();

    console.log('Page content replaced with decrypted content');

  } catch (error) {
    console.error('Failed to load decrypted content:', error);
    // Fallback: show error
    document.body.innerHTML = `
      <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif; color: red;">
        <h1>加载失败</h1>
        <p>无法加载解密内容: ${error.message}</p>
        <button onclick="location.reload()">重试</button>
      </div>
    `;
  }
}

// Add logout button if we have a key (with DOM ready check)
if (getCookie('dec_key')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addLogoutButton);
  } else {
    addLogoutButton();
  }
}
