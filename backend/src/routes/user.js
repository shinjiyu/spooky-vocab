// User routes
// Endpoints for user profile and settings

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getCollection } = require('../utils/database');
const { getOrCreateUserSettings } = require('../utils/mongo-helpers');

// Apply auth middleware
router.use(authMiddleware);

/**
 * GET /api/user/settings
 * Get user settings
 */
router.get('/settings', async (req, res) => {
  const user_id = req.user_id;

  try {
    const userSettings = getCollection('user_settings');
    let settings = await userSettings.findOne({ user_id });

    // If no settings exist, create default
    if (!settings) {
      const now = new Date();
      settings = {
        user_id,
        cefr_level: 'B1',
        created_at: now,
        updated_at: now
      };
      await userSettings.insertOne(settings);
    }

    res.json({
      success: true,
      data: {
        user_id: settings.user_id,
        cefr_level: settings.cefr_level,
        created_at: settings.created_at,
        updated_at: settings.updated_at
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
    const userSettings = getCollection('user_settings');
    const now = new Date();

    // Upsert settings
    await userSettings.updateOne(
      { user_id },
      {
        $set: {
          cefr_level: cefr_level || 'B1',
          updated_at: now
        },
        $setOnInsert: {
          user_id,
          created_at: now
        }
      },
      { upsert: true }
    );

    // Return updated settings
    const updated = await userSettings.findOne({ user_id });

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
    const userSettings = getCollection('user_settings');
    const wordRecords = getCollection('word_records');

    // Get user settings
    const settings = await userSettings.findOne({ user_id });

    // Get word statistics using aggregation
    const statsResult = await wordRecords.aggregate([
      { $match: { user_id } },
      {
        $group: {
          _id: null,
          total_words: { $sum: 1 },
          mastered_words: {
            $sum: {
              $cond: [{ $gte: ['$familiarity_score', 80] }, 1, 0]
            }
          },
          learning_words: {
            $sum: {
              $cond: [
                { $and: [
                  { $gte: ['$familiarity_score', 40] },
                  { $lt: ['$familiarity_score', 80] }
                ]},
                1,
                0
              ]
            }
          },
          difficult_words: {
            $sum: {
              $cond: [{ $lt: ['$familiarity_score', 40] }, 1, 0]
            }
          },
          total_encounters: { $sum: '$encounter_count' },
          total_known_feedback: { $sum: '$known_feedback_count' },
          total_unknown_feedback: { $sum: '$unknown_feedback_count' }
        }
      }
    ]).toArray();

    const stats = statsResult[0] || {
      total_words: 0,
      mastered_words: 0,
      learning_words: 0,
      difficult_words: 0,
      total_encounters: 0,
      total_known_feedback: 0,
      total_unknown_feedback: 0
    };

    res.json({
      success: true,
      data: {
        user_id,
        cefr_level: settings?.cefr_level || 'B1',
        statistics: {
          total_words: stats.total_words,
          mastered_words: stats.mastered_words,
          learning_words: stats.learning_words,
          difficult_words: stats.difficult_words,
          total_encounters: stats.total_encounters,
          total_known_feedback: stats.total_known_feedback,
          total_unknown_feedback: stats.total_unknown_feedback,
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
