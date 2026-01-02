// Authentication middleware
// JWT-based authentication

const jwt = require('jsonwebtoken');

// JWT密钥 - 从环境变量读取
const JWT_SECRET = process.env.AUTH_SERVICE_JWT_SECRET || process.env.JWT_SECRET || 'your_jwt_secret_change_in_production';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  // 检查Authorization header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header. Expected: Bearer {jwt_token}'
      }
    });
  }

  // 提取JWT token
  const token = authHeader.substring(7).trim();

  if (!token) {
    return res.status(401).json({ 
      error: {
        code: 'UNAUTHORIZED',
        message: 'Empty token in Authorization header'
      }
    });
  }

  try {
    // 验证JWT token
    const decoded = jwt.verify(token, JWT_SECRET);

    // 检查必需字段 - 认证服务可能使用 id、user_id 或 sub
    const userId = decoded.user_id || decoded.id || decoded.sub;
    if (!userId) {
      return res.status(401).json({ 
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token payload missing user identifier'
        }
      });
    }

    // 检查token是否过期
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return res.status(401).json({ 
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired'
        }
      });
    }

    // 将user_id和完整payload附加到request对象
    // 兼容认证服务的不同字段名
    req.user_id = decoded.user_id || decoded.id || decoded.sub;
    req.user = decoded;

    next();

  } catch (error) {
    // JWT验证失败
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired'
        }
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token signature or format'
        }
      });
    } else {
      return res.status(500).json({ 
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error verifying token'
        }
      });
    }
  }
}

// 导出中间件和JWT_SECRET（用于生成token）
module.exports = authMiddleware;
module.exports.JWT_SECRET = JWT_SECRET;

