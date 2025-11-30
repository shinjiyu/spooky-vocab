// Frontend configuration
// 前端配置文件 - 纯API模式

// 默认配置
const DEFAULT_CONFIG = {
  API_BASE_URL: 'http://localhost:3000', // 默认后端API地址
  DEBUG_MODE: true, // 是否开启调试模式
  API_READY: false // API是否已准备好（已获取token）
};

// 从chrome.storage.local加载配置
async function loadConfig() {
  const storedConfig = await new Promise(resolve => {
    chrome.storage.local.get(['API_BASE_URL', 'DEBUG_MODE', 'API_READY'], (result) => {
      resolve(result);
    });
  });

  window.VOCAB_HELPER_CONFIG = { ...DEFAULT_CONFIG, ...storedConfig };
  
  if (window.VOCAB_HELPER_CONFIG.DEBUG_MODE) {
    console.log('[Config] Loaded config:', window.VOCAB_HELPER_CONFIG);
  }
}

// 立即加载配置
loadConfig();
