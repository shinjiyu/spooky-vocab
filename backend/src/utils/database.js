// Database connection and utilities
// 数据库连接和工具函数

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const USER_DB_PATH = path.join(__dirname, '../../data/user_data.db');
const DICT_DB_PATH = path.join(__dirname, '../../data/ecdict.db');

// 用户数据库连接
const userDb = new sqlite3.Database(USER_DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to user database:', err);
  } else {
    console.log('✓ Connected to user_data.db');
    
    // 启用WAL模式（优化并发）
    userDb.run('PRAGMA journal_mode = WAL', (err) => {
      if (err) console.error('Failed to enable WAL mode:', err);
    });
  }
});

// 词典数据库连接（只读）
let dictDb = null;
const fs = require('fs');

if (fs.existsSync(DICT_DB_PATH)) {
  dictDb = new sqlite3.Database(DICT_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Failed to connect to dictionary database:', err);
    } else {
      console.log('✓ Connected to ecdict.db');
    }
  });
} else {
  console.warn('⚠ Dictionary database not found at:', DICT_DB_PATH);
  console.warn('  The app will work but won\'t have dictionary data.');
  console.warn('  Download ECDICT from: https://github.com/skywind3000/ECDICT');
}

// Promise包装器 - 将sqlite3的回调API转为Promise
function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// 导出
// 词典数据库的Promise包装器
function dictDbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!dictDb) {
      resolve(null);
      return;
    }
    dictDb.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dictDbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!dictDb) {
      resolve([]);
      return;
    }
    dictDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// Async function to check if dictDb is ready
async function connectDictDb() {
  return dictDb;
}

module.exports = {
  userDb,
  dictDb,
  dbRun,
  dbGet,
  dbAll,
  dictDbGet,
  dictDbAll,
  connectDictDb
};
