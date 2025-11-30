// JWT Manager
// 管理JWT token的存储、验证和刷新

(function() {
  'use strict';

  class JWTManager {
    constructor() {
      this.storageKey = window.CONFIG.jwt.storageKey;
      this.token = null;
      this.payload = null;
      this.expiresAt = null;
    }

    /**
     * 初始化 - 从storage加载token
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
          resolve();
        });
      });
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
     */
    getUserId() {
      return this.payload?.user_id || null;
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
      const bufferMs = window.CONFIG.jwt.expiryBuffer * 1000;
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

