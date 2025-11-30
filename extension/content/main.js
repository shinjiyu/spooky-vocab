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
    debug: true
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

  function initializeExtension() {
    log('DOM ready, starting initialization');

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

    // 监听动态内容变化
    observeDynamicContent();
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

