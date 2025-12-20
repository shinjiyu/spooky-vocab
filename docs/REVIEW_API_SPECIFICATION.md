# Spooky Vocab - Review API Specification

**版本**: v1.0.0  
**更新日期**: 2025-12-02  
**协议类型**: RESTful API  
**认证方式**: JWT (JSON Web Token)

---

## 📋 目录

1. [概述](#概述)
2. [认证机制](#认证机制)
3. [数据模型](#数据模型)
4. [API端点](#api端点)
5. [FSRS算法说明](#fsrs算法说明)
6. [错误处理](#错误处理)
7. [示例代码](#示例代码)

---

## 概述

本文档定义了Spooky Vocab复习系统的所有API接口规范。复习系统基于FSRS (Free Spaced Repetition Scheduler) 算法实现智能间隔重复学习。

### Base URL

**开发环境**: `http://localhost:3000`  
**生产环境**: `https://api.spookyvocab.com` (待定)

### Content-Type

所有请求和响应均使用JSON格式：
```
Content-Type: application/json
```

---

## 认证机制

### JWT Token

所有API请求必须在Header中携带JWT Token：

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

JWT Payload最小字段：
```json
{
  "user_id": "string",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### 获取测试Token

```http
POST /api/auth/test-token
Content-Type: application/json

{
  "user_id": "test_user_123"
}

Response 200:
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 86400
  }
}
```

---

## 数据模型

### FSRSCard - FSRS卡片

```typescript
interface FSRSCard {
  // 基础信息
  word: string;                  // 单词
  phonetic: string;              // 音标
  translation: string;           // 主要翻译
  translations?: string[];       // 多个翻译
  definition?: string;           // 英文定义
  
  // FSRS参数
  fsrs: {
    state: CardState;            // 卡片状态 0-3
    stability: number;           // 记忆稳定性（天）
    difficulty: number;          // 难度参数 1-10
    due_date: string;            // 下次复习时间 ISO8601
    last_review: string | null;  // 最后复习时间 ISO8601
    reps: number;                // 重复次数
    lapses: number;              // 遗忘次数
    elapsed_days: number;        // 距离上次复习天数
  };
  
  // 上下文信息
  contexts?: WordContext[];      // 例句列表
  familiarity_score?: number;    // 原有熟悉度分数 0-100
}
```

### CardState - 卡片状态

```typescript
enum CardState {
  New = 0,          // 新卡片：从未复习过
  Learning = 1,     // 学习中：首次学习阶段
  Review = 2,       // 复习中：已进入长期记忆复习
  Relearning = 3    // 重新学习：遗忘后重新学习
}
```

### ReviewGrade - 复习评分

```typescript
enum ReviewGrade {
  Again = 1,    // 完全不记得，需要重新学习
  Hard = 2,     // 很难想起来，记得不牢固
  Good = 3,     // 正常记起，经过思考
  Easy = 4      // 轻松记起，不需要思考
}
```

### ReviewResult - 复习结果

```typescript
interface ReviewResult {
  word: string;                  // 单词
  grade: ReviewGrade;            // 评分
  old_state: CardState;          // 旧状态
  new_state: CardState;          // 新状态
  old_due: string;               // 旧到期时间
  new_due: string;               // 新到期时间
  next_interval_days: number;    // 下次间隔天数
  review_time: string;           // 复习时间戳
}
```

### WordContext - 单词上下文

```typescript
interface WordContext {
  id: number;
  sentence: string;              // 包含该词的句子
  url?: string;                  // 来源URL
  created_at: string;            // 创建时间
}
```

### ReviewStats - 复习统计

```typescript
interface ReviewStats {
  overview: {
    total_cards: number;         // 总卡片数
    new_cards: number;           // 新卡片数
    learning_cards: number;      // 学习中卡片数
    review_cards: number;        // 复习中卡片数
    due_today: number;           // 今日到期数
    completed_today: number;     // 今日已完成数
  };
  progress: {
    retention_rate: number;      // 保留率百分比
    average_ease: number;        // 平均难易度
    mature_cards: number;        // 成熟卡片数（stability>21天）
    young_cards: number;         // 年轻卡片数（stability≤21天）
  };
  forecast: {
    due_tomorrow: number;        // 明天到期数
    due_next_7_days: number;     // 未来7天到期数
    due_next_30_days: number;    // 未来30天到期数
  };
  activity: {
    reviews_today: number;       // 今日复习数
    reviews_this_week: number;   // 本周复习数
    reviews_this_month: number;  // 本月复习数
    study_streak_days: number;   // 连续学习天数
    total_study_days: number;    // 总学习天数
  };
  time_stats: {
    average_review_time_seconds: number;  // 平均复习时间（秒）
    total_time_today_minutes: number;     // 今日总时间（分钟）
    total_time_all_minutes: number;       // 累计总时间（分钟）
  };
}
```

---

## API端点

### 1. 获取到期复习单词

**端点**: `GET /api/sr/due`

**认证**: 需要JWT

**Query参数**:

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|-----|------|------|--------|------|
| limit | number | 否 | 20 | 返回数量，最大100 |
| offset | number | 否 | 0 | 偏移量 |
| states | string | 否 | "0,1,2,3" | 状态过滤，逗号分隔 |
| include_new | boolean | 否 | true | 是否包含新卡片 |

**请求示例**:

```http
GET /api/sr/due?limit=20&include_new=true
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应 200 - 成功**:

```json
{
  "success": true,
  "data": {
    "cards": [
      {
        "word": "ubiquitous",
        "phonetic": "/juːˈbɪkwɪtəs/",
        "translation": "无处不在的",
        "translations": ["无处不在的", "普遍存在的"],
        "definition": "present, appearing, or found everywhere",
        "fsrs": {
          "state": 2,
          "stability": 15.5,
          "difficulty": 6.2,
          "due_date": "2025-12-02T08:00:00Z",
          "last_review": "2025-11-17T10:30:00Z",
          "reps": 5,
          "lapses": 1,
          "elapsed_days": 15
        },
        "contexts": [
          {
            "id": 123,
            "sentence": "The ubiquitous nature of technology in modern society...",
            "url": "https://example.com/article",
            "created_at": "2025-11-17T10:30:00Z"
          }
        ],
        "familiarity_score": 65
      },
      {
        "word": "implement",
        "phonetic": "/ˈɪmplɪment/",
        "translation": "实施；执行；实现",
        "fsrs": {
          "state": 1,
          "stability": 2.3,
          "difficulty": 5.8,
          "due_date": "2025-12-02T09:00:00Z",
          "last_review": "2025-11-30T10:00:00Z",
          "reps": 2,
          "lapses": 0,
          "elapsed_days": 2
        },
        "contexts": [],
        "familiarity_score": 52
      }
    ],
    "counts": {
      "due": 12,       // 到期卡片数（包含已到期和今日到期）
      "new": 8,        // 新卡片数
      "learning": 3,   // 学习中卡片数
      "review": 9      // 复习中卡片数
    },
    "pagination": {
      "total": 20,
      "limit": 20,
      "offset": 0,
      "has_more": false
    }
  },
  "meta": {
    "timestamp": "2025-12-02T10:00:00Z"
  }
}
```

**响应 401 - 未授权**:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing JWT token"
  },
  "meta": {
    "timestamp": "2025-12-02T10:00:00Z"
  }
}
```

---

### 2. 提交复习结果

**端点**: `POST /api/sr/review`

**认证**: 需要JWT

**Request Body**:

```json
{
  "word": "ubiquitous",
  "grade": 3,
  "duration_seconds": 12,
  "context": "Reviewed in daily practice session"
}
```

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|-----|------|------|------|
| word | string | 是 | 复习的单词 |
| grade | number | 是 | 评分 1-4 (Again/Hard/Good/Easy) |
| duration_seconds | number | 否 | 复习耗时（秒） |
| context | string | 否 | 复习上下文信息 |

**响应 200 - 成功**:

```json
{
  "success": true,
  "data": {
    "result": {
      "word": "ubiquitous",
      "grade": 3,
      "old_state": 2,
      "new_state": 2,
      "old_due": "2025-12-02T08:00:00Z",
      "new_due": "2025-12-20T08:00:00Z",
      "next_interval_days": 18,
      "review_time": "2025-12-02T10:05:00Z"
    },
    "updated_card": {
      "state": 2,
      "stability": 18.2,
      "difficulty": 6.0,
      "due_date": "2025-12-20T08:00:00Z",
      "last_review": "2025-12-02T10:05:00Z",
      "reps": 6,
      "lapses": 1
    },
    "next_card": {
      "word": "implement",
      "phonetic": "/ˈɪmplɪment/",
      "translation": "实施；执行",
      "fsrs": {
        "state": 1,
        "stability": 2.3,
        "difficulty": 5.8,
        "due_date": "2025-12-02T09:00:00Z",
        "reps": 2
      }
    }
  },
  "meta": {
    "timestamp": "2025-12-02T10:05:00Z"
  }
}
```

**响应 400 - 无效评分**:

```json
{
  "error": {
    "code": "INVALID_GRADE",
    "message": "Grade must be 1-4 (Again/Hard/Good/Easy)",
    "details": {
      "received": 5,
      "valid_values": [1, 2, 3, 4],
      "meanings": {
        "1": "Again - 完全不记得",
        "2": "Hard - 很难想起来",
        "3": "Good - 正常记起",
        "4": "Easy - 轻松记起"
      }
    }
  },
  "meta": {
    "timestamp": "2025-12-02T10:05:00Z"
  }
}
```

**响应 404 - 单词未找到**:

```json
{
  "error": {
    "code": "WORD_NOT_FOUND",
    "message": "Word record not found for this user",
    "details": {
      "word": "nonexistentword"
    }
  }
}
```

---

### 3. 获取间隔重复统计

**端点**: `GET /api/sr/stats`

**认证**: 需要JWT

**Query参数**:

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|-----|------|------|--------|------|
| period | string | 否 | "all" | "today", "week", "month", "all" |

**请求示例**:

```http
GET /api/sr/stats?period=all
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应 200 - 成功**:

```json
{
  "success": true,
  "data": {
    "overview": {
      "total_cards": 256,
      "new_cards": 45,
      "learning_cards": 32,
      "review_cards": 179,
      "due_today": 12,
      "completed_today": 8
    },
    "progress": {
      "retention_rate": 87.5,
      "average_ease": 2.8,
      "mature_cards": 120,
      "young_cards": 59
    },
    "forecast": {
      "due_tomorrow": 15,
      "due_next_7_days": 89,
      "due_next_30_days": 234
    },
    "activity": {
      "reviews_today": 8,
      "reviews_this_week": 42,
      "reviews_this_month": 156,
      "study_streak_days": 7,
      "total_study_days": 28
    },
    "time_stats": {
      "average_review_time_seconds": 8.5,
      "total_time_today_minutes": 12,
      "total_time_all_minutes": 320
    }
  },
  "meta": {
    "period": "all",
    "timestamp": "2025-12-02T10:00:00Z"
  }
}
```

---

### 4. 重置单词进度

**端点**: `POST /api/sr/reset`

**认证**: 需要JWT

**Request Body**:

```json
{
  "word": "ubiquitous",
  "reset_type": "full"
}
```

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|-----|------|------|------|
| word | string | 是 | 要重置的单词 |
| reset_type | string | 否 | "full" 完全重置 / "keep_stats" 保留统计 |

**响应 200 - 成功**:

```json
{
  "success": true,
  "data": {
    "word": "ubiquitous",
    "reset": true,
    "new_state": 0,
    "reset_type": "full",
    "message": "Word reset to new card"
  },
  "meta": {
    "timestamp": "2025-12-02T10:10:00Z"
  }
}
```

---

### 5. 批量获取卡片信息

**端点**: `POST /api/sr/batch-info`

**认证**: 需要JWT

**Request Body**:

```json
{
  "words": ["ubiquitous", "implement", "comprehensive"]
}
```

**响应 200 - 成功**:

```json
{
  "success": true,
  "data": {
    "cards": {
      "ubiquitous": {
        "exists": true,
        "state": 2,
        "stability": 15.5,
        "difficulty": 6.2,
        "due_date": "2025-12-02T08:00:00Z",
        "is_due": true,
        "days_until_due": 0
      },
      "implement": {
        "exists": true,
        "state": 1,
        "stability": 2.3,
        "difficulty": 5.8,
        "due_date": "2025-12-03T08:00:00Z",
        "is_due": false,
        "days_until_due": 1
      },
      "comprehensive": {
        "exists": false
      }
    }
  },
  "meta": {
    "timestamp": "2025-12-02T10:00:00Z",
    "total_requested": 3,
    "total_found": 2
  }
}
```

---

## FSRS算法说明

### 算法概述

FSRS (Free Spaced Repetition Scheduler) 是一种现代化的间隔重复算法，相比传统的SM-2算法，FSRS能够更准确地预测记忆保留率。

### 核心参数

#### 1. Stability (稳定性)

表示记忆保留率降至90%所需的天数。稳定性越高，单词记得越牢固。

- 初始值：根据首次评分确定（1-4天）
- 范围：0.1天 - 36500天（100年）
- 更新：每次复习后根据评分重新计算

#### 2. Difficulty (难度)

表示单词的固有难度，范围1-10。

- 初始值：5.0（中等难度）
- 影响因素：单词本身特征、用户历史表现
- 更新：根据评分动态调整

#### 3. State (状态)

- **0 (New)**: 新卡片，从未复习
- **1 (Learning)**: 学习中，间隔<1天
- **2 (Review)**: 复习中，已进入长期记忆
- **3 (Relearning)**: 重新学习，遗忘后重新开始

### 默认参数

```javascript
const DEFAULT_FSRS_PARAMS = {
  // 17个权重参数（通过机器学习优化）
  w: [
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 
    0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61
  ],
  request_retention: 0.9,      // 目标保留率 90%
  maximum_interval: 36500,     // 最大间隔 100年
  easy_bonus: 1.3,             // Easy评分奖励系数
  hard_penalty: 0.5            // Hard评分惩罚系数
};
```

### 核心公式

#### 1. 记忆保留率 (Retrievability)

```
R = exp((t / S) * ln(0.9))
```

其中：
- R = Retrievability（记忆保留率）
- t = 距离上次复习的天数
- S = Stability（稳定性）
- 0.9 = 目标保留率

#### 2. 稳定性更新

首次学习后：
```
S_new = w[Grade-1]
```

复习后：
```
S_new = S × (exp(w[8]) × (11 - D) × S^(-w[9]) × (exp(w[10] × (1-R)) - 1) × Grade_Factor + 1)
```

其中：
- Grade_Factor: Again=0.2, Hard=0.6, Good=1.0, Easy=1.4

#### 3. 难度更新

```
D_new = D - w[6] × (Grade - 3)
D_new = max(1, min(10, D_new))
```

评分对难度的影响：
- Again (1): +2 × w[6]
- Hard (2): +1 × w[6]
- Good (3): 不变
- Easy (4): -1 × w[6]

#### 4. 下次复习间隔

```
Interval = S × (request_retention^(1/decay) - 1) / decay
```

其中：
- decay = w[11] - (D - 1) × w[12]

### 评分指南

| 评分 | 名称 | 含义 | 建议使用场景 |
|-----|------|------|-------------|
| 1 | Again | 完全不记得 | 看到单词完全没印象 |
| 2 | Hard | 很难想起 | 想了很久才想起来 |
| 3 | Good | 正常记起 | 稍作思考就想起来 |
| 4 | Easy | 轻松记起 | 立即想起，不需思考 |

### 学习阶段

#### New → Learning

首次学习时：
- Again (1): 1分钟后复习
- Hard (2): 10分钟后复习
- Good (3): 1天后复习
- Easy (4): 直接进入Review，4天后复习

#### Learning → Review

当Stability ≥ 1天时，进入Review状态

#### Review → Relearning

当评分为Again时，进入Relearning状态

---

## 错误处理

### 错误响应格式

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2025-12-02T10:00:00Z",
    "request_id": "req_abc123"
  }
}
```

### 错误码列表

#### 认证错误 (401)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|------------|
| `UNAUTHORIZED` | 缺少或无效的Authorization header | 401 |
| `INVALID_TOKEN` | JWT token无效 | 401 |
| `TOKEN_EXPIRED` | JWT token已过期 | 401 |

#### 请求错误 (400)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|------------|
| `INVALID_REQUEST` | 请求参数无效 | 400 |
| `INVALID_GRADE` | 复习评分必须是1-4 | 400 |
| `MISSING_PARAMETER` | 缺少必需参数 | 400 |
| `BATCH_SIZE_EXCEEDED` | 批量请求超过限制 | 400 |

#### 资源错误 (404)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|------------|
| `WORD_NOT_FOUND` | 单词记录不存在 | 404 |
| `USER_NOT_FOUND` | 用户不存在 | 404 |

#### 服务器错误 (500)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|------------|
| `INTERNAL_ERROR` | 服务器内部错误 | 500 |
| `DATABASE_ERROR` | 数据库错误 | 500 |
| `FSRS_CALCULATION_ERROR` | FSRS算法计算错误 | 500 |
| `DICTIONARY_UNAVAILABLE` | 词典服务不可用 | 503 |

---

## 示例代码

### JavaScript/Node.js

```javascript
// API客户端封装
class ReviewAPIClient {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers
      }
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Request failed');
    }

    return data;
  }

  // 获取到期单词
  async getDueWords(limit = 20, includeNew = true) {
    return this.request(`/api/sr/due?limit=${limit}&include_new=${includeNew}`);
  }

  // 提交复习结果
  async submitReview(word, grade, durationSeconds = null) {
    return this.request('/api/sr/review', {
      method: 'POST',
      body: JSON.stringify({
        word,
        grade,
        duration_seconds: durationSeconds
      })
    });
  }

  // 获取统计数据
  async getStats(period = 'all') {
    return this.request(`/api/sr/stats?period=${period}`);
  }

  // 重置单词
  async resetWord(word, resetType = 'full') {
    return this.request('/api/sr/reset', {
      method: 'POST',
      body: JSON.stringify({ word, reset_type: resetType })
    });
  }

  // 批量获取卡片信息
  async batchInfo(words) {
    return this.request('/api/sr/batch-info', {
      method: 'POST',
      body: JSON.stringify({ words })
    });
  }
}

