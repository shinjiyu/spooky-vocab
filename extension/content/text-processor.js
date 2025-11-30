// Text processor: traverse DOM and wrap English words
// 文本处理器：遍历页面文本节点并包装英文单词

(function() {
  'use strict';

  class TextProcessor {
    constructor(isMobile) {
      this.isMobile = isMobile;
      this.processedNodes = new WeakSet();
      this.wordCount = 0;
      this.maxWords = isMobile ? 1000 : 3000; // 移动端限制处理数量
      
      // 词汇判断缓存 {word: {needs_translation: bool, translation: {...}}}
      this.vocabularyCache = new Map();
      this.cacheExpiry = window.CONFIG ? window.CONFIG.performance.cacheExpiry : 3600000; // 1小时
      
      // 不需要处理的标签
      this.excludedTags = new Set([
        'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
        'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'CODE', 'PRE'
      ]);

      // 单词匹配正则（包括连字符和缩写）
      this.wordRegex = /\b[A-Za-z]+(?:[-'][A-Za-z]+)*\b/g;
      
      // 待处理的单词批次
      this.pendingBatch = new Set();
      this.batchTimer = null;
    }

    // 处理整个页面
    async processPage() {
      if (!window.VOCAB_HELPER_CONFIG.enabled) {
        return;
      }

      this.wordCount = 0;
      this.log('Starting page processing');

      // 使用TreeWalker遍历所有文本节点
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => this.acceptNode(node)
        }
      );

      const nodesToProcess = [];
      const allWords = new Set();
      let node;
      
      while ((node = walker.nextNode())) {
        if (this.wordCount >= this.maxWords) {
          this.log(`Reached max word limit: ${this.maxWords}`);
          break;
        }
        
        // 收集节点和单词
        const words = this.extractWords(node.textContent);
        if (words.length > 0) {
          nodesToProcess.push({ node, words });
          words.forEach(w => allWords.add(w.word.toLowerCase()));
        }
      }

      // 批量查询单词
      if (allWords.size > 0) {
        await this.batchCheckWords(Array.from(allWords));
      }

      // 处理文本节点
      nodesToProcess.forEach(({ node, words }) => {
        this.processTextNodeWithCache(node, words);
      });

      this.log(`Processed ${this.wordCount} words`);
    }

    // 提取文本中的所有单词
    extractWords(text) {
      const words = [];
      let match;
      this.wordRegex.lastIndex = 0; // 重置正则状态
      
      while ((match = this.wordRegex.exec(text)) !== null) {
        words.push({
          word: match[0],
          index: match.index,
          length: match[0].length
        });
      }
      
      return words;
    }

    // 批量检查单词（调用API或使用Mock）
    async batchCheckWords(words) {
      if (words.length === 0) return;

      // 过滤掉已缓存的单词
      const uncachedWords = words.filter(w => !this.vocabularyCache.has(w));
      
      if (uncachedWords.length === 0) {
        this.log('All words found in cache');
        return;
      }

      this.log(`Checking ${uncachedWords.length} words via ${window.VOCAB_HELPER_CONFIG.useAPI ? 'API' : 'Mock'}`);

      try {
        if (window.VOCAB_HELPER_CONFIG.useAPI && window.VOCAB_HELPER_CONFIG.apiReady) {
          // 使用真实API
          const result = await window.apiClient.batchCheckWords(uncachedWords);
          
          // 缓存结果
          Object.entries(result).forEach(([word, data]) => {
            this.vocabularyCache.set(word, {
              needs_translation: data.needs_translation,
              translation: data.translation || null,
              timestamp: Date.now()
            });
          });
          
        } else {
          // 使用Mock数据
          if (window.mockVocabulary) {
            uncachedWords.forEach(word => {
              const needsTranslation = window.mockVocabulary.needsTranslation(word);
              const translation = needsTranslation ? window.mockVocabulary.getTranslation(word) : null;
              
              this.vocabularyCache.set(word, {
                needs_translation: needsTranslation,
                translation: translation,
                timestamp: Date.now()
              });
            });
          }
        }
        
      } catch (error) {
        console.error('[TextProcessor] Failed to check words:', error);
        
        // API失败，降级到Mock模式
        if (window.VOCAB_HELPER_CONFIG.useAPI && window.mockVocabulary) {
          this.log('API failed, falling back to mock mode');
          uncachedWords.forEach(word => {
            const needsTranslation = window.mockVocabulary.needsTranslation(word);
            const translation = needsTranslation ? window.mockVocabulary.getTranslation(word) : null;
            
            this.vocabularyCache.set(word, {
              needs_translation: needsTranslation,
              translation: translation,
              timestamp: Date.now()
            });
          });
        }
      }
    }

    // 判断节点是否应该被处理
    acceptNode(node) {
      // 已处理过的节点跳过
      if (this.processedNodes.has(node)) {
        return NodeFilter.FILTER_REJECT;
      }

      // 检查父元素是否在排除列表中
      let parent = node.parentElement;
      while (parent) {
        if (this.excludedTags.has(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // 跳过已标记的单词（避免重复处理）
        if (parent.classList && parent.classList.contains('vocab-word')) {
          return NodeFilter.FILTER_REJECT;
        }
        
        parent = parent.parentElement;
      }

      // 检查文本内容是否包含英文
      const text = node.textContent.trim();
      if (text.length === 0 || !/[A-Za-z]/.test(text)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    }

    // 使用缓存数据处理文本节点
    processTextNodeWithCache(textNode, words) {
      if (!textNode.parentElement) {
        return;
      }

      const text = textNode.textContent;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      words.forEach(({ word, index, length }) => {
        if (this.wordCount >= this.maxWords) {
          return;
        }

        // 添加单词前的文本
        if (index > lastIndex) {
          fragment.appendChild(
            document.createTextNode(text.substring(lastIndex, index))
          );
        }

        // 从缓存获取判断结果
        const wordLower = word.toLowerCase();
        const cached = this.vocabularyCache.get(wordLower);
        const needsTranslation = cached ? cached.needs_translation : false;

        if (needsTranslation) {
          // 包装需要翻译的单词
          const span = document.createElement('span');
          span.className = 'vocab-word vocab-needs-translation';
          span.textContent = word;
          span.dataset.word = wordLower;
          
          // 添加事件监听
          this.attachEventListeners(span);
          
          fragment.appendChild(span);
          this.wordCount++;
        } else {
          // 不需要翻译的单词也包装，但不添加特殊样式（用于双击/长按功能）
          const span = document.createElement('span');
          span.className = 'vocab-word';
          span.textContent = word;
          span.dataset.word = wordLower;
          
          // 添加事件监听（支持强制显示翻译）
          this.attachEventListeners(span);
          
          fragment.appendChild(span);
        }

        lastIndex = index + length;
      });

      // 添加剩余文本
      if (lastIndex < text.length) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex))
        );
      }

      // 替换原文本节点
      textNode.parentElement.replaceChild(fragment, textNode);
      this.processedNodes.add(textNode);
    }

    // 为单词元素添加事件监听
    attachEventListeners(span) {
      if (this.isMobile) {
        // 移动端：点击切换翻译，长按强制显示
        span.addEventListener('click', (e) => this.handleMobileClick(e, span));
        span.addEventListener('touchstart', (e) => this.handleTouchStart(e, span));
        span.addEventListener('touchend', (e) => this.handleTouchEnd(e, span));
        span.addEventListener('touchcancel', (e) => this.handleTouchCancel(e, span));
      } else {
        // 桌面端：悬停显示翻译，双击强制显示
        span.addEventListener('mouseenter', (e) => this.handleMouseEnter(e, span));
        span.addEventListener('mouseleave', (e) => this.handleMouseLeave(e, span));
        span.addEventListener('dblclick', (e) => this.handleDoubleClick(e, span));
      }
    }

    // 桌面端：鼠标进入
    async handleMouseEnter(e, span) {
      const word = span.dataset.word;
      const needsTranslation = span.classList.contains('vocab-needs-translation');
      
      if (needsTranslation && window.translationTooltip) {
        const translation = await this.getTranslation(word);
        if (translation) {
          window.translationTooltip.show(span, word, translation);
        }
      }
    }

    // 桌面端：鼠标离开
    handleMouseLeave(e, span) {
      if (window.translationTooltip) {
        window.translationTooltip.scheduleHide();
      }
    }

    // 桌面端：双击强制显示翻译
    async handleDoubleClick(e, span) {
      e.preventDefault();
      const word = span.dataset.word;
      
      this.log(`Double-click on word: ${word}`);
      
      // 获取翻译
      let translation = await this.getTranslation(word, true);
      
      if (!translation) {
        translation = {
          translation: '(暂无翻译数据)',
          phonetic: ''
        };
      }
      
      if (window.translationTooltip) {
        window.translationTooltip.show(span, word, translation, true);
      }
      
      // 记录用户主动请求翻译
      if (window.feedbackHandler) {
        await window.feedbackHandler.markAsUnknown(word);
      }
    }

    // 移动端：点击切换
    async handleMobileClick(e, span) {
      e.preventDefault();
      const word = span.dataset.word;
      const needsTranslation = span.classList.contains('vocab-needs-translation');
      
      if (needsTranslation) {
        const translation = await this.getTranslation(word);
        if (translation && window.translationTooltip) {
          window.translationTooltip.toggle(span, word, translation);
        }
      }
    }

    // 移动端：触摸开始（长按检测）
    handleTouchStart(e, span) {
      span.longPressTimer = setTimeout(() => {
        this.handleLongPress(e, span);
      }, 500);
    }

    // 移动端：触摸结束
    handleTouchEnd(e, span) {
      if (span.longPressTimer) {
        clearTimeout(span.longPressTimer);
        span.longPressTimer = null;
      }
    }

    // 移动端：触摸取消
    handleTouchCancel(e, span) {
      if (span.longPressTimer) {
        clearTimeout(span.longPressTimer);
        span.longPressTimer = null;
      }
    }

    // 移动端：长按强制显示翻译
    async handleLongPress(e, span) {
      e.preventDefault();
      const word = span.dataset.word;
      
      this.log(`Long press on word: ${word}`);
      
      let translation = await this.getTranslation(word, true);
      
      if (!translation) {
        translation = {
          translation: '(暂无翻译数据)',
          phonetic: ''
        };
      }
      
      if (window.translationTooltip) {
        window.translationTooltip.show(span, word, translation, true);
      }
      
      // 记录用户主动请求翻译
      if (window.feedbackHandler) {
        await window.feedbackHandler.markAsUnknown(word);
      }
    }

    // 获取单词翻译（从缓存或API）
    async getTranslation(word, forceAPI = false) {
      // 先检查缓存
      const cached = this.vocabularyCache.get(word);
      
      if (cached && cached.translation && !forceAPI) {
        return cached.translation;
      }

      this.log(`Getting translation for: ${word}`);

      try {
        if (window.VOCAB_HELPER_CONFIG.useAPI && window.VOCAB_HELPER_CONFIG.apiReady) {
          // 从API获取
          const data = await window.apiClient.getWord(word);
          
          if (data && data.translation) {
            // 更新缓存
            this.vocabularyCache.set(word, {
              needs_translation: data.needs_translation,
              translation: data.translation,
              timestamp: Date.now()
            });
            
            return data.translation;
          }
        } else if (window.mockVocabulary) {
          // 从Mock获取
          return window.mockVocabulary.getTranslation(word);
        }
      } catch (error) {
        console.error(`[TextProcessor] Failed to get translation for ${word}:`, error);
        
        // API失败，降级到Mock
        if (window.mockVocabulary) {
          return window.mockVocabulary.getTranslation(word);
        }
      }

      return null;
    }

    // 清理过期缓存
    cleanExpiredCache() {
      const now = Date.now();
      let cleanedCount = 0;
      
      for (const [word, data] of this.vocabularyCache.entries()) {
        if (now - data.timestamp > this.cacheExpiry) {
          this.vocabularyCache.delete(word);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        this.log(`Cleaned ${cleanedCount} expired cache entries`);
      }
    }

    // 清理所有标记（禁用插件时使用）
    cleanup() {
      const allWords = document.querySelectorAll('.vocab-word');
      allWords.forEach(span => {
        const text = span.textContent;
        const textNode = document.createTextNode(text);
        span.parentNode.replaceChild(textNode, span);
      });
      
      this.log('Cleaned up all word markers');
    }

    log(...args) {
      if (window.VOCAB_HELPER_CONFIG && window.VOCAB_HELPER_CONFIG.debug) {
        console.log('[TextProcessor]', ...args);
      }
    }
  }

  // 导出到全局
  window.TextProcessor = TextProcessor;
})();
