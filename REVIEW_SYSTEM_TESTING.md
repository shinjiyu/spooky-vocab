# Spooky Vocab 复习系统测试指南

**创建日期**: 2025-12-02  
**测试版本**: v1.0.0

---

## 🎯 测试目标

验证FSRS间隔重复复习系统的完整功能，包括：
1. 后端API正常工作
2. 前端界面可用
3. FSRS算法准确运行
4. 用户体验流畅

---

## 🚀 快速开始

### 1. 启动后端服务

```bash
cd /Users/user/Documents/english_helper/backend
npm start
```

**期望输出**:
```
╔═══════════════════════════════════════════╗
║   👻 Spooky Vocab Backend Server          ║
║   Status: Running                         ║
║   Port: 3000                              ║
║   URL: http://localhost:3000              ║
╚═══════════════════════════════════════════╝
```

### 2. 访问复习界面

在浏览器中打开:
```
http://localhost:3000/review/
```

### 3. 登录

- **用户ID**: `test_user`
- **API地址**: `http://localhost:3000`

点击"登录"按钮

---

## ✅ 功能测试清单

### 测试1: 健康检查 ✅

**请求**:
```bash
curl http://localhost:3000/health
```

**期望响应**:
```json
{
  "status": "ok",
  "service": "spookyvocab-backend",
  "version": "1.0.0",
  "timestamp": "2025-12-02T..."
}
```

### 测试2: JWT认证 ✅

**请求**:
```bash
curl -X POST http://localhost:3000/api/auth/test-token \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_user"}'
```

**期望响应**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbG...",
    "expires_in": 86400
  }
}
```

### 测试3: 获取到期单词 ✅

**请求**:
```bash
TOKEN="your_jwt_token_here"
curl -X GET "http://localhost:3000/api/sr/due?limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

**期望响应**:
```json
{
  "success": true,
  "data": {
    "cards": [],
    "counts": {
      "due": 0,
      "new": 0,
      "learning": 0,
      "review": 0
    }
  }
}
```

### 测试4: 获取统计数据 ✅

**请求**:
```bash
curl -X GET "http://localhost:3000/api/sr/stats" \
  -H "Authorization: Bearer $TOKEN"
```

**期望响应**:
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_cards": 0,
      "due_today": 0,
      "completed_today": 0
    },
    "activity": {
      "study_streak_days": 0
    }
  }
}
```

### 测试5: 复习单词（FSRS算法）

由于当前数据库为空，需要先通过Chrome插件创建一些单词记录，或者手动插入测试数据。

#### 方法A: 使用Chrome插件

1. 在Chrome中加载extension
2. 浏览包含英文单词的网页
3. 系统会自动识别单词并创建记录
4. 在复习界面点击"开始复习"

#### 方法B: 手动创建测试数据

```bash
sqlite3 backend/data/user_data.db

INSERT INTO word_records (user_id, word, state, stability, difficulty, due_date, last_review, reps, lapses) 
VALUES 
('test_user', 'ubiquitous', 0, 0, 5.0, NULL, NULL, 0, 0),
('test_user', 'implement', 0, 0, 5.0, NULL, NULL, 0, 0),
('test_user', 'comprehensive', 0, 0, 5.0, NULL, NULL, 0, 0);

.exit
```

然后在复习界面刷新，应该看到3个待复习单词。

### 测试6: 提交复习评分

**请求**:
```bash
curl -X POST "http://localhost:3000/api/sr/review" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "word": "ubiquitous",
    "grade": 3,
    "duration_seconds": 10
  }'
