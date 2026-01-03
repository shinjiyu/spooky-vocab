#!/usr/bin/env node

/**
 * 配置应用脚本
 * 
 * 用途：将本地配置应用到各个需要配置的文件中
 * 
 * 使用方法：
 *   node scripts/apply-config.js          # 应用本地配置
 *   node scripts/apply-config.js --reset  # 恢复为示例配置（用于提交到 git）
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const isReset = process.argv.includes('--reset');

// 加载配置
let config;
try {
  if (isReset) {
    config = require(path.join(projectRoot, 'config/config.example.js'));
    console.log('📦 使用示例配置（用于 git 提交）');
  } else {
    config = require(path.join(projectRoot, 'config/config.local.js'));
    console.log('🔧 使用本地配置');
  }
} catch (e) {
  console.error('❌ 无法加载配置文件:', e.message);
  console.log('\n请确保 config/config.local.js 存在');
  console.log('可以从 config/config.example.js 复制并修改');
  process.exit(1);
}

// 需要更新的文件和替换规则
const replacements = [
  {
    file: 'extension/config.js',
    rules: [
      { pattern: /baseURL: 'https:\/\/[^']+\/vocab-api'/, replacement: `baseURL: '${config.api.baseUrl}'` }
    ]
  },
  {
    file: 'extension/popup/popup.js',
    rules: [
      { pattern: /const AUTH_SERVICE_URL = 'https:\/\/[^']+';/, replacement: `const AUTH_SERVICE_URL = '${config.auth.url}';` }
    ]
  },
  {
    file: 'extension/manifest.json',
    rules: [
      { pattern: /"https:\/\/[^"]+\/\*"/, replacement: `"https://${config.domain}/*"` }
    ]
  },
  {
    file: 'extension/lib/auth-sdk.js',
    rules: [
      { pattern: /apiUrl: 'https:\/\/[^']+',/, replacement: `apiUrl: '${config.auth.url}',` }
    ]
  },
  {
    file: 'review-app/index.html',
    rules: [
      { pattern: /import { loginView } from 'https:\/\/[^']+\/sdk\/login\.js';/, replacement: `import { loginView } from '${config.auth.sdkUrl}';` },
      { pattern: /apiUrl: 'https:\/\/[^']+\/vocab-api',/, replacement: `apiUrl: '${config.api.baseUrl}',` },
      { pattern: /authUrl: 'https:\/\/[^']+',/, replacement: `authUrl: '${config.auth.url}',` }
    ]
  },
  {
    file: 'backend/public/privacy.html',
    rules: [
      { pattern: /https:\/\/[^"]+\/vocab-api\/public\/icon128\.png/, replacement: `${config.api.baseUrl}/public/icon128.png` },
      { pattern: /mailto:[^"]+@[^"]+/, replacement: `mailto:${config.privacy.email}` },
      { pattern: /📧 [^\s<]+@[^\s<]+/, replacement: `📧 ${config.privacy.email}` },
      { pattern: /href="https:\/\/[^"]+">返回主页/, replacement: `href="https://${config.domain}">返回主页` }
    ]
  },
  {
    file: 'extension/popup/popup.html',
    rules: [
      { pattern: /href="https:\/\/[^"]+\/vocab-review\/"/, replacement: `href="${config.review.url}"` }
    ]
  },
  {
    file: 'releases/store-description.md',
    rules: [
      { pattern: /https:\/\/[^\/\s]+\/vocab-api/g, replacement: config.api.baseUrl },
      { pattern: /https:\/\/[^\/\s]+\/\*/g, replacement: `https://${config.domain}/*` },
      { pattern: /\([^)]+\.com\)/g, replacement: `(${config.domain})` }
    ]
  },
  {
    file: 'backend/src/middleware/auth.js',
    rules: [
      { pattern: /const JWT_SECRET = process\.env\.AUTH_SERVICE_JWT_SECRET \|\| process\.env\.JWT_SECRET \|\| '[^']+';/, 
        replacement: `const JWT_SECRET = process.env.AUTH_SERVICE_JWT_SECRET || process.env.JWT_SECRET || '${config.jwt.authServiceSecret}';` }
    ]
  }
];

// 执行替换
let updatedCount = 0;

replacements.forEach(({ file, rules }) => {
  const filePath = path.join(projectRoot, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⏭ 跳过不存在的文件: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  rules.forEach(({ pattern, replacement }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ 更新: ${file}`);
    updatedCount++;
  } else {
    console.log(`⏭ 无需更新: ${file}`);
  }
});

console.log(`\n🎉 完成！更新了 ${updatedCount} 个文件`);

if (isReset) {
  console.log('\n📝 现在可以安全提交到 git 了');
} else {
  console.log('\n🚀 配置已应用，可以进行开发/部署了');
}

