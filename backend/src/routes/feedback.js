// Feedback routes
// Endpoints for user feedback (known/unknown words)

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adaptiveAlgorithm = require('../services/adaptive-algorithm');
const { userDb } = require('../utils/database');

// Apply auth middleware
router.use(authMiddleware);

/**
 * POST /api/feedback/known
 * Mark a word as known
 */
router.post('/known', (req, res) => {
  const { word } = req.body;
  const user_id = req.user_id;

  if (!word) {
    return res.status(400).json({ 
      error: 'Bad Request',
      message: 'Missing "word" in request body'
    });
  }

  try {
    const lowerWord = word.toLowerCase();

    // Get current record
    let wordRecord = userDb.prepare(`
      SELECT * FROM word_records 
      WHERE user_id = ? AND word = ?
    `).get(user_id, lowerWord);

    if (!wordRecord) {
      // Create new record if doesn't exist
      const initialScore = adaptiveAlgorithm.calculateInitialScore(lowerWord);
      
      userDb.prepare(`
        INSERT INTO word_records (user_id, word, familiarity_score, known_feedback_count)
        VALUES (?, ?, ?, 1)
      `).run(user_id, lowerWord, initialScore);

      wordRecord = { 
        familiarity_score: initialScore,
        known_feedback_count: 1
      };
    }

    // Update score
    const newScore = adaptiveAlgorithm.updateScore(
      wordRecord.familiarity_score,
      'known',
      { known_feedback_count: wordRecord.known_feedback_count + 1 }
    );

    // Update database
    userDb.prepare(`
      UPDATE word_records 
      SET familiarity_score = ?,
          known_feedback_count = known_feedback_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND word = ?
    `).run(newScore, user_id, lowerWord);

    res.json({
      success: true,
      word: lowerWord,
      old_score: wordRecord.familiarity_score,
      new_score: newScore
    });
  } catch (error) {
    console.error('Error in mark known:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
});

/**
 * POST /api/feedback/unknown
 * Mark a word as unknown (user requested translation)
 */
router.post('/unknown', (req, res) => {
  const { word, context, url } = req.body;
  const user_id = req.user_id;

  if (!word) {
    return res.status(400).json({ 
      error: 'Bad Request',
      message: 'Missing "word" in request body'
    });
  }

  try {
    const lowerWord = word.toLowerCase();

    // Get or create record
    let wordRecord = userDb.prepare(`
      SELECT * FROM word_records 
      WHERE user_id = ? AND word = ?
    `).get(user_id, lowerWord);

    if (!wordRecord) {
      const initialScore = adaptiveAlgorithm.calculateInitialScore(lowerWord);
      
      userDb.prepare(`
        INSERT INTO word_records (user_id, word, familiarity_score, unknown_feedback_count, last_encountered)
        VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
      `).run(user_id, lowerWord, initialScore);

      wordRecord = { 
        familiarity_score: initialScore,
        unknown_feedback_count: 1
      };
    }

    // Update score
    const newScore = adaptiveAlgorithm.updateScore(
      wordRecord.familiarity_score,
      'unknown'
    );

    // Update database
    userDb.prepare(`
      UPDATE word_records 
      SET familiarity_score = ?,
          unknown_feedback_count = unknown_feedback_count + 1,
          encounter_count = encounter_count + 1,
          last_encountered = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND word = ?
    `).run(newScore, user_id, lowerWord);

    // Save context if provided
    if (context) {
      userDb.prepare(`
        INSERT INTO word_contexts (user_id, word, sentence, url)
        VALUES (?, ?, ?, ?)
      `).run(user_id, lowerWord, context, url || null);
    }

    res.json({
      success: true,
      word: lowerWord,
      old_score: wordRecord.familiarity_score,
      new_score: newScore
    });
  } catch (error) {
    console.error('Error in mark unknown:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
});

/**
 * POST /api/feedback/encounter
 * Record that user encountered a word (for statistics)
 */
router.post('/encounter', (req, res) => {
  const { word } = req.body;
  const user_id = req.user_id;

  if (!word) {
    return res.status(400).json({ 
      error: 'Bad Request',
      message: 'Missing "word" in request body'
    });
  }

  try {
    const lowerWord = word.toLowerCase();

    // Update encounter count
    userDb.prepare(`
      UPDATE word_records 
      SET encounter_count = encounter_count + 1,
          last_encountered = CURRENT_TIMESTAMP
      WHERE user_id = ? AND word = ?
    `).run(user_id, lowerWord);

    res.json({ success: true });
  } catch (error) {
    console.error('Error in record encounter:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
});

module.exports = router;

