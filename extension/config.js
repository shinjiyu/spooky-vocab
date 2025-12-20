// Frontend configuration
// 前端配置文件 - 完整配置

// 完整配置
window.CONFIG = {
  // API配置
  api: {
    baseURL: 'https://kuroneko.chat/vocab-api',
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000
  },
  
  // JWT配置
  jwt: {
    storageKey: 'vocab_helper_jwt',
    expiryBuffer: 300  // 提前5分钟认为过期
  },
  
  // 功能开关
  features: {
    debugMode: false,
    enableHighlight: true,
    enableTooltip: true,
    enableFeedback: true,
    enableAutoProcess: true
  },
  
  // 性能配置
  performance: {
    maxBatchSize: 100,
    debounceDelay: 300,
    processDelay: 100
  },
  
  // 手机端配置
  mobile: {
    triggerMode: 'tap',  // 'tap' = 点击触发, 'longpress' = 长按触发
    longPressDelay: 500,
    tooltipPosition: 'bottom',
    enableHapticFeedback: true
  }
};

// 兼容旧的配置格式
const DEFAULT_CONFIG = {
  API_BASE_URL: window.CONFIG.api.baseURL,
  DEBUG_MODE: window.CONFIG.features.debugMode,
  API_READY: false,
  apiReady: false,
  useAPI: true,
  enabled: true,
  isMobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768
};

// 从chrome.storage.local加载配置
async function loadConfig() {
  const storedConfig = await new Promise(resolve => {
    chrome.storage.local.get(['API_BASE_URL', 'DEBUG_MODE', 'API_READY', 'api_base_url'], (result) => {
      resolve(result);
    });
  });

  // 更新API地址（如果用户自定义了）
  if (storedConfig.api_base_url) {
    window.CONFIG.api.baseURL = storedConfig.api_base_url;
  } else if (storedConfig.API_BASE_URL) {
    window.CONFIG.api.baseURL = storedConfig.API_BASE_URL;
  }
  
  // 更新调试模式
  if (storedConfig.DEBUG_MODE !== undefined) {
    window.CONFIG.features.debugMode = storedConfig.DEBUG_MODE;
  }

  window.VOCAB_HELPER_CONFIG = { 
    ...DEFAULT_CONFIG, 
    ...storedConfig,
    API_BASE_URL: window.CONFIG.api.baseURL
  };
  
  if (window.CONFIG.features.debugMode) {
    console.log('[Config] Loaded config:', window.CONFIG);
  }
}

// 立即加载配置
loadConfig();
