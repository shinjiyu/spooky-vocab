# 生词判断算法说明

## 概述

Spooky Vocab 使用多层判断策略来决定一个英文单词是否需要为用户显示翻译（划下划线）。算法综合考虑以下因素：

1. **用户反馈记录** - 用户是否已标记该词为"已知"
2. **极常用词过滤** - 排除基础语法词汇
3. **词典难度评估** - 基于 ECDICT 词典的词频数据
4. **词长启发式** - 基于用户 CEFR 等级和词长的简单判断

## 判断流程

```
┌─────────────────────────────────────┐
│           输入: 单词                 │
└─────────────────┬───────────────────┘
                  ▼
┌─────────────────────────────────────┐
│  用户是否标记为"已知"?              │
│  (known_feedback_count > 0)         │
└─────────────────┬───────────────────┘
                  │ 是 → 不需要翻译 (score: 80)
                  ▼ 否
┌─────────────────────────────────────┐
│  是否为极常用词?                    │
│  (veryCommonWords 列表)             │
└─────────────────┬───────────────────┘
                  │ 是 → 不需要翻译 (score: 90)
                  ▼ 否
┌─────────────────────────────────────┐
│  ECDICT 词典是否可用?               │
└─────────────────┬───────────────────┘
          是      │       否
          ▼       │       ▼
┌─────────────────┐ ┌─────────────────┐
│ 使用词频评估    │ │ 使用词长判断    │
│ (difficulty)    │ │ (词长 vs 等级)  │
└─────────────────┘ └─────────────────┘
          │                 │
          └────────┬────────┘
                   ▼
┌─────────────────────────────────────┐
│  score < 65 → 需要翻译 (划线)       │
│  score >= 65 → 不需要翻译           │
└─────────────────────────────────────┘
```

## 详细说明

### 1. 用户反馈优先

如果用户曾经点击翻译窗口的 ✓ 按钮标记某个词为"已知"，该词将不再显示翻译：

```javascript
if (userRecord && userRecord.known_feedback_count > 0) {
  return { needs_translation: false, score: 80 };
}
```

### 2. 极常用词过滤

以下类别的词默认不显示翻译：

| 类别 | 示例 |
|------|------|
| be 动词 | is, am, are, was, were, been |
| 助动词 | have, has, do, does, will, would, can, could |
| 代词 | I, you, he, she, it, we, they, this, that |
| 冠词 | a, an, the |
| 介词 | in, on, at, to, for, of, with, by, from |
| 连词 | and, or, but, so, if, when, because |
| 副词 | not, yes, very, too, just, only, still |
| 基础动词 | go, come, get, make, take, see, know, want |
| 基础形容词 | good, bad, new, old, big, small, first, last |
| 数词 | one, two, three, first, second, third |

完整列表约 200 个词。

### 3. ECDICT 词频评估

当 ECDICT 词典可用时，使用词频数据进行更精确的难度评估：

```javascript
// 词频越高，分数越高（越容易）
// 词频越低，分数越低（越难）
const difficulty = await dictionaryService.getDifficulty(word);
familiarityScore = difficulty.score;
```

### 4. 词长启发式判断

作为后备方案，使用词长结合用户 CEFR 等级进行判断：

| 用户等级 | 容忍词长 | 说明 |
|----------|----------|------|
| A1 | ≤4 | 初学者，4字母以下认为认识 |
| A2 | ≤5 | 初级 |
| B1 | ≤6 | 中级（默认） |
| B2 | ≤7 | 中高级 |
| C1 | ≤8 | 高级 |
| C2 | ≤10 | 精通 |

```javascript
const threshold = levelThresholds[userLevel] || 6;

if (wordLength <= threshold) {
  return { needs_translation: false, score: 70 };
} else {
  // 词越长，分数越低
  const score = Math.max(20, 65 - (wordLength - threshold) * 5);
  return { needs_translation: score < 65, score };
}
```

## 分数阈值

- **score < 65**: 需要翻译，显示下划线
- **score >= 65**: 不需要翻译，不显示下划线

## 前端处理流程

1. **页面加载时**：`text-processor.js` 扫描页面文本，提取英文单词
2. **批量检查**：调用 `/api/vocabulary/batch-check` 获取每个词的 `needs_translation` 状态
3. **标记生词**：为需要翻译的词添加 `vocab-needs-translation` 类名（显示虚线下划线）
4. **交互触发**：
   - 桌面端：悬停或双击显示翻译
   - 移动端：点击显示翻译

## 相关文件

- `backend/src/routes/vocabulary.js` - 服务端判断逻辑
- `backend/src/services/dictionary.js` - ECDICT 词典服务
- `extension/content/text-processor.js` - 前端文本处理

## 自适应学习

系统会根据用户的反馈不断优化判断：

- 用户点击 ✓ 标记"已知" → 该词不再显示翻译
- 用户主动请求翻译（悬停/双击）→ 该词记入学习列表
- 基于 FSRS 算法的间隔复习 → 巩固记忆

详见 [FSRS_ALGORITHM_EXPLAINED.md](./FSRS_ALGORITHM_EXPLAINED.md)



