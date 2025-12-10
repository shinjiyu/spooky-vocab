// Database initialization script
// Creates collections and indexes for MongoDB

const { connectDatabase, getDb, closeDatabase } = require('./database');

async function initDatabase() {
  console.log('Initializing MongoDB database...');

  try {
    // 连接数据库
    await connectDatabase();
    const db = getDb();

    // 创建集合和索引
    console.log('Creating collections and indexes...');

    // 1. user_settings 集合
    console.log('  Setting up user_settings collection...');
    const userSettings = db.collection('user_settings');
    await userSettings.createIndex({ user_id: 1 }, { unique: true });
    console.log('    ✓ Created unique index on user_id');

    // 2. word_records 集合
    console.log('  Setting up word_records collection...');
    const wordRecords = db.collection('word_records');
    
    // 复合唯一索引：user_id + word
    await wordRecords.createIndex(
      { user_id: 1, word: 1 }, 
      { unique: true }
    );
    console.log('    ✓ Created unique compound index on user_id + word');
    
    // FSRS相关索引
    await wordRecords.createIndex({ user_id: 1, due_date: 1 });
    console.log('    ✓ Created index on user_id + due_date');
    
    await wordRecords.createIndex({ user_id: 1, state: 1 });
    console.log('    ✓ Created index on user_id + state');
    
    await wordRecords.createIndex({ last_encountered: 1 });
    console.log('    ✓ Created index on last_encountered');

    // 3. word_contexts 集合
    console.log('  Setting up word_contexts collection...');
    const wordContexts = db.collection('word_contexts');
    await wordContexts.createIndex({ user_id: 1, word: 1 });
    console.log('    ✓ Created compound index on user_id + word');
    
    await wordContexts.createIndex({ created_at: 1 });
    console.log('    ✓ Created index on created_at');

    // 4. review_log 集合
    console.log('  Setting up review_log collection...');
    const reviewLog = db.collection('review_log');
    await reviewLog.createIndex({ user_id: 1, review_time: 1 });
    console.log('    ✓ Created compound index on user_id + review_time');
    
    await reviewLog.createIndex({ user_id: 1, word: 1 });
    console.log('    ✓ Created compound index on user_id + word');

    // 5. ecdict 集合（如果需要词典数据）
    console.log('  Setting up ecdict collection...');
    const ecdict = db.collection('ecdict');
    await ecdict.createIndex({ word: 1 }, { unique: true });
    console.log('    ✓ Created unique index on word');

    console.log('✅ MongoDB database initialized successfully (with FSRS support)');
    console.log('\nCollections created:');
    console.log('  - user_settings');
    console.log('  - word_records (with FSRS fields)');
    console.log('  - word_contexts');
    console.log('  - review_log');
    console.log('  - ecdict');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Run initialization if this file is executed directly
if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('\nInitialization complete!');
      closeDatabase();
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nInitialization failed:', error);
      closeDatabase();
      process.exit(1);
    });
}

module.exports = { initDatabase };
