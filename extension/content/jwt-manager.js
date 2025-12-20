// JWT Manager
// 管理JWT token的存储、验证和刷新

(function() {
  'use strict';

  class JWTManager {
    constructor() {
      // 使用默认值保护，防止CONFIG未加载
      this.storageKey = window.CONFIG?.jwt?.storageKey || 'vocab_helper_jwt';
      this.expiryBuffer = window.CONFIG?.jwt?.expiryBuffer || 300;
      this.token = null;
      this.payload = null;
      this.expiresAt = null;
    }

    /**
     * 初始化 - 从storage加载token并监听变化
     */
    async init() {
      return new Promise((resolve) => {
        chrome.storage.local.get([this.storageKey], (result) => {
          if (result[this.storageKey]) {
            this.setToken(result[this.storageKey]);
            this.log('Token loaded from storage', { user_id: this.getUserId() });
          } else {
            this.log('No token found in storage');
          }
          
          // 监听 storage 变化，当用户从 popup 登录后自动更新
          this.listenForTokenChanges();
          
          resolve();
        });
      });
    }
    
    /**
     * 监听 token 变化（用户登录/登出时）
     */
    listenForTokenChanges() {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        
        if (changes[this.storageKey]) {
          const newToken = changes[this.storageKey].newValue;
          
          if (newToken) {
            console.log('[JWTManager] 🔄 Token updated from storage');
            this.setToken(newToken);
            
            // 更新全局 API 就绪状态
            if (window.VOCAB_HELPER_CONFIG) {
              window.VOCAB_HELPER_CONFIG.apiReady = true;
              window.VOCAB_HELPER_CONFIG.API_READY = true;
              console.log('[JWTManager] ✅ API_READY set to true');
            }
            
            // 触发页面重新处理
            if (window.textProcessor) {
              console.log('[JWTManager] 🔄 Triggering page reprocess...');
              setTimeout(() => {
                window.textProcessor.processPage();
              }, 500);
            }
          } else {
            console.log('[JWTManager] 🔒 Token removed (logged out)');
            this.clear();
            
            if (window.VOCAB_HELPER_CONFIG) {
              window.VOCAB_HELPER_CONFIG.apiReady = false;
              window.VOCAB_HELPER_CONFIG.API_READY = false;
            }
          }
        }
      });
      
      this.log('Listening for token changes');
    }

    /**
     * 设置JWT token
     */
    setToken(token) {
      this.token = token;
      
      try {
        // 解析JWT payload（base64解码）
        const parts = token.split('.');
        if (parts.length === 3) {
          // JWT格式: header.payload.signature
          const payloadBase64 = parts[1];
          // Base64URL解码
          const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
          const payload = JSON.parse(payloadJson);
          
          this.payload = payload;
          this.expiresAt = payload.exp * 1000;  // 转换为毫秒
          
          // 保存到storage
          chrome.storage.local.set({
            [this.storageKey]: token
          });
          
          this.log('Token set successfully', { 
            user_id: payload.user_id,
            expires: new Date(this.expiresAt).toISOString(),
            valid_for: this.getTimeUntilExpiry()
          });
        } else {
          throw new Error('Invalid JWT format');
        }
      } catch (error) {
        console.error('[JWTManager] Failed to parse JWT:', error);
        this.clear();
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
     * 支持多种JWT payload格式: id, user_id, sub
     */
    getUserId() {
      return this.payload?.id || this.payload?.user_id || this.payload?.sub || null;
    }

    /**
     * 获取用户CEFR等级
     */
    getCEFRLevel() {
      return this.payload?.cefr_level || 'B1';
    }

    /**
     * 获取完整payload
     */
    getPayload() {
      return this.payload;
    }

    /**
     * 检查token是否有效
     */
    isValid() {
      if (!this.token || !this.expiresAt) {
        return false;
      }
      
      // 检查是否过期（提前buffer时间）
      const bufferMs = this.expiryBuffer * 1000;
      const isValid = Date.now() < (this.expiresAt - bufferMs);
      
      if (!isValid) {
        this.log('Token expired or about to expire');
      }
      
      return isValid;
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
      const needs = timeLeft < oneHour && timeLeft > 0;
      
      if (needs) {
        this.log('Token needs refresh', { time_left: this.getTimeUntilExpiry() });
      }
      
      return needs;
    }

    /**
     * 获取距离过期的剩余时间（秒）
     */
    getTimeUntilExpiry() {
      if (!this.expiresAt) {
        return 0;
      }
      
      const timeLeft = this.expiresAt - Date.now();
      return Math.max(0, Math.floor(timeLeft / 1000));
    }

    /**
     * 清除token
     */
    async clear() {
      this.token = null;
      this.payload = null;
      this.expiresAt = null;
      
      return new Promise((resolve) => {
        chrome.storage.local.remove(this.storageKey, () => {
          this.log('Token cleared');
          resolve();
        });
      });
    }

    /**
     * 获取Authorization header值
     */
    getAuthHeader() {
      return this.token ? `Bearer ${this.token}` : null;
    }

    /**
     * 检查是否已登录
     */
    isLoggedIn() {
      return this.token !== null && this.isValid();
    }

    log(...args) {
      if (window.CONFIG && window.CONFIG.features.debugMode) {
        console.log('[JWTManager]', ...args);
      }
    }
  }

  // 导出到全局
  window.JWTManager = JWTManager;
  window.jwtManager = new JWTManager();
})();

