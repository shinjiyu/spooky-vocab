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
      
      // 不需要处理的标签
      this.excludedTags = new Set([
        'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
        'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'CODE', 'PRE'
      ]);

      // 单词匹配正则（包括连字符和缩写）
      this.wordRegex = /\b[A-Za-z]+(?:[-'][A-Za-z]+)*\b/g;
    }

    // 处理整个页面
    processPage() {
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
      let node;
      
      while ((node = walker.nextNode())) {
        if (this.wordCount >= this.maxWords) {
          this.log(`Reached max word limit: ${this.maxWords}`);
          break;
        }
        nodesToProcess.push(node);
      }

      // 批量处理文本节点
      nodesToProcess.forEach(node => this.processTextNode(node));

      this.log(`Processed ${this.wordCount} words`);
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

    // 处理单个文本节点
    processTextNode(textNode) {
      if (!textNode.parentElement) {
        return;
      }

      const text = textNode.textContent;
      const words = [];
      let match;
      
      // 提取所有单词及其位置
      while ((match = this.wordRegex.exec(text)) !== null) {
        words.push({
          word: match[0],
          index: match.index,
          length: match[0].length
        });
      }

      if (words.length === 0) {
        return;
      }

      // 创建文档片段
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

        // 检查是否需要翻译
        const needsTranslation = window.mockVocabulary && 
                                window.mockVocabulary.needsTranslation(word);

        if (needsTranslation) {
          // 包装需要翻译的单词
          const span = document.createElement('span');
          span.className = 'vocab-word vocab-needs-translation';
          span.textContent = word;
          span.dataset.word = word.toLowerCase();
          
          // 添加事件监听
          this.attachEventListeners(span);
          
          fragment.appendChild(span);
          this.wordCount++;
        } else {
          // 不需要翻译的单词也包装，但不添加特殊样式（用于双击/长按功能）
          const span = document.createElement('span');
          span.className = 'vocab-word';
          span.textContent = word;
          span.dataset.word = word.toLowerCase();
          
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
    handleMouseEnter(e, span) {
      const word = span.dataset.word;
      const needsTranslation = span.classList.contains('vocab-needs-translation');
      
      if (needsTranslation && window.translationTooltip) {
        const translation = window.mockVocabulary.getTranslation(word);
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
    handleDoubleClick(e, span) {
      e.preventDefault();
      const word = span.dataset.word;
      
      // 查询翻译（即使是简单词也尝试显示）
      let translation = window.mockVocabulary.getTranslation(word);
      
      if (!translation) {
        // 如果没有翻译数据，显示提示
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
        window.feedbackHandler.markAsUnknown(word);
      }
    }

    // 移动端：点击切换
    handleMobileClick(e, span) {
      e.preventDefault();
      const word = span.dataset.word;
      const needsTranslation = span.classList.contains('vocab-needs-translation');
      
      if (needsTranslation) {
        const translation = window.mockVocabulary.getTranslation(word);
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
    handleLongPress(e, span) {
      e.preventDefault();
      const word = span.dataset.word;
      
      let translation = window.mockVocabulary.getTranslation(word);
      
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
        window.feedbackHandler.markAsUnknown(word);
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

