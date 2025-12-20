# URL参数传递Token认证集成计划（已更新）

## 概述

认证服务已完全支持URL传参，采用以下流程：
- 用户在登录页面传入 `redirectUrl` 参数：`https://kuroneko.chat/login?redirectUrl=xxx`
- 登录成功后，认证服务重定向到 `redirectUrl?token=xxx`（或 `redirectUrl?access_token=xxx`）
- 扩展从重定向URL的参数中提取token
- 后端仅验证token的有效性，不调用认证API

## 参考项目认证服务信息

- **认证服务域名**: https://kuroneko.chat
- **登录页面**: https://kuroneko.chat/login
- **注册页面**: https://kuroneko.chat/register
- **JWT_SECRET_KEY**: `5c88ab2e00452305d87b018fe39fcabbf250db022645a4adf4e55bb05d9cfa`
- **URL传参支持**: ✅ 已完全支持 `redirectUrl` 参数

## 实现步骤

### 阶段1: 后端配置更新

#### 1.1 更新JWT验证配置
- 修改 `backend/src/middleware/auth.js`，使用认证服务的 JWT_SECRET_KEY 验证token
- 更新 `backend/env.example`，添加 `AUTH_SERVICE_JWT_SECRET` 环境变量
- 后端只负责验证token，不调用任何认证API

#### 1.2 更新环境变量
- 添加认证服务相关配置：
  - `AUTH_SERVICE_JWT_SECRET=5c88ab2e00452305d87b018fe39fcabbf250db022645a4adf4e55bb05d9cfa`

### 阶段2: 前端Token获取机制（URL参数传递）

#### 2.1 创建重定向处理页面
- 创建 `extension/auth-callback.html`：
  - 简单的成功页面，显示"登录成功"消息
  - 自动提取URL参数中的token
  - 存储token到chrome.storage
  - 显示倒计时（3秒后自动关闭）或提供"关闭"按钮

#### 2.2 创建重定向处理脚本
- 创建 `extension/auth-callback.js`：
  - 从URL参数中提取token（支持 `token`、`access_token`、`jwt` 等参数名）
  - 验证token格式（JWT格式检查：包含两个点号）
  - 存储token到chrome.storage（使用现有的JWT_STORAGE_KEY）
  - 通知popup token已更新（通过chrome.storage.onChanged事件）
  - 显示成功消息并倒计时关闭

#### 2.3 更新登录界面
- 修改 `extension/popup/popup.html`：
  - 移除原有的user_id和cefr_level输入框（或保留作为开发模式）
  - 添加"前往登录"按钮，打开认证服务登录页面
  - 显示当前登录状态和用户信息（从token中解析）
  - 添加"退出登录"按钮

#### 2.4 实现登录流程
- 更新 `extension/popup/popup.js`：
  - 获取扩展ID：`chrome.runtime.id`
  - 生成redirectUrl：`chrome-extension://${chrome.runtime.id}/auth-callback.html`
  - 打开登录页面：`https://kuroneko.chat/login?redirectUrl=${encodeURIComponent(redirectUrl)}`
  - 监听token更新事件（通过chrome.storage.onChanged）
  - 检测到token后，显示登录成功并更新UI
  - 从token中解析用户信息（user_id等）

#### 2.5 更新manifest.json
- 添加 `auth-callback.html` 到 `web_accessible_resources`：
  ```json
  "web_accessible_resources": [
    {
      "resources": ["auth-callback.html", "auth-callback.js"],
      "matches": ["<all_urls>"]
    }
  ]
  ```

#### 2.6 更新Token管理
- 更新 `extension/content/jwt-manager.js`：
  - 从chrome.storage读取token（已支持）
  - 验证token有效性（已支持）
  - 处理token过期（提示用户重新登录）

#### 2.7 更新API客户端
- 更新 `extension/content/api-client.js`：
  - 使用存储的token发送请求（已支持）
  - 处理token过期（提示用户重新登录）
  - 不实现自动刷新（因为不调用认证API）

### 阶段3: 用户数据关联

#### 3.1 用户ID映射
- 从JWT token的payload中提取用户ID
- 确认认证服务JWT payload中的用户ID字段名（可能是 `id`、`user_id`、`sub` 等）
- 确保后端使用相同的 `user_id` 关联现有数据
- 如果认证服务的用户ID格式不同，需要建立映射关系

#### 3.2 向后兼容
- 保留 `test-token` 端点（用于开发和测试）
- 支持两种认证方式：
  - 新方式：从认证服务获取token（生产环境）
  - 旧方式：test-token（开发环境）
- 在popup中添加"开发模式"开关，允许使用test-token

## 文件修改清单

