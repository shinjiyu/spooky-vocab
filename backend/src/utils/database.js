// Database connection and utilities
// Using better-sqlite3 for synchronous SQLite operations

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// User data database
const userDbPath = path.join(DATA_DIR, 'user_data.db');
const userDb = new Database(userDbPath);

// Dictionary database (ECDICT)
const dictDbPath = path.join(DATA_DIR, 'ecdict.db');
let dictDb = null;

// Try to connect to dictionary database
try {
  if (fs.existsSync(dictDbPath)) {
    dictDb = new Database(dictDbPath, { readonly: true });
    console.log('✅ ECDICT dictionary loaded');
  } else {
    console.warn('⚠️  ECDICT dictionary not found. Please download it to data/ecdict.db');
    console.warn('   Download from: https://github.com/skywind3000/ECDICT/releases');
  }
} catch (error) {
  console.error('❌ Failed to load dictionary:', error.message);
}

// Enable WAL mode for better concurrency
userDb.pragma('journal_mode = WAL');

module.exports = {
  userDb,
  dictDb,
  DATA_DIR
};

