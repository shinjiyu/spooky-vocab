// Review routes
// Endpoints for getting words to review

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const dictionaryService = require('../services/dictionary');
const adaptiveAlgorithm = require('../services/adaptive-algorithm');
const { userDb } = require('../utils/database');

// Apply auth middleware
router.use(authMiddleware);

/**
 * GET /api/review/words
 * Get words for review
 */
router.get('/words', (req, res) => {
  const user_id = req.user_id;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  try {
    // Get words with low-medium familiarity scores (need review)
    const words = userDb.prepare(`
      SELECT * FROM word_records
      WHERE user_id = ? AND familiarity_score < 80
      ORDER BY familiarity_score ASC, last_encountered DESC
      LIMIT ? OFFSET ?
    `).all(user_id, limit, offset);

    // Get total count
    const { total } = userDb.prepare(`
      SELECT COUNT(*) as total FROM word_records
      WHERE user_id = ? AND familiarity_score < 80
    `).get(user_id);

    // Enrich with dictionary data and calculate priority
    const enrichedWords = words.map(record => {
      const dictEntry = dictionaryService.lookup(record.word);
      const priority = adaptiveAlgorithm.getReviewPriority(record);

      return {
        word: record.word,
        translation: dictEntry?.translation || '',
        phonetic: dictEntry?.phonetic || '',
        familiarity_score: record.familiarity_score,
        encounter_count: record.encounter_count,
        last_encountered: record.last_encountered,
        review_priority: Math.round(priority)
      };
    });

    // Sort by priority
    enrichedWords.sort((a, b) => b.review_priority - a.review_priority);

    res.json({
      words: enrichedWords,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error getting review words:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
});

/**
 * GET /api/review/contexts/:word
 * Get example sentences for a word
 */
router.get('/contexts/:word', (req, res) => {
  const { word } = req.params;
  const user_id = req.user_id;
  const limit = parseInt(req.query.limit) || 5;

  try {
    const lowerWord = word.toLowerCase();

    const contexts = userDb.prepare(`
      SELECT sentence, url, created_at
      FROM word_contexts
      WHERE user_id = ? AND word = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(user_id, lowerWord, limit);

    res.json({
      word: lowerWord,
      contexts
    });
  } catch (error) {
    console.error('Error getting word contexts:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
});

/**
 * GET /api/review/stats
 * Get review statistics
 */
router.get('/stats', (req, res) => {
  const user_id = req.user_id;

  try {
    // Total words
    const { total_words } = userDb.prepare(`
      SELECT COUNT(*) as total_words FROM word_records
      WHERE user_id = ?
    `).get(user_id);

    // Mastered words (score >= 80)
    const { mastered } = userDb.prepare(`
      SELECT COUNT(*) as mastered FROM word_records
      WHERE user_id = ? AND familiarity_score >= 80
    `).get(user_id);

    // Learning words (40 <= score < 80)
    const { learning } = userDb.prepare(`
      SELECT COUNT(*) as learning FROM word_records
      WHERE user_id = ? AND familiarity_score >= 40 AND familiarity_score < 80
    `).get(user_id);

    // Difficult words (score < 40)
    const { difficult } = userDb.prepare(`
      SELECT COUNT(*) as difficult FROM word_records
      WHERE user_id = ? AND familiarity_score < 40
    `).get(user_id);

    // Words needing review (not encountered in last 7 days)
    const { needs_review } = userDb.prepare(`
      SELECT COUNT(*) as needs_review FROM word_records
      WHERE user_id = ? 
        AND familiarity_score < 80
        AND (last_encountered IS NULL OR last_encountered < datetime('now', '-7 days'))
    `).get(user_id);

    res.json({
      total_words,
      mastered,
      learning,
      difficult,
      needs_review,
      mastery_rate: total_words > 0 ? Math.round((mastered / total_words) * 100) : 0
    });
  } catch (error) {
    console.error('Error getting review stats:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
});

module.exports = router;

