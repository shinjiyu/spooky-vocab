// Spooky Vocab Configuration
// 配置管理

const CONFIG = {
  // API服务器配置（默认值，可在Settings中修改）
  api: {
    baseURL: 'http://localhost:3000',  // 默认本地开发环境
    timeout: 10000,  // 10秒超时
    retryAttempts: 3,
    retryDelay: 1000  // 重试延迟(ms)
  },

  // JWT配置
  jwt: {
    storageKey: 'spooky_vocab_jwt',
    expiryBuffer: 300  // 提前5分钟刷新token (秒)
  },

  // 功能开关
  features: {
    offlineMode: true,  // 离线模式
    autoSync: true,     // 自动同步
    debugMode: true     // 调试模式（开发时true，生产时false）
  },

  // 性能配置
  performance: {
    maxBatchSize: 100,        // 批量检查最大单词数
    batchDelay: 500,          // 批量请求防抖延迟(ms)
    cacheExpiry: 3600000,     // 缓存过期时间(1小时，毫秒)
    syncInterval: 60000       // 同步间隔(1分钟，毫秒)
  }
};

// 从chrome.storage加载用户配置的API URL
async function loadUserConfig() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['api_base_url', 'debug_mode'], (result) => {
        if (result.api_base_url) {
          CONFIG.api.baseURL = result.api_base_url;
        }
        if (result.debug_mode !== undefined) {
          CONFIG.features.debugMode = result.debug_mode;
        }
        resolve();
      });
    });
  }
}

// 如果在扩展环境中，尝试加载用户配置
if (typeof chrome !== 'undefined' && chrome.storage) {
  loadUserConfig().then(() => {
    console.log('[Config] Loaded with API URL:', CONFIG.api.baseURL);
  });
}

// 导出配置
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}

