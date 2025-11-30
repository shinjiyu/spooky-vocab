// Authentication middleware
// Test phase: Extract plaintext user_id from Bearer token
// Future: Implement proper JWT verification

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer {user_id}'
    });
  }

  // Extract user_id from "Bearer {user_id}"
  const user_id = authHeader.substring(7).trim();

  if (!user_id) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Empty user_id in Authorization header'
    });
  }

  // Validate user_id format (alphanumeric and underscores only)
  if (!/^[a-zA-Z0-9_]+$/.test(user_id)) {
    return res.status(400).json({ 
      error: 'Bad Request',
      message: 'Invalid user_id format. Use alphanumeric characters and underscores only.'
    });
  }

  // Store user_id in request object
  req.user_id = user_id;

  next();
}

module.exports = authMiddleware;

