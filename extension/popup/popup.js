// Popup UI logic - 整合登陆、主界面、设置
// Popup界面逻辑 - 使用 Kuroneko Auth SDK

(function() {
  'use strict';

  // 视图元素
  const loginView = document.getElementById('loginView');
  const mainView = document.getElementById('mainView');
  const settingsView = document.getElementById('settingsView');

  // 登陆视图元素
  const loginStatus = document.getElementById('loginStatus');
  const sdkLoginContainer = document.getElementById('sdkLoginContainer');

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
  const logoutBtn = document.getElementById('logoutBtn');
  const settingsStatus = document.getElementById('settingsStatus');
  const currentUserIdEl = document.getElementById('currentUserId');
  const currentUsernameEl = document.getElementById('currentUsername');
  const currentEmailEl = document.getElementById('currentEmail');
  const tokenExpiryEl = document.getElementById('tokenExpiry');
  
  // 用户信息缓存
  let cachedUserInfo = null;
  
  // SDK 登录实例
  let loginInstance = null;

  // 配置
  let API_BASE_URL = window.CONFIG ? window.CONFIG.api.baseURL : 'http://localhost:3000';
  const JWT_STORAGE_KEY = window.CONFIG ? window.CONFIG.jwt.storageKey : 'vocab_helper_jwt';
  const AUTH_SERVICE_URL = 'https://kuroneko.chat';

  // 状态
  let currentToken = null;
  let currentUserId = null;
  let useAPI = true;
  let refreshTimer = null;

  // 初始化
  init();

  async function init() {
    // 显示版本信息
    if (window.VOCAB_HELPER_VERSION) {
      console.log(`[Popup] ${window.getVersionInfo()}`);
      // 更新footer版本号
      const footerEl = document.getElementById('footerVersion');
      if (footerEl) {
        footerEl.textContent = `Spooky Vocab ${window.getVersionInfo()}`;
        footerEl.title = `Build: ${window.VOCAB_HELPER_VERSION.buildDate}\nMode: ${window.VOCAB_HELPER_VERSION.mode}`;
      }
    }
    console.log('[Popup] Initializing with SDK login...');
    
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
      // 初始化 SDK 登录
      await initSDKLogin();
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

  // 初始化 SDK 登录
  function initSDKLogin() {
    console.log('[Popup] Initializing Auth SDK...');
    
    // 检查 SDK 是否已加载
    if (!window.KuronekoAuth || !window.KuronekoAuth.loginView) {
      console.error('[Popup] Auth SDK not loaded');
      showLoginStatus('error', '登录组件加载失败');
      
      // 降级方案：显示链接到认证页面
      if (sdkLoginContainer) {
        sdkLoginContainer.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <p style="color: #666; margin-bottom: 16px;">登录组件加载失败</p>
            <a href="${AUTH_SERVICE_URL}/login" target="_blank" 
               style="color: #667eea; text-decoration: none;">
              点击这里前往登录页面 →
            </a>
          </div>
        `;
      }
      return;
    }
    
    const { loginView } = window.KuronekoAuth;
    
    // 创建登录实例
    loginInstance = loginView.create({
      container: sdkLoginContainer,
      title: '登录',
      theme: 'light',
      apiUrl: AUTH_SERVICE_URL
    });
    
    // 设置登录成功回调
    loginInstance.onSuccess(async (result) => {
      console.log('[Popup] Login success via SDK:', result);
      console.log('[Popup] SDK user object:', JSON.stringify(result.user, null, 2));
      
      // 保存 token 到 chrome.storage.local
      const storageData = {
        [JWT_STORAGE_KEY]: result.token,
        login_time: Date.now()
      };
      
      // 如果有 refresh token，也保存
      if (result.refreshToken) {
        storageData['refresh_token'] = result.refreshToken;
      }
      
      // 保存用户信息（SDK 返回的完整信息，包含 username）
      if (result.user) {
        const userInfo = {
          user_id: result.user.id,
          username: result.user.username,
          email: result.user.email
        };
        storageData['user_info'] = userInfo;
        console.log('[Popup] Saving user_info:', JSON.stringify(userInfo, null, 2));
      }
      
      await chromeStorageSet(storageData);
      console.log('[Popup] Token and user info saved to chrome.storage.local');
      
      // 更新当前状态
      currentToken = result.token;
      
      // 缓存用户信息
      if (result.user) {
        cachedUserInfo = {
          user_id: result.user.id,
          username: result.user.username,
          email: result.user.email
        };
        currentUserId = result.user.id;
      }
      
      // 切换到主视图
      showView('main');
      await loadMainView();
      startAutoRefresh();
    });
    
    // 设置登录失败回调
    loginInstance.onError((error) => {
      console.error('[Popup] Login error via SDK:', error);
      showLoginStatus('error', `登录失败: ${error.message || '未知错误'}`);
    });
    
    // 挂载登录表单
    loginInstance.mount();
    console.log('[Popup] SDK login form mounted');
  }
  
  // 获取用户信息
  async function fetchUserInfo() {
    if (!currentToken) {
      console.warn('[Popup] No token available for fetchUserInfo');
      return null;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/info`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('[Popup] Token invalid, clearing...');
          await clearToken();
          showView('login');
          await initSDKLogin();  // 重新初始化登录
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        cachedUserInfo = data.data;
        console.log('[Popup] User info fetched:', cachedUserInfo);
        return cachedUserInfo;
      }
      
      return null;
    } catch (error) {
      console.error('[Popup] Failed to fetch user info:', error);
      return null;
    }
  }
  
  // 清除token
  async function clearToken() {
    currentToken = null;
    currentUserId = null;
    cachedUserInfo = null;
    loginInstance = null;
    await new Promise((resolve) => {
      chrome.storage.local.remove([JWT_STORAGE_KEY, 'refresh_token', 'login_time', 'user_info'], resolve);
    });
  }

  function showLoginStatus(type, message) {
    if (!loginStatus) return;
    
    if (!type && !message) {
      loginStatus.className = 'status-message';
      loginStatus.textContent = '';
      return;
    }
    
    loginStatus.className = `status-message ${type}`;
    loginStatus.textContent = message;
    
    if (type === 'error' || type === 'info') {
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
    console.log('[Popup] Loading token with key:', JWT_STORAGE_KEY);
    const result = await chromeStorageGet([JWT_STORAGE_KEY, 'user_info']);
    console.log('[Popup] chrome.storage.local result:', result);
    
    if (result[JWT_STORAGE_KEY]) {
      currentToken = result[JWT_STORAGE_KEY];
      console.log('[Popup] Token loaded successfully');
    } else {
      console.log('[Popup] No token found in chrome.storage.local');
    }
    
    // 加载缓存的用户信息（包含 username）
    if (result.user_info) {
      cachedUserInfo = result.user_info;
      currentUserId = result.user_info.user_id;
      console.log('[Popup] Cached user info loaded:', cachedUserInfo.username);
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
    console.log('[Popup] loadUserInfo called, cachedUserInfo:', JSON.stringify(cachedUserInfo, null, 2));
    
    // 保存登录时的用户名（SDK返回的真实用户名）
    const savedUsername = cachedUserInfo?.username;
    console.log('[Popup] Saved username from cache:', savedUsername);
    
    // 从后端获取用户信息（验证 token 有效性）
    const apiUserInfo = await fetchUserInfo();
    
    if (apiUserInfo) {
      console.log('[Popup] API returned userInfo:', JSON.stringify(apiUserInfo, null, 2));
      
      // API 返回的 username 可能只是 user_id，使用登录时保存的真实 username
      if (savedUsername && savedUsername !== apiUserInfo.user_id) {
        apiUserInfo.username = savedUsername;
        console.log('[Popup] Using saved username:', savedUsername);
      }
      
      cachedUserInfo = apiUserInfo;
      currentUserId = apiUserInfo.user_id;
      
      const displayName = apiUserInfo.username || apiUserInfo.user_id || '用户';
      console.log('[Popup] Display name:', displayName);
      userInfoEl.textContent = `欢迎, ${displayName}`;
    } else if (cachedUserInfo) {
      // API 失败但有缓存的用户信息
      const displayName = cachedUserInfo.username || cachedUserInfo.user_id || '用户';
      userInfoEl.textContent = `欢迎, ${displayName}`;
    } else if (currentUserId) {
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
      // 尝试从API获取 - 只获取标记为"已知"的词（known_feedback_count > 0）
      if (useAPI && currentToken) {
        const data = await apiRequest('GET', '/api/review/words?limit=10&sort=recent&known_only=true');
        
        if (data && data.words && data.words.length > 0) {
          renderWordList(data.words);
          return;
        } else {
          knownWordsList.innerHTML = '<div class="empty-state">暂无已掌握的词汇</div>';
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
    // 加载用户信息
    if (cachedUserInfo) {
      // 显示真实用户名（不是 user_id）
      const displayUsername = (cachedUserInfo.username && cachedUserInfo.username !== cachedUserInfo.user_id) 
        ? cachedUserInfo.username 
        : '-';
      if (currentUsernameEl) currentUsernameEl.textContent = displayUsername;
      if (currentUserIdEl) currentUserIdEl.textContent = cachedUserInfo.user_id || '-';
      if (currentEmailEl) currentEmailEl.textContent = cachedUserInfo.email || '-';
      if (tokenExpiryEl && cachedUserInfo.expires_at) {
        const expiresIn = cachedUserInfo.expires_in;
        const hours = Math.floor(expiresIn / 3600);
        const minutes = Math.floor((expiresIn % 3600) / 60);
        tokenExpiryEl.textContent = `${hours}小时${minutes}分钟后过期`;
      } else if (tokenExpiryEl) {
        tokenExpiryEl.textContent = '-';
      }
    } else {
      if (currentUsernameEl) currentUsernameEl.textContent = '-';
      if (currentUserIdEl) currentUserIdEl.textContent = currentUserId || '未登陆';
      if (currentEmailEl) currentEmailEl.textContent = '-';
      if (tokenExpiryEl) tokenExpiryEl.textContent = '-';
    }
  }

  async function handleLogout() {
    if (!confirm('确定要退出登陆吗？')) {
      return;
    }
    
    stopAutoRefresh();
    await clearToken();
    
    // 清除 SDK 登录容器
    if (sdkLoginContainer) {
      sdkLoginContainer.innerHTML = '';
    }
    
    showView('login');
    
    // 重新初始化 SDK 登录
    await initSDKLogin();
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

    clearHistoryBtn.addEventListener('click', async () => {
      if (!confirm('确定要清除所有学习记录吗？\n\n这将清除：\n• 本次会话统计\n• 服务器上的词汇记录\n• 复习进度')) {
        return;
      }
      
      clearHistoryBtn.disabled = true;
      clearHistoryBtn.textContent = '清除中...';
      
      try {
        // 清除服务器数据
        if (useAPI && currentToken) {
          await apiRequest('DELETE', '/api/review/reset?confirm=true');
          console.log('[Popup] Server data cleared');
        }
        
        // 清除本地数据
        chrome.storage.local.set({
          knownWords: [],
          encounterHistory: [],
          syncQueue: []
        }, () => {
          loadStats();
          loadKnownWords();
          clearHistoryBtn.disabled = false;
          clearHistoryBtn.textContent = '清除历史记录';
        });
        
        // 通知内容脚本清除已记录的词汇
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'clearRecordedWords' });
            console.log('[Popup] Notified content script to clear recorded words');
          }
        });
        
      } catch (error) {
        console.error('[Popup] Failed to clear history:', error);
        alert('清除失败: ' + error.message);
        clearHistoryBtn.disabled = false;
        clearHistoryBtn.textContent = '清除历史记录';
      }
    });

    // 设置视图
    backBtn.addEventListener('click', () => showView('main'));
    logoutBtn.addEventListener('click', handleLogout);
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
