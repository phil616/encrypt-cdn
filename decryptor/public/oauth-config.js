// OAuth Configuration
// This file contains OAuth client configuration that can be customized

window.OAUTH_CONFIG = {
  // OAuth Client Configuration
  client_id: 'app_numyflz8ezr9eyc',
  redirect_uri: `${window.location.origin}/oauth/callback.html`,
  scope: 'openid profile email',

  // OIDC Discovery Configuration
  discovery_url: 'https://api.dreamreflex.com/.well-known/openid-configuration',

  // Key API Configuration
  key_api_url: 'https://api.dreamreflex.com/api/application-key/info',

  // UI Customization
  provider_name: 'DreamReflex',
  login_button_text: '使用 OAuth 登录',

  // Advanced Settings
  response_type: 'code',
  code_challenge_method: 'S256',

  // PKCE Settings
  code_verifier_length: 128,
  state_length: 32,
  nonce_length: 32
};

// Function to get OAuth config (allows runtime overrides)
window.getOAuthConfig = function() {
  return window.OAUTH_CONFIG || {
    client_id: 'app_numyflz8ezr9eyc',
    redirect_uri: `${window.location.origin}/oauth/callback.html`,
    scope: 'openid profile email',
    discovery_url: '/oidc/.well-known/openid-configuration',
    key_api_url: '/key/api/application-key/info',
    provider_name: 'DreamReflex',
    login_button_text: '使用 OAuth 登录',
    response_type: 'code',
    code_challenge_method: 'S256',
    code_verifier_length: 128,
    state_length: 32,
    nonce_length: 32
  };
};

// Function to update OAuth config at runtime
window.updateOAuthConfig = function(newConfig) {
  window.OAUTH_CONFIG = { ...window.getOAuthConfig(), ...newConfig };
  console.log('OAuth config updated:', window.OAUTH_CONFIG);
};
