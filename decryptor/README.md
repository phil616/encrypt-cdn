# Decryptor 前端应用

基于 Vite + TypeScript 的前端解密应用，支持 AES-GCM 解密和 OAuth2.1 PKCE 认证。

## 功能特性

- AES-GCM 解密静态资源
- Service Worker 拦截和解密请求
- 支持手动密钥输入和 OAuth 登录
- Vite 开发服务器
- 响应式设计

## 项目结构

```
decryptor/
├── public/                 # 静态资源目录
│   ├── index.html         # 首页入口
│   ├── consult.html       # 咨询页面入口
│   ├── shop.html          # 商城页面入口
│   ├── bootstrap.js       # 引导脚本
│   ├── sw.js             # Service Worker
│   ├── enc/              # 加密资源目录（由 encryptor 生成）
│   └── oauth/
│       └── callback.html  # OAuth 回调页面
├── src/                   # 源代码
│   ├── crypto.ts         # 解密工具
│   ├── oauth.ts          # OAuth 认证
│   └── types.ts          # 类型定义
├── package.json
├── vite.config.ts         # Vite 配置
└── README.md
```

## 安装和运行

```bash
cd decryptor
npm install
npm run dev
```

## 开发配置

### Vite Proxy 配置

为了解决本地开发时的 CORS 问题，Vite 配置了代理：

```typescript
proxy: {
  '/oidc': {
    target: 'https://api.dreamreflex.com',
    changeOrigin: true
  },
  '/key': {
    target: 'https://api.dreamreflex.com',
    changeOrigin: true
  }
}
```

### 环境变量

支持通过 `.env` 文件覆盖 OIDC 配置：

```env
VITE_OIDC_AUTH_ENDPOINT=https://your-oidc-provider.com/oauth/authorize
VITE_OIDC_TOKEN_ENDPOINT=https://your-oidc-provider.com/oauth/token
```

## 工作原理

### 1. 引导流程 (bootstrap.js)

1. 检查 Cookie 中是否存在解密密钥
2. 如果有密钥，注册 Service Worker 并传递密钥
3. 如果没有密钥，显示密钥输入界面

### 2. Service Worker 解密

1. 拦截所有同源 fetch 请求（除明文文件外）
2. 将请求路径 `/path` 映射到 `/enc/path.enc`
3. 解密 AES-GCM 加密的数据
4. 返回正确 MIME 类型的响应

### 3. OAuth 认证流程

1. 生成 PKCE code_verifier 和 code_challenge
2. 重定向到 OIDC authorization_endpoint
3. 回调页面处理 code，交换 access_token
4. 使用 token 调用密钥 API 获取解密密钥
5. 存储密钥并刷新页面

## 加密格式

Service Worker 期望的加密文件格式：

```
magic(8 bytes): "DRXENC01"
ivLen(1 byte): 12
iv(12 bytes): 随机初始化向量
ciphertext: AES-GCM 加密数据（含认证标签）
```

## API 接口

### OIDC Discovery

```
GET /oidc/.well-known/openid-configuration
```

### 密钥获取

```
GET /key/api/application-key/info
Authorization: Bearer <access_token>
```

响应格式：
```json
{
  "has_key": true,
  "application_key": {
    "key": "your-decryption-key"
  }
}
```

## 密钥存储

- **解密密钥**: 存储在 Cookie 中 (`dec_key`)
- **访问令牌**: 存储在 sessionStorage 中 (`access_token`)
- **认证状态**: 存储在 sessionStorage 中 (`auth_state`)

## 调试指南

### Service Worker 调试

1. 打开 Chrome DevTools → Application → Service Workers
2. 查看 SW 状态和错误日志
3. 使用 "Update" 强制刷新 SW

### 网络请求调试

1. Network 面板查看请求
2. 确认加密文件正确加载
3. 检查 MIME 类型是否正确

### 控制台命令

```javascript
// 手动登出
logout();

// 查看当前密钥状态
console.log('Decryption key:', document.cookie.includes('dec_key'));
console.log('Access token:', sessionStorage.getItem('access_token'));
```

## 常见问题

### CORS 问题

**本地开发**: 使用 Vite proxy 解决
**生产环境**: 确保 API 服务器配置了正确的 CORS 策略

### Service Worker 更新

如果 SW 代码有更新：
1. 关闭所有浏览器标签页
2. 重新打开应用
3. 或在 DevTools 中强制更新 SW

### 密钥错误

- 检查密钥是否正确
- 确认 Cookie 没有过期
- 尝试重新输入密钥或重新登录

## 构建部署

```bash
npm run build
```

将 `dist` 目录部署到静态托管服务。

## 安全注意事项

- 解密密钥存储在客户端 Cookie 中
- Cookie 设置 `SameSite=Lax`，不支持 HttpOnly（因为 JS 需要读取）
- 生产环境建议使用 HTTPS
- OAuth token 仅在会话期间有效
