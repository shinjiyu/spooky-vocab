// Database initialization script
// Creates tables if they don't exist

const { userDb, dbRun } = require('./database');

async function initDatabase() {
  console.log('Initializing database...');

  try {
    // Create user_settings table
    await dbRun(userDb, `
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY,
        cefr_level TEXT DEFAULT 'B1',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create word_records table
    await dbRun(userDb, `
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
    await dbRun(userDb, `
      CREATE INDEX IF NOT EXISTS idx_word_records_user_word 
      ON word_records(user_id, word)
    `);

    // Create word_contexts table
    await dbRun(userDb, `
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
    await dbRun(userDb, `
      CREATE INDEX IF NOT EXISTS idx_word_contexts_user_word 
      ON word_contexts(user_id, word)
    `);

    // ===== FSRS扩展：添加间隔重复算法所需字段 =====
    console.log('Checking FSRS columns...');
    
    // 添加FSRS字段（使用ALTER TABLE保持向后兼容）
    const fsrsColumns = [
      { name: 'stability', type: 'REAL DEFAULT 0', description: '记忆稳定性（天）' },
      { name: 'difficulty', type: 'REAL DEFAULT 5.0', description: '单词难度 (1-10)' },
      { name: 'state', type: 'INTEGER DEFAULT 0', description: '卡片状态 (0=new, 1=learning, 2=review, 3=relearning)' },
      { name: 'due_date', type: 'DATETIME', description: '下次复习到期时间' },
      { name: 'last_review', type: 'DATETIME', description: '最后复习时间' },
      { name: 'reps', type: 'INTEGER DEFAULT 0', description: '重复次数' },
      { name: 'lapses', type: 'INTEGER DEFAULT 0', description: '遗忘次数' }
    ];

    for (const column of fsrsColumns) {
      try {
        // SQLite的ALTER TABLE ADD COLUMN是幂等的，如果列已存在会报错但不影响
        await dbRun(userDb, `
          ALTER TABLE word_records ADD COLUMN ${column.name} ${column.type}
        `);
        console.log(`  ✓ Added column: ${column.name} (${column.description})`);
      } catch (error) {
        // 如果列已存在，忽略错误
        if (error.message.includes('duplicate column name')) {
          console.log(`  - Column ${column.name} already exists`);
        } else {
          throw error;
        }
      }
    }

    // 创建FSRS查询优化索引
    await dbRun(userDb, `
      CREATE INDEX IF NOT EXISTS idx_word_records_due_date 
      ON word_records(user_id, due_date)
    `);
    console.log('  ✓ Created index on due_date');

    await dbRun(userDb, `
      CREATE INDEX IF NOT EXISTS idx_word_records_state 
      ON word_records(user_id, state)
    `);
    console.log('  ✓ Created index on state');

    // 创建review_log表用于统计和参数优化
    await dbRun(userDb, `
      CREATE TABLE IF NOT EXISTS review_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        word TEXT NOT NULL,
        grade INTEGER NOT NULL,
        state INTEGER NOT NULL,
        stability REAL,
        difficulty REAL,
        elapsed_days REAL,
        last_elapsed_days REAL,
        scheduled_days REAL,
        review_duration_seconds INTEGER,
        review_time DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ Created review_log table');

    await dbRun(userDb, `
      CREATE INDEX IF NOT EXISTS idx_review_log_user_time 
      ON review_log(user_id, review_time)
    `);
    console.log('  ✓ Created index on review_log');

    console.log('✅ Database initialized successfully (with FSRS support)');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Run initialization if this file is executed directly
if (require.main === module) {
  initDatabase().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { initDatabase };
