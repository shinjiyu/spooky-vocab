# 📋 版本信息系统

## ✅ 已实现

插件初始化时会显示完整的版本和构建信息！

---

## 🎯 功能特点

### 1. **Console Banner**

当插件加载时（DEBUG_MODE: true），会在控制台显示：

```
╔═══════════════════════════════════════════╗
║   👻 Spooky Vocab - 智能英语学习助手       ║
║                                           ║
║   Version:    1.0.0                      ║
║   Build Date: 2025-11-30                 ║
║   Commit:     1823808                    ║
║   Mode:       API                        ║
║                                           ║
║   Features:                               ║
║   • ECDICT词典 (340万词)                  ║
║   • 智能评分算法                          ║
║   • 自适应学习                            ║
║   • 离线同步队列                          ║
║   • JWT认证                               ║
║                                           ║
╚═══════════════════════════════════════════╝

[VocabHelper] Version: v1.0.0 (2025-11-30) [1823808]
[VocabHelper] Device: Desktop
[VocabHelper] Initializing...
```

### 2. **Popup Footer**

Popup界面底部显示：
```
Spooky Vocab v1.0.0 (2025-11-30) [1823808]
```

鼠标悬停显示tooltip：
```
Build: 2025-11-30
Mode: API
```

### 3. **版本信息API**

JavaScript中可以访问：

```javascript
// 获取版本对象
window.VOCAB_HELPER_VERSION
// {
//   version: '1.0.0',
//   buildDate: '2025-11-30',
//   gitCommit: '1823808',
//   mode: 'API',
//   features: [...]
// }

// 获取简短版本字符串
window.getVersionInfo()
// "v1.0.0 (2025-11-30) [1823808]"

// 获取完整横幅
window.getVersionBanner()
// (完整的ASCII艺术横幅)
```

---

## 🔧 自动更新脚本

### 使用方法

**手动更新：**
```bash
./update-version.sh
```

**输出：**
```
✓ Updated version.js:
  Version: 1.0.0
  Build Date: 2025-11-30
  Git Commit: 1823808
```

### 脚本功能

`update-version.sh` 会自动：
1. 从 `manifest.json` 读取版本号
2. 获取当前 Git commit hash (短格式)
3. 获取当前日期
4. 更新 `extension/version.js`

---

## 📦 工作流集成

### Git Pre-commit Hook (推荐)

每次commit前自动更新版本信息：

```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
./update-version.sh
git add extension/version.js
EOF

chmod +x .git/hooks/pre-commit
```

### 发布流程

```bash
# 1. 更新manifest.json中的版本号
vim extension/manifest.json
# 修改 "version": "1.0.0" → "1.1.0"

# 2. 运行版本更新脚本
./update-version.sh

# 3. 提交更改
git add extension/manifest.json extension/version.js
git commit -m "chore: Bump version to 1.1.0"
git tag v1.1.0
git push && git push --tags

# 4. 构建发布包
cd extension
zip -r ../spooky-vocab-v1.1.0.zip .
```

---

## 📁 文件说明

### `extension/version.js`

版本信息定义文件：
```javascript
window.VOCAB_HELPER_VERSION = {
  version: '1.0.0',        // 从manifest.json读取
  buildDate: '2025-11-30', // 自动生成
  gitCommit: '1823808',    // 自动获取
  mode: 'API',             // 手动维护
  features: [...]          // 手动维护
};
```

### `update-version.sh`

自动更新脚本：
- 读取 `manifest.json` 版本
- 获取 Git commit hash
- 重新生成 `version.js`

---

## 🐛 调试用途

### 查看版本信息

**在Console中：**
```javascript
// 查看完整版本信息
console.log(window.VOCAB_HELPER_VERSION);

// 查看简短版本
console.log(window.getVersionInfo());

// 查看横幅
console.log(window.getVersionBanner());
```

**在Popup中：**
- 查看底部Footer
- 鼠标悬停查看详情

### Bug报告

用户报告Bug时，可以提供：
```
版本: v1.0.0 (2025-11-30) [1823808]
设备: Desktop
浏览器: Chrome 120
```

---

## 📊 版本号规则

遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)：

```
MAJOR.MINOR.PATCH
  │     │     │
  │     │     └─ Bug修复
  │     └─────── 新功能（向下兼容）
  └───────────── 重大更改（不兼容）
```

### 示例

| 版本 | 说明 |
|------|------|
| 1.0.0 | 初始发布 |
| 1.0.1 | Bug修复 |
| 1.1.0 | 新功能（兼容） |
| 2.0.0 | 重大更新（不兼容） |

---

## 🎯 最佳实践

### 1. 发布前检查

```bash
# 确保版本信息是最新的
./update-version.sh

# 检查Console显示
# 打开扩展 → F12 → Console
# 应该看到版本横幅
```

### 2. Git Tag同步

```bash
# 版本号应与git tag一致
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0
```

### 3. Changelog维护

每次版本更新时更新CHANGELOG.md：
```markdown
## [1.0.0] - 2025-11-30

### Added
- 版本信息系统
- 自动构建日期跟踪
- Git commit hash追踪

### Changed
- 移除Mock模式
- 完全使用API

### Fixed
- 修复日志配置名称
```

---

## 🔮 未来增强

### 计划中的功能

- [ ] 构建号追踪
- [ ] 环境标识（dev/staging/prod）
- [ ] 自动生成Changelog
- [ ] 版本更新通知
- [ ] A/B测试版本标识

---

## 📚 相关文档

- **manifest.json** - Chrome扩展清单，定义版本号
- **version.js** - 版本信息实现
- **main.js** - 显示版本横幅
- **popup.js** - Popup版本显示
- **update-version.sh** - 自动更新脚本

---

## ✅ 验证清单

部署前检查：

- [ ] `manifest.json` 版本号正确
- [ ] 运行 `./update-version.sh`
- [ ] `version.js` 已更新
- [ ] Console显示正确版本
- [ ] Popup footer显示正确版本
- [ ] Git commit已提交
- [ ] Git tag已创建

---

**当前版本:** v1.0.0 (2025-11-30) [1823808]  
**最后更新:** 2025-11-30  
**状态:** ✅ Production Ready

