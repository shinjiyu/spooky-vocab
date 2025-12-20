// Spooky Vocab Backend Server
// Express + MongoDB API server for vocabulary learning

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import database connection
const { connectDatabase } = require('./utils/database');
const { initDatabase } = require('./utils/init-db');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 静态文件服务（复习界面）
app.use('/review', express.static(path.join(__dirname, '../public')));

// 静态文件服务（公共页面：隐私政策等）
app.use('/public', express.static(path.join(__dirname, '../public')));

// ============ 统一认证网关 ============
// 不需要认证的公开路径
const publicPaths = [
  '/health',
  // 注意：test-token端点已移除，如需开发测试请使用认证服务
];

// 统一认证中间件 - 所有API路径都需要认证（除了公开路径）
app.use((req, res, next) => {
  // 检查是否为公开路径
  const isPublicPath = publicPaths.some(path => req.path === path || req.path.startsWith(path + '/'));
  
  if (isPublicPath) {
    return next();
  }
  
  // API路径都需要认证
  if (req.path.startsWith('/api/')) {
    return authMiddleware(req, res, next);
  }
  
  // 其他路径（如静态文件）不需要认证
  next();
});
// ============ End 统一认证网关 ============

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'spookyvocab-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
const authRoutes = require('./routes/auth');
const vocabularyRoutes = require('./routes/vocabulary');
const feedbackRoutes = require('./routes/feedback');
const reviewRoutes = require('./routes/review');
const userRoutes = require('./routes/user');
const srRoutes = require('./routes/spaced-repetition');

app.use('/api/auth', authRoutes);
app.use('/api/vocabulary', vocabularyRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/user', userRoutes);
app.use('/api/sr', srRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message 
  });
});

// Start server with database initialization
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDatabase();
    console.log('✓ MongoDB connected');
    
    // Initialize database (create collections and indexes)
    await initDatabase();
    console.log('✓ Database initialized');
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════╗
║   👻 Spooky Vocab Backend Server          ║
║                                           ║
║   Status: Running                         ║
║   Port: ${PORT}                              ║
║   URL: http://localhost:${PORT}              ║
║   Database: MongoDB                       ║
║                                           ║
║   Core Endpoints:                         ║
║   - GET  /health                          ║
║   - POST /api/auth/test-token             ║
║   - POST /api/vocabulary/batch-check      ║
║   - POST /api/feedback/known              ║
║                                           ║
║   FSRS Spaced Repetition (NEW):          ║
║   - GET  /api/sr/due                      ║
║   - POST /api/sr/review                   ║
║   - GET  /api/sr/stats                    ║
║   - POST /api/sr/reset                    ║
║   - POST /api/sr/batch-info               ║
║                                           ║
╚═══════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;

