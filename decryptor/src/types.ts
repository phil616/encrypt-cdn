export interface EncryptedFile {
  magic: string;
  ivLen: number;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}

export interface OidcConfig {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  grant_types_supported?: string[];
  subject_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

export interface KeyInfoResponse {
  has_key: boolean;
  application_key?: {
    id: string;
    key: string;
    is_active: boolean;
    last_used_at?: string;
    created_at: string;
    updated_at?: string;
  };
}

export interface AuthState {
  code_verifier: string;
  state: string;
  nonce?: string;
  preAuthPath: string;
}
