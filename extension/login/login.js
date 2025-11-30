// Login page logic
// 登陆页面逻辑

(function() {
  'use strict';

  // DOM元素
  const loginForm = document.getElementById('loginForm');
  const userIdInput = document.getElementById('userId');
  const cefrLevelSelect = document.getElementById('cefrLevel');
  const loginBtn = document.getElementById('loginBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const statusMessage = document.getElementById('statusMessage');
  const helpLink = document.getElementById('helpLink');

  // 配置
  let API_BASE_URL = window.CONFIG ? window.CONFIG.api.baseURL : 'http://localhost:3000';

  // 初始化
  init();

  function init() {
    console.log('[Login] Initializing...');
    
    // 加载保存的用户ID
    loadSavedUserId();
    
    // 加载API配置
    loadApiConfig();
    
    // 检查是否已经登陆
    checkExistingLogin();
    
    // 事件监听
    loginForm.addEventListener('submit', handleLogin);
    settingsBtn.addEventListener('click', openSettings);
    helpLink.addEventListener('click', showHelp);
  }

  // 加载保存的用户ID
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

  // 加载API配置
  function loadApiConfig() {
    chrome.storage.local.get(['api_base_url'], (result) => {
      if (result.api_base_url) {
        API_BASE_URL = result.api_base_url;
        console.log('[Login] Using API URL:', API_BASE_URL);
      }
    });
  }

  // 检查是否已经登陆
  async function checkExistingLogin() {
    const JWT_STORAGE_KEY = window.CONFIG ? window.CONFIG.jwt.storageKey : 'spooky_vocab_jwt';
    
    chrome.storage.local.get([JWT_STORAGE_KEY], (result) => {
      if (result[JWT_STORAGE_KEY]) {
        console.log('[Login] Existing token found');
        showStatus('success', '已登陆！正在跳转...');
        
        // 跳转到popup或关闭当前页面
        setTimeout(() => {
          window.close();
        }, 1000);
      }
    });
  }

  // 处理登陆
  async function handleLogin(e) {
    e.preventDefault();
    
    const userId = userIdInput.value.trim();
    const cefrLevel = cefrLevelSelect.value;
    
    // 验证输入
    if (!userId) {
      showStatus('error', '请输入用户ID');
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(userId)) {
      showStatus('error', '用户ID只能包含字母、数字和下划线');
      return;
    }
    
    // 显示加载状态
    showStatus('loading', '正在登陆...');
    loginBtn.disabled = true;
    
    try {
      // 调用API获取JWT token
      const response = await fetch(`${API_BASE_URL}/api/auth/test-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          cefr_level: cefrLevel
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.data || !data.data.token) {
        throw new Error('Invalid response format');
      }
      
      const token = data.data.token;
      
      // 保存token和用户信息
      const JWT_STORAGE_KEY = window.CONFIG ? window.CONFIG.jwt.storageKey : 'spooky_vocab_jwt';
      
      await new Promise((resolve) => {
        chrome.storage.local.set({
          [JWT_STORAGE_KEY]: token,
          user_id: userId,
          cefrLevel: cefrLevel,
          login_time: new Date().toISOString()
        }, resolve);
      });
      
      console.log('[Login] Token saved successfully');
      
      // 显示成功消息
      showStatus('success', `✓ 登陆成功！欢迎 ${userId}`);
      
      // 延迟关闭登陆页面
      setTimeout(() => {
        window.close();
        
        // 如果无法关闭（可能是独立打开的页面），显示提示
        setTimeout(() => {
          showStatus('success', '登陆成功！你可以关闭此页面了');
          loginBtn.disabled = false;
          loginBtn.textContent = '重新登陆';
        }, 1000);
      }, 1500);
      
    } catch (error) {
      console.error('[Login] Login failed:', error);
      showStatus('error', `登陆失败: ${error.message}`);
      loginBtn.disabled = false;
    }
  }

  // 打开设置页面
  function openSettings() {
    chrome.runtime.openOptionsPage();
  }

  // 显示帮助
  function showHelp(e) {
    e.preventDefault();
    
    const helpMessage = `
Spooky Vocab 登陆说明：

1. 用户ID：输入任意字母数字组合（如：john_doe）
2. 英语水平：选择你当前的英语等级
3. 点击登陆按钮获取JWT token

注意：
- 这是开发模式，无需真实密码
- 你的数据存储在本地和后端数据库
- 可以在设置中修改API服务器地址
    `.trim();
    
    alert(helpMessage);
  }

  // 显示状态消息
  function showStatus(type, message) {
    statusMessage.className = `status ${type}`;
    statusMessage.textContent = message;
    
    // 错误消息5秒后自动隐藏
    if (type === 'error') {
      setTimeout(() => {
        statusMessage.className = 'status';
      }, 5000);
    }
  }
})();

