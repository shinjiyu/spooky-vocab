// API Client
// 前端与后端API通信客户端

(function() {
  'use strict';

  class APIClient {
    constructor() {
      // 使用默认值保护，防止CONFIG未加载
      this.baseURL = window.CONFIG?.api?.baseURL || 'http://localhost:3000';
      this.timeout = window.CONFIG?.api?.timeout || 10000;
      this.retryAttempts = window.CONFIG?.api?.retryAttempts || 3;
      this.retryDelay = window.CONFIG?.api?.retryDelay || 1000;
      this.maxBatchSize = window.CONFIG?.performance?.maxBatchSize || 100;
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

      // 添加JWT token（除非明确跳过）
      if (!options.skipAuth) {
        const authHeader = window.jwtManager.getAuthHeader();
        if (authHeader) {
          config.headers['Authorization'] = authHeader;
        } else if (!options.allowNoAuth) {
          throw new APIError({
            code: 'NO_TOKEN',
            message: 'No JWT token available. Please login first.'
          }, 401);
        }
      }

      // 添加请求体
      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.body = JSON.stringify(data);
      }

      // 执行请求（带重试）
      for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
        try {
          this.log(`${method} ${endpoint}`, { attempt: attempt + 1, data });

          const response = await this.fetchWithTimeout(url, config);
          const responseData = await response.json();

          if (!response.ok) {
            // 检查是否是认证错误
            if (response.status === 401 && responseData.error?.code === 'TOKEN_EXPIRED') {
              // Token过期，尝试刷新
              if (!options.isRefreshRequest) {
                await this.handleTokenExpired();
                // 刷新后重试原请求
                return this.request(method, endpoint, data, options);
              }
            }

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

          // 网络错误才重试，API错误直接抛出
          if (error instanceof APIError) {
            throw error;
          }

          // 等待后重试
          await this.sleep(this.retryDelay * (attempt + 1));
        }
      }
    }

    /**
     * 带超时的fetch
     */
    async fetchWithTimeout(url, config) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          ...config,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
    }

    /**
     * 处理token过期
     */
    async handleTokenExpired() {
      this.log('Token expired, attempting refresh...');
      
      try {
        const result = await this.refreshToken();
        window.jwtManager.setToken(result.token);
        this.log('Token refreshed successfully');
      } catch (error) {
        this.log('Token refresh failed, clearing token', error);
        await window.jwtManager.clear();
        throw error;
      }
    }

    // ============ HTTP方法封装 ============

    /**
     * GET请求
     */
    async get(endpoint, params = {}, options = {}) {
      // 构建查询字符串
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `${endpoint}?${queryString}` : endpoint;
      
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

    // ============ 认证API ============

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
      return this.post('/api/auth/refresh', null, { isRefreshRequest: true });
    }

    /**
     * 验证Token
     */
    async verifyToken() {
      return this.get('/api/auth/verify');
    }

    // ============ 词汇API ============

    /**
     * 批量检查单词
     */
    async batchCheckWords(words) {
      if (!Array.isArray(words) || words.length === 0) {
        throw new Error('words must be a non-empty array');
      }

      // 限制批量大小
      if (words.length > this.maxBatchSize) {
        this.log(`Batch size ${words.length} exceeds max ${this.maxBatchSize}, splitting...`);
        
        // 分批处理
        const batches = [];
        for (let i = 0; i < words.length; i += this.maxBatchSize) {
          batches.push(words.slice(i, i + this.maxBatchSize));
        }
        
        // 并发请求所有批次
        const results = await Promise.all(
          batches.map(batch => this.batchCheckWords(batch))
        );
        
        // 合并结果
        return Object.assign({}, ...results);
      }

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

    // ============ 反馈API ============

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
     * 标记单词为未知（请求翻译）
     */
    async markWordUnknown(word, context = null, url = null) {
      console.log(`[APIClient] 🌐 POST /api/feedback/unknown - word: ${word}`);
      const result = await this.post('/api/feedback/unknown', {
        word,
        context,
        url: url || window.location.href,
        timestamp: new Date().toISOString()
      });
      console.log(`[APIClient] 📥 Response:`, result);
      return result;
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

    // ============ 复习API ============

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

    // ============ 用户API ============

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

    /**
     * 延迟函数
     */
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 检查网络连接
     */
    isOnline() {
      return navigator.onLine;
    }

    log(...args) {
      if (window.CONFIG && window.CONFIG.features.debugMode) {
        console.log('[APIClient]', ...args);
      }
    }
  }

  // API错误类
  class APIError extends Error {
    constructor(error, status) {
      super(error?.message || 'API Error');
      this.name = 'APIError';
      this.code = error?.code || 'UNKNOWN_ERROR';
      this.status = status;
      this.details = error?.details;
    }
  }

  // 导出到全局
  window.APIClient = APIClient;
  window.APIError = APIError;
  window.apiClient = new APIClient();
})();

