# Spooky Vocab API 规范文档

**版本**: v1.0.0  
**更新日期**: 2025-11-30  
**协议类型**: RESTful API  
**认证方式**: JWT (JSON Web Token)

---

## 📋 目录

1. [认证机制](#认证机制)
2. [通用规范](#通用规范)
3. [数据模型](#数据模型)
4. [API端点](#api端点)
5. [错误处理](#错误处理)
6. [状态码说明](#状态码说明)

---

## 🔐 认证机制

### JWT Token 结构

#### Header

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

#### Payload

```json
{
  "user_id": "string",           // 用户唯一标识符
  "username": "string",          // 用户名（可选）
  "email": "string",             // 邮箱（可选）
  "cefr_level": "string",        // CEFR等级 (A1-C2)
  "iat": 1234567890,             // 签发时间 (Unix timestamp)
  "exp": 1234567890              // 过期时间 (Unix timestamp)
}
```

#### 最小必需字段

```json
{
  "user_id": "uuid-or-unique-id",
  "iat": 1701234567,
  "exp": 1701320967
}
```

### 认证流程

#### 1. 获取JWT Token

**测试阶段 (Phase 1)**

```http
POST /api/auth/test-token
Content-Type: application/json

{
  "user_id": "test_user_123"
}

Response 200:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400
}
```

**生产阶段 (Phase 2) - 待实现**

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "hashed_password"
}

Response 200:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": "uuid",
    "username": "john_doe",
    "email": "user@example.com",
    "cefr_level": "B2"
  },
  "expires_in": 86400
}
```

#### 2. 使用JWT Token

所有需要认证的API请求必须在Header中携带JWT Token：

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 3. JWT验证流程

```
1. 检查Authorization header是否存在
2. 提取Bearer token
3. 验证JWT签名
4. 检查token是否过期
5. 从payload中提取user_id
6. 验证user_id有效性
7. 将user_id附加到request对象
```

#### 4. Token刷新

```http
POST /api/auth/refresh
Authorization: Bearer {old_token}

Response 200:
{
  "token": "new_jwt_token",
  "expires_in": 86400
}
```

---

## 📐 通用规范

### Base URL

**开发环境**: `http://localhost:3000`  
**生产环境**: `https://api.spookyvocab.com` (待定)

### Content-Type

所有请求和响应均使用JSON格式：

```
Content-Type: application/json
```

### 请求Header

```http
Authorization: Bearer {jwt_token}     # 必需 (除auth端点外)
Content-Type: application/json        # 必需 (POST/PUT请求)
Accept: application/json              # 可选
```

### 响应格式

#### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-11-30T10:30:00Z",
    "version": "1.0.0"
  }
}
```

#### 错误响应

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2025-11-30T10:30:00Z",
    "request_id": "req_xyz123"
  }
}
```

### 分页参数

```
?limit=20      # 每页数量 (默认20, 最大100)
?offset=0      # 偏移量 (默认0)
?page=1        # 页码 (可选, 与offset二选一)
```

### 排序参数

```
?sort=field    # 排序字段
?order=asc     # 排序方向 (asc/desc)
```

---

## 🗄️ 数据模型

### User

```typescript
interface User {
  user_id: string;              // 唯一标识符
  username?: string;            // 用户名 (可选)
  email?: string;               // 邮箱 (可选)
  cefr_level: CEFRLevel;        // CEFR等级
  created_at: string;           // ISO 8601日期
  updated_at: string;           // ISO 8601日期
}

type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
```

### WordRecord

```typescript
interface WordRecord {
  id: number;                   // 记录ID
  user_id: string;              // 用户ID (从JWT获取)
  word: string;                 // 单词 (小写)
  familiarity_score: number;    // 熟悉度分数 (0-100)
  encounter_count: number;      // 遇到次数
  known_feedback_count: number; // "认识"反馈次数
  unknown_feedback_count: number; // "不认识"反馈次数
  last_encountered: string;     // 最后遇到时间 (ISO 8601)
  created_at: string;           // 创建时间
  updated_at: string;           // 更新时间
}
```

### WordTranslation

```typescript
interface WordTranslation {
  word: string;                 // 单词原形
  phonetic: string;             // 音标
  translation: string;          // 主要翻译
  translations: string[];       // 多个翻译
  definition?: string;          // 英文定义
  frequency_rank: number;       // 词频排名
  collins_stars?: number;       // Collins星级 (0-5)
  oxford_3000?: boolean;        // 是否为Oxford 3000核心词
}
```

### WordContext

```typescript
interface WordContext {
  id: number;
  user_id: string;
  word: string;
  sentence: string;             // 包含该词的句子
  url?: string;                 // 来源URL
  created_at: string;
}
```

### VocabularyCheckResult

```typescript
interface VocabularyCheckResult {
  [word: string]: {
    needTranslation: boolean;    // 是否需要显示翻译
    translation?: string;        // 翻译 (如需要)
    phonetic?: string;           // 音标 (如需要)
    familiarity_score: number;   // 熟悉度分数
  }
}
```

### ReviewWord

```typescript
interface ReviewWord {
  word: string;
  translation: string;
  phonetic: string;
  familiarity_score: number;
  encounter_count: number;
  last_encountered: string;
  review_priority: number;      // 复习优先级 (0-100)
  contexts?: WordContext[];     // 例句
}
```

### LearningStats

```typescript
interface LearningStats {
  total_words: number;          // 总词汇量
  mastered: number;             // 已掌握 (score >= 80)
  learning: number;             // 学习中 (40 <= score < 80)
  difficult: number;            // 困难词 (score < 40)
  needs_review: number;         // 需要复习
  mastery_rate: number;         // 掌握率百分比
}
```

---

## 📡 API端点

### 1. 认证相关

#### 1.1 生成测试Token

**仅用于开发测试阶段**

```http
POST /api/auth/test-token
```

**Request Body**

```json
{
  "user_id": "string",          // 必需
  "cefr_level": "B1"            // 可选, 默认B1
}
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_id": "test_user_123",
    "expires_in": 86400,
    "expires_at": "2025-12-01T10:30:00Z"
  }
}
```

**Response 400** - 无效参数

```json
{
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Missing required field: user_id"
  }
}
```

#### 1.2 刷新Token

```http
POST /api/auth/refresh
Authorization: Bearer {current_token}
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "token": "new_jwt_token",
    "expires_in": 86400,
    "expires_at": "2025-12-01T10:30:00Z"
  }
}
```

**Response 401** - Token无效或过期

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Token expired or invalid"
  }
}
```

---

### 2. 词汇查询

#### 2.1 批量检查单词

检查多个单词是否需要显示翻译

```http
POST /api/vocabulary/batch-check
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body**

