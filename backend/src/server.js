// Spooky Vocab Backend Server
// Express + SQLite API server for vocabulary learning

const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize database
require('./utils/init-db');

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

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   👻 Spooky Vocab Backend Server          ║
║                                           ║
║   Status: Running                         ║
║   Port: ${PORT}                              ║
║   URL: http://localhost:${PORT}              ║
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

module.exports = app;

