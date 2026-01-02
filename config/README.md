# 配置管理

## 📋 概述

本目录用于管理项目的敏感配置信息，如服务器地址、密钥等。

**配置存储在私有仓库**: `https://git.wemomo.com/yu.zhenyu/online_config`

## 🔧 使用方法

### 方式1：从私有仓库同步配置（推荐）

```bash
# 从 online_config 仓库同步配置
./scripts/sync-config.sh

# 应用配置到项目文件
node scripts/apply-config.js
```

### 方式2：手动创建本地配置

```bash
# 复制示例配置
cp config/config.example.js config/config.local.js

# 编辑配置，填入真实值
vim config/config.local.js

# 应用配置
node scripts/apply-config.js
```

### 提交代码前（重要！）

```bash
# 恢复为示例配置（用于提交到 git）
node scripts/apply-config.js --reset
```

## 📁 文件说明

| 文件 | 说明 | Git 状态 |
|------|------|----------|
| `config.example.js` | 示例配置，包含占位符 | ✅ 已提交 |
| `config.local.js` | 本地真实配置 | ❌ 已忽略 |

## ⚠️ 注意事项

1. **永远不要提交 `config.local.js`** - 它包含敏感信息
2. 在提交代码前，运行 `node scripts/apply-config.js --reset` 确保不会泄露敏感信息
3. 服务器密码建议使用 SSH 密钥认证，避免硬编码

## 🔐 配置项说明

```javascript
module.exports = {
  // 域名（用于 manifest.json 权限声明）
  domain: 'your-domain.com',
  
  // API 服务
  api: {
    baseUrl: 'https://your-domain.com/vocab-api',  // 后端 API 地址
    healthCheck: 'https://your-domain.com/vocab-api/health'
  },
  
  // 认证服务
  auth: {
    url: 'https://your-domain.com',           // 认证服务地址
    sdkUrl: 'https://your-domain.com/sdk/login.js'  // SDK 地址
  },
  
  // 服务器（仅部署使用）
  server: {
    host: 'your-server-ip',
    user: 'root',
    remoteDir: '/opt/your-project'
  },
  
  // JWT 密钥
  jwt: {
    secret: 'your-jwt-secret',
    authServiceSecret: 'auth-service-jwt-secret'
  },
  
  // 隐私政策
  privacy: {
    url: 'https://your-domain.com/privacy',
    email: 'support@your-domain.com'
  }
};
```