```json
{
  "words": ["string"],          // 必需, 单词数组, 最多1000个
  "include_translation": true   // 可选, 是否包含翻译, 默认true
}
```

**Example**

```json
{
  "words": ["implement", "comprehensive", "ubiquitous", "the", "is"]
}
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "implement": {
      "needTranslation": true,
      "translation": "实施；执行；实现",
      "phonetic": "/ˈɪmplɪment/",
      "familiarity_score": 45
    },
    "comprehensive": {
      "needTranslation": true,
      "translation": "全面的；综合的",
      "phonetic": "/ˌkɒmprɪˈhensɪv/",
      "familiarity_score": 52
    },
    "ubiquitous": {
      "needTranslation": true,
      "translation": "无处不在的",
      "phonetic": "/juːˈbɪkwɪtəs/",
      "familiarity_score": 30
    },
    "the": {
      "needTranslation": false,
      "familiarity_score": 100
    },
    "is": {
      "needTranslation": false,
      "familiarity_score": 100
    }
  },
  "meta": {
    "total_checked": 5,
    "needs_translation": 3,
    "timestamp": "2025-11-30T10:30:00Z"
  }
}
```

**Response 400** - 无效请求

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "words array is required and must contain 1-1000 items",
    "details": {
      "received": 0,
      "min": 1,
      "max": 1000
    }
  }
}
```

**Response 401** - 未授权

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing JWT token"
  }
}
```

