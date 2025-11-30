// Popup UI logic
// Popup界面逻辑

(function() {
  'use strict';

  // DOM元素
  const toggleSwitch = document.getElementById('toggleSwitch');
  const uniqueWordsEl = document.getElementById('uniqueWords');
  const knownWordsEl = document.getElementById('knownWords');
  const knownWordsList = document.getElementById('knownWordsList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const levelBtns = document.querySelectorAll('.level-btn');

  // 初始化
  init();

  function init() {
    loadSettings();
    loadStats();
    loadKnownWords();
    attachEventListeners();
  }

  // 加载设置
  function loadSettings() {
    chrome.storage.local.get(['enabled', 'cefrLevel'], (result) => {
      const enabled = result.enabled !== false; // 默认启用
      toggleSwitch.classList.toggle('active', enabled);

      const cefrLevel = result.cefrLevel || 'B1';
      levelBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.level === cefrLevel);
      });
    });
  }

  // 加载统计数据
  function loadStats() {
    chrome.storage.local.get(['encounterHistory'], (result) => {
      const history = result.encounterHistory || [];
      
      // 统计唯一单词和已知单词
      const uniqueWords = new Set();
      let knownCount = 0;

      history.forEach(encounter => {
        uniqueWords.add(encounter.word);
        if (encounter.action === 'known') {
          knownCount++;
        }
      });

      uniqueWordsEl.textContent = uniqueWords.size;
      knownWordsEl.textContent = knownCount;
    });
  }

  // 加载已掌握的词汇列表
  function loadKnownWords() {
    chrome.storage.local.get(['knownWords'], (result) => {
      const knownWords = result.knownWords || [];
      
      if (knownWords.length === 0) {
        knownWordsList.innerHTML = '<div class="empty-state">暂无已掌握的词汇</div>';
        return;
      }

      // 统计每个单词出现次数
      const wordCounts = {};
      chrome.storage.local.get(['encounterHistory'], (historyResult) => {
        const history = historyResult.encounterHistory || [];
        
        history.forEach(encounter => {
          if (encounter.action === 'known') {
            wordCounts[encounter.word] = (wordCounts[encounter.word] || 0) + 1;
          }
        });

        // 渲染列表
        let html = '';
        knownWords.slice(0, 20).forEach(word => {
          const count = wordCounts[word] || 1;
          html += `
            <div class="word-item">
              <span class="word-text">${word}</span>
              <span class="word-count">×${count}</span>
            </div>
          `;
        });

        if (knownWords.length > 20) {
          html += `<div class="empty-state">...还有 ${knownWords.length - 20} 个单词</div>`;
        }

        knownWordsList.innerHTML = html;
      });
    });
  }

  // 附加事件监听器
  function attachEventListeners() {
    // 插件开关
    toggleSwitch.addEventListener('click', () => {
      const isEnabled = toggleSwitch.classList.toggle('active');
      
      chrome.storage.local.set({ enabled: isEnabled }, () => {
        // 通知content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'toggleExtension',
              enabled: isEnabled
            });
          }
        });
      });
    });

    // 英语水平选择
    levelBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        levelBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const level = btn.dataset.level;
        chrome.storage.local.set({ cefrLevel: level }, () => {
          console.log('CEFR level saved:', level);
        });
      });
    });

    // 清除历史记录
    clearHistoryBtn.addEventListener('click', () => {
      if (confirm('确定要清除所有历史记录吗？这将删除已掌握的词汇列表和学习统计。')) {
        chrome.storage.local.set({
          knownWords: [],
          encounterHistory: []
        }, () => {
          loadStats();
          loadKnownWords();
          alert('历史记录已清除');
        });
      }
    });
  }

  // 定期刷新统计数据
  setInterval(() => {
    loadStats();
  }, 2000);
})();

