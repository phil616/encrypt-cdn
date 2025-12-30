# 静态站点 AES 加密解密系统

一个完整的解决方案，实现静态站点资源的 AES-GCM 加密存储和前端动态解密，保持原有 URL 路由不变。

## 项目概述

本项目包含两个主要组件：

1. **Encryptor** (加密工具): Node.js CLI 工具，将明文静态站点批量加密
2. **Decryptor** (解密前端): 基于 Vite + TypeScript 的前端应用，支持 Service Worker 解密和 OAuth 认证

## 核心特性

- **AES-GCM 加密**: 每个文件使用随机 IV，包含完整性验证
- **无缝路由**: 解密后保持原有 URL，不改变用户体验
- **双重密钥获取**: 支持手动输入和 OAuth2.1 PKCE 登录
- **Service Worker**: 透明拦截和解密网络请求
- **现代化前端**: Vite + TypeScript + 响应式设计

## 快速开始

### 1. 环境准备

```bash
# 确保安装了 Node.js 16+
node --version

# 克隆项目
git clone <repository-url>
cd oauth-static-sw
```

### 2. 加密演示站点

```bash
# 安装加密工具
cd encryptor
npm install

# 运行测试确保工具正常
npm test

# 加密演示站点
node bin/encrypt.mjs encrypt --in ../target_site --out ../decryptor/public/enc --key "csv9WNXMvFJ44QcQ56xj1dF7tDX7reWgkLubzlQ3hYZkm762Y7i9MCC0Rknzf4Hj" --clean --manifest
```

### 3. 启动解密前端

```bash
# 安装依赖
cd ../decryptor
npm install

# 启动开发服务器
npm run dev0
```

### 4. 访问应用

打开浏览器访问 `http://localhost:5173/index.html`

## 工作流程

1. **加密阶段**: 使用 CLI 工具将静态资源加密为 `.enc` 文件
2. **部署阶段**: 将加密文件和前端应用一同部署
3. **访问阶段**:
   - 用户访问明文入口 HTML
   - 前端检查解密密钥
   - 注册 Service Worker
   - SW 拦截并解密后续资源请求

## 加密格式规范

每个加密文件使用固定格式：

```
DRXENC01        # 8字节魔数
12              # 1字节 IV 长度
<12字节随机IV>  # 初始化向量
<加密数据>      # AES-GCM 密文（含认证标签）
```

密钥通过 SHA-256 哈希生成 32 字节 AES 密钥。

## OAuth Integration

### Discovery Document

```
https://api.dreamreflex.com/.well-known/openid-configuration
```

### Key Acquisition Endpoint

```
GET https://api.dreamreflex.com/api/application-key/info
Authorization: Bearer <access_token>
```

响应格式：
```json
{
  "has_key": true,
  "application_key": {
    "key": "<decryption-key>"
  }
}
```

## Project Structure

```
/
├── encryptor/              # 加密 CLI 工具
│   ├── bin/encrypt.mjs     # CLI 入口
│   ├── src/                # 加密逻辑
│   └── package.json
├── decryptor/              # 解密前端应用
│   ├── public/             # 静态资源
│   │   ├── enc/           # 加密文件存储目录
│   │   ├── sw.js          # Service Worker
│   │   └── *.html         # 明文入口页面
│   ├── src/               # 前端源码
│   └── package.json
├── target_site/        # 示例明文站点
└── README.md
```

## 技术栈

- **加密工具**: Node.js + ES Modules
- **前端框架**: Vite + TypeScript
- **加密算法**: Web Crypto API (AES-GCM)
- **认证协议**: OAuth 2.1 + PKCE
- **网络拦截**: Service Worker
- **状态管理**: Cookie + sessionStorage

## 开发调试

### Service Worker 调试

```bash
# Chrome DevTools → Application → Service Workers
# 查看控制台日志和网络请求
```

### 常见调试命令

```javascript
// 在浏览器控制台中执行
logout(); // 清除认证状态
navigator.serviceWorker.getRegistrations(); // 查看 SW 状态
```

## CORS 处理

### 本地开发

Vite 配置了代理，将 `/oidc/*` 和 `/key/*` 请求转发到 `https://api.dreamreflex.com`

### 生产部署

确保 API 服务器配置了正确的 CORS 策略：

```nginx
# Nginx 配置示例
location /oidc/ {
  proxy_pass https://api.dreamreflex.com/;
  add_header Access-Control-Allow-Origin *;
  add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
  add_header Access-Control-Allow-Headers "Authorization, Content-Type";
}
```

## 安全考虑

- **密钥存储**: 客户端 Cookie (HttpOnly=false，因为 JS 需要读取)
- **传输安全**: 生产环境必须使用 HTTPS
- **密钥派生**: SHA-256 单向哈希
- **完整性**: GCM 模式提供认证和完整性保证

## 性能优化

- **缓存策略**: Service Worker 响应设置 `Cache-Control`
- **懒加载**: 只在需要时注册 SW
- **内存管理**: 及时清理加密数据缓冲区

## 故障排除

### 解密失败

1. 检查密钥是否正确
2. 确认 Cookie 未过期
3. 查看 Service Worker 控制台错误

### OAuth 登录失败

1. 检查网络连接
2. 确认 API 端点可访问
3. 查看浏览器控制台错误

### Service Worker 问题

1. 强制刷新页面
2. 清除浏览器缓存
3. 在 DevTools 中 unregister SW

## 扩展开发

### 添加新的文件类型

在 `src/crypto.ts` 中更新 `getMimeType` 函数：

```typescript
case 'woff2':
  return 'font/woff2';
```

### 自定义认证流程

修改 `src/oauth.ts` 中的认证逻辑以适配其他 OIDC 提供商。

### 增强加密算法

如需更换加密算法，同步修改 `encryptor/src/crypto.js` 和 `decryptor/src/crypto.ts`。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
