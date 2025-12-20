// Authentication routes
// Endpoints for JWT token management

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
// 注意：认证已在server.js统一网关中处理，refresh和verify端点无需重复认证
const { JWT_SECRET } = require('../middleware/auth');
const { getCollection } = require('../utils/database');

/**
 * POST /api/auth/test-token
 * [DEPRECATED] 此端点已废弃，请使用认证服务登录
 * Generate a test JWT token (for development/testing)
 * 
 * @deprecated 请使用认证服务 https://kuroneko.chat/login 进行登录
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
    const now = new Date();
    
    const userSettings = getCollection('user_settings');
    await userSettings.updateOne(
      { user_id },
      {
        $set: {
          cefr_level: level,
          updated_at: now
        },
        $setOnInsert: {
          user_id,
          created_at: now
        }
      },
      { upsert: true }
    );

    // 生成JWT token
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresIn = 86400; // 24小时

    const payload = {
      user_id,
      cefr_level: level,
      iat: nowSeconds,
      exp: nowSeconds + expiresIn
    };

    const token = jwt.sign(payload, JWT_SECRET);

    // 返回token
    res.json({
      success: true,
      data: {
        token,
        user_id,
        expires_in: expiresIn,
        expires_at: new Date((nowSeconds + expiresIn) * 1000).toISOString()
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
 * 注意：认证已在server.js统一网关中处理，无需在此处重复
 */
router.post('/refresh', async (req, res) => {
  try {
    // 从当前token中提取信息
    const { user_id } = req.user;

    // 获取用户最新设置
    const userSettings = getCollection('user_settings');
    const settings = await userSettings.findOne({ user_id });

    const cefrLevel = settings?.cefr_level || 'B1';

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
 * 注意：认证已在server.js统一网关中处理，无需在此处重复
 */
router.get('/verify', (req, res) => {
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
