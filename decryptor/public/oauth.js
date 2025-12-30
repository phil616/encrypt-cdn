// OAuth utilities for frontend
// getOAuthConfig is available globally from oauth-config.js

// Generate random string for PKCE
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate code challenge from verifier
async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Get OIDC configuration
export async function getOidcConfig() {
  const config = window.getOAuthConfig();
  const response = await fetch(config.discovery_url);
  if (!response.ok) {
    throw new Error('Failed to fetch OIDC configuration');
  }
  return response.json();
}

// Start OAuth authorization flow
export async function startAuthorization() {
  try {
    const oidcConfig = await getOidcConfig();
    const oauthConfig = window.getOAuthConfig();

    // Generate PKCE values
    const codeVerifier = generateRandomString(oauthConfig.code_verifier_length);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateRandomString(oauthConfig.state_length);
    const nonce = generateRandomString(oauthConfig.nonce_length);

    // Store auth state
    const authState = {
      code_verifier: codeVerifier,
      state,
      nonce,
      preAuthPath: window.location.pathname
    };
    sessionStorage.setItem('auth_state', JSON.stringify(authState));

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: oauthConfig.response_type,
      client_id: oauthConfig.client_id,
      redirect_uri: oauthConfig.redirect_uri,
      scope: oauthConfig.scope,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: oauthConfig.code_challenge_method
    });

    console.log('Starting OAuth flow with config:', oauthConfig);
    console.log('Authorization URL:', `${oidcConfig.authorization_endpoint}?${params.toString()}`);

    // Redirect to authorization endpoint
    window.location.href = `${oidcConfig.authorization_endpoint}?${params.toString()}`;

  } catch (error) {
    console.error('Failed to start authorization:', error);
    throw error;
  }
}

// Exchange authorization code for token
export async function exchangeCodeForToken(code, state) {
  try {
    const oidcConfig = await getOidcConfig();
    const oauthConfig = window.getOAuthConfig();
    const authStateStr = sessionStorage.getItem('auth_state');

    if (!authStateStr) {
      throw new Error('No authorization state found');
    }

    const authState = JSON.parse(authStateStr);

    if (authState.state !== state) {
      throw new Error('State mismatch - possible CSRF attack');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: oauthConfig.redirect_uri,
      client_id: oauthConfig.client_id,
      code_verifier: authState.code_verifier
    });

    console.log('Exchanging code for token with config:', oauthConfig);

    const response = await fetch(oidcConfig.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
    }

    const tokenResponse = await response.json();
    sessionStorage.setItem('access_token', tokenResponse.access_token);

    return tokenResponse;

  } catch (error) {
    console.error('Token exchange failed:', error);
    throw error;
  }
}

// Get application key using access token
export async function getApplicationKey() {
  try {
    const oauthConfig = window.getOAuthConfig();
    const accessToken = sessionStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('No access token available');
    }

    console.log('Fetching application key from:', oauthConfig.key_api_url);

    const response = await fetch(oauthConfig.key_api_url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Key API request failed: ${response.status} ${response.statusText}`);
    }

    const keyInfo = await response.json();

    if (!keyInfo.has_key || !keyInfo.application_key?.key) {
      throw new Error('No decryption key available for this user');
    }

    return keyInfo.application_key.key;

  } catch (error) {
    console.error('Failed to get application key:', error);
    throw error;
  }
}

// Clear authentication data
export function clearAuth() {
  document.cookie = 'dec_key=; expires=Thu, 01 Jan 1970 00:0000 GMT; path=/';
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('auth_state');
}
