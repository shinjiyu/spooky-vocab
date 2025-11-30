// Popup UI logic - 整合登陆、主界面、设置
// Popup界面逻辑

(function() {
  'use strict';

  // 视图元素
  const loginView = document.getElementById('loginView');
  const mainView = document.getElementById('mainView');
  const settingsView = document.getElementById('settingsView');

  // 登陆视图元素
  const loginForm = document.getElementById('loginForm');
  const userIdInput = document.getElementById('userId');
  const cefrLevelSelect = document.getElementById('cefrLevel');
  const loginBtn = document.getElementById('loginBtn');
  const loginStatus = document.getElementById('loginStatus');

  // 主视图元素
  const userInfoEl = document.getElementById('userInfo');
  const toggleSwitch = document.getElementById('toggleSwitch');
  const uniqueWordsEl = document.getElementById('uniqueWords');
  const knownWordsEl = document.getElementById('knownWords');
  const knownWordsList = document.getElementById('knownWordsList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const levelBtns = document.querySelectorAll('.level-btn');
  const settingsBtn = document.getElementById('settingsBtn');

  // 设置视图元素
  const backBtn = document.getElementById('backBtn');
  const apiBaseUrlInput = document.getElementById('apiBaseUrl');
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const connectionStatus = document.getElementById('connectionStatus');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const settingsStatus = document.getElementById('settingsStatus');
  const currentUserIdEl = document.getElementById('currentUserId');
  const presetBtns = document.querySelectorAll('.preset-btn');

  // 配置
  let API_BASE_URL = window.CONFIG ? window.CONFIG.api.baseURL : 'http://localhost:3000';
  const JWT_STORAGE_KEY = window.CONFIG ? window.CONFIG.jwt.storageKey : 'spooky_vocab_jwt';

  // 状态
  let currentToken = null;
  let currentUserId = null;
  let useAPI = true;
  let refreshTimer = null;

  // 初始化
  init();

  async function init() {
    console.log('[Popup] Initializing...');
    
    // 加载API配置
    await loadApiConfig();
    
    // 检查登陆状态
    await loadToken();
    
    // 根据登陆状态显示对应视图
    if (currentToken) {
      showView('main');
      await loadMainView();
      startAutoRefresh();  // 开始自动刷新
    } else {
      showView('login');
      loadSavedUserId();
    }
    
    // 附加事件监听
    attachEventListeners();
  }

  // ============ 视图切换 ============

  function showView(viewName) {
    loginView.classList.remove('active');
    mainView.classList.remove('active');
    settingsView.classList.remove('active');
    
    switch(viewName) {
      case 'login':
        loginView.classList.add('active');
        break;
      case 'main':
        mainView.classList.add('active');
        break;
      case 'settings':
        settingsView.classList.add('active');
        loadSettingsView();
        break;
    }
    
    console.log('[Popup] Switched to view:', viewName);
  }

  // ============ 登陆视图 ============

  function loadSavedUserId() {
    chrome.storage.local.get(['user_id', 'cefrLevel'], (result) => {
      if (result.user_id) {
        userIdInput.value = result.user_id;
      }
      if (result.cefrLevel) {
        cefrLevelSelect.value = result.cefrLevel;
      }
    });
  }

  async function handleLogin(e) {
    e.preventDefault();
    
    const userId = userIdInput.value.trim();
    const cefrLevel = cefrLevelSelect.value;
    
    if (!userId || !/^[a-zA-Z0-9_]+$/.test(userId)) {
      showLoginStatus('error', '用户ID格式不正确');
      return;
    }
    
    showLoginStatus('loading', '正在登陆...');
    loginBtn.disabled = true;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/test-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, cefr_level: cefrLevel })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.data || !data.data.token) {
        throw new Error('Invalid response');
      }
      
      // 保存token和用户信息
      await chromeStorageSet({
        [JWT_STORAGE_KEY]: data.data.token,
        user_id: userId,
        cefrLevel: cefrLevel,
        login_time: new Date().toISOString()
      });
      
      currentToken = data.data.token;
      currentUserId = userId;
      
      showLoginStatus('success', '✓ 登陆成功！');
      
      setTimeout(() => {
        showView('main');
        loadMainView();
        startAutoRefresh();
      }, 1000);
      
    } catch (error) {
      console.error('[Popup] Login failed:', error);
      showLoginStatus('error', `登陆失败: ${error.message}`);
      loginBtn.disabled = false;
    }
  }

  function showLoginStatus(type, message) {
    loginStatus.className = `status-message ${type}`;
    loginStatus.textContent = message;
    
    if (type === 'error') {
      setTimeout(() => {
        loginStatus.className = 'status-message';
      }, 3000);
    }
  }

  // ============ 主视图 ============

  async function loadMainView() {
    console.log('[Popup] Loading main view...');
    
    try {
      await loadSettings();
      await loadUserInfo();
      await loadStats();
      await loadKnownWords();
    } catch (error) {
      console.error('[Popup] Failed to load main view:', error);
    }
  }

  async function loadToken() {
    const result = await chromeStorageGet([JWT_STORAGE_KEY, 'user_id']);
    
    if (result[JWT_STORAGE_KEY]) {
      currentToken = result[JWT_STORAGE_KEY];
      currentUserId = result.user_id;
      console.log('[Popup] Token loaded:', !!currentToken);
    }
  }

  async function loadApiConfig() {
    const result = await chromeStorageGet(['api_base_url']);
    if (result.api_base_url) {
      API_BASE_URL = result.api_base_url;
      console.log('[Popup] API URL:', API_BASE_URL);
    }
  }

  async function loadSettings() {
    const result = await chromeStorageGet(['enabled', 'cefrLevel']);
    
    const enabled = result.enabled !== false;
    toggleSwitch.classList.toggle('active', enabled);

    const cefrLevel = result.cefrLevel || 'B1';
    levelBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.level === cefrLevel);
    });
  }

  async function loadUserInfo() {
    if (currentUserId) {
      userInfoEl.textContent = `用户: ${currentUserId}`;
    } else {
      userInfoEl.textContent = '未登陆';
    }
  }

  async function loadStats() {
    console.log('[Popup] Refreshing stats...');
    
    // "本次会话统计"始终从本地存储读取（不从API读取）
    // 因为API返回的是全部历史数据，不是本次会话的数据
    const result = await chromeStorageGet(['encounterHistory']);
    const history = result.encounterHistory || [];
    
    // 计算本次会话的唯一单词数
    const uniqueWords = new Set();
    let knownCount = 0;

    history.forEach(encounter => {
      uniqueWords.add(encounter.word);
      if (encounter.action === 'known') {
        knownCount++;
      }
    });

    // 更新显示
    uniqueWordsEl.textContent = uniqueWords.size;
    knownWordsEl.textContent = knownCount;
    
    console.log('[Popup] Stats refreshed:', {
      unique: uniqueWords.size,
      known: knownCount,
      total_encounters: history.length
    });
  }

  async function loadKnownWords() {
    try {
      // 尝试从API获取
      if (useAPI && currentToken) {
        const data = await apiRequest('GET', '/api/review/words?limit=10&sort=recent');
        
        if (data && data.words && data.words.length > 0) {
          renderWordList(data.words);
          return;
        }
      }
    } catch (error) {
      console.log('[Popup] API words failed, using local');
    }
    
    // 降级：从本地获取
    const result = await chromeStorageGet(['knownWords', 'encounterHistory']);
    const knownWords = result.knownWords || [];
    
    if (knownWords.length === 0) {
      knownWordsList.innerHTML = '<div class="empty-state">暂无已掌握的词汇</div>';
      return;
    }

    const history = result.encounterHistory || [];
    const wordCounts = {};
    
    history.forEach(encounter => {
      if (encounter.action === 'known') {
        wordCounts[encounter.word] = (wordCounts[encounter.word] || 0) + 1;
      }
    });

    let html = '';
    knownWords.slice(0, 10).forEach(word => {
      const count = wordCounts[word] || 1;
      html += `
        <div class="word-item">
          <span class="word-text">${word}</span>
          <span class="word-count">×${count}</span>
        </div>
      `;
    });

    if (knownWords.length > 10) {
      html += `<div class="empty-state">...还有 ${knownWords.length - 10} 个单词</div>`;
    }

    knownWordsList.innerHTML = html;
  }

  function renderWordList(words) {
    let html = '';
    
    words.forEach(wordData => {
      const word = wordData.word;
      const score = wordData.familiarity_score || 0;
      
      html += `
        <div class="word-item">
          <span class="word-text">${word}</span>
          <span class="word-count">熟悉度: ${score}</span>
        </div>
      `;
    });

    knownWordsList.innerHTML = html;
  }

  // 自动刷新
  function startAutoRefresh() {
    // 清除旧的定时器
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
    
    // 每1秒刷新一次统计数据（更实时）
    refreshTimer = setInterval(() => {
      if (mainView.classList.contains('active')) {
        loadStats();
        loadKnownWords();
      }
    }, 1000);
    
    console.log('[Popup] Auto-refresh started (1s interval)');
    
    // 监听storage变化，立即刷新（最实时！）
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.encounterHistory) {
        console.log('[Popup] Storage changed, refreshing immediately!');
        if (mainView.classList.contains('active')) {
          loadStats();
          loadKnownWords();
        }
      }
    });
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
      console.log('[Popup] Auto-refresh stopped');
    }
  }

  // ============ 设置视图 ============

  function loadSettingsView() {
    // 加载当前API URL
    apiBaseUrlInput.value = API_BASE_URL;
    
    // 加载用户信息
    currentUserIdEl.textContent = currentUserId || '未登陆';
  }

  async function handleSaveSettings() {
    const apiBaseUrl = apiBaseUrlInput.value.trim();
    
    if (!apiBaseUrl) {
      showSettingsStatus('error', 'API URL不能为空');
      return;
    }
    
    try {
      new URL(apiBaseUrl);
    } catch (error) {
      showSettingsStatus('error', 'API URL格式不正确');
      return;
    }
    
    await chromeStorageSet({ api_base_url: apiBaseUrl });
    
    API_BASE_URL = apiBaseUrl;
    if (window.CONFIG) {
      window.CONFIG.api.baseURL = apiBaseUrl;
    }
    
    showSettingsStatus('success', '✓ 设置已保存！');
    
    setTimeout(() => {
      showView('main');
    }, 1500);
  }

  async function handleTestConnection() {
    const apiBaseUrl = apiBaseUrlInput.value.trim();
    
    if (!apiBaseUrl) {
      connectionStatus.textContent = '⚠️ 请先输入API URL';
      connectionStatus.style.color = '#f44336';
      return;
    }
    
    connectionStatus.textContent = '⏳ 正在测试...';
    connectionStatus.style.color = '#1976d2';
    testConnectionBtn.disabled = true;
    
    try {
      const response = await fetch(`${apiBaseUrl}/health`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'ok') {
        connectionStatus.textContent = `✓ 连接成功！`;
        connectionStatus.style.color = '#2e7d32';
      } else {
        throw new Error('Invalid response');
      }
      
    } catch (error) {
      connectionStatus.textContent = `✗ 连接失败: ${error.message}`;
      connectionStatus.style.color = '#f44336';
    } finally {
      testConnectionBtn.disabled = false;
    }
  }

  function handleLogout() {
    if (!confirm('确定要退出登陆吗？')) {
      return;
    }
    
    chrome.storage.local.remove([JWT_STORAGE_KEY, 'user_id', 'cefrLevel', 'login_time'], () => {
      currentToken = null;
      currentUserId = null;
      
      stopAutoRefresh();
      showView('login');
    });
  }

  function showSettingsStatus(type, message) {
    settingsStatus.className = `status-message ${type}`;
    settingsStatus.textContent = message;
    
    setTimeout(() => {
      settingsStatus.className = 'status-message';
    }, 3000);
  }

  // ============ 事件监听 ============

  function attachEventListeners() {
    // 登陆视图
    loginForm.addEventListener('submit', handleLogin);
    
    // 主视图
    settingsBtn.addEventListener('click', () => showView('settings'));
    
    toggleSwitch.addEventListener('click', () => {
      const isEnabled = toggleSwitch.classList.toggle('active');
      
      chrome.storage.local.set({ enabled: isEnabled }, () => {
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

    levelBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        levelBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const level = btn.dataset.level;
        await chromeStorageSet({ cefrLevel: level });
        
        if (useAPI && currentToken) {
          try {
            await apiRequest('PUT', '/api/user/settings', { cefr_level: level });
          } catch (error) {
            console.error('[Popup] Failed to update CEFR level:', error);
          }
        }
      });
    });

    clearHistoryBtn.addEventListener('click', () => {
      if (!confirm('确定要清除所有历史记录吗？')) {
        return;
      }
      
      chrome.storage.local.set({
        knownWords: [],
        encounterHistory: []
      }, () => {
        loadStats();
        loadKnownWords();
      });
    });

    // 设置视图
    backBtn.addEventListener('click', () => showView('main'));
    saveSettingsBtn.addEventListener('click', handleSaveSettings);
    testConnectionBtn.addEventListener('click', handleTestConnection);
    logoutBtn.addEventListener('click', handleLogout);
    
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        apiBaseUrlInput.value = btn.dataset.url;
      });
    });
  }

  // ============ 辅助函数 ============

  async function apiRequest(method, endpoint, data = null) {
    if (!currentToken) {
      throw new Error('No token');
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
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.data || result;
  }

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

  // 清理
  window.addEventListener('unload', () => {
    stopAutoRefresh();
  });
})();
