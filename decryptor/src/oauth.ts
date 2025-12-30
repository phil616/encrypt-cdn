import type { OidcConfig, TokenResponse, KeyInfoResponse, AuthState } from './types.ts';

// Generate random string for PKCE
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate code challenge from verifier
async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Get OIDC configuration
export async function getOidcConfig(): Promise<OidcConfig> {
  const response = await fetch('/oidc/.well-known/openid-configuration');
  if (!response.ok) {
    throw new Error('Failed to fetch OIDC configuration');
  }
  return response.json();
}

// Start OAuth authorization flow
export async function startAuthorization(): Promise<void> {
  try {
    const config = await getOidcConfig();

    // Generate PKCE values
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateRandomString(32);
    const nonce = generateRandomString(32);

    // Store auth state
    const authState: AuthState = {
      code_verifier: codeVerifier,
      state,
      nonce,
      preAuthPath: window.location.pathname
    };
    sessionStorage.setItem('auth_state', JSON.stringify(authState));

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: 'dreamreflex-client', // This should be configurable
      redirect_uri: `${window.location.origin}/oauth/callback.html`,
      scope: 'openid profile email',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    // Redirect to authorization endpoint
    window.location.href = `${config.authorization_endpoint}?${params.toString()}`;

  } catch (error) {
    console.error('Failed to start authorization:', error);
    throw error;
  }
}

// Exchange authorization code for token
export async function exchangeCodeForToken(code: string, state: string): Promise<TokenResponse> {
  try {
    const config = await getOidcConfig();
    const authStateStr = sessionStorage.getItem('auth_state');

    if (!authStateStr) {
      throw new Error('No authorization state found');
    }

    const authState: AuthState = JSON.parse(authStateStr);

    if (authState.state !== state) {
      throw new Error('State mismatch - possible CSRF attack');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${window.location.origin}/oauth/callback.html`,
      client_id: 'dreamreflex-client', // This should be configurable
      code_verifier: authState.code_verifier
    });

    const response = await fetch(config.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
    }

    const tokenResponse: TokenResponse = await response.json();
    sessionStorage.setItem('access_token', tokenResponse.access_token);

    return tokenResponse;

  } catch (error) {
    console.error('Token exchange failed:', error);
    throw error;
  }
}

// Get application key using access token
export async function getApplicationKey(): Promise<string> {
  try {
    const accessToken = sessionStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch('/key/api/application-key/info', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Key API request failed: ${response.status} ${response.statusText}`);
    }

    const keyInfo: KeyInfoResponse = await response.json();

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
export function clearAuth(): void {
  document.cookie = 'dec_key=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('auth_state');
}
