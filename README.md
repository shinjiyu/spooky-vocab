# 智能英语单词翻译助手

一个智能的Chrome浏览器插件，能够自动识别网页中的英文难词并显示翻译，支持自适应学习和移动端。

## 项目概述

这个项目旨在帮助英语学习者在浏览英文网页时，只对不认识的单词显示翻译，而不是全部翻译。通过用户反馈和自适应算法，系统会逐渐学习用户的词汇水平，提供个性化的学习体验。

## 核心特性

- 🎯 **智能难词识别**：基于词频、CEFR等级和用户历史，判断哪些词需要翻译
- 💡 **浮层翻译**：不破坏原文布局，翻译悬浮在单词旁边
- 🧠 **自适应学习**：根据用户反馈动态调整词汇难度判断
- 📱 **移动端支持**：适配Kiwi Browser等支持插件的移动浏览器
- 📊 **学习追踪**：记录遇到的单词，提供复习功能
- 🔄 **云端同步**：多设备间同步学习进度（阶段二）

## 开发进度

### ✅ 阶段一：前端体验验证（当前）

使用Mock数据快速验证UI/UX设计

- [x] Chrome插件基础结构
- [x] 页面文本遍历和分词
- [x] Mock词汇数据和判断逻辑
- [x] 翻译浮层UI（Shadow DOM）
- [x] 设备检测和响应式交互
- [x] 移动端适配（tap/long-press）
- [x] 本地存储反馈
- [x] Popup界面
- [ ] PC和移动端测试（需要用户评估）

### 🚧 阶段二：后端智能系统（待开发）

实现真实的自适应学习算法和数据持久化

- [ ] Node.js + Express后端
- [ ] ECDICT离线词典集成
- [ ] 词汇查询API
- [ ] 自适应学习算法
- [ ] 用户反馈处理
- [ ] 复习功能
- [ ] 前后端联调测试

## 技术栈

### 前端（Chrome Extension）

- **Chrome Extension Manifest V3**
- **Vanilla JavaScript**（无框架，性能优先）
- **Shadow DOM**（CSS隔离）
- **响应式设计**（PC + 移动端）

### 后端（计划）

- **Node.js + Express**
- **SQLite**（词典数据 + 用户数据）
- **ECDICT**（开源英语词典，80万词条）
- **JWT认证**（测试阶段使用明文user_id）

## 快速开始

### 安装Chrome插件

1. 克隆仓库：
```bash
git clone <repository-url>
cd english_helper
```

2. 添加图标文件（临时可以跳过）：
```bash
cd extension/icons
# 参考 icons/README.md 创建图标文件
```

3. 加载插件：
   - 打开 Chrome 浏览器
   - 访问 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择 `extension` 文件夹

4. 测试：
   - 访问任意英文网页（如 https://www.bbc.com/news）
   - 查看插件是否自动标记单词
   - 悬停/点击查看翻译

### 使用说明

详细使用说明请查看：[extension/README.md](extension/README.md)

## 项目结构

```
english_helper/
├── extension/                 # Chrome插件
│   ├── manifest.json          # 插件配置
│   ├── content/               # Content scripts
│   │   ├── main.js            # 入口和设备检测
│   │   ├── text-processor.js  # 文本处理和分词
│   │   ├── mock-vocabulary.js # Mock词汇数据
│   │   ├── translation-tooltip.js  # 翻译浮层UI
│   │   └── feedback-handler.js     # 用户反馈
│   ├── popup/                 # Popup界面
│   │   ├── popup.html
│   │   └── popup.js
│   ├── icons/                 # 图标文件
│   └── README.md
├── backend/                   # 后端（阶段二）
│   └── (待创建)
└── README.md                  # 本文件
```

## 设计文档

完整的设计计划请查看：[chrome.plan.md](chrome.plan.md)

## 测试指南

### PC端测试

1. 访问英文网站（推荐：BBC News, Medium）
2. 验证以下功能：
   - 单词是否正确标记
   - 悬停显示翻译
   - 双击强制显示翻译
   - 点击"✓"按钮标记已知
   - Popup统计数据更新

### 移动端测试（Kiwi Browser）

1. 在Android设备上安装Kiwi Browser
2. 加载插件（步骤同PC端）
3. 验证以下功能：
   - 点击单词切换翻译
   - 长按强制显示翻译
   - 浮层不超出屏幕
   - 触摸区域大小合适
   - 交互流畅度

### 体验评估重点

- ✅ 浮层是否影响正常阅读？
- ✅ 交互是否自然流畅？
- ✅ 翻译显示时机是否合理？
- ✅ 移动端操作是否方便？
- ✅ 性能是否流畅（大量单词时）？

## 待优化问题

当前已知的可改进点：

1. **Mock数据有限**：只包含约50个难词，阶段二接入真实词典
2. **图标占位**：需要设计正式的插件图标
3. **性能优化**：大型网页可能需要更多优化
4. **边界情况**：某些特殊网页布局可能影响显示

## 贡献指南

欢迎提供反馈和建议！

### 反馈方式

- 提交 Issue 描述问题或建议
- 附上截图或录屏
- 说明测试环境（浏览器、操作系统、设备类型）

## License

MIT License

## 联系方式

如有问题或建议，请通过Issue联系。

