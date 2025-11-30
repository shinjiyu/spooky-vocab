// Database initialization script
// Creates tables if they don't exist

const { userDb } = require('./database');

function initDatabase() {
  console.log('Initializing database...');

  // Create user_settings table
  userDb.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      cefr_level TEXT DEFAULT 'B1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create word_records table
  userDb.exec(`
    CREATE TABLE IF NOT EXISTS word_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      word TEXT NOT NULL,
      familiarity_score INTEGER DEFAULT 0,
      encounter_count INTEGER DEFAULT 0,
      known_feedback_count INTEGER DEFAULT 0,
      unknown_feedback_count INTEGER DEFAULT 0,
      last_encountered DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, word)
    )
  `);

  // Create index for faster lookups
  userDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_word_records_user_word 
    ON word_records(user_id, word)
  `);

  // Create word_contexts table
  userDb.exec(`
    CREATE TABLE IF NOT EXISTS word_contexts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      word TEXT NOT NULL,
      sentence TEXT,
      url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index for contexts
  userDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_word_contexts_user_word 
    ON word_contexts(user_id, word)
  `);

  console.log('✅ Database initialized successfully');
}

// Run initialization
initDatabase();

module.exports = { initDatabase };