#### 2.2 查询单个单词详情

```http
GET /api/vocabulary/word/{word}
Authorization: Bearer {jwt_token}
```

**URL Parameters**

- `word` (string): 要查询的单词

**Response 200**

```json
{
  "success": true,
  "data": {
    "word": "implement",
    "phonetic": "/ˈɪmplɪment/",
    "translation": "实施；执行；实现",
    "translations": [
      "实施；执行；实现",
      "贯彻；落实",
      "工具；器具"
    ],
    "definition": "to put a plan or system into operation",
    "frequency_rank": 2456,
    "collins_stars": 4,
    "oxford_3000": true,
    "user_record": {
      "familiarity_score": 45,
      "encounter_count": 3,
      "known_feedback_count": 0,
      "unknown_feedback_count": 1,
      "last_encountered": "2025-11-30T09:15:00Z"
    }
  }
}
```

**Response 404** - 单词未找到

```json
{
  "error": {
    "code": "WORD_NOT_FOUND",
    "message": "Word not found in dictionary",
    "details": {
      "word": "xyzabc"
    }
  }
}
```

---

### 3. 用户反馈

#### 3.1 标记单词为"已知"

用户点击"✓我认识"按钮时调用

```http
POST /api/feedback/known
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body**

```json
{
  "word": "string",             // 必需, 单词
  "timestamp": "ISO8601"        // 可选, 客户端时间戳
}
```

**Example**

```json
{
  "word": "implement",
  "timestamp": "2025-11-30T10:30:00Z"
}
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "word": "implement",
    "old_score": 45,
    "new_score": 60,
    "score_change": 15,
    "updated_at": "2025-11-30T10:30:00Z"
  }
}
```

**Response 400** - 无效请求

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: word"
  }
}
```

#### 3.2 标记单词为"未知"

用户主动请求翻译时调用（双击/长按）

```http
POST /api/feedback/unknown
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body**

```json
{
  "word": "string",             // 必需, 单词
  "context": "string",          // 可选, 包含该词的句子
  "url": "string",              // 可选, 页面URL
  "timestamp": "ISO8601"        // 可选, 客户端时间戳
}
```

**Example**

```json
{
  "word": "ubiquitous",
  "context": "The ubiquitous nature of technology in contemporary society...",
  "url": "https://www.example.com/article",
  "timestamp": "2025-11-30T10:30:00Z"
}
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "word": "ubiquitous",
    "old_score": 40,
    "new_score": 30,
    "score_change": -10,
    "context_saved": true,
    "updated_at": "2025-11-30T10:30:00Z"
  }
}
```

#### 3.3 记录单词遇到

用户遇到标记的单词时调用（用于统计）

```http
POST /api/feedback/encounter
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body**

```json
{
  "word": "string",             // 必需
  "timestamp": "ISO8601"        // 可选
}
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "word": "implement",
    "encounter_count": 4,
    "last_encountered": "2025-11-30T10:30:00Z"
  }
}
```

---

### 4. 复习系统

#### 4.1 获取复习单词列表

```http
GET /api/review/words
Authorization: Bearer {jwt_token}
```

**Query Parameters**

- `limit` (integer, optional): 每页数量, 默认20, 最大100
- `offset` (integer, optional): 偏移量, 默认0
- `sort` (string, optional): 排序字段, 默认priority
  - `priority` - 按优先级降序
  - `score` - 按熟悉度升序
  - `recent` - 按最近遇到时间降序
- `min_score` (integer, optional): 最小熟悉度分数, 默认0
- `max_score` (integer, optional): 最大熟悉度分数, 默认79

