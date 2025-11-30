// Options page logic
// 设置页面逻辑

(function() {
  'use strict';

  // DOM元素
  const apiBaseUrlInput = document.getElementById('apiBaseUrl');
  const debugModeCheckbox = document.getElementById('debugMode');
  const useApiModeCheckbox = document.getElementById('useApiMode');
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const connectionStatus = document.getElementById('connectionStatus');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');
  const statusMessage = document.getElementById('statusMessage');
  
  // 账号信息元素
  const currentUserIdEl = document.getElementById('currentUserId');
  const currentCefrLevelEl = document.getElementById('currentCefrLevel');
  const loginTimeEl = document.getElementById('loginTime');

  // 快速选择按钮
  const presetBtns = document.querySelectorAll('.preset-btn');

  // 初始化
  init();

  function init() {
    console.log('[Options] Initializing...');
    
    // 加载当前设置
    loadSettings();
    
    // 加载账号信息
    loadAccountInfo();
    
    // 事件监听
    saveBtn.addEventListener('click', saveSettings);
    resetBtn.addEventListener('click', resetSettings);
    logoutBtn.addEventListener('click', logout);
    clearDataBtn.addEventListener('click', clearAllData);
    testConnectionBtn.addEventListener('click', testConnection);
    
    // 预设URL按钮
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        apiBaseUrlInput.value = btn.dataset.url;
      });
    });
  }

  // 加载当前设置
  function loadSettings() {
    chrome.storage.local.get([
      'api_base_url',
      'debug_mode',
      'use_api'
    ], (result) => {
      // API URL
      if (result.api_base_url) {
        apiBaseUrlInput.value = result.api_base_url;
      } else {
        apiBaseUrlInput.value = window.CONFIG ? window.CONFIG.api.baseURL : 'http://localhost:3000';
      }
      
      // 调试模式
      debugModeCheckbox.checked = result.debug_mode || false;
      
      // API模式
      useApiModeCheckbox.checked = result.use_api !== false;
      
      console.log('[Options] Settings loaded');
    });
  }

  // 加载账号信息
  function loadAccountInfo() {
    const JWT_STORAGE_KEY = window.CONFIG ? window.CONFIG.jwt.storageKey : 'spooky_vocab_jwt';
    
    chrome.storage.local.get([
      JWT_STORAGE_KEY,
      'user_id',
      'cefrLevel',
      'login_time'
    ], (result) => {
      // 用户ID
      if (result.user_id) {
        currentUserIdEl.textContent = result.user_id;
      }
      
      // CEFR等级
      if (result.cefrLevel) {
        currentCefrLevelEl.textContent = result.cefrLevel;
      }
      
      // 登陆时间
      if (result.login_time) {
        const date = new Date(result.login_time);
        loginTimeEl.textContent = date.toLocaleString('zh-CN');
      }
      
      console.log('[Options] Account info loaded');
    });
  }

  // 保存设置
  function saveSettings() {
    const apiBaseUrl = apiBaseUrlInput.value.trim();
    
    // 验证URL
    if (!apiBaseUrl) {
      showStatus('error', 'API URL不能为空');
      return;
    }
    
    try {
      new URL(apiBaseUrl);
    } catch (error) {
      showStatus('error', 'API URL格式不正确，请输入完整的URL（包含 http:// 或 https://）');
      return;
    }
    
    // 保存到storage
    chrome.storage.local.set({
      api_base_url: apiBaseUrl,
      debug_mode: debugModeCheckbox.checked,
      use_api: useApiModeCheckbox.checked
    }, () => {
      console.log('[Options] Settings saved');
      showStatus('success', '✓ 设置已保存！某些更改可能需要刷新页面后生效。');
      
      // 更新CONFIG对象
      if (window.CONFIG) {
        window.CONFIG.api.baseURL = apiBaseUrl;
        window.CONFIG.features.debugMode = debugModeCheckbox.checked;
      }
    });
  }

  // 恢复默认设置
  function resetSettings() {
    if (!confirm('确定要恢复默认设置吗？')) {
      return;
    }
    
    const defaultUrl = 'http://localhost:3000';
    
    apiBaseUrlInput.value = defaultUrl;
    debugModeCheckbox.checked = false;
    useApiModeCheckbox.checked = true;
    
    chrome.storage.local.set({
      api_base_url: defaultUrl,
      debug_mode: false,
      use_api: true
    }, () => {
      showStatus('success', '✓ 已恢复默认设置');
    });
  }

  // 测试连接
  async function testConnection() {
    const apiBaseUrl = apiBaseUrlInput.value.trim();
    
    if (!apiBaseUrl) {
      connectionStatus.textContent = '⚠️ 请先输入API URL';
      connectionStatus.style.color = '#f44336';
      return;
    }
    
    connectionStatus.textContent = '⏳ 正在测试连接...';
    connectionStatus.style.color = '#1976d2';
    testConnectionBtn.disabled = true;
    
    try {
      const response = await fetch(`${apiBaseUrl}/health`, {
        method: 'GET',
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'ok') {
        connectionStatus.textContent = `✓ 连接成功！服务器版本: ${data.version || 'unknown'}`;
        connectionStatus.style.color = '#2e7d32';
      } else {
        throw new Error('Invalid health response');
      }
      
    } catch (error) {
      console.error('[Options] Connection test failed:', error);
      connectionStatus.textContent = `✗ 连接失败: ${error.message}`;
      connectionStatus.style.color = '#f44336';
    } finally {
      testConnectionBtn.disabled = false;
    }
  }

  // 退出登陆
  function logout() {
    if (!confirm('确定要退出登陆吗？')) {
      return;
    }
    
    const JWT_STORAGE_KEY = window.CONFIG ? window.CONFIG.jwt.storageKey : 'spooky_vocab_jwt';
    
    chrome.storage.local.remove([
      JWT_STORAGE_KEY,
      'user_id',
      'cefrLevel',
      'login_time'
    ], () => {
      currentUserIdEl.textContent = '未登陆';
      currentCefrLevelEl.textContent = '-';
      loginTimeEl.textContent = '-';
      
      showStatus('success', '✓ 已退出登陆');
      
      // 跳转到登陆页面
      setTimeout(() => {
        window.location.href = '../login/login.html';
      }, 1000);
    });
  }

  // 清除所有数据
  function clearAllData() {
    const confirmText = '这将清除所有数据，包括：\n- 登陆信息\n- 学习记录\n- 已掌握的词汇\n- 所有设置\n\n确定要继续吗？';
    
    if (!confirm(confirmText)) {
      return;
    }
    
    // 二次确认
    if (!confirm('再次确认：真的要清除所有数据吗？此操作不可恢复！')) {
      return;
    }
    
    chrome.storage.local.clear(() => {
      console.log('[Options] All data cleared');
      showStatus('success', '✓ 所有数据已清除');
      
      // 重置界面
      currentUserIdEl.textContent = '未登陆';
      currentCefrLevelEl.textContent = '-';
      loginTimeEl.textContent = '-';
      
      // 恢复默认设置
      resetSettings();
      
      // 跳转到登陆页面
      setTimeout(() => {
        window.location.href = '../login/login.html';
      }, 2000);
    });
  }

  // 显示状态消息
  function showStatus(type, message) {
    statusMessage.className = `status ${type}`;
    statusMessage.textContent = message;
    
    // 消息3秒后自动隐藏
    setTimeout(() => {
      statusMessage.className = 'status';
    }, 3000);
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
})();

