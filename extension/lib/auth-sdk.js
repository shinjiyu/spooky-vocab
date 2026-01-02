/**
 * Kuroneko Auth SDK - 登录组件
 * 
 * 使用方式:
 * 
 * // ES Module
 * import { loginView } from 'https://your-domain.com/sdk/login.js';
 * 
 * // Script 标签
 * // <script src="https://your-domain.com/sdk/login.js"></script>
 * // const { loginView } = window.KuronekoAuth;
 * 
 * const login = loginView.create({
 *   container: '#login-container'
 * });
 * 
 * login.onSuccess((result) => {
 *   console.log(result.token);
 *   console.log(result.user);
 * }).mount();
 */

// 默认配置
const DEFAULT_OPTIONS = {
  apiUrl: 'https://kuroneko.chat',
  title: '登录',
  theme: 'light'
};

// 内联样式 - 深紫色主题 (匹配幽灵猫 Logo)
const STYLES = `
  .ka-login-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 400px;
    margin: 0 auto;
    padding: 0;
    box-sizing: border-box;
  }
  .ka-login-container * {
    box-sizing: border-box;
  }
  .ka-login-title {
    display: none;
  }
  .ka-login-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .ka-form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ka-form-label {
    font-size: 13px;
    font-weight: 500;
    color: #b8b8d1;
  }
  .ka-form-input {
    padding: 12px;
    font-size: 14px;
    border: 2px solid #2d3a5a;
    border-radius: 8px;
    outline: none;
    transition: all 0.2s;
    background: #1a1a2e;
    color: #ffffff;
  }
  .ka-form-input::placeholder {
    color: #6c6c8a;
  }
  .ka-form-input:focus {
    border-color: #7c4dff;
    box-shadow: 0 0 0 3px rgba(124, 77, 255, 0.2);
  }
  .ka-submit-btn {
    padding: 12px;
    font-size: 15px;
    font-weight: 600;
    color: #fff;
    background: linear-gradient(135deg, #7c4dff 0%, #5c3dcc 100%);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 4px;
  }
  .ka-submit-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(124, 77, 255, 0.4);
  }
  .ka-submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  .ka-error-msg {
    padding: 12px;
    font-size: 13px;
    color: #f87171;
    background: rgba(248, 113, 113, 0.15);
    border: 1px solid rgba(248, 113, 113, 0.3);
    border-radius: 6px;
    display: none;
  }
  .ka-error-msg.show {
    display: block;
  }
  .ka-register-link {
    text-align: center;
    font-size: 13px;
    color: #6c6c8a;
    margin-top: 16px;
  }
  .ka-register-link a {
    color: #9d7bff;
    text-decoration: none;
    font-weight: 500;
  }
  .ka-register-link a:hover {
    color: #b89fff;
    text-decoration: underline;
  }
`;

// 注入样式
function injectStyles() {
  if (document.getElementById('ka-login-styles')) return;
  const style = document.createElement('style');
  style.id = 'ka-login-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

// 生成登录表单 HTML
function createFormHTML(options) {
  return `
    <div class="ka-login-container ${options.theme === 'dark' ? 'dark' : ''}">
      <h2 class="ka-login-title">${options.title}</h2>
      <form class="ka-login-form" id="ka-login-form">
        <div class="ka-form-group">
          <label class="ka-form-label" for="ka-email">邮箱</label>
          <input class="ka-form-input" type="email" id="ka-email" placeholder="请输入邮箱" required>
        </div>
        <div class="ka-form-group">
          <label class="ka-form-label" for="ka-password">密码</label>
          <input class="ka-form-input" type="password" id="ka-password" placeholder="请输入密码" required>
        </div>
        <div class="ka-error-msg" id="ka-error-msg"></div>
        <button class="ka-submit-btn" type="submit" id="ka-submit-btn">登录</button>
      </form>
      <div class="ka-register-link">
        还没有账号？<a href="${options.apiUrl}/register" target="_blank">立即注册</a>
      </div>
    </div>
  `;
}

// 登录实例类
class LoginInstance {
  constructor(options) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.container = null;
    this.successCallback = null;
    this.errorCallback = null;
    this.mounted = false;
  }

  // 设置成功回调
  onSuccess(callback) {
    this.successCallback = callback;
    return this;
  }

  // 设置错误回调
  onError(callback) {
    this.errorCallback = callback;
    return this;
  }

  // 挂载
  mount() {
    if (this.mounted) return this;

    // 获取容器
    const containerEl = typeof this.options.container === 'string'
      ? document.querySelector(this.options.container)
      : this.options.container;

    if (!containerEl) {
      console.error('[KuronekoAuth] Container not found:', this.options.container);
      return this;
    }

    this.container = containerEl;

    // 注入样式
    injectStyles();

    // 渲染表单
    this.container.innerHTML = createFormHTML(this.options);

    // 绑定事件
    this._bindEvents();

    this.mounted = true;
    return this;
  }

  // 卸载
  unmount() {
    if (!this.mounted || !this.container) return;
    this.container.innerHTML = '';
    this.mounted = false;
  }

  // 绑定表单事件
  _bindEvents() {
    const form = this.container.querySelector('#ka-login-form');
    const submitBtn = this.container.querySelector('#ka-submit-btn');
    const errorMsg = this.container.querySelector('#ka-error-msg');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = this.container.querySelector('#ka-email').value.trim();
      const password = this.container.querySelector('#ka-password').value;

      if (!email || !password) {
        this._showError('请填写邮箱和密码');
        return;
      }

      // 禁用按钮
      submitBtn.disabled = true;
      submitBtn.textContent = '登录中...';
      errorMsg.classList.remove('show');

      try {
        const response = await fetch(`${this.options.apiUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
          // 登录成功
          const result = {
            token: data.data.access_token,
            refreshToken: data.data.refresh_token,
            user: data.data.user
          };

          if (this.successCallback) {
            this.successCallback(result);
          }
        } else {
          this._showError(data.message || '登录失败');
          if (this.errorCallback) {
            this.errorCallback(new Error(data.message || '登录失败'));
          }
        }
      } catch (error) {
        console.error('[KuronekoAuth] Login error:', error);
        this._showError('网络错误，请稍后重试');
        if (this.errorCallback) {
          this.errorCallback(error);
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
      }
    });
  }

  // 显示错误信息
  _showError(message) {
    const errorMsg = this.container.querySelector('#ka-error-msg');
    if (errorMsg) {
      errorMsg.textContent = message;
      errorMsg.classList.add('show');
    }
  }
}

// 导出的 loginView 对象
const loginView = {
  create(options) {
    return new LoginInstance(options);
  }
};

// 全局变量 (Chrome 扩展使用)
if (typeof window !== 'undefined') {
  window.KuronekoAuth = { loginView };
}
