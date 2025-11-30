// User routes
// Endpoints for user settings and profile

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { userDb } = require('../utils/database');

// Apply auth middleware
router.use(authMiddleware);

/**
 * GET /api/user/settings
 * Get user settings
 */
router.get('/settings', (req, res) => {
  const user_id = req.user_id;

  try {
    let settings = userDb.prepare(`
      SELECT * FROM user_settings WHERE user_id = ?
    `).get(user_id);

    if (!settings) {
      // Create default settings
      userDb.prepare(`
        INSERT INTO user_settings (user_id, cefr_level)
        VALUES (?, 'B1')
      `).run(user_id);

      settings = { user_id, cefr_level: 'B1' };
    }

    res.json(settings);
  } catch (error) {
    console.error('Error getting user settings:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
});

/**
 * PUT /api/user/settings
 * Update user settings
 */
router.put('/settings', (req, res) => {
  const user_id = req.user_id;
  const { cefr_level } = req.body;

  if (!cefr_level) {
    return res.status(400).json({ 
      error: 'Bad Request',
      message: 'Missing "cefr_level" in request body'
    });
  }

  // Validate CEFR level
  const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  if (!validLevels.includes(cefr_level)) {
    return res.status(400).json({ 
      error: 'Bad Request',
      message: `Invalid CEFR level. Must be one of: ${validLevels.join(', ')}`
    });
  }

  try {
    // Upsert settings
    userDb.prepare(`
      INSERT INTO user_settings (user_id, cefr_level, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        cefr_level = excluded.cefr_level,
        updated_at = CURRENT_TIMESTAMP
    `).run(user_id, cefr_level);

    res.json({ 
      success: true,
      cefr_level 
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
});

/**
 * GET /api/user/profile
 * Get user profile with statistics
 */
router.get('/profile', (req, res) => {
  const user_id = req.user_id;

  try {
    // Get settings
    const settings = userDb.prepare(`
      SELECT * FROM user_settings WHERE user_id = ?
    `).get(user_id);

    // Get statistics
    const { total_words } = userDb.prepare(`
      SELECT COUNT(*) as total_words FROM word_records WHERE user_id = ?
    `).get(user_id);

    const { total_encounters } = userDb.prepare(`
      SELECT SUM(encounter_count) as total_encounters FROM word_records WHERE user_id = ?
    `).get(user_id);

    const { mastered } = userDb.prepare(`
      SELECT COUNT(*) as mastered FROM word_records 
      WHERE user_id = ? AND familiarity_score >= 80
    `).get(user_id);

    res.json({
      user_id,
      settings: settings || { cefr_level: 'B1' },
      statistics: {
        total_words: total_words || 0,
        total_encounters: total_encounters || 0,
        mastered_words: mastered || 0,
        mastery_rate: total_words > 0 ? Math.round((mastered / total_words) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
});

module.exports = router;

