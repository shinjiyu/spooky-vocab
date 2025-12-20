# 快速开始指南

## 🎯 选择部署方式

### 方式1: 🐳 Docker部署（推荐）

**优点：**
- ✅ 一键启动，无需手动配置
- ✅ 环境隔离，不污染本地
- ✅ 易于部署到服务器

**快速启动：**
```bash
# 1. 准备词典（首次运行，约206MB下载）
cd backend/data
curl -L -o ecdict.zip "https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip"
unzip ecdict.zip && mv stardict.db ecdict.db && rm ecdict.zip
cd ../..

# 2. 启动服务
docker-compose up -d

# 3. 验证
curl http://localhost:3000/health
```

**详细文档：** 请查看 [`DOCKER_DEPLOYMENT.md`](DOCKER_DEPLOYMENT.md)

---

### 方式2: 📦 本地Node.js部署

适合开发和调试。

---

## 安装步骤

### 1. 生成图标文件（必须）

Chrome扩展需要图标才能加载。请按以下任一方法操作：

**方法A：使用在线生成器（推荐，最简单）**

1. 打开 `extension/icons/generate-icons.html` 文件
2. 点击"Download All"按钮
3. 将下载的3个PNG文件保存到 `extension/icons/` 目录：
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`

**方法B：使用ImageMagick命令行（如果已安装）**

```bash
cd extension/icons
convert -size 16x16 xc:'#667eea' icon16.png
convert -size 48x48 xc:'#667eea' icon48.png
convert -size 128x128 xc:'#667eea' icon128.png
```

**方法C：临时跳过（仅用于测试）**

暂时注释掉 `manifest.json` 中的图标配置（不推荐，会有警告）

### 2. 加载Chrome扩展

1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"**开发者模式**"开关
4. 点击"**加载已解压的扩展程序**"
5. 选择本项目的 `extension` 文件夹
6. 确认扩展已加载成功

### 3. 测试功能

**PC端测试：**

1. 打开 `test.html` 文件（或访问任意英文网页）
2. 观察哪些单词被高亮标记
3. **鼠标悬停**在标记的单词上，查看翻译浮层
4. **双击**任意单词，强制显示翻译
5. 点击浮层中的"**✓**"按钮，标记为"已知"
6. 点击扩展图标，查看Popup界面统计

**移动端测试（Kiwi Browser）：**

1. 在Android设备上安装Kiwi Browser
2. 访问 `chrome://extensions/`，开启开发者模式
3. 加载扩展（步骤同PC端）
4. 访问测试页面
5. **点击（tap）**标记的单词，查看翻译
6. **长按（500ms）**任意单词，强制显示翻译
7. 点击浮层外部区域隐藏翻译

## 功能说明

### 自动翻译

- 扩展会自动识别页面中的英文单词
- 只有"难词"会被标记并显示翻译
- 简单常见词不会显示翻译

### 强制翻译

如果某个词没有被标记，但你想查看翻译：

- **PC端**：双击该单词
- **移动端**：长按该单词（保持500ms）

### 标记已知

如果某个词被标记了但你其实认识：

1. 显示翻译浮层
2. 点击右上角的"**✓**"按钮
3. 该词会被添加到"已知词汇表"
4. 下次遇到不会再显示翻译

### Popup界面

点击扩展图标打开Popup，可以：

- **启用/禁用**扩展
- 查看**本次会话统计**（遇到多少生词）
- 设置**英语水平**（A1-C2）
- 查看**已掌握的词汇列表**
- **清除历史记录**

## 当前Mock词汇库

### 不显示翻译（约500个常见词）

the, is, are, have, make, take, good, bad, simple, test...

### 显示翻译（约50个难词）

**中等难度：**
- implement（实施）
- comprehensive（全面的）
- significant（重大的）
- facilitate（促进）
- sophisticated（复杂的）

**高难度：**
- ubiquitous（无处不在的）
- ephemeral（短暂的）
- meticulous（一丝不苟的）
- paradigm（范例）
- pragmatic（实用的）

完整列表见 `extension/content/mock-vocabulary.js`

## 测试建议

### 推荐测试网站

1. **BBC News**: https://www.bbc.com/news
2. **Medium**: https://medium.com/
3. **Wikipedia**: https://en.wikipedia.org/
4. **本项目的test.html**（包含各难度词汇）

### 评估重点

请在测试时关注以下几点：

1. ✅ **浮层定位**：是否准确，会不会遮挡原文？
2. ✅ **交互流畅度**：悬停/点击反应是否及时？
3. ✅ **阅读体验**：是否影响正常阅读？
4. ✅ **移动端体验**：触摸区域大小是否合适？
5. ✅ **翻译时机**：哪些词显示翻译合理吗？
6. ✅ **性能**：大量文本时是否流畅？

## 故障排除

### 扩展加载失败

- 确保图标文件已生成并放在正确位置
- 检查`manifest.json`语法是否正确
- 查看Chrome扩展页面的错误信息

### 没有单词被标记

1. 检查扩展是否启用（点击图标查看）
2. 刷新页面重试
3. 打开浏览器控制台（F12），查看是否有错误

### 翻译浮层不显示

1. 确认单词确实被标记（应该有视觉样式）
2. PC端：确保鼠标悬停在单词上
3. 移动端：确保点击了标记的单词
4. 检查控制台是否有JavaScript错误

### 移动端长按没反应

- 确保长按时间足够（500ms）
- 不要在长按过程中移动手指
- 某些网页可能禁用了长按功能

## 调试模式

扩展默认开启调试模式，可以在控制台看到详细日志：

```
[VocabHelper] Initializing...
[TextProcessor] Processed 123 words
[TranslationTooltip] Tooltip shown for word: implement
```

如需关闭调试日志，修改 `extension/content/main.js`：

```javascript
window.VOCAB_HELPER_CONFIG = {
  // ...
  debug: false  // 改为false
};
```

## 下一步

### 用户测试（当前阶段）

请在各种场景下测试，并提供反馈：

- 哪些地方体验好？
- 哪些地方需要改进？
- 浮层设计是否合理？
- 交互是否符合预期？

### 阶段二开发（待测试通过后）

- 搭建Node.js后端
- 集成ECDICT离线词典（80万词）
- 实现自适应学习算法
- 用户数据云端同步
- 复习功能

## 技术支持

如遇到问题：

1. 查看 `extension/README.md` 详细文档
2. 检查浏览器控制台的错误信息
3. 提交Issue并附上：
   - 浏览器版本
   - 操作系统
   - 错误截图或描述
   - 控制台错误日志

## 文件结构参考

```
english_helper/
├── extension/                    # Chrome扩展
│   ├── manifest.json
│   ├── content/                  # Content Scripts
│   │   ├── main.js
│   │   ├── text-processor.js
│   │   ├── mock-vocabulary.js
│   │   ├── translation-tooltip.js
│   │   └── feedback-handler.js
│   ├── popup/                    # Popup界面
│   │   ├── popup.html
│   │   └── popup.js
│   ├── icons/                    # 图标
│   │   ├── icon16.png           # 需要生成
│   │   ├── icon48.png           # 需要生成
│   │   ├── icon128.png          # 需要生成
│   │   ├── icon.svg             # SVG源文件
│   │   └── generate-icons.html  # 图标生成工具
│   └── README.md
├── test.html                     # 测试页面
├── README.md                     # 项目说明
├── QUICK_START.md               # 本文件
└── chrome.plan.md               # 开发计划
```

---

**祝测试顺利！期待您的反馈 🚀**

