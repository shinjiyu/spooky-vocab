// Authentication routes
// Endpoints for JWT token management

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const { JWT_SECRET } = require('../middleware/auth');
const { userDb, dbRun, dbGet } = require('../utils/database');

/**
 * POST /api/auth/test-token
 * Generate a test JWT token (for development/testing)
 */
router.post('/test-token', async (req, res) => {
  const { user_id, cefr_level } = req.body;

  // Validate required fields
  if (!user_id) {
    return res.status(400).json({ 
      error: {
        code: 'INVALID_PARAMETERS',
        message: 'Missing required field: user_id'
      }
    });
  }

  // Validate user_id format
  if (!/^[a-zA-Z0-9_]+$/.test(user_id)) {
    return res.status(400).json({ 
      error: {
        code: 'INVALID_PARAMETERS',
        message: 'Invalid user_id format. Use alphanumeric characters and underscores only.'
      }
    });
  }

  // Validate CEFR level if provided
  if (cefr_level) {
    const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    if (!validLevels.includes(cefr_level)) {
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
  }

  try {
    // 创建或更新用户设置
    const level = cefr_level || 'B1';
    
    await dbRun(userDb, `
      INSERT INTO user_settings (user_id, cefr_level)
      VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        cefr_level = excluded.cefr_level,
        updated_at = CURRENT_TIMESTAMP
    `, [user_id, level]);

    // 生成JWT token
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 86400; // 24小时

    const payload = {
      user_id,
      cefr_level: level,
      iat: now,
      exp: now + expiresIn
    };

    const token = jwt.sign(payload, JWT_SECRET);

    // 返回token
    res.json({
      success: true,
      data: {
        token,
        user_id,
        expires_in: expiresIn,
        expires_at: new Date((now + expiresIn) * 1000).toISOString()
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating test token:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate token'
      }
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh an existing JWT token
 */
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    // 从当前token中提取信息
    const { user_id } = req.user;

    // 获取用户最新设置
    const userSettings = await dbGet(userDb, `
      SELECT cefr_level FROM user_settings WHERE user_id = ?
    `, [user_id]);

    const cefrLevel = userSettings?.cefr_level || 'B1';

    // 生成新token
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 86400; // 24小时

    const payload = {
      user_id,
      cefr_level: cefrLevel,
      iat: now,
      exp: now + expiresIn
    };

    const newToken = jwt.sign(payload, JWT_SECRET);

    // 返回新token
    res.json({
      success: true,
      data: {
        token: newToken,
        user_id,
        expires_in: expiresIn,
        expires_at: new Date((now + expiresIn) * 1000).toISOString()
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to refresh token'
      }
    });
  }
});

/**
 * GET /api/auth/verify
 * Verify current JWT token (for debugging)
 */
router.get('/verify', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      valid: true,
      user: req.user,
      user_id: req.user_id
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;

