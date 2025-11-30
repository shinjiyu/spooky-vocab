// User routes
// Endpoints for user profile and settings

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { userDb, dbGet, dbRun } = require('../utils/database');

// Apply auth middleware
router.use(authMiddleware);

/**
 * GET /api/user/settings
 * Get user settings
 */
router.get('/settings', async (req, res) => {
  const user_id = req.user_id;

  try {
    let userSettings = await dbGet(userDb, `
      SELECT * FROM user_settings WHERE user_id = ?
    `, [user_id]);

    // If no settings exist, create default
    if (!userSettings) {
      await dbRun(userDb, `
        INSERT INTO user_settings (user_id, cefr_level)
        VALUES (?, 'B1')
      `, [user_id]);

      userSettings = {
        user_id,
        cefr_level: 'B1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    res.json({
      success: true,
      data: {
        user_id: userSettings.user_id,
        cefr_level: userSettings.cefr_level,
        created_at: userSettings.created_at,
        updated_at: userSettings.updated_at
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[User API] Error getting settings:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user settings',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/user/settings
 * Update user settings
 */
router.put('/settings', async (req, res) => {
  const user_id = req.user_id;
  const { cefr_level } = req.body;

  // Validate CEFR level
  const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  if (cefr_level && !validLevels.includes(cefr_level)) {
    return res.status(400).json({ 
      error: {
        code: 'INVALID_CEFR_LEVEL',
        message: `Invalid CEFR level. Must be one of: ${validLevels.join(', ')}`,
        details: {
          received: cefr_level,
          valid_levels: validLevels
        }
      }
    });
  }

  try {
    // Check if settings exist
    const existing = await dbGet(userDb, `
      SELECT * FROM user_settings WHERE user_id = ?
    `, [user_id]);

    if (existing) {
      // Update existing settings
      await dbRun(userDb, `
        UPDATE user_settings 
        SET cefr_level = ?,
            updated_at = datetime('now')
        WHERE user_id = ?
      `, [cefr_level || existing.cefr_level, user_id]);
    } else {
      // Create new settings
      await dbRun(userDb, `
        INSERT INTO user_settings (user_id, cefr_level)
        VALUES (?, ?)
      `, [user_id, cefr_level || 'B1']);
    }

    // Return updated settings
    const updated = await dbGet(userDb, `
      SELECT * FROM user_settings WHERE user_id = ?
    `, [user_id]);

    res.json({
      success: true,
      data: {
        user_id: updated.user_id,
        cefr_level: updated.cefr_level,
        updated_at: updated.updated_at
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[User API] Error updating settings:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update user settings',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/user/profile
 * Get user profile with statistics
 */
router.get('/profile', async (req, res) => {
  const user_id = req.user_id;

  try {
    // Get user settings
    const settings = await dbGet(userDb, `
      SELECT * FROM user_settings WHERE user_id = ?
    `, [user_id]);

    // Get word statistics
    const stats = await dbGet(userDb, `
      SELECT 
        COUNT(*) as total_words,
        SUM(CASE WHEN familiarity_score >= 80 THEN 1 ELSE 0 END) as mastered_words,
        SUM(CASE WHEN familiarity_score >= 40 AND familiarity_score < 80 THEN 1 ELSE 0 END) as learning_words,
        SUM(CASE WHEN familiarity_score < 40 THEN 1 ELSE 0 END) as difficult_words,
        SUM(encounter_count) as total_encounters,
        SUM(known_feedback_count) as total_known_feedback,
        SUM(unknown_feedback_count) as total_unknown_feedback
      FROM word_records
      WHERE user_id = ?
    `, [user_id]);

    res.json({
      success: true,
      data: {
        user_id,
        cefr_level: settings?.cefr_level || 'B1',
        statistics: {
          total_words: stats.total_words || 0,
          mastered_words: stats.mastered_words || 0,
          learning_words: stats.learning_words || 0,
          difficult_words: stats.difficult_words || 0,
          total_encounters: stats.total_encounters || 0,
          total_known_feedback: stats.total_known_feedback || 0,
          total_unknown_feedback: stats.total_unknown_feedback || 0,
          mastery_rate: stats.total_words > 0 
            ? Math.round((stats.mastered_words / stats.total_words) * 100) 
            : 0
        },
        created_at: settings?.created_at,
        updated_at: settings?.updated_at
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[User API] Error getting profile:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user profile',
        details: error.message
      }
    });
  }
});

module.exports = router;
