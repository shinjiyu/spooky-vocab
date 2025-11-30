// Feedback routes
// Endpoints for user feedback (known/unknown words)

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { userDb, dbGet, dbRun } = require('../utils/database');

// Apply auth middleware
router.use(authMiddleware);

/**
 * POST /api/feedback/known
 * Mark a word as known by the user
 */
router.post('/known', async (req, res) => {
  const { word, timestamp } = req.body;
  const user_id = req.user_id;

  if (!word) {
    return res.status(400).json({ 
      error: {
        code: 'INVALID_PARAMETERS',
        message: 'Missing required field: word'
      }
    });
  }

  try {
    const lowerWord = word.toLowerCase();

    // Get or create word record
    let wordRecord = await dbGet(userDb, `
      SELECT * FROM word_records 
      WHERE user_id = ? AND word = ?
    `, [user_id, lowerWord]);

    if (!wordRecord) {
      // Create new record with high score
      await dbRun(userDb, `
        INSERT INTO word_records (
          user_id, word, familiarity_score, 
          known_feedback_count, encounter_count,
          last_encountered, updated_at
        ) VALUES (?, ?, ?, 1, 0, datetime('now'), datetime('now'))
      `, [user_id, lowerWord, 80]);
    } else {
      // Update existing record
      const newScore = Math.min(100, wordRecord.familiarity_score + 15);
      
      await dbRun(userDb, `
        UPDATE word_records 
        SET familiarity_score = ?,
            known_feedback_count = known_feedback_count + 1,
            last_encountered = datetime('now'),
            updated_at = datetime('now')
        WHERE user_id = ? AND word = ?
      `, [newScore, user_id, lowerWord]);
    }

    res.json({
      success: true,
      data: {
        word: lowerWord,
        action: 'marked_as_known'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Feedback API] Error marking word as known:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark word as known',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/feedback/unknown
 * Mark a word as unknown by the user (user requested translation)
 */
router.post('/unknown', async (req, res) => {
  const { word, context, url, timestamp } = req.body;
  const user_id = req.user_id;

  if (!word) {
    return res.status(400).json({ 
      error: {
        code: 'INVALID_PARAMETERS',
        message: 'Missing required field: word'
      }
    });
  }

  try {
    const lowerWord = word.toLowerCase();

    // Get or create word record
    let wordRecord = await dbGet(userDb, `
      SELECT * FROM word_records 
      WHERE user_id = ? AND word = ?
    `, [user_id, lowerWord]);

    if (!wordRecord) {
      // Create new record with low score
      await dbRun(userDb, `
        INSERT INTO word_records (
          user_id, word, familiarity_score, 
          unknown_feedback_count, encounter_count,
          last_encountered, updated_at
        ) VALUES (?, ?, ?, 1, 0, datetime('now'), datetime('now'))
      `, [user_id, lowerWord, 30]);
    } else {
      // Update existing record
      const newScore = Math.max(0, wordRecord.familiarity_score - 10);
      
      await dbRun(userDb, `
        UPDATE word_records 
        SET familiarity_score = ?,
            unknown_feedback_count = unknown_feedback_count + 1,
            last_encountered = datetime('now'),
            updated_at = datetime('now')
        WHERE user_id = ? AND word = ?
      `, [newScore, user_id, lowerWord]);
    }

    // Save context if provided
    if (context) {
      await dbRun(userDb, `
        INSERT INTO word_contexts (user_id, word, sentence, url)
        VALUES (?, ?, ?, ?)
      `, [user_id, lowerWord, context, url || '']);
    }

    res.json({
      success: true,
      data: {
        word: lowerWord,
        action: 'marked_as_unknown'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Feedback API] Error marking word as unknown:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark word as unknown',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/feedback/encounter
 * Record that user encountered a word
 */
router.post('/encounter', async (req, res) => {
  const { word, timestamp } = req.body;
  const user_id = req.user_id;

  if (!word) {
    return res.status(400).json({ 
      error: {
        code: 'INVALID_PARAMETERS',
        message: 'Missing required field: word'
      }
    });
  }

  try {
    const lowerWord = word.toLowerCase();

    // Get or create word record
    let wordRecord = await dbGet(userDb, `
      SELECT * FROM word_records 
      WHERE user_id = ? AND word = ?
    `, [user_id, lowerWord]);

    if (!wordRecord) {
      // Create new record
      await dbRun(userDb, `
        INSERT INTO word_records (
          user_id, word, familiarity_score, 
          encounter_count, last_encountered, updated_at
        ) VALUES (?, ?, 50, 1, datetime('now'), datetime('now'))
      `, [user_id, lowerWord]);
    } else {
      // Update encounter count and slight score increase
      const newScore = Math.min(100, wordRecord.familiarity_score + 2);
      
      await dbRun(userDb, `
        UPDATE word_records 
        SET encounter_count = encounter_count + 1,
            familiarity_score = ?,
            last_encountered = datetime('now'),
            updated_at = datetime('now')
        WHERE user_id = ? AND word = ?
      `, [newScore, user_id, lowerWord]);
    }

    res.json({
      success: true,
      data: {
        word: lowerWord,
        action: 'encounter_recorded'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Feedback API] Error recording encounter:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to record encounter',
        details: error.message
      }
    });
  }
});

module.exports = router;
