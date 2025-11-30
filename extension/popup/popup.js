// Popup UI logic
// Popup界面逻辑

(function() {
  'use strict';

  // DOM元素
  const userInfoEl = document.getElementById('userInfo');
  const toggleSwitch = document.getElementById('toggleSwitch');
  const uniqueWordsEl = document.getElementById('uniqueWords');
  const knownWordsEl = document.getElementById('knownWords');
  const knownWordsList = document.getElementById('knownWordsList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const levelBtns = document.querySelectorAll('.level-btn');
  const footerEl = document.getElementById('footer');

  // 配置
  const API_BASE_URL = window.CONFIG ? window.CONFIG.api.baseURL : 'http://localhost:3000';
  const JWT_STORAGE_KEY = window.CONFIG ? window.CONFIG.jwt.storageKey : 'spooky_vocab_jwt';

  // 状态
  let currentToken = null;
  let currentUserId = null;
  let useAPI = true;

  // 调试日志
  console.log('[Popup] Initializing...');
  console.log('[Popup] API_BASE_URL:', API_BASE_URL);
  console.log('[Popup] CONFIG available:', !!window.CONFIG);

  // 初始化
  init();

  async function init() {
    console.log('[Popup] Starting initialization...');
    
    try {
      // 加载JWT token
      console.log('[Popup] Loading JWT token...');
      await loadToken();
      console.log('[Popup] Token loaded:', currentToken ? 'Yes' : 'No');
      console.log('[Popup] User ID:', currentUserId);
      
      // 检查是否使用API
      const result = await chromeStorageGet(['use_api']);
      useAPI = result.use_api !== false;
      console.log('[Popup] Use API mode:', useAPI);
      
      // 加载各种数据
      await loadSettings();
      await loadUserInfo();
      await loadStats();
      await loadReviewWords();
      
      // 附加事件监听器
      attachEventListeners();
      
      // 更新footer
      updateFooter();
      
      // 定期刷新数据
      setInterval(refreshData, 5000);
      
      console.log('[Popup] Initialization complete!');
      
    } catch (error) {
      console.error('[Popup] Initialization failed:', error);
      console.error('[Popup] Error stack:', error.stack);
      showError('初始化失败，使用离线模式');
      useAPI = false;
      
      // 降级到本地模式
      await loadSettings();
      loadStatsFromLocal();
      loadKnownWordsFromLocal();
      attachEventListeners();
      updateFooter();
    }
  }

  // 加载JWT token
  async function loadToken() {
    const result = await chromeStorageGet([JWT_STORAGE_KEY]);
    if (result[JWT_STORAGE_KEY]) {
      currentToken = result[JWT_STORAGE_KEY];
      
      // 解析token获取user_id
      try {
        const parts = currentToken.split('.');
        if (parts.length === 3) {
          const payloadBase64 = parts[1];
          const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
          const payload = JSON.parse(payloadJson);
          currentUserId = payload.user_id;
        }
      } catch (error) {
        console.error('[Popup] Failed to parse token:', error);
      }
    }
  }

  // 加载用户信息
  async function loadUserInfo() {
    console.log('[Popup] Loading user info...');
    console.log('[Popup] useAPI:', useAPI, 'currentToken:', !!currentToken);
    
    if (!useAPI) {
      console.log('[Popup] API mode disabled, showing offline mode');
      userInfoEl.textContent = '离线模式（Mock数据）';
      userInfoEl.style.cursor = 'pointer';
      userInfoEl.title = '点击前往设置';
      userInfoEl.onclick = () => chrome.runtime.openOptionsPage();
      return;
    }
    
    if (!currentToken) {
      console.log('[Popup] No token, prompting login');
      userInfoEl.innerHTML = '未登陆 - <a href="#" style="color: #667eea; text-decoration: underline;">点击登陆</a>';
      userInfoEl.querySelector('a').onclick = (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: chrome.runtime.getURL('login/login.html') });
      };
      return;
    }

    try {
      console.log('[Popup] Fetching user settings from API...');
      const data = await apiRequest('GET', '/api/user/settings');
      console.log('[Popup] User settings received:', data);
      
      if (data) {
        currentUserId = currentUserId || data.user_id || '未知';
        const cefrLevel = data.cefr_level || 'B1';
        
        userInfoEl.textContent = `用户: ${currentUserId} | 等级: ${cefrLevel}`;
        console.log('[Popup] User info updated:', userInfoEl.textContent);
        
        // 更新等级按钮
        levelBtns.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.level === cefrLevel);
        });
      }
    } catch (error) {
      console.error('[Popup] Failed to load user info:', error);
      console.error('[Popup] Error details:', error.message);
      userInfoEl.textContent = currentUserId ? `用户: ${currentUserId}` : '离线模式';
    }
  }

  // 加载设置
  async function loadSettings() {
    const result = await chromeStorageGet(['enabled', 'cefrLevel']);
    
    const enabled = result.enabled !== false; // 默认启用
    toggleSwitch.classList.toggle('active', enabled);

    const cefrLevel = result.cefrLevel || 'B1';
    levelBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.level === cefrLevel);
    });
  }

  // 加载统计数据
  async function loadStats() {
    if (!useAPI || !currentToken) {
      loadStatsFromLocal();
      return;
    }

    try {
      const stats = await apiRequest('GET', '/api/review/stats?period=all');
      
      if (stats) {
        uniqueWordsEl.textContent = stats.total_words || 0;
        knownWordsEl.textContent = stats.known_words || 0;
      }
    } catch (error) {
      console.error('[Popup] Failed to load stats:', error);
      loadStatsFromLocal();
    }
  }

  // 从本地存储加载统计数据（降级）
  function loadStatsFromLocal() {
    chromeStorageGet(['encounterHistory']).then(result => {
      const history = result.encounterHistory || [];
      
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

  // 加载复习单词列表
  async function loadReviewWords() {
    if (!useAPI || !currentToken) {
      loadKnownWordsFromLocal();
      return;
    }

    try {
      const data = await apiRequest('GET', '/api/review/words?limit=20&sort=recent');
      
      if (data && data.words && data.words.length > 0) {
        renderWordList(data.words);
      } else {
        knownWordsList.innerHTML = '<div class="empty-state">暂无需要复习的词汇</div>';
      }
    } catch (error) {
      console.error('[Popup] Failed to load review words:', error);
      loadKnownWordsFromLocal();
    }
  }

  // 渲染单词列表
  function renderWordList(words) {
    let html = '';
    
    words.forEach(wordData => {
      const word = wordData.word;
      const score = wordData.familiarity_score || 0;
      const count = wordData.encounter_count || 0;
      
      html += `
        <div class="word-item">
          <span class="word-text">${word}</span>
          <span class="word-count">熟悉度: ${score}</span>
        </div>
      `;
    });

    knownWordsList.innerHTML = html;
  }

  // 从本地存储加载已知单词（降级）
  function loadKnownWordsFromLocal() {
    chromeStorageGet(['knownWords']).then(result => {
      const knownWords = result.knownWords || [];
      
      if (knownWords.length === 0) {
        knownWordsList.innerHTML = '<div class="empty-state">暂无已掌握的词汇</div>';
        return;
      }

      chromeStorageGet(['encounterHistory']).then(historyResult => {
        const history = historyResult.encounterHistory || [];
        const wordCounts = {};
        
        history.forEach(encounter => {
          if (encounter.action === 'known') {
            wordCounts[encounter.word] = (wordCounts[encounter.word] || 0) + 1;
          }
        });

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
      btn.addEventListener('click', async () => {
        levelBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const level = btn.dataset.level;
        
        // 保存到本地
        await chromeStorageSet({ cefrLevel: level });
        
        // 同步到API
        if (useAPI && currentToken) {
          try {
            await apiRequest('PUT', '/api/user/settings', {
              cefr_level: level
            });
            
            showSuccess('英语水平已更新');
            await loadUserInfo();
          } catch (error) {
            console.error('[Popup] Failed to update CEFR level:', error);
            showError('更新失败，但已保存到本地');
          }
        }
      });
    });

    // 清除历史记录
    clearHistoryBtn.addEventListener('click', async () => {
      if (!confirm('确定要清除所有历史记录吗？这将删除已掌握的词汇列表和学习统计。')) {
        return;
      }

      try {
        // 清除本地存储
        await chromeStorageSet({
          knownWords: [],
          encounterHistory: [],
          syncQueue: []
        });
        
        // TODO: 调用API清除后端数据（如果后端提供了该接口）
        
        // 刷新显示
        await loadStats();
        await loadReviewWords();
        
        showSuccess('历史记录已清除');
      } catch (error) {
        console.error('[Popup] Failed to clear history:', error);
        showError('清除失败');
      }
    });
  }

  // 刷新数据
  async function refreshData() {
    try {
      if (useAPI && currentToken) {
        await loadStats();
      } else {
        loadStatsFromLocal();
      }
    } catch (error) {
      // 静默失败
    }
  }

  // 更新footer
  function updateFooter() {
    const mode = useAPI ? 'API模式' : '离线模式';
    const status = currentToken ? '已连接' : '未连接';
    footerEl.innerHTML = `Spooky Vocab v1.0.0<br>${mode} | ${status}`;
  }

  // API请求封装
  async function apiRequest(method, endpoint, data = null) {
    if (!currentToken) {
      throw new Error('No JWT token available');
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      }
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data || result;
  }

  // Chrome存储辅助函数
  function chromeStorageGet(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function chromeStorageSet(items) {
    return new Promise((resolve) => {
      chrome.storage.local.set(items, resolve);
    });
  }

  // UI反馈
  function showSuccess(message) {
    // 简单的临时提示
    const oldText = userInfoEl.textContent;
    userInfoEl.textContent = `✓ ${message}`;
    userInfoEl.style.color = '#4caf50';
    
    setTimeout(() => {
      loadUserInfo();
      userInfoEl.style.color = '';
    }, 2000);
  }

  function showError(message) {
    const oldText = userInfoEl.textContent;
    userInfoEl.textContent = `✗ ${message}`;
    userInfoEl.style.color = '#f44336';
    
    setTimeout(() => {
      userInfoEl.textContent = oldText;
      userInfoEl.style.color = '';
    }, 3000);
  }
})();