```

**期望响应**:
```json
{
  "success": true,
  "data": {
    "result": {
      "word": "ubiquitous",
      "grade": 3,
      "old_state": 0,
      "new_state": 1,
      "next_interval_days": 2.4
    }
  }
}
```

**验证点**:
- FSRS算法计算了新的stability
- state从0（新卡片）变为1（学习中）
- 计算了下次复习间隔

---

## 🎨 前端UI测试

### 测试7: 登录界面

**测试步骤**:
1. 打开 http://localhost:3000/review/
2. 检查UI元素：
   - ✅ "Spooky Vocab"标题显示
   - ✅ 用户ID输入框可用
   - ✅ API地址输入框可用
   - ✅ 登录按钮可点击

**截图**: (打开浏览器查看)

### 测试8: 统计界面

**测试步骤**:
1. 登录成功后
2. 检查统计卡片：
   - ✅ 今日待复习显示正确数字
   - ✅ 今日已完成显示0
   - ✅ 总词汇量显示
   - ✅ 连续学习天数显示

### 测试9: 翻卡片界面

**测试步骤**:
1. 点击"开始复习"
2. 检查卡片：
   - ✅ 单词显示正确（正面）
   - ✅ 音标显示（如有）
   - ✅ 点击卡片可翻转
   - ✅ 翻转后显示中文释义（背面）
   - ✅ 3D翻转动画流畅

### 测试10: 评分按钮

**测试步骤**:
1. 在卡片界面
2. 检查评分按钮：
   - ✅ "😰 Again" 红色按钮
   - ✅ "😓 Hard" 橙色按钮
   - ✅ "😊 Good" 青色按钮
   - ✅ "😎 Easy" 浅绿色按钮
3. 点击任意按钮
4. 验证：
   - ✅ 显示"✓ 已记录！下次复习: X天后"
   - ✅ 1秒后自动切换到下一张卡片

---

## 🧪 FSRS算法验证

### 测试11: 评分对间隔的影响

创建相同的测试单词，用不同评分测试：

| 评分 | 期望间隔 | 期望状态 |
|------|----------|----------|
| Again (1) | ~0.4天 (约10小时) | Learning |
| Hard (2) | ~0.6天 (约14小时) | Learning |
| Good (3) | ~2.4天 | Learning |
| Easy (4) | ~5.8天 | Review |

**验证方法**:
```bash
# 查看review_log表
sqlite3 backend/data/user_data.db
SELECT word, grade, stability, difficulty, state FROM review_log ORDER BY review_time DESC LIMIT 10;
```

### 测试12: 连续复习效果

对同一单词连续选择"Good"评分3次：

| 次数 | 期望Stability | 期望间隔增长 |
|------|---------------|--------------|
| 1 | ~2.4天 | 基础间隔 |
| 2 | ~6-8天 | ~3倍增长 |
| 3 | ~15-20天 | ~2.5倍增长 |

**验证**:
- Stability应该递增
- Difficulty应该保持不变或略有下降
- State应该保持在Learning或升至Review

### 测试13: "Again"的遗忘效果

对已学习的单词选择"Again"：

**期望结果**:
- Lapses +1
- State变为Relearning (3)
- Stability大幅下降
- 间隔重置到短期

---

## 📱 浏览器兼容性测试

### 桌面浏览器

| 浏览器 | 版本 | 测试结果 | 备注 |
|--------|------|----------|------|
| Chrome | 120+ | ✅ 通过 | 完全兼容 |
| Safari | 17+ | ⏳ 待测试 | 3D动画可能有差异 |
| Firefox | 120+ | ⏳ 待测试 | 应该兼容 |
| Edge | 120+ | ⏳ 待测试 | 基于Chromium |

### 移动浏览器

| 浏览器 | 设备 | 测试结果 | 备注 |
|--------|------|----------|------|
| iOS Safari | iPhone | ⏳ 待测试 | 触摸交互 |
| Chrome Mobile | Android | ⏳ 待测试 | 响应式布局 |
| Kiwi Browser | Android | ⏳ 待测试 | 支持扩展 |

**测试要点**:
- 触摸翻卡片是否流畅
- 按钮是否足够大（至少44x44px）
- 响应式布局是否正确
- 字体大小是否可读

---

## 🐛 已知问题

### 问题1: 空数据库
**现象**: 首次使用时没有单词可复习  
**解决**: 使用Chrome插件浏览英文网页创建单词记录，或手动插入测试数据

### 问题2: JWT过期
**现象**: 24小时后token失效  
**解决**: 重新登录获取新token（未来可实现自动刷新）

---

## 📊 性能测试

### 测试14: API响应时间

```bash
# 测试健康检查
time curl -s http://localhost:3000/health > /dev/null

# 测试获取到期单词
time curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/sr/due?limit=20" > /dev/null

# 测试提交复习
time curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"word":"test","grade":3}' \
  "http://localhost:3000/api/sr/review" > /dev/null
```

**期望指标**:
- 健康检查: < 10ms
- 获取单词: < 50ms
- 提交复习: < 100ms

### 测试15: 前端加载速度

使用Chrome DevTools Lighthouse测试:
1. 打开 http://localhost:3000/review/
2. F12 打开DevTools
3. Lighthouse标签
4. 点击"Generate report"

**期望指标**:
- Performance: > 90
- Accessibility: > 90
- Best Practices: > 90

---

## 🔍 调试技巧

### 查看后端日志

```bash
# 查看服务器输出
tail -f backend-logs.txt  # 如果有日志文件

# 或直接在terminal中查看npm start的输出
```

### 查看数据库内容

```bash
sqlite3 backend/data/user_data.db

# 查看所有单词记录
SELECT * FROM word_records LIMIT 10;

# 查看复习日志
SELECT * FROM review_log ORDER BY review_time DESC LIMIT 10;

# 查看FSRS参数
SELECT word, state, stability, difficulty, due_date, reps, lapses 
FROM word_records 
WHERE user_id = 'test_user';
```

### 浏览器开发者工具

1. 打开DevTools (F12)
2. Network标签 - 查看API请求
3. Console标签 - 查看JavaScript错误
4. Application标签 - 查看localStorage中的token

---

## ✅ 测试总结模板

```
日期: 2025-12-02
测试人员: [你的名字]
测试环境: [OS / 浏览器]

后端测试:
- [ ] 健康检查
- [ ] JWT认证
- [ ] 获取到期单词
- [ ] 获取统计数据
- [ ] 提交复习评分

前端测试:
- [ ] 登录界面
- [ ] 统计显示
- [ ] 翻卡片交互
- [ ] 评分按钮
- [ ] 响应式布局

FSRS算法:
- [ ] 不同评分的间隔计算
- [ ] 连续复习的效果
- [ ] Lapses记录

问题发现:
1. [问题描述]
2. [问题描述]

总体评价: ⭐⭐⭐⭐⭐ (5星)
```

---

## 🚀 下一步

### 待实现功能
1. ⏳ 小程序版本开发
2. ⏳ 更多统计图表
3. ⏳ 导出学习数据
4. ⏳ 社交分享功能

### 待优化
1. ⏳ 自动JWT刷新
2. ⏳ 离线缓存支持
3. ⏳ 更多卡片样式
4. ⏳ 自定义FSRS参数

---

**测试完成后请运行**: ✅

```bash
# 提交测试报告
git add REVIEW_SYSTEM_TESTING.md
git commit -m "docs: 添加复习系统测试指南"
```

---

*最后更新: 2025-12-02*  
*测试版本: v1.0.0*

