// Translation tooltip component with Shadow DOM
// 翻译浮层组件：使用Shadow DOM实现响应式翻译提示

(function() {
  'use strict';

  class TranslationTooltip {
    constructor(isMobile) {
      this.isMobile = isMobile;
      this.tooltipContainer = null;
      this.shadowRoot = null;
      this.currentTarget = null;
      this.hideTimeout = null;
      this.isVisible = false;
      
      this.createTooltip();
      this.attachGlobalListeners();
    }

    // 创建浮层容器（使用Shadow DOM）
    createTooltip() {
      // 创建容器元素
      this.tooltipContainer = document.createElement('div');
      this.tooltipContainer.id = 'vocab-helper-tooltip-container';
      this.tooltipContainer.style.cssText = `
        position: absolute;
        z-index: 2147483647;
        pointer-events: none;
      `;

      // 附加Shadow DOM
      this.shadowRoot = this.tooltipContainer.attachShadow({ mode: 'open' });

      // 创建样式
      const style = document.createElement('style');
      style.textContent = this.getStyles();
      this.shadowRoot.appendChild(style);

      // 创建浮层内容容器
      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      this.shadowRoot.appendChild(tooltip);

      // 添加到页面
      document.body.appendChild(this.tooltipContainer);
      
      this.log('Tooltip created');
    }

    // 获取样式（响应式设计）
    getStyles() {
      const baseSize = this.isMobile ? '16px' : '14px';
      const padding = this.isMobile ? '12px 16px' : '8px 12px';
      const buttonSize = this.isMobile ? '44px' : '24px';
      const maxWidth = this.isMobile ? '280px' : '320px';
      
      return `
        .tooltip {
          position: relative;
          background: rgba(30, 30, 30, 0.95);
          color: #ffffff;
          padding: ${padding};
          border-radius: ${this.isMobile ? '12px' : '8px'};
          font-size: ${baseSize};
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          line-height: 1.5;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          max-width: ${maxWidth};
          pointer-events: auto;
          opacity: 0;
          transform: translateY(4px);
          transition: opacity 0.2s ease, transform 0.2s ease;
        }

        .tooltip.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .tooltip.mobile {
          font-size: 16px;
          padding: 12px 16px;
        }

        .tooltip-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: ${this.isMobile ? '8px' : '4px'};
        }

        .tooltip-word {
          font-weight: 600;
          font-size: ${this.isMobile ? '18px' : '15px'};
          margin-right: 8px;
        }

        .tooltip-close {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #ffffff;
          width: ${buttonSize};
          height: ${buttonSize};
          min-width: ${buttonSize};
          min-height: ${buttonSize};
          border-radius: ${this.isMobile ? '8px' : '4px'};
          cursor: pointer;
          font-size: ${this.isMobile ? '20px' : '16px'};
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s ease;
          flex-shrink: 0;
        }

        .tooltip-close:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .tooltip-close:active {
          background: rgba(255, 255, 255, 0.3);
        }

        .tooltip-phonetic {
          color: #88ccff;
          font-size: ${this.isMobile ? '15px' : '13px'};
          margin-bottom: ${this.isMobile ? '8px' : '6px'};
          font-family: 'Lucida Sans Unicode', 'Times New Roman', serif;
        }

        .tooltip-translation {
          color: #ffffff;
          line-height: 1.6;
        }

        .tooltip-arrow {
          position: absolute;
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
        }

        .tooltip-arrow.top {
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          border-bottom: 6px solid rgba(30, 30, 30, 0.95);
        }

        .tooltip-arrow.bottom {
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          border-top: 6px solid rgba(30, 30, 30, 0.95);
        }
      `;
    }

    // 显示浮层
    show(targetElement, word, translation, forceShow = false) {
      if (!targetElement || !translation) {
        return;
      }

      clearTimeout(this.hideTimeout);
      this.currentTarget = targetElement;

      // 构建浮层内容
      const tooltip = this.shadowRoot.querySelector('.tooltip');
      tooltip.innerHTML = `
        <div class="tooltip-header">
          <span class="tooltip-word">${word}</span>
          <button class="tooltip-close" data-action="close" title="我认识这个词">✓</button>
        </div>
        ${translation.phonetic ? `<div class="tooltip-phonetic">/${translation.phonetic}/</div>` : ''}
        <div class="tooltip-translation">${translation.translation}</div>
        <div class="tooltip-arrow"></div>
      `;

      // 添加移动端类名
      if (this.isMobile) {
        tooltip.classList.add('mobile');
      }

      // 绑定关闭按钮事件
      const closeBtn = tooltip.querySelector('[data-action="close"]');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleClose(word);
      });

      // 定位浮层
      this.positionTooltip(targetElement, tooltip);

      // 显示动画
      requestAnimationFrame(() => {
        tooltip.classList.add('visible');
        this.isVisible = true;
      });

      // 桌面端：鼠标移入浮层时保持显示
      if (!this.isMobile) {
        tooltip.addEventListener('mouseenter', () => {
          clearTimeout(this.hideTimeout);
        });
        
        tooltip.addEventListener('mouseleave', () => {
          this.scheduleHide();
        });
      }

      this.log('Tooltip shown for word:', word);
    }

    // 智能定位算法
    positionTooltip(targetElement, tooltip) {
      const targetRect = targetElement.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const arrow = tooltip.querySelector('.tooltip-arrow');
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      const spaceAbove = targetRect.top;
      const spaceBelow = viewportHeight - targetRect.bottom;
      const tooltipHeight = tooltipRect.height || 100; // 预估高度

      let top, left;
      let arrowPosition = 'top'; // 默认箭头在上方（浮层在下方）

      // 垂直定位：优先显示在上方
      if (spaceAbove > tooltipHeight + 20 || spaceAbove > spaceBelow) {
        // 显示在单词上方
        top = targetRect.top + scrollY - tooltipHeight - 10;
        arrowPosition = 'bottom';
      } else {
        // 显示在单词下方
        top = targetRect.bottom + scrollY + 10;
        arrowPosition = 'top';
      }

      // 水平定位：居中对齐，但确保不超出屏幕
      left = targetRect.left + scrollX + (targetRect.width / 2) - (tooltipRect.width / 2);

      // 边界检测
      const margin = 10;
      if (left < scrollX + margin) {
        left = scrollX + margin;
      } else if (left + tooltipRect.width > scrollX + viewportWidth - margin) {
        left = scrollX + viewportWidth - tooltipRect.width - margin;
      }

      // 应用位置
      this.tooltipContainer.style.top = `${top}px`;
      this.tooltipContainer.style.left = `${left}px`;

      // 设置箭头位置
      if (arrow) {
        arrow.className = `tooltip-arrow ${arrowPosition}`;
        
        // 计算箭头相对于浮层的水平位置
        const targetCenter = targetRect.left + scrollX + (targetRect.width / 2);
        const tooltipLeft = left;
        const arrowLeft = targetCenter - tooltipLeft;
        
        arrow.style.left = `${arrowLeft}px`;
      }
    }

    // 切换显示/隐藏（移动端）
    toggle(targetElement, word, translation) {
      if (this.isVisible && this.currentTarget === targetElement) {
        this.hide();
      } else {
        this.show(targetElement, word, translation);
      }
    }

    // 延迟隐藏（桌面端）
    scheduleHide() {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = setTimeout(() => {
        this.hide();
      }, 300);
    }

    // 隐藏浮层
    hide() {
      const tooltip = this.shadowRoot.querySelector('.tooltip');
      if (tooltip) {
        tooltip.classList.remove('visible');
        this.isVisible = false;
        this.currentTarget = null;
      }
      
      this.log('Tooltip hidden');
    }

    // 处理关闭按钮点击
    handleClose(word) {
      this.hide();
      
      // 标记为"已知"
      if (window.feedbackHandler) {
        window.feedbackHandler.markAsKnown(word);
      }
      
      // 移除该单词的翻译标记
      const wordElements = document.querySelectorAll(`[data-word="${word.toLowerCase()}"]`);
      wordElements.forEach(el => {
        el.classList.remove('vocab-needs-translation');
      });
      
      this.log('Word marked as known:', word);
    }

    // 附加全局事件监听器
    attachGlobalListeners() {
      // 点击任意位置关闭翻译窗口（手机和PC通用）
      // 使用捕获阶段，确保在单词点击事件之前执行
      document.addEventListener('click', (e) => {
        if (this.isVisible) {
          // 如果点击的是浮层内部（如关闭按钮），不处理
          if (this.tooltipContainer.contains(e.target)) {
            return;
          }
          
          // 关闭翻译窗口
          this.hide();
          
          // 阻止事件继续传播，避免触发新的翻译
          e.stopPropagation();
          e.preventDefault();
          
          this.log('Tooltip closed by clicking outside');
        }
      }, true); // true = 捕获阶段

      // 触摸设备：触摸开始时也需要关闭（避免touchstart触发的问题）
      if (this.isMobile) {
        document.addEventListener('touchstart', (e) => {
          if (this.isVisible && !this.tooltipContainer.contains(e.target)) {
            this.hide();
            e.stopPropagation();
            e.preventDefault();
            this.log('Tooltip closed by touch outside');
          }
        }, true);
      }

      // 滚动时隐藏浮层
      let scrollTimeout;
      window.addEventListener('scroll', () => {
        if (this.isVisible) {
          // 重新定位
          if (this.currentTarget) {
            const tooltip = this.shadowRoot.querySelector('.tooltip');
            this.positionTooltip(this.currentTarget, tooltip);
          }
          
          // 如果滚动过快，隐藏浮层
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            // 滚动停止，不做处理
          }, 150);
        }
      }, { passive: true });

      // 窗口大小改变时隐藏
      window.addEventListener('resize', () => {
        if (this.isVisible) {
          this.hide();
        }
      });
    }

    log(...args) {
      if (window.VOCAB_HELPER_CONFIG && window.VOCAB_HELPER_CONFIG.DEBUG_MODE) {
        console.log('[TranslationTooltip]', ...args);
      }
    }
  }

  // 导出到全局
  window.TranslationTooltip = TranslationTooltip;
})();

