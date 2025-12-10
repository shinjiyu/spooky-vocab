// MongoDB helper functions
// 辅助函数：简化MongoDB操作

/**
 * 获取或创建用户设置
 */
async function getOrCreateUserSettings(collection, user_id, defaultLevel = 'B1') {
  let userSettings = await collection.findOne({ user_id });
  
  if (!userSettings) {
    const now = new Date();
    userSettings = {
      user_id,
      cefr_level: defaultLevel,
      created_at: now,
      updated_at: now
    };
    await collection.insertOne(userSettings);
  }
  
  return userSettings;
}

/**
 * 更新用户设置
 */
async function updateUserSettings(collection, user_id, updates) {
  const result = await collection.updateOne(
    { user_id },
    { 
      $set: { 
        ...updates,
        updated_at: new Date()
      }
    },
    { upsert: true }
  );
  
  return result;
}

/**
 * 获取或创建单词记录
 */
async function getOrCreateWordRecord(collection, user_id, word, initialScore = 50) {
  const now = new Date();
  const result = await collection.findOneAndUpdate(
    { user_id, word },
    {
      $setOnInsert: {
        user_id,
        word,
        familiarity_score: initialScore,
        encounter_count: 0,
        known_feedback_count: 0,
        unknown_feedback_count: 0,
        created_at: now,
        updated_at: now,
        // FSRS fields
        stability: 0,
        difficulty: 5.0,
        state: 0,  // 0=new, 1=learning, 2=review, 3=relearning
        due_date: null,
        last_review: null,
        reps: 0,
        lapses: 0
      }
    },
    { 
      upsert: true, 
      returnDocument: 'after'
    }
  );
  
  return result.value;
}

/**
 * 更新单词记录
 */
async function updateWordRecord(collection, user_id, word, updates) {
  const result = await collection.updateOne(
    { user_id, word },
    {
      $set: {
        ...updates,
        updated_at: new Date()
      }
    }
  );
  
  return result;
}

/**
 * 递增字段值
 */
async function incrementWordFields(collection, user_id, word, fields) {
  const updates = {
    updated_at: new Date()
  };
  
  const increments = {};
  Object.keys(fields).forEach(key => {
    increments[key] = fields[key];
  });
  
  const result = await collection.updateOne(
    { user_id, word },
    {
      $inc: increments,
      $set: updates
    }
  );
  
  return result;
}

/**
 * 添加单词上下文
 */
async function addWordContext(collection, user_id, word, sentence, url = '') {
  const context = {
    user_id,
    word,
    sentence,
    url,
    created_at: new Date()
  };
  
  const result = await collection.insertOne(context);
  return result;
}

/**
 * 添加复习日志
 */
async function addReviewLog(collection, logData) {
  const log = {
    ...logData,
    review_time: new Date()
  };
  
  const result = await collection.insertOne(log);
  return result;
}

/**
 * 构建排序对象
 */
function buildSort(sortType) {
  switch (sortType) {
    case 'recent':
      return { last_encountered: -1 };
    case 'score':
      return { familiarity_score: 1 };
    case 'priority':
    default:
      return { familiarity_score: 1, last_encountered: -1 };
  }
}

/**
 * 日期范围过滤器
 */
function getDateFilter(period) {
  const now = new Date();
  
  switch (period) {
    case 'today':
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { $gte: startOfDay };
      
    case 'week':
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { $gte: weekAgo };
      
    case 'month':
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { $gte: monthAgo };
      
    case 'all':
    default:
      return null;
  }
}

module.exports = {
  getOrCreateUserSettings,
  updateUserSettings,
  getOrCreateWordRecord,
  updateWordRecord,
  incrementWordFields,
  addWordContext,
  addReviewLog,
  buildSort,
  getDateFilter
};


