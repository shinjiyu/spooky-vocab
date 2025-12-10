// Review routes
// Endpoints for getting words to review

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getCollection } = require('../utils/database');
const { buildSort } = require('../utils/mongo-helpers');

// Apply auth middleware
router.use(authMiddleware);

/**
 * GET /api/review/words
 * Get words for review
 */
router.get('/words', async (req, res) => {
  const user_id = req.user_id;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  const sort = req.query.sort || 'priority'; // priority, recent, score

  try {
    const wordRecords = getCollection('word_records');
    
    // Build sort object
    const sortObj = buildSort(sort);

    // Get words with low-medium familiarity scores (need review)
    const words = await wordRecords
      .find({
        user_id,
        familiarity_score: { $lt: 80 }
      })
      .sort(sortObj)
      .skip(offset)
      .limit(limit)
      .toArray();

    // Get total count
    const total = await wordRecords.countDocuments({
      user_id,
      familiarity_score: { $lt: 80 }
    });

    // Format response
    const formattedWords = words.map(record => ({
      word: record.word,
      familiarity_score: record.familiarity_score,
      encounter_count: record.encounter_count,
      known_feedback_count: record.known_feedback_count,
      unknown_feedback_count: record.unknown_feedback_count,
      last_encountered: record.last_encountered
    }));

    res.json({
      success: true,
      data: {
        words: formattedWords,
        total,
        limit,
        offset
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Review API] Error getting review words:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get review words',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/review/contexts/:word
 * Get example sentences for a word
 */
router.get('/contexts/:word', async (req, res) => {
  const { word } = req.params;
  const user_id = req.user_id;
  const limit = parseInt(req.query.limit) || 5;

  try {
    const lowerWord = word.toLowerCase();
    const wordContexts = getCollection('word_contexts');

    const contexts = await wordContexts
      .find({
        user_id,
        word: lowerWord
      })
      .sort({ created_at: -1 })
      .limit(limit)
      .project({ sentence: 1, url: 1, created_at: 1, _id: 0 })
      .toArray();

    res.json({
      success: true,
      data: {
        word: lowerWord,
        contexts
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Review API] Error getting word contexts:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get word contexts',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/review/stats
 * Get review statistics
 */
router.get('/stats', async (req, res) => {
  const user_id = req.user_id;
  const period = req.query.period || 'all'; // all, today, week, month

  try {
    const wordRecords = getCollection('word_records');

    // Calculate various statistics using aggregation
    const stats = await wordRecords.aggregate([
      { $match: { user_id } },
      {
        $facet: {
          total: [
            { $count: 'count' }
          ],
          known: [
            { $match: { known_feedback_count: { $gt: 0 } } },
            { $count: 'count' }
          ],
          mastered: [
            { $match: { familiarity_score: { $gte: 80 } } },
            { $count: 'count' }
          ],
          learning: [
            { $match: { familiarity_score: { $gte: 40, $lt: 80 } } },
            { $count: 'count' }
          ],
          difficult: [
            { $match: { familiarity_score: { $lt: 40 } } },
            { $count: 'count' }
          ],
          needs_review: [
            {
              $match: {
                familiarity_score: { $lt: 80 },
                $or: [
                  { last_encountered: null },
                  { last_encountered: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
                ]
              }
            },
            { $count: 'count' }
          ]
        }
      }
    ]).toArray();

    const result = stats[0];
    const total_words = result.total[0]?.count || 0;
    const known_words = result.known[0]?.count || 0;
    const mastered = result.mastered[0]?.count || 0;
    const learning = result.learning[0]?.count || 0;
    const difficult = result.difficult[0]?.count || 0;
    const needs_review = result.needs_review[0]?.count || 0;

    res.json({
      success: true,
      data: {
        total_words,
        known_words,
        mastered,
        learning,
        difficult,
        needs_review,
        mastery_rate: total_words > 0 ? Math.round((mastered / total_words) * 100) : 0
      },
      meta: {
        period,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Review API] Error getting review stats:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get review stats',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/review/reset
 * 重置用户的所有学习记录
 */
router.delete('/reset', async (req, res) => {
  const user_id = req.user_id;
  const { confirm } = req.query;

  // 需要确认参数以防止误操作
  if (confirm !== 'true') {
    return res.status(400).json({
      error: {
        code: 'CONFIRMATION_REQUIRED',
        message: 'Add ?confirm=true to confirm deletion'
      }
    });
  }

  try {
    const wordRecords = getCollection('word_records');
    const wordContexts = getCollection('word_contexts');
    const reviewLog = getCollection('review_log');

    // 删除用户的所有词汇记录
    const wordsResult = await wordRecords.deleteMany({ user_id });
    
    // 删除用户的所有上下文记录
    const contextsResult = await wordContexts.deleteMany({ user_id });
    
    // 删除用户的复习日志
    const logsResult = await reviewLog.deleteMany({ user_id });

    console.log(`[Review API] Reset learning data for user ${user_id}:`, {
      words_deleted: wordsResult.deletedCount,
      contexts_deleted: contextsResult.deletedCount,
      logs_deleted: logsResult.deletedCount
    });

    res.json({
      success: true,
      data: {
        words_deleted: wordsResult.deletedCount,
        contexts_deleted: contextsResult.deletedCount,
        logs_deleted: logsResult.deletedCount
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Review API] Error resetting learning data:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reset learning data',
        details: error.message
      }
    });
  }
});

module.exports = router;
