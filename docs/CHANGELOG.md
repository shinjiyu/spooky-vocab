# 📝 Changelog

## [Unreleased] - 2025-11-30

### ✨ 新增
- **统一Popup界面**：登陆、主界面、设置全部整合到一个小窗口（360x500px）
- **自动刷新功能**：统计数据每2秒自动更新
- **视图切换**：三个视图（登陆、主界面、设置）流畅切换，无需跳转页面
- **实时数据同步**：
  - 遇到的生词数量实时更新
  - 标记为已知数量实时更新
  - 已掌握的词汇列表实时更新

### 🎨 改进
- **更好的用户体验**：
  - 不再跳转到独立页面
  - 所有操作在Popup内完成
  - 登陆后自动切换到主界面
  - 平滑的视图过渡动画
  
- **优化的登陆流程**：
  - 直接在Popup内登陆
  - 记住上次使用的用户ID
  - 即时反馈登陆状态
  - 错误提示更友好

- **内联设置页面**：
  - 点击⚙️按钮打开设置
  - API URL配置
  - 测试连接功能
  - 退出登陆按钮
  - 返回按钮回到主界面

### 🔧 修复
- ✅ **修复统计数据不刷新的问题**（每2秒自动刷新）
- ✅ **修复登陆/设置需要跳转独立页面的问题**（整合到Popup）
- ✅ **移除hardcode的API URL**（可在设置中配置）

### 🗑️ 移除
- 删除独立的登陆页面（`extension/login/`）
- 删除独立的设置页面（`extension/options/`）
- 移除manifest.json中的`options_page`配置

### 📦 文件变更
```
新增/修改：
  extension/popup/popup.html  (完全重写，整合三个视图)
  extension/popup/popup.js    (完全重写，支持视图切换和自动刷新)
  extension/config.js         (支持动态加载配置)

删除：
  extension/login/            (已整合到popup)
  extension/options/          (已整合到popup)

更新：
  extension/manifest.json     (移除options_page)
  USER_GUIDE.md              (更新使用指南)
```

---

## [1.0.0] - 2025-11-30

### ✨ 初始发布

#### 前端功能
- Chrome扩展基础框架
- 页面文本处理和单词识别
- 翻译浮层显示
- 用户反馈机制（标记已知/未知）
- Mock数据模式
- 移动端适配（Kiwi Browser）

#### 后端功能
- Express API服务器
- SQLite数据库
- JWT认证系统
- 用户管理
- 词汇记录
- 基础API端点

#### 认证系统
- JWT token生成
- Token验证
- Token刷新
- 测试token端点（开发模式）

#### API端点
```
认证：
  POST /api/auth/test-token   - 获取测试token
  POST /api/auth/refresh      - 刷新token
  GET  /api/auth/verify       - 验证token

用户：
  GET  /api/user/settings     - 获取用户设置
  PUT  /api/user/settings     - 更新用户设置

复习：
  GET  /api/review/words      - 获取复习单词
  GET  /api/review/stats      - 获取学习统计

词汇：
  POST /api/vocabulary/batch-check  - 批量检查单词

反馈：
  POST /api/feedback/known    - 标记为已知
  POST /api/feedback/unknown  - 标记为未知
```

#### 文档
- README.md - 项目概述
- QUICK_START.md - 快速开始指南
- TESTING_GUIDE.md - 测试指南
- USER_GUIDE.md - 用户使用指南
- API_SPECIFICATION.md - API协议文档
- FRONTEND_INTEGRATION.md - 前端集成指南
- IMPLEMENTATION_ROADMAP.md - 实现路线图
- DOCUMENTATION_INDEX.md - 文档索引

---

## 🎯 即将推出

### Phase 5: 完整后端实现
- [ ] 自适应学习算法
- [ ] ECDICT离线词典集成
- [ ] 词频分析
- [ ] CEFR等级判断
- [ ] 熟悉度评分系统

### Phase 6: 高级功能
- [ ] 复习提醒
- [ ] 学习统计报告
- [ ] 词汇导出
- [ ] 自定义词汇表
- [ ] 单词卡片

### Phase 7: 生产准备
- [ ] 真实登陆系统
- [ ] JWT加密
- [ ] HTTPS支持
- [ ] 性能优化
- [ ] Chrome Web Store发布

---

## 📋 版本规则

格式：`[Major].[Minor].[Patch]`

- **Major**: 重大功能更新或架构变更
- **Minor**: 新功能添加
- **Patch**: Bug修复和小改进

---

## 🔗 相关链接

- **项目仓库**: https://git.wemomo.com/yu.zhenyu/spookyvocab
- **问题反馈**: GitHub Issues
- **文档**: README.md

---

**注意**: 本项目目前处于开发阶段，功能持续完善中。

