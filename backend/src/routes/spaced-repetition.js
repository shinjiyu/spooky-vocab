// Spaced Repetition API Routes
// 间隔重复复习系统API端点

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const fsrsService = require('../services/fsrs');
const { userDb, dbAll, dbGet, dbRun } = require('../utils/database');

// 应用认证中间件
router.use(authMiddleware);

/**
 * GET /api/sr/due
 * 获取到期复习单词列表
 */
router.get('/due', async (req, res) => {
  const user_id = req.user_id;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  const statesParam = req.query.states || '0,1,2,3';
  const include_new = req.query.include_new !== 'false';

  // 解析状态过滤
  const states = statesParam.split(',').map(s => parseInt(s.trim())).filter(s => s >= 0 && s <= 3);

  try {
    console.log(`[SR API] Getting due words for user ${user_id}`, {
      limit,
      offset,
      states,
      include_new
    });

    // 获取到期卡片
    const cards = await fsrsService.getDueCards(user_id, {
      limit,
      offset,
      states,
      include_new
    });

    // 获取各状态计数
    const now = new Date().toISOString();
    const counts = await dbGet(userDb, `
      SELECT 
        SUM(CASE WHEN (due_date IS NOT NULL AND due_date <= ?) OR state = 0 THEN 1 ELSE 0 END) as due,
        SUM(CASE WHEN state = 0 THEN 1 ELSE 0 END) as new,
        SUM(CASE WHEN state = 1 THEN 1 ELSE 0 END) as learning,
        SUM(CASE WHEN state = 2 THEN 1 ELSE 0 END) as review
      FROM word_records
      WHERE user_id = ?
    `, [now, user_id]);

    // 获取总数用于分页
    const totalResult = await dbGet(userDb, `
      SELECT COUNT(*) as total FROM word_records
      WHERE user_id = ?
        AND state IN (${states.join(',')})
        AND (
          due_date IS NULL 
          OR due_date <= ?
          ${include_new ? 'OR state = 0' : ''}
        )
    `, [user_id, now]);

    const total = totalResult?.total || 0;

    res.json({
      success: true,
      data: {
        cards,
        counts: {
          due: counts.due || 0,
          new: counts.new || 0,
          learning: counts.learning || 0,
          review: counts.review || 0
        },
        pagination: {
          total,
          limit,
          offset,
          has_more: total > offset + limit
        }
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[SR API] Error getting due words:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get due words',
        details: error.message
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/sr/review
 * 提交复习结果
 */
router.post('/review', async (req, res) => {
  const user_id = req.user_id;
  const { word, grade, duration_seconds, context } = req.body;

  // 验证参数
  if (!word) {
    return res.status(400).json({
      error: {
        code: 'MISSING_PARAMETER',
        message: 'Missing required field: word'
      }
    });
  }

  if (!grade || grade < 1 || grade > 4) {
    return res.status(400).json({
      error: {
        code: 'INVALID_GRADE',
        message: 'Grade must be 1-4 (Again/Hard/Good/Easy)',
        details: {
          received: grade,
          valid_values: [1, 2, 3, 4],
          meanings: {
            '1': 'Again - 完全不记得',
            '2': 'Hard - 很难想起来',
            '3': 'Good - 正常记起',
            '4': 'Easy - 轻松记起'
          }
        }
      }
    });
  }

  try {
    console.log(`[SR API] Reviewing word: ${word}, grade: ${grade}, user: ${user_id}`);

    // 检查单词是否存在
    const existingRecord = await dbGet(userDb, `
      SELECT * FROM word_records WHERE user_id = ? AND word = ?
    `, [user_id, word.toLowerCase()]);

    if (!existingRecord) {
      return res.status(404).json({
        error: {
          code: 'WORD_NOT_FOUND',
          message: 'Word record not found for this user',
          details: {
            word: word
          }
        }
      });
    }

    // 复习卡片
    const result = await fsrsService.reviewCard(user_id, word.toLowerCase(), grade, duration_seconds);

    // 获取完整的更新后卡片信息
    const updatedRecord = await dbGet(userDb, `
      SELECT * FROM word_records WHERE user_id = ? AND word = ?
    `, [user_id, word.toLowerCase()]);

    const enrichedCard = await fsrsService.enrichCardData(updatedRecord, user_id);

    // 获取下一张卡片（可选）
    const nextCards = await fsrsService.getDueCards(user_id, { limit: 1, offset: 0 });
    const next_card = nextCards.length > 0 ? nextCards[0] : null;

    res.json({
      success: true,
      data: {
        result: {
          word: word.toLowerCase(),
          grade: grade,
          old_state: result.old_state,
          new_state: result.new_state,
          old_due: result.old_due,
          new_due: result.new_due,
          next_interval_days: result.next_interval_days,
          review_time: new Date().toISOString()
        },
        updated_card: enrichedCard.fsrs,
        next_card: next_card
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[SR API] Error reviewing word:', error);
    
    if (error.message === 'Word record not found') {
      return res.status(404).json({
        error: {
          code: 'WORD_NOT_FOUND',
          message: error.message
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'FSRS_CALCULATION_ERROR',
        message: 'Failed to process review',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/sr/stats
 * 获取间隔重复统计数据
 */
router.get('/stats', async (req, res) => {
  const user_id = req.user_id;
  const period = req.query.period || 'all';

  try {
    console.log(`[SR API] Getting stats for user ${user_id}, period: ${period}`);

    const stats = await fsrsService.getStats(user_id, period);

    res.json({
      success: true,
      data: stats,
      meta: {
        period,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[SR API] Error getting stats:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get statistics',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/sr/reset
 * 重置单词进度
 */
router.post('/reset', async (req, res) => {
  const user_id = req.user_id;
  const { word, reset_type = 'full' } = req.body;

  if (!word) {
    return res.status(400).json({
      error: {
        code: 'MISSING_PARAMETER',
        message: 'Missing required field: word'
      }
    });
  }

  if (!['full', 'keep_stats'].includes(reset_type)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_PARAMETER',
        message: 'reset_type must be "full" or "keep_stats"'
      }
    });
  }

  try {
    console.log(`[SR API] Resetting word: ${word}, type: ${reset_type}`);

    const result = await fsrsService.resetCard(user_id, word.toLowerCase(), reset_type);

    res.json({
      success: true,
      data: {
        word: result.word,
        reset: result.reset,
        new_state: result.new_state,
        reset_type: result.reset_type,
        message: 'Word reset to new card'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[SR API] Error resetting word:', error);
    
    if (error.message === 'Word record not found') {
      return res.status(404).json({
        error: {
          code: 'WORD_NOT_FOUND',
          message: error.message
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reset word',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/sr/batch-info
 * 批量获取卡片信息
 */
router.post('/batch-info', async (req, res) => {
  const user_id = req.user_id;
  const { words } = req.body;

  if (!words || !Array.isArray(words) || words.length === 0) {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'words array is required and must not be empty'
      }
    });
  }

  if (words.length > 100) {
    return res.status(400).json({
      error: {
        code: 'BATCH_SIZE_EXCEEDED',
        message: 'Maximum 100 words per batch request',
        details: {
          received: words.length,
          maximum: 100
        }
      }
    });
  }

  try {
    console.log(`[SR API] Batch info for ${words.length} words`);

    const now = new Date();
    const cards = {};

    // 查询所有单词
    const placeholders = words.map(() => '?').join(',');
    const lowerWords = words.map(w => w.toLowerCase());
    
    const records = await dbAll(userDb, `
      SELECT word, state, stability, difficulty, due_date, reps, lapses
      FROM word_records
      WHERE user_id = ? AND word IN (${placeholders})
    `, [user_id, ...lowerWords]);

    // 构建结果映射
    const recordMap = {};
    records.forEach(r => {
      recordMap[r.word] = r;
    });

    // 处理每个单词
    for (const word of lowerWords) {
      const record = recordMap[word];
      
      if (!record) {
        cards[word] = {
          exists: false
        };
      } else {
        const due_date = record.due_date ? new Date(record.due_date) : null;
        const is_due = due_date ? due_date <= now : true;
        const days_until_due = due_date ? Math.ceil((due_date - now) / (1000 * 60 * 60 * 24)) : 0;

        cards[word] = {
          exists: true,
          state: record.state || 0,
          stability: record.stability || 0,
          difficulty: record.difficulty || 5.0,
          due_date: record.due_date,
          is_due,
          days_until_due: Math.max(0, days_until_due)
        };
      }
    }

    res.json({
      success: true,
      data: {
        cards
      },
      meta: {
        timestamp: now.toISOString(),
        total_requested: words.length,
        total_found: records.length
      }
    });
  } catch (error) {
    console.error('[SR API] Error getting batch info:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get batch info',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/sr/contexts/:word
 * 获取单词的例句上下文
 */
router.get('/contexts/:word', async (req, res) => {
  const user_id = req.user_id;
  const word = req.params.word.toLowerCase();
  const limit = Math.min(parseInt(req.query.limit) || 5, 20);

  try {
    console.log(`[SR API] Getting contexts for word: ${word}`);

    const contexts = await dbAll(userDb, `
      SELECT id, sentence, url, created_at
      FROM word_contexts
      WHERE user_id = ? AND word = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [user_id, word, limit]);

    res.json({
      success: true,
      data: {
        word,
        contexts,
        total: contexts.length
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[SR API] Error getting contexts:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get contexts',
        details: error.message
      }
    });
  }
});

module.exports = router;