**Example**

```http
GET /api/review/words?limit=10&sort=priority
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "words": [
      {
        "word": "ubiquitous",
        "translation": "无处不在的",
        "phonetic": "/juːˈbɪkwɪtəs/",
        "familiarity_score": 30,
        "encounter_count": 5,
        "last_encountered": "2025-11-29T15:20:00Z",
        "review_priority": 85
      },
      {
        "word": "implement",
        "translation": "实施；执行",
        "phonetic": "/ˈɪmplɪment/",
        "familiarity_score": 60,
        "encounter_count": 4,
        "last_encountered": "2025-11-30T10:30:00Z",
        "review_priority": 65
      }
    ],
    "pagination": {
      "total": 156,
      "limit": 10,
      "offset": 0,
      "has_more": true
    }
  }
}
```

#### 4.2 获取单词例句

```http
GET /api/review/contexts/{word}
Authorization: Bearer {jwt_token}
```

**URL Parameters**

- `word` (string): 单词

**Query Parameters**

- `limit` (integer, optional): 返回数量, 默认5, 最大20

**Response 200**

```json
{
  "success": true,
  "data": {
    "word": "implement",
    "contexts": [
      {
        "id": 123,
        "sentence": "Modern companies implement comprehensive solutions...",
        "url": "https://www.example.com/article1",
        "created_at": "2025-11-30T10:30:00Z"
      },
      {
        "id": 124,
        "sentence": "It's essential to implement these changes gradually...",
        "url": "https://www.example.com/article2",
        "created_at": "2025-11-29T14:20:00Z"
      }
    ],
    "total": 5
  }
}
```

#### 4.3 获取学习统计

```http
GET /api/review/stats
Authorization: Bearer {jwt_token}
```

**Query Parameters**

- `period` (string, optional): 统计周期
  - `all` - 全部 (默认)
  - `today` - 今天
  - `week` - 本周
  - `month` - 本月

**Response 200**

```json
{
  "success": true,
  "data": {
    "total_words": 256,
    "mastered": 89,
    "learning": 115,
    "difficult": 52,
    "needs_review": 67,
    "mastery_rate": 35,
    "daily_progress": {
      "words_encountered_today": 15,
      "words_marked_known": 5,
      "new_words_learned": 3
    }
  }
}
```

---

### 5. 用户管理

#### 5.1 获取用户设置

```http
GET /api/user/settings
Authorization: Bearer {jwt_token}
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "user_id": "user123",
    "cefr_level": "B2",
    "display_name": "John Doe",
    "preferences": {
      "auto_pronounce": false,
      "show_definition": true,
      "review_reminder": true
    },
    "created_at": "2025-11-01T10:00:00Z",
    "updated_at": "2025-11-30T10:30:00Z"
  }
}
```

#### 5.2 更新用户设置

```http
PUT /api/user/settings
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body**

```json
{
  "cefr_level": "B2",           // 可选, A1-C2
  "display_name": "John Doe",   // 可选
  "preferences": {              // 可选
    "auto_pronounce": false,
    "show_definition": true,
    "review_reminder": true
  }
}
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "updated": true,
    "settings": {
      "cefr_level": "B2",
      "display_name": "John Doe",
      "preferences": {
        "auto_pronounce": false,
        "show_definition": true,
        "review_reminder": true
      },
      "updated_at": "2025-11-30T10:30:00Z"
    }
  }
}
```

**Response 400** - 无效的CEFR等级

```json
{
  "error": {
    "code": "INVALID_CEFR_LEVEL",
    "message": "Invalid CEFR level. Must be one of: A1, A2, B1, B2, C1, C2",
    "details": {
      "received": "X1",
      "valid_levels": ["A1", "A2", "B1", "B2", "C1", "C2"]
    }
  }
}
```

#### 5.3 获取用户档案

```http
GET /api/user/profile
Authorization: Bearer {jwt_token}
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "user_id": "user123",
    "username": "john_doe",
    "email": "john@example.com",
    "settings": {
      "cefr_level": "B2"
    },
    "statistics": {
      "total_words": 256,
      "total_encounters": 1523,
      "mastered_words": 89,
      "mastery_rate": 35,
      "days_active": 45,
      "current_streak": 7
    },
    "created_at": "2025-10-15T10:00:00Z",
    "last_active": "2025-11-30T10:30:00Z"
  }
}
```

---

## ⚠️ 错误处理

### 错误响应格式

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2025-11-30T10:30:00Z",
    "request_id": "req_abc123"
  }
}
```

