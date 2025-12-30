# Encryptor CLI

AES-GCM 加密工具，用于加密静态站点资源。

## 安装

```bash
cd encryptor
npm install
```

## 使用

### 加密目录

```bash
# 基本用法
node bin/encrypt.mjs encrypt --in ../target_site --out ../decryptor/public/enc --key "your-secret-key"

# 使用环境变量中的密钥
export ENCRYPTION_KEY="your-secret-key"
node bin/encrypt.mjs encrypt --in ../target_site --out ../decryptor/public/enc --key-env ENCRYPTION_KEY

# 从文件读取密钥
echo "your-secret-key" > key.txt
node bin/encrypt.mjs encrypt --in ../target_site --out ../decryptor/public/enc --key-file key.txt

# 清理输出目录并生成清单
node bin/encrypt.mjs encrypt --in ../target_site --out ../decryptor/public/enc --key "your-secret-key" --clean --manifest
```

### 运行测试

```bash
node bin/encrypt.mjs test
# 或
npm test
```

## 选项说明

- `-i, --in <directory>`: 输入目录（必需）
- `-o, --out <directory>`: 输出目录（必需）
- `-k, --key <string>`: 加密密钥字符串
- `--key-file <file>`: 包含密钥的文件
- `--key-env <env_var>`: 包含密钥的环境变量名（默认: ENCRYPTION_KEY）
- `-c, --clean`: 加密前清理输出目录
- `-m, --manifest`: 生成 manifest.json 文件

## 加密格式

每个加密文件使用以下格式：

```
magic(8 bytes): "DRXENC01"
ivLen(1 byte): 12
iv(12 bytes): 随机生成的初始化向量
ciphertext: AES-GCM 加密数据（包含认证标签）
```

## 支持的文件类型

- HTML: `.html`
- 样式: `.css`
- JavaScript: `.js`
- 数据: `.json`
- 图片: `.png`, `.jpg`, `.jpeg`, `.svg`, `.webp`
- 字体: `.woff`, `.woff2`, `.ttf`
- 图标: `.ico`

## 注意事项

- 密钥通过 SHA-256 哈希转换为 32 字节 AES 密钥
- 使用 AES-GCM 模式，每个文件使用随机 IV
- 输出文件名在原文件名后追加 `.enc` 后缀
- 保持原始目录结构
