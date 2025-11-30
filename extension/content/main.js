// Main entry point for content script
// 主入口文件：检测设备类型并初始化各功能模块

(function() {
  'use strict';

  // 设备检测
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
  
  // 全局配置
  window.VOCAB_HELPER_CONFIG = {
    isMobile: isMobile,
    enabled: true,
    debug: window.CONFIG && window.CONFIG.features.debugMode,
    useAPI: true,  // 是否使用真实API（false则使用mock）
    apiReady: false  // API是否就绪
  };

  // 调试日志
  function log(...args) {
    if (window.VOCAB_HELPER_CONFIG.debug) {
      console.log('[VocabHelper]', ...args);
    }
  }

  log('Initializing...', { isMobile });

  // 检查插件是否启用
  chrome.storage.local.get(['enabled'], (result) => {
    const enabled = result.enabled !== false; // 默认启用
    window.VOCAB_HELPER_CONFIG.enabled = enabled;

    if (!enabled) {
      log('Extension is disabled');
      return;
    }

    // 等待DOM完全加载
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeExtension);
    } else {
      initializeExtension();
    }
  });

  async function initializeExtension() {
    log('DOM ready, starting initialization');

    try {
      // 第一步：初始化JWT管理器
      await initializeAuth();
      
      // 第二步：初始化各功能模块
      initializeModules();
      
      // 第三步：监听动态内容变化
      observeDynamicContent();
      
      log('Initialization complete');
      
    } catch (error) {
      console.error('[VocabHelper] Initialization failed:', error);
      
      // 如果API初始化失败，降级到Mock模式
      if (window.VOCAB_HELPER_CONFIG.useAPI) {
        log('API initialization failed, falling back to mock mode');
        window.VOCAB_HELPER_CONFIG.useAPI = false;
        initializeModules();
        observeDynamicContent();
      }
    }
  }

  /**
   * 初始化认证和API
   */
  async function initializeAuth() {
    if (!window.VOCAB_HELPER_CONFIG.useAPI) {
      log('Using mock mode, skipping auth');
      return;
    }

    log('Initializing JWT manager...');
    
    // 初始化JWT管理器
    await window.jwtManager.init();
    
    // 检查是否有有效token
    if (!window.jwtManager.isLoggedIn()) {
      log('No valid token found, requesting test token...');
      
      // 获取或生成默认user_id
      const userId = await getOrCreateUserId();
      
      try {
        // 请求测试token
        const result = await window.apiClient.getTestToken(userId, 'B1');
        window.jwtManager.setToken(result.token);
        log('Test token acquired', { user_id: userId });
        
      } catch (error) {
        console.error('[VocabHelper] Failed to get test token:', error);
        throw error;
      }
    } else {
      log('Valid token found', { user_id: window.jwtManager.getUserId() });
      
      // 检查是否需要刷新
      if (window.jwtManager.needsRefresh()) {
        log('Token needs refresh, refreshing...');
        try {
          const result = await window.apiClient.refreshToken();
          window.jwtManager.setToken(result.token);
          log('Token refreshed successfully');
        } catch (error) {
          console.error('[VocabHelper] Token refresh failed:', error);
          // 刷新失败，清除token并重新获取
          await window.jwtManager.clear();
          return initializeAuth();
        }
      }
    }
    
    window.VOCAB_HELPER_CONFIG.apiReady = true;
    log('API ready');
  }

  /**
   * 获取或创建user_id
   */
  async function getOrCreateUserId() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['user_id'], (result) => {
        if (result.user_id) {
          resolve(result.user_id);
        } else {
          // 生成一个随机user_id
          const userId = 'user_' + Math.random().toString(36).substr(2, 9);
          chrome.storage.local.set({ user_id: userId }, () => {
            log('Generated new user_id', userId);
            resolve(userId);
          });
        }
      });
    });
  }

  /**
   * 初始化各功能模块
   */
  function initializeModules() {
    log('Initializing modules...');

    // 初始化反馈处理器
    if (typeof window.FeedbackHandler !== 'undefined') {
      window.feedbackHandler = new window.FeedbackHandler();
      log('FeedbackHandler initialized');
    }

    // 初始化翻译浮层
    if (typeof window.TranslationTooltip !== 'undefined') {
      window.translationTooltip = new window.TranslationTooltip(isMobile);
      log('TranslationTooltip initialized');
    }

    // 初始化文本处理器
    if (typeof window.TextProcessor !== 'undefined') {
      window.textProcessor = new window.TextProcessor(isMobile);
      window.textProcessor.processPage();
      log('TextProcessor initialized and processing started');
    }
  }

  // 监听页面动态变化（如SPA路由切换、AJAX加载内容等）
  function observeDynamicContent() {
    const observer = new MutationObserver((mutations) => {
      let shouldReprocess = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldReprocess = true;
          break;
        }
      }

      if (shouldReprocess && window.textProcessor) {
        // 防抖：避免频繁重新处理
        clearTimeout(window.reprocessTimeout);
        window.reprocessTimeout = setTimeout(() => {
          log('Content changed, reprocessing...');
          window.textProcessor.processPage();
        }, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    log('MutationObserver started');
  }

  // 监听来自popup的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleExtension') {
      window.VOCAB_HELPER_CONFIG.enabled = request.enabled;
      
      if (request.enabled) {
        log('Extension enabled, reprocessing page');
        if (window.textProcessor) {
          window.textProcessor.processPage();
        }
      } else {
        log('Extension disabled, cleaning up');
        // 清理所有标记
        if (window.textProcessor) {
          window.textProcessor.cleanup();
        }
      }
      
      sendResponse({ success: true });
    }
    
    return true; // 保持消息通道开启
  });

  log('Main script loaded successfully');
})();

