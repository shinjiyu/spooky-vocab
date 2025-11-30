// Feedback handler: record user feedback (known/unknown words)
// 反馈处理器：记录用户对单词的反馈

(function() {
  'use strict';

  class FeedbackHandler {
    constructor() {
      this.encounterLog = []; // 本次会话遇到的单词
      this.knownCount = 0;
      this.unknownCount = 0;
      this.syncQueue = []; // 待同步的操作队列
      this.syncing = false;
    }

    // 标记单词为"已知"
    async markAsKnown(word, context = null) {
      const lowerWord = word.toLowerCase();
      
      this.log(`Marking as known: ${lowerWord}`);
      
      // 立即更新本地计数
      this.knownCount++;
      this.logEncounter(lowerWord, 'known');
      
      // 调用API（纯API模式）
      try {
        if (window.VOCAB_HELPER_CONFIG.API_READY) {
          await window.apiClient.markWordKnown(lowerWord);
          this.log(`✓ API: Marked as known: ${lowerWord}`);
          this.notifyPopupRefresh(); // 通知Popup刷新
        } else {
          this.log(`⚠ API not ready, queuing feedback: ${lowerWord}`);
          this.queueSync('known', lowerWord, context);
        }
      } catch (error) {
        console.error(`[FeedbackHandler] ✗ Failed to mark as known: ${lowerWord}`, error);
        
        // API失败，加入同步队列稍后重试
        this.queueSync('known', lowerWord, context);
      }
    }

    // 标记单词为"未知"（用户主动请求翻译）
    async markAsUnknown(word, context = null) {
      const lowerWord = word.toLowerCase();
      
      this.log(`Marking as unknown: ${lowerWord}`);
      
      // 立即更新本地计数
      this.unknownCount++;
      this.logEncounter(lowerWord, 'unknown');
      
      // 调用API（纯API模式）
      try {
        if (window.VOCAB_HELPER_CONFIG.API_READY) {
          await window.apiClient.markWordUnknown(lowerWord, context);
          this.log(`✓ API: Marked as unknown: ${lowerWord}`);
          this.notifyPopupRefresh(); // 通知Popup刷新
        } else {
          this.log(`⚠ API not ready, queuing feedback: ${lowerWord}`);
          this.queueSync('unknown', lowerWord, context);
        }
      } catch (error) {
        console.error(`[FeedbackHandler] ✗ Failed to mark as unknown: ${lowerWord}`, error);
        
        // API失败，加入同步队列稍后重试
        this.queueSync('unknown', lowerWord, context);
      }
    }

    // 记录单词遇到（不发送到后端，仅本地日志）
    async recordEncounter(word, context = null) {
      const lowerWord = word.toLowerCase();
      
      try {
        if (window.VOCAB_HELPER_CONFIG.useAPI && window.VOCAB_HELPER_CONFIG.apiReady) {
          // 可选：调用encounter端点（如果后端实现了）
          // await window.apiClient.recordEncounter(lowerWord);
        }
      } catch (error) {
        // 忽略错误，遇到记录不是关键功能
      }
      
      this.logEncounter(lowerWord, 'encounter');
    }

    // 加入同步队列
    queueSync(action, word, context = null) {
      this.syncQueue.push({
        action,
        word,
        context,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
      
      this.log(`Queued for sync: ${action} - ${word}`);
      
      // 保存队列到本地存储
      this.saveSyncQueue();
      
      // 尝试同步
      this.processSyncQueue();
    }

    // 处理同步队列
    async processSyncQueue() {
      if (this.syncing || this.syncQueue.length === 0) {
        return;
      }
      
      if (!window.VOCAB_HELPER_CONFIG.API_READY || !navigator.onLine) {
        this.log('⚠ API not ready or offline, skipping sync');
        return;
      }
      
      this.syncing = true;
      this.log(`Processing sync queue: ${this.syncQueue.length} items`);
      
      const itemsToSync = [...this.syncQueue];
      const syncedItems = [];
      
      for (const item of itemsToSync) {
        try {
          if (item.action === 'known') {
            await window.apiClient.markWordKnown(item.word);
          } else if (item.action === 'unknown') {
            await window.apiClient.markWordUnknown(item.word, item.context, item.url);
          }
          
          syncedItems.push(item);
          this.log(`Synced: ${item.action} - ${item.word}`);
          
        } catch (error) {
          console.error(`[FeedbackHandler] Sync failed for ${item.word}:`, error);
          // 同步失败的项保留在队列中
        }
      }
      
      // 从队列中移除已同步的项
      this.syncQueue = this.syncQueue.filter(item => !syncedItems.includes(item));
      this.saveSyncQueue();
      
      this.syncing = false;
      
      this.log(`Sync complete: ${syncedItems.length} items synced, ${this.syncQueue.length} remaining`);
    }

    // 保存同步队列到本地存储
    saveSyncQueue() {
      chrome.storage.local.set({ syncQueue: this.syncQueue });
    }

    // 从本地存储加载同步队列
    async loadSyncQueue() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['syncQueue'], (result) => {
          if (result.syncQueue) {
            this.syncQueue = result.syncQueue;
            this.log(`Loaded ${this.syncQueue.length} items from sync queue`);
          }
          resolve();
        });
      });
    }

    // 记录单词遇到日志（本地）
    logEncounter(word, action) {
      const timestamp = new Date().toISOString();
      const encounter = {
        word,
        action,
        timestamp,
        url: window.location.href
      };

      this.encounterLog.push(encounter);

      // 保存到本地存储
      chrome.storage.local.get(['encounterHistory'], (result) => {
        const history = result.encounterHistory || [];
        history.push(encounter);

        // 只保留最近1000条记录
        if (history.length > 1000) {
          history.splice(0, history.length - 1000);
        }

        chrome.storage.local.set({ encounterHistory: history });
      });
    }

    // 获取本次会话统计
    getSessionStats() {
      const uniqueWords = new Set(this.encounterLog.map(e => e.word));
      
      return {
        totalEncounters: this.encounterLog.length,
        uniqueWords: uniqueWords.size,
        knownCount: this.knownCount,
        unknownCount: this.unknownCount,
        syncPending: this.syncQueue.length
      };
    }

    // 获取历史记录
    getHistory(callback) {
      chrome.storage.local.get(['encounterHistory'], (result) => {
        callback(result.encounterHistory || []);
      });
    }

    // 获取统计数据（从API）
    async getStats(period = 'all') {
      try {
        if (window.VOCAB_HELPER_CONFIG.useAPI && window.VOCAB_HELPER_CONFIG.apiReady) {
          const stats = await window.apiClient.getStats(period);
          return stats;
        }
      } catch (error) {
        console.error('[FeedbackHandler] Failed to get stats:', error);
      }
      
      // 降级到本地统计
      return this.getSessionStats();
    }

    // 清除历史记录
    clearHistory() {
      chrome.storage.local.set({ 
        encounterHistory: [],
        syncQueue: []
      }, () => {
        this.encounterLog = [];
        this.knownCount = 0;
        this.unknownCount = 0;
        this.syncQueue = [];
        this.log('History cleared');
      });
    }

    log(...args) {
      if (window.VOCAB_HELPER_CONFIG && window.VOCAB_HELPER_CONFIG.DEBUG_MODE) {
        console.log('[FeedbackHandler]', ...args);
      }
    }
  }

  // 导出到全局
  window.FeedbackHandler = FeedbackHandler;
})();