### 后端文件
1. `backend/src/middleware/auth.js` - 使用认证服务的JWT_SECRET验证token
2. `backend/env.example` - 添加认证服务JWT_SECRET配置

### 前端文件
1. `extension/popup/popup.html` - 更新登录界面，添加"前往登录"按钮
2. `extension/popup/popup.js` - 实现登录流程和token监听
3. `extension/auth-callback.html` - 新建：重定向处理页面
4. `extension/auth-callback.js` - 新建：从URL参数提取token
5. `extension/content/jwt-manager.js` - 确保支持从认证服务获取的token
6. `extension/content/api-client.js` - 确保使用token发送请求
7. `extension/manifest.json` - 添加web_accessible_resources配置
8. `extension/config.js` - 添加认证服务URL配置

## 关键实现细节

### Token获取流程
1. 用户在popup中点击"前往登录"
2. Popup获取扩展ID：`chrome.runtime.id`
3. 生成redirectUrl：`chrome-extension://扩展ID/auth-callback.html`
4. 打开新标签页：`https://kuroneko.chat/login?redirectUrl=编码后的redirectUrl`
5. 用户在认证服务页面登录
6. 登录成功后，认证服务重定向到：`chrome-extension://扩展ID/auth-callback.html?token=xxx`
7. auth-callback.js从URL参数中提取token（使用URLSearchParams）
8. 验证token格式（JWT格式：三个部分用点号分隔）
9. 存储token到chrome.storage（使用现有的JWT_STORAGE_KEY）
10. Popup通过chrome.storage.onChanged监听token更新
11. 显示登录成功，更新UI

### JWT Token验证
后端使用认证服务的JWT_SECRET_KEY验证token：
```javascript
const AUTH_SERVICE_JWT_SECRET = process.env.AUTH_SERVICE_JWT_SECRET || '5c88ab2e00452305d87b018fe39fcabbf250db022645a4adf4e55bb05d9cfa';
```

### redirectUrl格式
- Chrome扩展：`chrome-extension://扩展ID/auth-callback.html`
- 获取扩展ID：`chrome.runtime.id`（在popup.js中）
- URL编码：使用 `encodeURIComponent()` 编码redirectUrl

### Token参数名确认
需要确认认证服务使用的参数名：
- 可能是 `token`
- 可能是 `access_token`
- 可能是 `jwt`
- 建议：在auth-callback.js中支持多种参数名

### 用户ID提取
从JWT payload中提取用户ID：
```javascript
// 解析JWT payload
const parts = token.split('.');
const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
const userId = payload.id || payload.user_id || payload.sub;
```

## 注意事项

1. **JWT Secret**: 后端必须使用认证服务的JWT_SECRET_KEY验证token
2. **redirectUrl编码**: redirectUrl必须使用encodeURIComponent编码
3. **扩展ID**: 使用chrome.runtime.id动态获取，不能硬编码
4. **Token参数名**: 需要确认认证服务使用的参数名（token/access_token/jwt等）
5. **Token过期**: 不实现自动刷新，token过期时提示用户重新登录
6. **用户ID格式**: 从JWT payload中提取user_id，确保与现有数据兼容
7. **安全性**: Token在URL中传递，注意不要记录到日志中
8. **web_accessible_resources**: 必须将auth-callback.html添加到manifest.json中
9. **跨域限制**: chrome-extension://协议不受跨域限制，可以直接访问

## 测试要点

1. **登录流程测试**：
   - 点击"前往登录" → 打开登录页面
   - 登录成功后 → 重定向到auth-callback.html
   - 提取token → 存储到chrome.storage
   - Popup监听更新 → 显示登录成功

2. **Token存储测试**：
   - Token是否正确存储到chrome.storage
   - Token格式是否正确（JWT格式）

3. **后端验证测试**：
   - 后端能否正确验证认证服务签发的token
   - 使用认证服务的JWT_SECRET验证

4. **Token过期测试**：
   - Token过期时的处理流程
   - 提示用户重新登录

5. **用户数据关联测试**：
   - 从token提取user_id
   - 确保与现有数据兼容

6. **向后兼容性测试**：
   - test-token仍可用（开发模式）
   - 新旧两种认证方式可以切换

7. **不同浏览器环境测试**：
   - Chrome浏览器
   - Edge浏览器（Chromium内核）
   - 扩展ID在不同环境下的获取

## 开发顺序建议

1. 先实现后端JWT验证（使用认证服务的JWT_SECRET）
2. 创建auth-callback.html和auth-callback.js
3. 更新manifest.json添加web_accessible_resources
4. 更新popup.html和popup.js实现登录流程
5. 测试完整的登录流程
6. 处理用户ID映射和数据关联
7. 添加向后兼容支持
