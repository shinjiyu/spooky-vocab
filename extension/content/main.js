// Main entry point for content script
// 主入口文件：检测设备类型并初始化各功能模块

(function() {
  'use strict';

  console.log('[VocabHelper] 🚀 main.js loaded');

  // 设备检测
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
  
  // 全局配置 - 合并已有配置
  const existingConfig = window.VOCAB_HELPER_CONFIG || {};
  window.VOCAB_HELPER_CONFIG = {
    ...existingConfig,  // 保留已有配置
    isMobile: isMobile,
    enabled: true,
    DEBUG_MODE: window.CONFIG?.features?.debugMode || false,
    useAPI: true,  // 是否使用真实API（false则使用mock）
    apiReady: false,  // API是否就绪
    API_READY: false  // 兼容旧代码
  };
  
  console.log('[VocabHelper] Config initialized:', window.VOCAB_HELPER_CONFIG);

  // 调试日志
  function log(...args) {
    if (window.VOCAB_HELPER_CONFIG && window.VOCAB_HELPER_CONFIG.DEBUG_MODE) {
      console.log('[VocabHelper]', ...args);
    }
  }

  // 显示版本信息
  if (window.VOCAB_HELPER_CONFIG && window.VOCAB_HELPER_CONFIG.DEBUG_MODE) {
    console.log('\n' + window.getVersionBanner() + '\n');
    console.log(`[VocabHelper] Version: ${window.getVersionInfo()}`);
    console.log(`[VocabHelper] Device: ${isMobile ? 'Mobile' : 'Desktop'}`);
  }

  log('Initializing...');

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
   * 注意：不再自动请求test-token，用户必须通过认证服务登录
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
      // 没有有效token，不自动请求test-token
      // 用户需要通过popup点击"前往登录"进行认证
      log('No valid token found. Please login via popup.');
      console.log('[VocabHelper] 请点击扩展图标登录');
      window.VOCAB_HELPER_CONFIG.apiReady = false;
      window.VOCAB_HELPER_CONFIG.API_READY = false;
      return;
    }
    
    log('Valid token found', { user_id: window.jwtManager.getUserId() });
    
    // 检查token是否即将过期
    if (window.jwtManager.needsRefresh()) {
      log('Token will expire soon, please re-login');
      // 不再自动刷新，token过期后提示用户重新登录
    }
    
    window.VOCAB_HELPER_CONFIG.apiReady = true;
    window.VOCAB_HELPER_CONFIG.API_READY = true;
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
   * 注入全局样式
   */
  function injectStyles() {
    const styleId = 'vocab-helper-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* 需要翻译的单词 - 轻微下划线 */
      .vocab-needs-translation {
        border-bottom: 1px dashed rgba(102, 126, 234, 0.5);
        cursor: pointer;
      }
      
      /* 所有单词在手机端的点击区域 */
      .vocab-word {
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      
      /* 点击反馈效果 */
      .vocab-clicked {
        background-color: rgba(102, 126, 234, 0.2) !important;
        border-radius: 3px;
      }
      
      /* 手机端优化 - 增大点击区域 */
      @media (max-width: 768px) {
        .vocab-word {
          padding: 2px 0;
          margin: -2px 0;
        }
        
        .vocab-needs-translation {
          border-bottom-width: 2px;
        }
      }
    `;
    document.head.appendChild(style);
    log('Styles injected');
  }

  /**
   * 初始化各功能模块
   */
  function initializeModules() {
    log('Initializing modules...');
    
    // 注入样式
    injectStyles();

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
    
    // 清除已记录的词汇（清除历史时）
    if (request.action === 'clearRecordedWords') {
      if (window.textProcessor) {
        window.textProcessor.clearRecordedWords();
      }
      sendResponse({ success: true });
    }
    
    return true; // 保持消息通道开启
  });

  log('Main script loaded successfully');
})();

