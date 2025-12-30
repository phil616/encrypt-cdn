# OAuth 配置指南

本系统支持可配置的OAuth客户端参数，允许您自定义OAuth集成以适应不同的身份提供商。

## 配置方式

### 1. 修改 `oauth-config.js`

编辑 `public/oauth-config.js` 文件来设置您的OAuth配置：

```javascript
window.OAUTH_CONFIG = {
  // OAuth 客户端ID
  client_id: 'your-client-id',

  // 重定向URI（通常不需要修改）
  redirect_uri: `${window.location.origin}/oauth/callback.html`,

  // 请求的权限范围
  scope: 'openid profile email',

  // OIDC Discovery文档URL
  discovery_url: '/oidc/.well-known/openid-configuration',

  // 密钥API端点
  key_api_url: '/key/api/application-key/info',

  // UI显示名称
  provider_name: 'Your Provider Name',

  // 登录按钮文本
  login_button_text: '使用 OAuth 登录',

  // 高级设置（通常不需要修改）
  response_type: 'code',
  code_challenge_method: 'S256',
  code_verifier_length: 128,
  state_length: 32,
  nonce_length: 32
};
```

### 2. 运行时配置

您也可以在运行时通过JavaScript动态修改配置：

```javascript
// 在浏览器控制台或自定义脚本中
import { updateOAuthConfig } from '/oauth-config.js';

updateOAuthConfig({
  client_id: 'new-client-id',
  provider_name: 'New Provider',
  scope: 'openid email'
});
```

## 配置参数详解

### 基本配置

| 参数 | 说明 | 示例 |
|------|------|------|
| `client_id` | OAuth客户端ID，由身份提供商分配 | `'my-app-client'` |
| `redirect_uri` | OAuth回调URI | `'https://mydomain.com/oauth/callback.html'` |
| `scope` | 请求的权限范围 | `'openid profile email'` |

### 端点配置

| 参数 | 说明 | 示例 |
|------|------|------|
| `discovery_url` | OIDC Discovery文档URL | `'/oidc/.well-known/openid-configuration'` |
| `key_api_url` | 获取解密密钥的API端点 | `'/key/api/application-key/info'` |

### UI配置

| 参数 | 说明 | 示例 |
|------|------|------|
| `provider_name` | 提供商显示名称 | `'Microsoft'` |
| `login_button_text` | 登录按钮文本 | `'使用 Microsoft 登录'` |

### 安全配置

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `response_type` | OAuth响应类型 | `'code'` |
| `code_challenge_method` | PKCE挑战方法 | `'S256'` |
| `code_verifier_length` | 代码验证器长度 | `128` |
| `state_length` | 状态参数长度 | `32` |
| `nonce_length` | nonce参数长度 | `32` |

## 支持的身份提供商

### DreamReflex (默认)
```javascript
window.OAUTH_CONFIG = {
  client_id: 'dreamreflex-client',
  provider_name: 'DreamReflex',
  discovery_url: '/oidc/.well-known/openid-configuration',
  key_api_url: '/key/api/application-key/info'
};
```

### Microsoft Azure AD
```javascript
window.OAUTH_CONFIG = {
  client_id: 'your-azure-client-id',
  provider_name: 'Microsoft',
  scope: 'openid profile email',
  discovery_url: 'https://login.microsoftonline.com/your-tenant-id/v2.0/.well-known/openid_configuration',
  key_api_url: 'https://your-api-endpoint.com/api/keys'
};
```

### Google OAuth
```javascript
window.OAUTH_CONFIG = {
  client_id: 'your-google-client-id',
  provider_name: 'Google',
  scope: 'openid email profile',
  discovery_url: 'https://accounts.google.com/.well-known/openid_configuration',
  key_api_url: 'https://your-api-endpoint.com/api/keys'
};
```

### Auth0
```javascript
window.OAUTH_CONFIG = {
  client_id: 'your-auth0-client-id',
  provider_name: 'Auth0',
  scope: 'openid profile email',
  discovery_url: 'https://your-domain.auth0.com/.well-known/openid-configuration',
  key_api_url: 'https://your-api-endpoint.com/api/keys'
};
```

## Vite代理配置

如果您使用不同的身份提供商，需要在 `vite.config.ts` 中配置相应的代理：

```typescript
export default defineConfig({
  server: {
    proxy: {
      // OIDC Discovery
      '/oidc': {
        target: 'https://your-identity-provider.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/oidc/, '')
      },
      // Key API
      '/key': {
        target: 'https://your-api-server.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/key/, '')
      }
    }
  }
});
```

## 测试配置

配置完成后，您可以通过以下方式验证：

1. **检查控制台日志**: 启动OAuth流程时查看配置信息
2. **验证端点**: 确保Discovery和Key API端点可访问
3. **测试登录流程**: 完整的OAuth登录和密钥获取流程

## 注意事项

- `client_id` 必须与身份提供商注册的应用ID匹配
- `redirect_uri` 必须在提供商处注册为允许的重定向URI
- 确保API端点配置正确的CORS策略
- Discovery URL必须返回有效的OIDC配置

## 故障排除

### 错误: "Failed to fetch OIDC configuration"
- 检查 `discovery_url` 是否正确
- 确认代理配置正确转发请求

### 错误: "Invalid client"
- 验证 `client_id` 与提供商注册的应用匹配
- 检查 `redirect_uri` 是否在允许列表中

### 错误: "No decryption key available"
- 确认 `key_api_url` 指向正确的端点
- 检查API返回的数据格式是否正确

如果您需要支持其他身份提供商或有特定的配置需求，请参考相应提供商的文档并相应调整配置。