// 使用示例
const client = new ReviewAPIClient('http://localhost:3000', 'your-jwt-token');

// 获取待复习单词
const dueCards = await client.getDueWords(20);
console.log(`今日待复习: ${dueCards.data.counts.due}张`);

// 提交复习
const result = await client.submitReview('ubiquitous', 3, 12);
console.log(`下次复习: ${result.data.result.new_due}`);

// 获取统计
const stats = await client.getStats();
console.log(`连续学习: ${stats.data.activity.study_streak_days}天`);
```

### Vue 3 / uni-app

```javascript
// utils/api.js
import { ref } from 'vue';

const baseURL = 'http://localhost:3000';
const token = ref('');

export const setToken = (newToken) => {
  token.value = newToken;
  uni.setStorageSync('jwt_token', newToken);
};

export const loadToken = () => {
  const savedToken = uni.getStorageSync('jwt_token');
  if (savedToken) {
    token.value = savedToken;
  }
};

const request = async (url, options = {}) => {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${baseURL}${url}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`,
        ...options.header
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error(res.data.error?.message || 'Request failed'));
        }
      },
      fail: reject
    });
  });
};

export const reviewAPI = {
  getDueWords: (limit = 20) => 
    request(`/api/sr/due?limit=${limit}`),
  
  submitReview: (word, grade, duration = null) =>
    request('/api/sr/review', {
      method: 'POST',
      data: { word, grade, duration_seconds: duration }
    }),
  
  getStats: (period = 'all') =>
    request(`/api/sr/stats?period=${period}`),
  
  resetWord: (word, resetType = 'full') =>
    request('/api/sr/reset', {
      method: 'POST',
      data: { word, reset_type: resetType }
    }),
  
  batchInfo: (words) =>
    request('/api/sr/batch-info', {
      method: 'POST',
      data: { words }
    })
};
```

### Python

```python
import requests
from typing import List, Dict, Optional

class ReviewAPIClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.token = token
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
    
    def get_due_words(self, limit: int = 20, include_new: bool = True) -> Dict:
        """获取到期复习单词"""
        url = f"{self.base_url}/api/sr/due"
        params = {'limit': limit, 'include_new': include_new}
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()
    
    def submit_review(self, word: str, grade: int, 
                     duration_seconds: Optional[int] = None) -> Dict:
        """提交复习结果"""
        url = f"{self.base_url}/api/sr/review"
        data = {
            'word': word,
            'grade': grade,
            'duration_seconds': duration_seconds
        }
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        return response.json()
    
    def get_stats(self, period: str = 'all') -> Dict:
        """获取统计数据"""
        url = f"{self.base_url}/api/sr/stats"
        params = {'period': period}
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()

# 使用示例
client = ReviewAPIClient('http://localhost:3000', 'your-jwt-token')

# 获取待复习单词
due_cards = client.get_due_words(limit=20)
print(f"今日待复习: {due_cards['data']['counts']['due']}张")

# 提交复习
result = client.submit_review('ubiquitous', 3, 12)
print(f"下次复习: {result['data']['result']['new_due']}")
```

---

## 版本控制

### API版本

当前版本: `v1.0.0`

### 变更日志

#### v1.0.0 (2025-12-02)
- 初始版本
- 实现FSRS算法核心功能
- 提供5个核心API端点
- 支持JWT认证

### 向后兼容承诺

- 新增字段不会破坏向后兼容
- 删除或修改现有字段需要发布新版本
- 废弃的API端点会提前3个月通知

---

## 安全考虑

### JWT安全

1. **Token过期时间**: 24小时
2. **刷新机制**: 支持token刷新
3. **HTTPS**: 生产环境必须使用HTTPS
4. **签名算法**: HS256 (HMAC SHA256)

### 请求限制

| 端点类型 | 限制 | 窗口期 |
|---------|------|--------|
| 认证端点 | 10次 | 1分钟 |
| 查询端点 | 100次 | 1分钟 |
| 复习端点 | 200次 | 1分钟 |

---

## 附录

### A. FSRS vs SM-2 对比

| 特性 | FSRS | SM-2 |
|-----|------|------|
| 算法年份 | 2022 | 1987 |
| 参数数量 | 17个权重参数 | 4个简单参数 |
| 准确性 | 更高（基于机器学习） | 较低 |
| 复杂度 | 较高 | 较低 |
| 适应性 | 根据用户数据动态优化 | 固定公式 |

### B. 术语表

- **Spaced Repetition**: 间隔重复，一种学习技术
- **Retrievability**: 记忆可提取性/保留率
- **Stability**: 记忆稳定性
- **Difficulty**: 单词难度
- **Card State**: 卡片状态
- **Review Grade**: 复习评分
- **Mature Card**: 成熟卡片（稳定性>21天）
- **Young Card**: 年轻卡片（稳定性≤21天）

---

*本文档遵循 [Semantic Versioning](https://semver.org/)*  
*最后更新: 2025-12-02*  
*维护者: Spooky Vocab Team*