### 错误代码列表

#### 认证错误 (401)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|------------|
| `UNAUTHORIZED` | 缺少或无效的Authorization header | 401 |
| `INVALID_TOKEN` | JWT token无效 | 401 |
| `TOKEN_EXPIRED` | JWT token已过期 | 401 |
| `INVALID_SIGNATURE` | JWT签名验证失败 | 401 |

#### 请求错误 (400)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|------------|
| `INVALID_REQUEST` | 请求参数无效 | 400 |
| `MISSING_PARAMETER` | 缺少必需参数 | 400 |
| `INVALID_CEFR_LEVEL` | 无效的CEFR等级 | 400 |
| `BATCH_SIZE_EXCEEDED` | 批量请求超过限制 | 400 |

#### 资源错误 (404)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|------------|
| `WORD_NOT_FOUND` | 单词未在词典中找到 | 404 |
| `USER_NOT_FOUND` | 用户不存在 | 404 |
| `RESOURCE_NOT_FOUND` | 资源未找到 | 404 |

#### 服务器错误 (500)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|------------|
| `INTERNAL_ERROR` | 服务器内部错误 | 500 |
| `DATABASE_ERROR` | 数据库错误 | 500 |
| `DICTIONARY_UNAVAILABLE` | 词典服务不可用 | 503 |

---

## 📊 状态码说明

| HTTP状态码 | 说明 | 使用场景 |
|-----------|------|----------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 认证失败 |
| 403 | Forbidden | 权限不足 |
| 404 | Not Found | 资源未找到 |
| 429 | Too Many Requests | 请求过于频繁 |
| 500 | Internal Server Error | 服务器错误 |
| 503 | Service Unavailable | 服务不可用 |

---

## 🔄 版本控制

### API版本

当前版本: `v1.0.0`

版本号通过URL路径指定（未来）：

```
https://api.spookyvocab.com/v1/...
https://api.spookyvocab.com/v2/...  (未来版本)
```

### 向后兼容

- 新增字段不会破坏向后兼容
- 删除或修改现有字段需要发布新版本
- 废弃的API端点会提前3个月通知

---

## 🔒 安全考虑

### JWT安全

1. **Token过期时间**: 24小时
2. **刷新机制**: 支持token刷新，避免频繁登录
3. **HTTPS**: 生产环境必须使用HTTPS
4. **签名算法**: HS256 (HMAC SHA256)

### 请求限制

| 端点类型 | 限制 | 窗口期 |
|---------|------|--------|
| 认证端点 | 10次 | 1分钟 |
| 查询端点 | 100次 | 1分钟 |
| 反馈端点 | 200次 | 1分钟 |

### 数据验证

- 所有输入必须经过验证和清理
- SQL注入防护
- XSS防护
- CSRF防护（生产环境）

---

## 📝 更新日志

### v1.0.0 (2025-11-30)

- 初始API规范
- JWT认证机制
- 词汇查询端点
- 用户反馈端点
- 复习系统端点
- 用户管理端点

---

## 📧 联系方式

**技术支持**: support@spookyvocab.com  
**API问题**: api@spookyvocab.com  
**文档反馈**: docs@spookyvocab.com

---

*本文档遵循 [Semantic Versioning](https://semver.org/)*  
*最后更新: 2025-11-30*

