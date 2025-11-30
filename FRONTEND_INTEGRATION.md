# 前端集成指南 - Spooky Vocab

**版本**: v1.0.0  
**更新日期**: 2025-11-30

本文档说明Chrome扩展前端如何集成后端API。

---

## 📋 目录

1. [架构概述](#架构概述)
2. [配置管理](#配置管理)
3. [JWT管理](#jwt管理)
4. [API通信模块](#api通信模块)
5. [数据流程](#数据流程)
6. [错误处理](#错误处理)
7. [离线支持](#离线支持)

---

## 🏗️ 架构概述

### 前后端交互流程

```
┌─────────────────┐         ┌─────────────────┐
│  Chrome Extension│         │   Backend API   │
│                 │         │                 │
│  ┌───────────┐  │         │  ┌───────────┐  │
│  │  Content  │  │  HTTP   │  │  Express  │  │
│  │  Script   │──┼────────►│  │  Server   │  │
│  └───────────┘  │  JWT    │  └───────────┘  │
│                 │         │        │        │
│  ┌───────────┐  │         │  ┌───────────┐  │
│  │  Popup    │  │         │  │  SQLite   │  │
│  │  UI       │──┼────────►│  │  Database │  │
│  └───────────┘  │         │  └───────────┘  │
│                 │         │        │        │
│  ┌───────────┐  │         │  ┌───────────┐  │
│  │ Background│  │         │  │  ECDICT   │  │
│  │  Service  │──┼────────►│  │Dictionary │  │
│  └───────────┘  │         │  └───────────┘  │
└─────────────────┘         └─────────────────┘
```

### 模块划分

```
extension/
├── content/
│   ├── api-client.js          # NEW - API通信客户端
│   ├── jwt-manager.js         # NEW - JWT管理
│   ├── main.js                # 更新 - 使用API而非Mock
│   ├── text-processor.js      # 更新 - 调用API检查词汇
│   ├── translation-tooltip.js # 保持不变
│   └── feedback-handler.js    # 更新 - 调用API记录反馈
├── popup/
│   ├── popup.html             # 更新 - 添加登录/JWT管理
│   ├── popup.js               # 更新 - 显示真实统计
│   └── api-client.js          # NEW - Popup的API客户端
└── background/
    └── service-worker.js      # NEW - 后台服务
```

---

## ⚙️ 配置管理

### 配置文件

**文件**: `extension/config.js`

```javascript
// 配置管理
const CONFIG = {
  // API服务器配置
  api: {
    baseURL: 'http://localhost:3000',  // 开发环境
    // baseURL: 'https://api.spookyvocab.com',  // 生产环境
    timeout: 10000,  // 10秒超时
    retryAttempts: 3,
    retryDelay: 1000
  },

  // JWT配置
  jwt: {
    storageKey: 'spooky_vocab_jwt',
    expiryBuffer: 300  // 提前5分钟刷新token
  },

  // 功能开关
  features: {
    offlineMode: true,  // 离线模式
    autoSync: true,     // 自动同步
    debugMode: false    // 调试模式
  },

  // 性能配置
  performance: {
    maxBatchSize: 100,        // 批量检查最大单词数
    batchDelay: 500,          // 批量请求防抖延迟(ms)
    cacheExpiry: 3600000,     // 缓存过期时间(1小时)
    syncInterval: 60000       // 同步间隔(1分钟)
  }
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
```

### 环境检测

```javascript
// 检测运行环境
function getEnvironment() {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return 'development';
  }
  return 'production';
}

// 根据环境调整配置
const env = getEnvironment();
if (env === 'production') {
  CONFIG.api.baseURL = 'https://api.spookyvocab.com';
  CONFIG.features.debugMode = false;
}
```

---

## 🔐 JWT管理

### JWT管理器

**文件**: `extension/content/jwt-manager.js`

```javascript
// JWT管理类
class JWTManager {
  constructor() {
    this.storageKey = CONFIG.jwt.storageKey;
    this.token = null;
    this.payload = null;
    this.expiresAt = null;
  }

  /**
   * 初始化 - 从storage加载token
   */
  async init() {
    const result = await chrome.storage.local.get([this.storageKey]);
    if (result[this.storageKey]) {
      this.setToken(result[this.storageKey]);
    }
  }

  /**
   * 设置JWT token
   */
  setToken(token) {
    this.token = token;
    
    try {
      // 解析JWT payload
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        this.payload = payload;
        this.expiresAt = payload.exp * 1000;  // 转换为毫秒
        
        // 保存到storage
        chrome.storage.local.set({
          [this.storageKey]: token
        });
        
        this.log('Token set successfully', { 
          user_id: payload.user_id,
          expires: new Date(this.expiresAt)
        });
      }
    } catch (error) {
      console.error('Failed to parse JWT:', error);
    }
  }

  /**
   * 获取当前token
   */
  getToken() {
    return this.token;
  }

  /**
   * 获取用户ID
   */
  getUserId() {
    return this.payload?.user_id || null;
  }

  /**
   * 检查token是否有效
   */
  isValid() {
    if (!this.token || !this.expiresAt) {
      return false;
    }
    
    // 检查是否过期（提前5分钟）
    const bufferMs = CONFIG.jwt.expiryBuffer * 1000;
    return Date.now() < (this.expiresAt - bufferMs);
  }

  /**
   * 检查是否需要刷新
   */
  needsRefresh() {
    if (!this.token || !this.expiresAt) {
      return false;
    }
    
    // 剩余时间少于1小时时刷新
    const oneHour = 3600 * 1000;
    const timeLeft = this.expiresAt - Date.now();
    return timeLeft < oneHour && timeLeft > 0;
  }

  /**
   * 清除token
   */
  async clear() {
    this.token = null;
    this.payload = null;
    this.expiresAt = null;
    
    await chrome.storage.local.remove(this.storageKey);
    this.log('Token cleared');
  }

  /**
   * 获取Authorization header值
   */
  getAuthHeader() {
    return this.token ? `Bearer ${this.token}` : null;
  }

  log(...args) {
    if (CONFIG.features.debugMode) {
      console.log('[JWTManager]', ...args);
    }
  }
}

// 导出单例
window.jwtManager = new JWTManager();
```

---

## 📡 API通信模块

### API客户端

**文件**: `extension/content/api-client.js`

```javascript
// API通信客户端
class APIClient {
  constructor() {
    this.baseURL = CONFIG.api.baseURL;
    this.timeout = CONFIG.api.timeout;
    this.retryAttempts = CONFIG.api.retryAttempts;
    this.retryDelay = CONFIG.api.retryDelay;
  }

  /**
   * 发送HTTP请求
   */
  async request(method, endpoint, data = null, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    // 构建请求配置
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    // 添加JWT token
    const authHeader = window.jwtManager.getAuthHeader();
    if (authHeader && !options.skipAuth) {
      config.headers['Authorization'] = authHeader;
    }

    // 添加请求体
    if (data && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(data);
    }

    // 执行请求（带重试）
    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        this.log(`${method} ${endpoint}`, { attempt: attempt + 1, data });

        const response = await fetch(url, config);
        const responseData = await response.json();

        if (!response.ok) {
          throw new APIError(responseData.error, response.status);
        }

        this.log(`Response from ${endpoint}`, responseData);
        return responseData.data || responseData;

      } catch (error) {
        // 如果是最后一次尝试，抛出错误
        if (attempt === this.retryAttempts - 1) {
          this.log(`Request failed after ${this.retryAttempts} attempts`, error);
          throw error;
        }

        // 等待后重试
        await this.sleep(this.retryDelay * (attempt + 1));
      }
    }
  }

  /**
   * GET请求
   */
  async get(endpoint, params = {}, options = {}) {
    // 构建查询字符串
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    
    return this.request('GET', url, null, options);
  }

  /**
   * POST请求
   */
  async post(endpoint, data, options = {}) {
    return this.request('POST', endpoint, data, options);
  }

  /**
   * PUT请求
   */
  async put(endpoint, data, options = {}) {
    return this.request('PUT', endpoint, data, options);
  }

  /**
   * DELETE请求
   */
  async delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, null, options);
  }

  // ============ 具体API方法 ============

  /**
   * 获取测试Token
   */
  async getTestToken(userId, cefrLevel = 'B1') {
    return this.post('/api/auth/test-token', {
      user_id: userId,
      cefr_level: cefrLevel
    }, { skipAuth: true });
  }

  /**
   * 刷新Token
   */
  async refreshToken() {
    return this.post('/api/auth/refresh');
  }

  /**
   * 批量检查单词
   */
  async batchCheckWords(words) {
    return this.post('/api/vocabulary/batch-check', {
      words,
      include_translation: true
    });
  }

  /**
   * 查询单个单词
   */
  async getWord(word) {
    return this.get(`/api/vocabulary/word/${encodeURIComponent(word)}`);
  }

  /**
   * 标记单词为已知
   */
  async markWordKnown(word) {
    return this.post('/api/feedback/known', {
      word,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 标记单词为未知
   */
  async markWordUnknown(word, context = null, url = null) {
    return this.post('/api/feedback/unknown', {
      word,
      context,
      url,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 记录单词遇到
   */
  async recordEncounter(word) {
    return this.post('/api/feedback/encounter', {
      word,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 获取复习单词列表
   */
  async getReviewWords(limit = 20, offset = 0, sort = 'priority') {
    return this.get('/api/review/words', { limit, offset, sort });
  }

  /**
   * 获取单词例句
   */
  async getWordContexts(word, limit = 5) {
    return this.get(`/api/review/contexts/${encodeURIComponent(word)}`, { limit });
  }

  /**
   * 获取学习统计
   */
  async getStats(period = 'all') {
    return this.get('/api/review/stats', { period });
  }

  /**
   * 获取用户设置
   */
  async getUserSettings() {
    return this.get('/api/user/settings');
  }

  /**
   * 更新用户设置
   */
  async updateUserSettings(settings) {
    return this.put('/api/user/settings', settings);
  }

  /**
   * 获取用户档案
   */
  async getUserProfile() {
    return this.get('/api/user/profile');
  }

  // ============ 辅助方法 ============

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  log(...args) {
    if (CONFIG.features.debugMode) {
      console.log('[APIClient]', ...args);
    }
  }
}

// API错误类
class APIError extends Error {
  constructor(error, status) {
    super(error.message);
    this.name = 'APIError';
    this.code = error.code;
    this.status = status;
    this.details = error.details;
  }
}

// 导出单例
window.apiClient = new APIClient();
```

---

## 🔄 数据流程

### 1. 初始化流程

```javascript
// extension/content/main.js

(async function() {
  'use strict';

  // 1. 初始化JWT管理器
  await window.jwtManager.init();

  // 2. 检查是否有有效token
  if (!window.jwtManager.isValid()) {
    console.log('No valid JWT token, getting test token...');
    
    // 获取或创建test token
    try {
      const result = await window.apiClient.getTestToken('test_user_' + Date.now());
      window.jwtManager.setToken(result.token);
    } catch (error) {
      console.error('Failed to get test token:', error);
      // 降级到离线模式
      window.VOCAB_HELPER_CONFIG.offlineMode = true;
    }
  }

  // 3. 检查是否需要刷新token
  if (window.jwtManager.needsRefresh()) {
    try {
      const result = await window.apiClient.refreshToken();
      window.jwtManager.setToken(result.token);
    } catch (error) {
      console.warn('Failed to refresh token:', error);
    }
  }

  // 4. 初始化其他模块
  initializeExtension();
})();
```

### 2. 词汇检查流程

```javascript
// extension/content/text-processor.js

class TextProcessor {
  async processPage() {
    // 1. 提取页面中的所有单词
    const words = this.extractWords();
    
    // 2. 分批处理（避免一次请求过多）
    const batches = this.createBatches(words, CONFIG.performance.maxBatchSize);
    
    // 3. 并发请求所有批次
    const results = await Promise.all(
      batches.map(batch => this.checkBatch(batch))
    );
    
    // 4. 合并结果
    const mergedResults = Object.assign({}, ...results);
    
    // 5. 标记需要翻译的单词
    this.markWords(mergedResults);
  }

  async checkBatch(words) {
    try {
      // 调用API批量检查
      const result = await window.apiClient.batchCheckWords(words);
      return result;
    } catch (error) {
      console.error('Batch check failed:', error);
      
      // 降级：使用本地缓存或Mock数据
      return this.fallbackCheck(words);
    }
  }

  fallbackCheck(words) {
    // 离线模式：使用Mock数据
    const results = {};
    words.forEach(word => {
      results[word] = {
        needTranslation: window.mockVocabulary.needsTranslation(word),
        familiarity_score: 50
      };
    });
    return results;
  }
}
```

### 3. 用户反馈流程

```javascript
// extension/content/feedback-handler.js

class FeedbackHandler {
  async markAsKnown(word) {
    try {
      // 1. 立即更新UI（乐观更新）
      this.updateUIImmediately(word, 'known');
      
      // 2. 调用API
      const result = await window.apiClient.markWordKnown(word);
      
      // 3. 更新本地缓存
      this.updateLocalCache(word, result);
      
      // 4. 记录到本地日志
      this.logFeedback(word, 'known', result);
      
    } catch (error) {
      console.error('Failed to mark word as known:', error);
      
      // 5. 回滚UI（如果API失败）
      this.revertUI(word);
      
      // 6. 加入离线队列，稍后同步
      this.queueForSync(word, 'known');
    }
  }

  async markAsUnknown(word, context = null) {
    try {
      // 获取当前页面URL
      const url = window.location.href;
      
      // 调用API
      const result = await window.apiClient.markWordUnknown(word, context, url);
      
      // 更新本地状态
      this.updateLocalCache(word, result);
      
    } catch (error) {
      console.error('Failed to mark word as unknown:', error);
      this.queueForSync(word, 'unknown', { context, url });
    }
  }
}
```

---

## ⚠️ 错误处理

### 错误处理策略

```javascript
// 统一错误处理
function handleAPIError(error, context) {
  // 1. 判断错误类型
  if (error instanceof APIError) {
    switch (error.code) {
      case 'UNAUTHORIZED':
      case 'INVALID_TOKEN':
      case 'TOKEN_EXPIRED':
        // Token问题：尝试刷新或重新获取
        return handleAuthError(error);
      
      case 'DICTIONARY_UNAVAILABLE':
        // 词典不可用：降级到基础功能
        return enableFallbackMode();
      
      case 'BATCH_SIZE_EXCEEDED':
        // 批量大小超限：拆分重试
        return retryWithSmallerBatch(context);
      
      default:
        // 其他错误：显示通知
        showErrorNotification(error.message);
    }
  } else if (error instanceof TypeError && error.message.includes('fetch')) {
    // 网络错误：启用离线模式
    return enableOfflineMode();
  }
  
  // 2. 记录错误日志
  logError(error, context);
  
  // 3. 用户友好的错误提示
  showUserFriendlyError(error);
}

// 认证错误处理
async function handleAuthError(error) {
  console.warn('Auth error, clearing token and retrying...', error);
  
  // 清除旧token
  await window.jwtManager.clear();
  
  // 重新获取token
  try {
    const result = await window.apiClient.getTestToken('test_user_' + Date.now());
    window.jwtManager.setToken(result.token);
    return true;  // 可以重试
  } catch (retryError) {
    console.error('Failed to recover from auth error:', retryError);
    enableOfflineMode();
    return false;
  }
}
```

---

## 💾 离线支持

### 离线队列

```javascript
// 离线同步队列
class OfflineQueue {
  constructor() {
    this.queue = [];
    this.syncing = false;
  }

  /**
   * 添加到队列
   */
  async add(action, data) {
    const item = {
      id: Date.now() + Math.random(),
      action,
      data,
      timestamp: new Date().toISOString(),
      retries: 0
    };
    
    this.queue.push(item);
    await this.save();
    
    // 如果在线，立即尝试同步
    if (navigator.onLine && !this.syncing) {
      this.sync();
    }
  }

  /**
   * 同步队列
   */
  async sync() {
    if (this.syncing || this.queue.length === 0) {
      return;
    }
    
    this.syncing = true;
    
    try {
      const results = await Promise.allSettled(
        this.queue.map(item => this.syncItem(item))
      );
      
      // 移除成功的项
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          this.queue.splice(index, 1);
        }
      });
      
      await this.save();
      
    } finally {
      this.syncing = false;
    }
  }

  /**
   * 同步单个项
   */
  async syncItem(item) {
    switch (item.action) {
      case 'known':
        return window.apiClient.markWordKnown(item.data.word);
      
      case 'unknown':
        return window.apiClient.markWordUnknown(
          item.data.word,
          item.data.context,
          item.data.url
        );
      
      case 'encounter':
        return window.apiClient.recordEncounter(item.data.word);
      
      default:
        throw new Error('Unknown action: ' + item.action);
    }
  }

  /**
   * 保存队列到storage
   */
  async save() {
    await chrome.storage.local.set({
      offlineQueue: this.queue
    });
  }

  /**
   * 从storage加载队列
   */
  async load() {
    const result = await chrome.storage.local.get(['offlineQueue']);
    this.queue = result.offlineQueue || [];
  }
}

// 初始化离线队列
window.offlineQueue = new OfflineQueue();

// 监听网络状态变化
window.addEventListener('online', () => {
  console.log('Network online, syncing offline queue...');
  window.offlineQueue.sync();
});
```

---

## 🔄 缓存策略

### 本地缓存

```javascript
// 缓存管理
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.expiryMap = new Map();
  }

  /**
   * 设置缓存
   */
  set(key, value, ttl = CONFIG.performance.cacheExpiry) {
    this.cache.set(key, value);
    this.expiryMap.set(key, Date.now() + ttl);
  }

  /**
   * 获取缓存
   */
  get(key) {
    if (!this.has(key)) {
      return null;
    }
    return this.cache.get(key);
  }

  /**
   * 检查缓存是否有效
   */
  has(key) {
    if (!this.cache.has(key)) {
      return false;
    }
    
    const expiry = this.expiryMap.get(key);
    if (Date.now() > expiry) {
      // 已过期，删除
      this.cache.delete(key);
      this.expiryMap.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * 清除所有缓存
   */
  clear() {
    this.cache.clear();
    this.expiryMap.clear();
  }
}

// 使用缓存的API请求
async function getCachedWord(word) {
  const cacheKey = `word:${word}`;
  
  // 1. 检查缓存
  if (window.cacheManager.has(cacheKey)) {
    return window.cacheManager.get(cacheKey);
  }
  
  // 2. 请求API
  const result = await window.apiClient.getWord(word);
  
  // 3. 存入缓存
  window.cacheManager.set(cacheKey, result);
  
  return result;
}

window.cacheManager = new CacheManager();
```

---

## 📊 性能优化

### 批量请求优化

```javascript
// 批量请求防抖
class BatchRequestManager {
  constructor() {
    this.pending = new Set();
    this.timer = null;
  }

  /**
   * 添加单词到批处理队列
   */
  add(word) {
    this.pending.add(word);
    
    // 防抖：延迟执行
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.flush();
    }, CONFIG.performance.batchDelay);
  }

  /**
   * 执行批处理请求
   */
  async flush() {
    if (this.pending.size === 0) {
      return;
    }
    
    const words = Array.from(this.pending);
    this.pending.clear();
    
    try {
      const result = await window.apiClient.batchCheckWords(words);
      this.handleResult(result);
    } catch (error) {
      console.error('Batch request failed:', error);
    }
  }

  handleResult(result) {
    // 触发自定义事件，通知结果
    window.dispatchEvent(new CustomEvent('batchCheckComplete', {
      detail: result
    }));
  }
}

window.batchRequestManager = new BatchRequestManager();
```

---

## 📝 开发清单

### 需要实现的文件

- [ ] `extension/config.js` - 配置管理
- [ ] `extension/content/jwt-manager.js` - JWT管理器
- [ ] `extension/content/api-client.js` - API通信客户端
- [ ] `extension/content/main.js` - 更新：集成API
- [ ] `extension/content/text-processor.js` - 更新：调用API
- [ ] `extension/content/feedback-handler.js` - 更新：调用API
- [ ] `extension/popup/popup.js` - 更新：显示真实数据
- [ ] `extension/background/service-worker.js` - 后台服务

### 需要更新的功能

- [ ] 移除Mock数据依赖
- [ ] 实现JWT认证流程
- [ ] 实现离线队列
- [ ] 实现本地缓存
- [ ] 错误处理和重试
- [ ] 性能监控

---

*文档版本: v1.0.0*  
*最后更新: 2025-11-30*

