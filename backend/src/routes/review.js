// Review routes
// Endpoints for getting words to review

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { userDb, dbAll, dbGet } = require('../utils/database');

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
    let orderBy = 'familiarity_score ASC, last_encountered DESC';
    
    if (sort === 'recent') {
      orderBy = 'last_encountered DESC';
    } else if (sort === 'score') {
      orderBy = 'familiarity_score ASC';
    }

    // Get words with low-medium familiarity scores (need review)
    const words = await dbAll(userDb, `
      SELECT * FROM word_records
      WHERE user_id = ? AND familiarity_score < 80
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `, [user_id, limit, offset]);

    // Get total count
    const totalResult = await dbGet(userDb, `
      SELECT COUNT(*) as total FROM word_records
      WHERE user_id = ? AND familiarity_score < 80
    `, [user_id]);
    
    const total = totalResult?.total || 0;

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

    const contexts = await dbAll(userDb, `
      SELECT sentence, url, created_at
      FROM word_contexts
      WHERE user_id = ? AND word = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [user_id, lowerWord, limit]);

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
    // Total words
    const totalResult = await dbGet(userDb, `
      SELECT COUNT(*) as total_words FROM word_records
      WHERE user_id = ?
    `, [user_id]);
    
    const total_words = totalResult?.total_words || 0;

    // Known words (known_feedback_count > 0)
    const knownResult = await dbGet(userDb, `
      SELECT COUNT(*) as known_words FROM word_records
      WHERE user_id = ? AND known_feedback_count > 0
    `, [user_id]);
    
    const known_words = knownResult?.known_words || 0;

    // Mastered words (score >= 80)
    const masteredResult = await dbGet(userDb, `
      SELECT COUNT(*) as mastered FROM word_records
      WHERE user_id = ? AND familiarity_score >= 80
    `, [user_id]);
    
    const mastered = masteredResult?.mastered || 0;

    // Learning words (40 <= score < 80)
    const learningResult = await dbGet(userDb, `
      SELECT COUNT(*) as learning FROM word_records
      WHERE user_id = ? AND familiarity_score >= 40 AND familiarity_score < 80
    `, [user_id]);
    
    const learning = learningResult?.learning || 0;

    // Difficult words (score < 40)
    const difficultResult = await dbGet(userDb, `
      SELECT COUNT(*) as difficult FROM word_records
      WHERE user_id = ? AND familiarity_score < 40
    `, [user_id]);
    
    const difficult = difficultResult?.difficult || 0;

    // Words needing review
    const needsReviewResult = await dbGet(userDb, `
      SELECT COUNT(*) as needs_review FROM word_records
      WHERE user_id = ? 
        AND familiarity_score < 80
        AND (last_encountered IS NULL OR last_encountered < datetime('now', '-7 days'))
    `, [user_id]);
    
    const needs_review = needsReviewResult?.needs_review || 0;

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

module.exports = router;
