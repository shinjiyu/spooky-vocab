// Database connection and utilities
// MongoDB连接（用户数据）+ SQLite连接（ECDICT词典）

const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config();

// MongoDB连接配置 (必须通过环境变量设置)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/english_helper';
const DB_NAME = process.env.MONGODB_DB_NAME || 'english_helper';

// SQLite词典路径
const DICT_DB_PATH = process.env.DICT_DB_PATH || path.join(__dirname, '../../data/ecdict.db');

let client = null;
let db = null;
let userDb = null;
let dictDb = null;  // MongoDB reference (legacy)
let sqliteDictDb = null;  // SQLite 词典数据库

/**
 * 初始化MongoDB连接
 */
async function connectDatabase() {
  if (client && db) {
    return { client, db };
  }

  try {
    console.log('Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    
    // 验证连接
    await client.db('admin').command({ ping: 1 });
    console.log('✓ Connected to MongoDB successfully');
    
    db = client.db(DB_NAME);
    userDb = db; // 用户数据使用同一个数据库
    dictDb = db; // 词典数据也使用同一个数据库
    
    return { client, db };
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

/**
 * 获取数据库实例
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
  return db;
}

/**
 * 获取集合
 */
function getCollection(collectionName) {
  return getDb().collection(collectionName);
}

/**
 * 关闭数据库连接
 */
async function closeDatabase() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    userDb = null;
    dictDb = null;
    console.log('✓ MongoDB connection closed');
  }
}

// ============ Promise包装器 - 兼容旧的SQLite API ============

/**
 * 执行插入/更新操作
 * @param {*} dbInstance - 忽略（MongoDB不需要）
 * @param {string} collection - 集合名称
 * @param {object} operation - 操作对象 { type, filter, data, options }
 */
async function dbRun(dbInstance, collection, operation) {
  const coll = getCollection(collection);
  
  if (operation.type === 'insert') {
    const result = await coll.insertOne(operation.data);
    return { 
      changes: result.insertedId ? 1 : 0, 
      lastID: result.insertedId?.toString() 
    };
  } else if (operation.type === 'update') {
    const result = await coll.updateOne(
      operation.filter, 
      operation.update, 
      operation.options || {}
    );
    return { 
      changes: result.modifiedCount, 
      lastID: null 
    };
  } else if (operation.type === 'upsert') {
    const result = await coll.updateOne(
      operation.filter, 
      operation.update, 
      { upsert: true, ...operation.options }
    );
    return { 
      changes: result.modifiedCount || result.upsertedCount, 
      lastID: result.upsertedId?.toString() 
    };
  } else if (operation.type === 'delete') {
    const result = await coll.deleteOne(operation.filter);
    return { 
      changes: result.deletedCount, 
      lastID: null 
    };
  } else if (operation.type === 'deleteMany') {
    const result = await coll.deleteMany(operation.filter);
    return { 
      changes: result.deletedCount, 
      lastID: null 
    };
  }
  
  throw new Error(`Unknown operation type: ${operation.type}`);
}

/**
 * 查询单条记录
 */
async function dbGet(dbInstance, collection, filter, options = {}) {
  const coll = getCollection(collection);
  return await coll.findOne(filter, options);
}

/**
 * 查询多条记录
 */
async function dbAll(dbInstance, collection, filter = {}, options = {}) {
  const coll = getCollection(collection);
  return await coll.find(filter, options).toArray();
}

/**
 * 连接SQLite词典数据库
 */
async function connectDictDb() {
  if (sqliteDictDb) {
    return sqliteDictDb;
  }

  try {
    // 动态加载 better-sqlite3
    const Database = require('better-sqlite3');
    const fs = require('fs');
    
    // 检查词典文件是否存在
    if (!fs.existsSync(DICT_DB_PATH)) {
      console.log(`⚠ Dictionary file not found: ${DICT_DB_PATH}`);
      return null;
    }
    
    sqliteDictDb = new Database(DICT_DB_PATH, { readonly: true });
    console.log(`✓ SQLite dictionary connected: ${DICT_DB_PATH}`);
    return sqliteDictDb;
  } catch (error) {
    console.error('Failed to connect to dictionary database:', error);
    return null;
  }
}

/**
 * 词典查询（单条）- SQLite
 */
async function dictDbGet(sql, params = []) {
  if (!sqliteDictDb) {
    await connectDictDb();
  }
  
  if (!sqliteDictDb) {
    return null;
  }

  try {
    const stmt = sqliteDictDb.prepare(sql);
    return stmt.get(...params);
  } catch (error) {
    console.error('[DictDb] Query error:', error);
    return null;
  }
}

/**
 * 词典查询（多条）- SQLite
 */
async function dictDbAll(sql, params = []) {
  if (!sqliteDictDb) {
    await connectDictDb();
  }
  
  if (!sqliteDictDb) {
    return [];
  }

  try {
    const stmt = sqliteDictDb.prepare(sql);
    return stmt.all(...params);
  } catch (error) {
    console.error('[DictDb] Query error:', error);
    return [];
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});

module.exports = {
  connectDatabase,
  getDb,
  getCollection,
  closeDatabase,
  userDb,
  dictDb,
  dbRun,
  dbGet,
  dbAll,
  dictDbGet,
  dictDbAll,
  connectDictDb,
  ObjectId
};
