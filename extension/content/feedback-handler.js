// Feedback handler: record user feedback (known/unknown words)
// 反馈处理器：记录用户对单词的反馈

(function() {
  'use strict';

  class FeedbackHandler {
    constructor() {
      this.encounterLog = []; // 本次会话遇到的单词
      this.knownCount = 0;
      this.unknownCount = 0;
    }

    // 标记单词为"已知"
    markAsKnown(word) {
      const lowerWord = word.toLowerCase();
      
      // 更新Mock词汇系统
      if (window.mockVocabulary) {
        window.mockVocabulary.markAsKnown(lowerWord);
      }

      this.knownCount++;
      this.logEncounter(lowerWord, 'known');
      
      this.log(`Marked as known: ${lowerWord}`);
    }

    // 标记单词为"未知"（用户主动请求翻译）
    markAsUnknown(word) {
      const lowerWord = word.toLowerCase();
      
      // 更新Mock词汇系统
      if (window.mockVocabulary) {
        window.mockVocabulary.markAsUnknown(lowerWord);
      }

      this.unknownCount++;
      this.logEncounter(lowerWord, 'unknown');
      
      this.log(`Marked as unknown: ${lowerWord}`);
    }

    // 记录单词遇到日志
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
        unknownCount: this.unknownCount
      };
    }

    // 获取历史记录
    getHistory(callback) {
      chrome.storage.local.get(['encounterHistory'], (result) => {
        callback(result.encounterHistory || []);
      });
    }

    // 清除历史记录
    clearHistory() {
      chrome.storage.local.set({ encounterHistory: [] }, () => {
        this.encounterLog = [];
        this.knownCount = 0;
        this.unknownCount = 0;
        this.log('History cleared');
      });
    }

    log(...args) {
      if (window.VOCAB_HELPER_CONFIG && window.VOCAB_HELPER_CONFIG.debug) {
        console.log('[FeedbackHandler]', ...args);
      }
    }
  }

  // 导出到全局
  window.FeedbackHandler = FeedbackHandler;
})();

