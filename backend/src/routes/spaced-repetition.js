// Spaced Repetition API Routes
// 间隔重复复习系统API端点

const express = require('express');
const router = express.Router();
// 注意：认证已在server.js中统一处理，无需在此处重复
const fsrsService = require('../services/fsrs');
const { getCollection } = require('../utils/database');

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

    const wordRecords = getCollection('word_records');
    const now = new Date();

    // 获取各状态计数
    const countsResult = await wordRecords.aggregate([
      { $match: { user_id } },
      {
        $group: {
          _id: null,
          due: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $and: [{ $ne: ['$due_date', null] }, { $lte: ['$due_date', now] }] },
                    { $eq: ['$state', 0] }
                  ]
                },
                1,
                0
              ]
            }
          },
          new: { $sum: { $cond: [{ $eq: ['$state', 0] }, 1, 0] } },
          learning: { $sum: { $cond: [{ $eq: ['$state', 1] }, 1, 0] } },
          review: { $sum: { $cond: [{ $eq: ['$state', 2] }, 1, 0] } }
        }
      }
    ]).toArray();

    const counts = countsResult[0] || {
      due: 0,
      new: 0,
      learning: 0,
      review: 0
    };

    // 获取总数用于分页
    const query = {
      user_id,
      state: { $in: states },
      $or: [
        { due_date: null },
        { due_date: { $lte: now } }
      ]
    };
    
    if (include_new) {
      query.$or.push({ state: 0 });
    }

    const total = await wordRecords.countDocuments(query);

    res.json({
      success: true,
      data: {
        cards,
        counts: {
          due: counts.due,
          new: counts.new,
          learning: counts.learning,
          review: counts.review
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

    const wordRecords = getCollection('word_records');
    
    // 检查单词是否存在
    const existingRecord = await wordRecords.findOne({ 
      user_id, 
      word: word.toLowerCase() 
    });

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
    const updatedRecord = await wordRecords.findOne({ 
      user_id, 
      word: word.toLowerCase() 
    });

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

    const wordRecords = getCollection('word_records');
    const now = new Date();
    const cards = {};

    // 查询所有单词
    const lowerWords = words.map(w => w.toLowerCase());
    
    const records = await wordRecords
      .find({
        user_id,
        word: { $in: lowerWords }
      })
      .project({
        word: 1,
        state: 1,
        stability: 1,
        difficulty: 1,
        due_date: 1,
        reps: 1,
        lapses: 1
      })
      .toArray();

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
 * GET /api/sr/words
 * 获取用户的所有单词列表
 */
router.get('/words', async (req, res) => {
  const user_id = req.user_id;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const sort_by = req.query.sort || 'created_at'; // created_at, word, due_date, state
  const order = req.query.order === 'asc' ? 1 : -1;
  const state_filter = req.query.state; // 可选：筛选特定状态

  try {
    console.log(`[SR API] Getting all words for user ${user_id}`, { limit, offset, sort_by, order });

    const wordRecords = getCollection('word_records');
    
    // 构建查询条件
    const query = { user_id };
    if (state_filter !== undefined && state_filter !== '') {
      query.state = parseInt(state_filter);
    }

    // 获取总数
    const total = await wordRecords.countDocuments(query);

    // 构建排序
    const sortObj = {};
    sortObj[sort_by] = order;

    // 查询单词列表
    const words = await wordRecords
      .find(query)
      .sort(sortObj)
      .skip(offset)
      .limit(limit)
      .project({
        word: 1,
        state: 1,
        stability: 1,
        difficulty: 1,
        due_date: 1,
        reps: 1,
        lapses: 1,
        created_at: 1,
        last_review: 1
      })
      .toArray();

    // 丰富数据
    const now = new Date();
    const enrichedWords = words.map(w => ({
      word: w.word,
      state: w.state || 0,
      state_name: ['新卡片', '学习中', '复习中', '重新学习'][w.state] || '未知',
      stability: w.stability || 0,
      difficulty: w.difficulty || 5.0,
      due_date: w.due_date,
      is_due: w.due_date ? new Date(w.due_date) <= now : true,
      reps: w.reps || 0,
      lapses: w.lapses || 0,
      created_at: w.created_at,
      last_review: w.last_review
    }));

    res.json({
      success: true,
      data: {
        words: enrichedWords,
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
    console.error('[SR API] Error getting words:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get words',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/sr/words/:word
 * 删除单个单词（并记录到已删除列表，避免重复添加）
 */
router.delete('/words/:word', async (req, res) => {
  const user_id = req.user_id;
  const word = req.params.word.toLowerCase();

  try {
    console.log(`[SR API] Deleting word: ${word} for user ${user_id}`);

    const wordRecords = getCollection('word_records');
    const wordContexts = getCollection('word_contexts');
    const reviewLog = getCollection('review_log');
    const deletedWords = getCollection('deleted_words');

    // 检查单词是否存在
    const existingRecord = await wordRecords.findOne({ user_id, word });
    if (!existingRecord) {
      return res.status(404).json({
        error: {
          code: 'WORD_NOT_FOUND',
          message: 'Word not found in vocabulary'
        }
      });
    }

    // 将单词添加到已删除列表（避免之后重复添加）
    await deletedWords.updateOne(
      { user_id, word },
      {
        $set: {
          user_id,
          word,
          deleted_at: new Date(),
          original_data: {
            familiarity_score: existingRecord.familiarity_score,
            reps: existingRecord.reps,
            state: existingRecord.state
          }
        }
      },
      { upsert: true }
    );

    // 删除单词记录
    await wordRecords.deleteOne({ user_id, word });

    // 删除相关上下文
    const contextsResult = await wordContexts.deleteMany({ user_id, word });

    // 删除相关复习日志
    const logsResult = await reviewLog.deleteMany({ user_id, word });

    res.json({
      success: true,
      data: {
        word,
        deleted: {
          word_record: true,
          contexts: contextsResult.deletedCount,
          review_logs: logsResult.deletedCount,
          added_to_blacklist: true
        }
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[SR API] Error deleting word:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete word',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/sr/deleted
 * 获取已删除的单词列表
 */
router.get('/deleted', async (req, res) => {
  const user_id = req.user_id;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const deletedWords = getCollection('deleted_words');

    const total = await deletedWords.countDocuments({ user_id });
    const words = await deletedWords
      .find({ user_id })
      .sort({ deleted_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    res.json({
      success: true,
      data: {
        words: words.map(w => ({
          word: w.word,
          deleted_at: w.deleted_at,
          original_data: w.original_data
        })),
        pagination: { total, limit, offset, has_more: total > offset + limit }
      },
      meta: { timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('[SR API] Error getting deleted words:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get deleted words' }
    });
  }
});

/**
 * POST /api/sr/restore/:word
 * 从已删除列表恢复单词（允许重新添加）
 */
router.post('/restore/:word', async (req, res) => {
  const user_id = req.user_id;
  const word = req.params.word.toLowerCase();

  try {
    const deletedWords = getCollection('deleted_words');

    const result = await deletedWords.deleteOne({ user_id, word });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Word not in deleted list' }
      });
    }

    res.json({
      success: true,
      data: { word, restored: true },
      meta: { timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('[SR API] Error restoring word:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to restore word' }
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

    const wordContexts = getCollection('word_contexts');

    const contexts = await wordContexts
      .find({ user_id, word })
      .sort({ created_at: -1 })
      .limit(limit)
      .project({ sentence: 1, url: 1, created_at: 1, _id: 1 })
      .toArray();

    res.json({
      success: true,
      data: {
        word,
        contexts: contexts.map(c => ({
          id: c._id,
          sentence: c.sentence,
          url: c.url,
          created_at: c.created_at
        })),
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
