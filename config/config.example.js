/**
 * 项目配置示例文件
 * 
 * 使用方法：
 * 1. 复制此文件为 config.local.js
 * 2. 填入你的真实配置
 * 3. config.local.js 已在 .gitignore 中，不会被提交
 */

module.exports = {
  // 域名配置
  domain: 'your-domain.com',
  
  // API 服务配置
  api: {
    baseUrl: 'https://your-domain.com/vocab-api',
    healthCheck: 'https://your-domain.com/vocab-api/health'
  },
  
  // 认证服务配置
  auth: {
    url: 'https://your-domain.com',
    sdkUrl: 'https://your-domain.com/sdk/login.js'
  },
  
  // 服务器配置（仅用于部署）
  server: {
    host: 'your-server-ip',
    user: 'root',
    // 密码建议使用 SSH 密钥，不要硬编码
    // password: 'your-password',
    remoteDir: '/opt/your-project'
  },
  
  // JWT 配置
  jwt: {
    secret: 'your-jwt-secret-change-in-production',
    authServiceSecret: 'your-auth-service-jwt-secret'
  },
  
  // 隐私政策页面
  privacy: {
    url: 'https://your-domain.com/vocab-api/public/privacy.html',
    email: 'support@your-domain.com'
  }
};

