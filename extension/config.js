// Spooky Vocab Configuration
// 配置管理

const CONFIG = {
  // API服务器配置
  api: {
    baseURL: 'http://localhost:3000',  // 开发环境
    // baseURL: 'https://api.spookyvocab.com',  // 生产环境（未来）
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

// 环境检测
function getEnvironment() {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'development';
    }
  }
  return 'production';
}

// 根据环境调整配置
const env = getEnvironment();
if (env === 'production') {
  CONFIG.api.baseURL = 'https://api.spookyvocab.com';
  CONFIG.features.debugMode = false;
}

// 导出配置
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}

