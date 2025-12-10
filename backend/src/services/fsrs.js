// FSRS (Free Spaced Repetition Scheduler) Service
// 实现间隔重复算法核心逻辑

const { FSRS, Rating, State, Card } = require('fsrs.js');
const { getCollection } = require('../utils/database');
const dictionaryService = require('./dictionary');

// FSRS参数配置
const params = {
  request_retention: 0.9, // 目标保留率 90%
  maximum_interval: 36500, // 最大间隔 100年
  enable_fuzz: true,
  enable_short_term: true
};

// 创建FSRS调度器实例
const f = new FSRS(params);

/**
 * 评分枚举映射
 */
const GRADE_MAP = {
  1: Rating.Again,  // 完全不记得
  2: Rating.Hard,   // 很难想起
  3: Rating.Good,   // 正常记起
  4: Rating.Easy    // 轻松记起
};

/**
 * 状态枚举映射
 */
const STATE_MAP = {
  0: State.New,
  1: State.Learning,
  2: State.Review,
  3: State.Relearning
};

const STATE_REVERSE_MAP = {
  [State.New]: 0,
  [State.Learning]: 1,
  [State.Review]: 2,
  [State.Relearning]: 3
};

/**
 * 初始化新卡片
 * @param {string} user_id - 用户ID
 * @param {string} word - 单词
 * @param {number} grade - 首次评分 (1-4)
 * @returns {Promise<Object>} 卡片信息
 */
async function initCard(user_id, word, grade = 3) {
  console.log(`[FSRS] Initializing new card: ${word} with grade ${grade}`);
  
  const wordRecords = getCollection('word_records');
  
  // 检查卡片是否已存在
  const existingRecord = await wordRecords.findOne({ user_id, word });

  if (existingRecord && existingRecord.state !== null && existingRecord.state !== 0) {
    console.log(`[FSRS] Card already exists, returning existing: ${word}`);
    return formatCardFromDB(existingRecord);
  }

  // 创建新卡片
  const now = new Date();
  const card = new Card();  // 使用 new Card() 而不是 Card.New()
  const rating = GRADE_MAP[grade] || Rating.Good;
  
  // 使用FSRS调度器计算首次复习
  const scheduling_cards = f.repeat(card, now);
  const scheduled_card = scheduling_cards[rating];
  
  const fsrsData = {
    state: STATE_REVERSE_MAP[scheduled_card.card.state],
    stability: scheduled_card.card.stability,
    difficulty: scheduled_card.card.difficulty,
    due_date: scheduled_card.card.due,
    last_review: now,
    reps: 1,
    lapses: 0
  };

  console.log(`[FSRS] New card data:`, fsrsData);

  // 更新或创建数据库记录
  if (existingRecord) {
    await wordRecords.updateOne(
      { user_id, word },
      {
        $set: {
          ...fsrsData,
          updated_at: now
        }
      }
    );
  } else {
    await wordRecords.insertOne({
      user_id,
      word,
      ...fsrsData,
      familiarity_score: 50,
      encounter_count: 0,
      known_feedback_count: 0,
      unknown_feedback_count: 0,
      created_at: now,
      updated_at: now
    });
  }

  // 记录到review_log
  await logReview(user_id, word, grade, fsrsData, 0, 0);

  return fsrsData;
}

/**
 * 复习卡片
 * @param {string} user_id - 用户ID
 * @param {string} word - 单词
 * @param {number} grade - 评分 (1-4)
 * @param {number} duration_seconds - 复习耗时（秒）
 * @returns {Promise<Object>} 复习结果
 */
async function reviewCard(user_id, word, grade, duration_seconds = null) {
  console.log(`[FSRS] Reviewing card: ${word} with grade ${grade}`);

  const wordRecords = getCollection('word_records');
  
  // 获取现有记录
  const record = await wordRecords.findOne({ user_id, word });

  if (!record) {
    throw new Error('Word record not found');
  }

  // 如果是新卡片（state=0或null），使用initCard
  if (record.state === null || record.state === 0) {
    console.log(`[FSRS] Card is new, initializing with grade ${grade}`);
    const newCard = await initCard(user_id, word, grade);
    return {
      old_state: 0,
      new_state: newCard.state,
      old_due: null,
      new_due: newCard.due_date,
      next_interval_days: calculateIntervalDays(newCard.due_date),
      updated_card: newCard
    };
  }

  // 构建FSRS卡片对象
  const now = new Date();
  const last_review = record.last_review ? new Date(record.last_review) : now;
  const elapsed_days = (now - last_review) / (1000 * 60 * 60 * 24);

  const card = {
    state: STATE_MAP[record.state],
    stability: record.stability || 0,
    difficulty: record.difficulty || 5.0,
    elapsed_days: elapsed_days,
    scheduled_days: record.due_date ? (new Date(record.due_date) - last_review) / (1000 * 60 * 60 * 24) : 0,
    reps: record.reps || 0,
    lapses: record.lapses || 0,
    last_review: last_review,
    due: record.due_date ? new Date(record.due_date) : now
  };

  const rating = GRADE_MAP[grade] || Rating.Good;

  // 使用FSRS调度器计算新参数
  const scheduling_cards = f.repeat(card, now);
  const scheduled_card = scheduling_cards[rating];

  const old_state = record.state;
  const old_due = record.due_date;

  const fsrsData = {
    state: STATE_REVERSE_MAP[scheduled_card.card.state],
    stability: scheduled_card.card.stability,
    difficulty: scheduled_card.card.difficulty,
    due_date: scheduled_card.card.due,
    last_review: now,
    reps: scheduled_card.card.reps,
    lapses: scheduled_card.card.lapses
  };

  console.log(`[FSRS] Updated card data:`, {
    word,
    old: { state: old_state, stability: record.stability, due: old_due },
    new: fsrsData
  });

  // 更新数据库
  await wordRecords.updateOne(
    { user_id, word },
    {
      $set: {
        ...fsrsData,
        updated_at: now
      }
    }
  );

  // 记录到review_log
  await logReview(user_id, word, grade, fsrsData, elapsed_days, card.scheduled_days, duration_seconds);

  const next_interval_days = calculateIntervalDays(fsrsData.due_date);

  return {
    old_state,
    new_state: fsrsData.state,
    old_due,
    new_due: fsrsData.due_date,
    next_interval_days,
    updated_card: fsrsData
  };
}

/**
 * 获取到期的复习卡片
 * @param {string} user_id - 用户ID
 * @param {Object} options - 查询选项
 * @returns {Promise<Array>} 卡片列表
 */
async function getDueCards(user_id, options = {}) {
  const {
    limit = 20,
    offset = 0,
    states = [0, 1, 2, 3],
    include_new = true
  } = options;

  console.log(`[FSRS] Getting due cards for user ${user_id}`, options);

  const wordRecords = getCollection('word_records');
  const now = new Date();
  
  // 构建查询条件
  const query = {
    user_id,
    state: { $in: states },
    $or: [
      { due_date: null },
      { due_date: { $lte: now } }
    ]
  };
  
  if (include_new) {
    query.$or.push({ state: 0 });
  }

  const cards = await wordRecords
    .find(query)
    .sort({ 
      state: 1,  // 新卡片优先
      due_date: 1, 
      difficulty: -1 
    })
    .skip(offset)
    .limit(limit)
    .toArray();

  console.log(`[FSRS] Found ${cards.length} due cards`);

  // 丰富卡片信息（添加翻译、音标等）
  const enrichedCards = await Promise.all(
    cards.map(async (card) => await enrichCardData(card, user_id))
  );

  return enrichedCards;
}

/**
 * 获取统计数据
 * @param {string} user_id - 用户ID
 * @param {string} period - 统计周期 (today/week/month/all)
 * @returns {Promise<Object>} 统计数据
 */
async function getStats(user_id, period = 'all') {
  console.log(`[FSRS] Getting stats for user ${user_id}, period: ${period}`);

  const wordRecords = getCollection('word_records');
  const reviewLog = getCollection('review_log');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 总卡片数和状态分布
  const overviewResult = await wordRecords.aggregate([
    { $match: { user_id } },
    {
      $group: {
        _id: null,
        total_cards: { $sum: 1 },
        new_cards: { $sum: { $cond: [{ $eq: ['$state', 0] }, 1, 0] } },
        learning_cards: { $sum: { $cond: [{ $eq: ['$state', 1] }, 1, 0] } },
        review_cards: { $sum: { $cond: [{ $eq: ['$state', 2] }, 1, 0] } },
        relearning_cards: { $sum: { $cond: [{ $eq: ['$state', 3] }, 1, 0] } },
        due_today: { 
          $sum: { 
            $cond: [
              { $and: [
                { $ne: ['$due_date', null] },
                { $lte: ['$due_date', now] }
              ]},
              1,
              0
            ]
          }
        }
      }
    }
  ]).toArray();

  const overview = overviewResult[0] || {
    total_cards: 0,
    new_cards: 0,
    learning_cards: 0,
    review_cards: 0,
    due_today: 0
  };

  // 今日完成数
  const todayCompletedResult = await reviewLog.countDocuments({
    user_id,
    review_time: { $gte: today }
  });

  // 进度统计
  const progressResult = await wordRecords.aggregate([
    { $match: { user_id, state: { $gt: 0 } } },
    {
      $group: {
        _id: null,
        avg_stability: { 
          $avg: { 
            $cond: [
              { $in: ['$state', [2, 3]] },
              '$stability',
              null
            ]
          }
        },
        avg_difficulty: { $avg: '$difficulty' },
        mature_cards: { $sum: { $cond: [{ $gt: ['$stability', 21] }, 1, 0] } },
        young_cards: { 
          $sum: { 
            $cond: [
              { $and: [
                { $gt: ['$stability', 0] },
                { $lte: ['$stability', 21] }
              ]},
              1,
              0
            ]
          }
        }
      }
    }
  ]).toArray();

  const progress = progressResult[0] || {
    avg_difficulty: 5,
    mature_cards: 0,
    young_cards: 0
  };

  // 预测统计
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  const next7days = new Date(now);
  next7days.setDate(next7days.getDate() + 7);
  const next30days = new Date(now);
  next30days.setDate(next30days.getDate() + 30);

  const forecastResult = await wordRecords.aggregate([
    { $match: { user_id, due_date: { $ne: null } } },
    {
      $group: {
        _id: null,
        due_tomorrow: {
          $sum: {
            $cond: [
              { $and: [
                { $gte: ['$due_date', tomorrow] },
                { $lt: ['$due_date', tomorrowEnd] }
              ]},
              1,
              0
            ]
          }
        },
        due_next_7_days: {
          $sum: {
            $cond: [
              { $and: [
                { $gte: ['$due_date', now] },
                { $lt: ['$due_date', next7days] }
              ]},
              1,
              0
            ]
          }
        },
        due_next_30_days: {
          $sum: {
            $cond: [
              { $and: [
                { $gte: ['$due_date', now] },
                { $lt: ['$due_date', next30days] }
              ]},
              1,
              0
            ]
          }
        }
      }
    }
  ]).toArray();

  const forecast = forecastResult[0] || {
    due_tomorrow: 0,
    due_next_7_days: 0,
    due_next_30_days: 0
  };

  // 活动统计
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const activityResult = await reviewLog.aggregate([
    { $match: { user_id } },
    {
      $group: {
        _id: null,
        reviews_today: {
          $sum: { $cond: [{ $gte: ['$review_time', today] }, 1, 0] }
        },
        reviews_this_week: {
          $sum: { $cond: [{ $gte: ['$review_time', sevenDaysAgo] }, 1, 0] }
        },
        reviews_this_month: {
          $sum: { $cond: [{ $gte: ['$review_time', thirtyDaysAgo] }, 1, 0] }
        },
        avg_review_time: { $avg: '$review_duration_seconds' }
      }
    }
  ]).toArray();

  const activity = activityResult[0] || {
    reviews_today: 0,
    reviews_this_week: 0,
    reviews_this_month: 0,
    avg_review_time: 0
  };

  // 计算学习连续天数
  const streak = await calculateStudyStreak(user_id);

  // 时间统计
  const timeStatsResult = await reviewLog.aggregate([
    { $match: { user_id, review_duration_seconds: { $ne: null } } },
    {
      $group: {
        _id: null,
        total_time_today_minutes: {
          $sum: {
            $cond: [
              { $gte: ['$review_time', today] },
              { $divide: ['$review_duration_seconds', 60] },
              0
            ]
          }
        },
        total_time_all_minutes: {
          $sum: { $divide: ['$review_duration_seconds', 60] }
        }
      }
    }
  ]).toArray();

  const timeStats = timeStatsResult[0] || {
    total_time_today_minutes: 0,
    total_time_all_minutes: 0
  };

  // 计算保留率
  const retention = await calculateRetentionRate(user_id);

  return {
    overview: {
      total_cards: overview.total_cards,
      new_cards: overview.new_cards,
      learning_cards: overview.learning_cards,
      review_cards: overview.review_cards,
      due_today: overview.due_today,
      completed_today: todayCompletedResult
    },
    progress: {
      retention_rate: retention,
      average_ease: progress.avg_difficulty ? 10 - progress.avg_difficulty : 5, // 转换为易度
      mature_cards: progress.mature_cards,
      young_cards: progress.young_cards
    },
    forecast: {
      due_tomorrow: forecast.due_tomorrow,
      due_next_7_days: forecast.due_next_7_days,
      due_next_30_days: forecast.due_next_30_days
    },
    activity: {
      reviews_today: activity.reviews_today,
      reviews_this_week: activity.reviews_this_week,
      reviews_this_month: activity.reviews_this_month,
      study_streak_days: streak.current_streak,
      total_study_days: streak.total_days
    },
    time_stats: {
      average_review_time_seconds: activity.avg_review_time || 0,
      total_time_today_minutes: timeStats.total_time_today_minutes,
      total_time_all_minutes: timeStats.total_time_all_minutes
    }
  };
}

/**
 * 重置单词进度
 * @param {string} user_id - 用户ID
 * @param {string} word - 单词
 * @param {string} reset_type - 重置类型 (full/keep_stats)
 * @returns {Promise<Object>} 重置结果
 */
async function resetCard(user_id, word, reset_type = 'full') {
  console.log(`[FSRS] Resetting card: ${word}, type: ${reset_type}`);

  const wordRecords = getCollection('word_records');
  const record = await wordRecords.findOne({ user_id, word });

  if (!record) {
    throw new Error('Word record not found');
  }

  const now = new Date();

  if (reset_type === 'full') {
    // 完全重置
    await wordRecords.updateOne(
      { user_id, word },
      {
        $set: {
          state: 0,
          stability: 0,
          difficulty: 5.0,
          due_date: null,
          last_review: null,
          reps: 0,
          lapses: 0,
          updated_at: now
        }
      }
    );
  } else {
    // 保留统计，只重置FSRS参数
    await wordRecords.updateOne(
      { user_id, word },
      {
        $set: {
          state: 0,
          stability: 0,
          due_date: null,
          last_review: null,
          updated_at: now
        }
      }
    );
  }

  return {
    word,
    reset: true,
    new_state: 0,
    reset_type
  };
}

// ===== 辅助函数 =====

/**
 * 丰富卡片数据（添加翻译、音标等）
 */
async function enrichCardData(record, user_id) {
  const wordContexts = getCollection('word_contexts');
  const dictEntry = await dictionaryService.lookup(record.word);
  
  // 获取例句上下文
  const contexts = await wordContexts
    .find({ user_id, word: record.word })
    .sort({ created_at: -1 })
    .limit(3)
    .project({ id: 1, sentence: 1, url: 1, created_at: 1 })
    .toArray();

  const elapsed_days = record.last_review 
    ? (Date.now() - new Date(record.last_review)) / (1000 * 60 * 60 * 24)
    : 0;

  return {
    word: record.word,
    phonetic: dictEntry?.phonetic || '',
    translation: dictEntry?.translation || '',
    translations: dictEntry?.translation ? [dictEntry.translation] : [],
    definition: dictEntry?.definition || '',
    fsrs: {
      state: record.state || 0,
      stability: record.stability || 0,
      difficulty: record.difficulty || 5.0,
      due_date: record.due_date,
      last_review: record.last_review,
      reps: record.reps || 0,
      lapses: record.lapses || 0,
      elapsed_days: Math.round(elapsed_days * 10) / 10
    },
    contexts: contexts.map(c => ({
      id: c._id,
      sentence: c.sentence,
      url: c.url,
      created_at: c.created_at
    })),
    familiarity_score: record.familiarity_score || 0
  };
}

/**
 * 记录复习日志
 */
async function logReview(user_id, word, grade, fsrsData, elapsed_days, scheduled_days, duration_seconds = null) {
  try {
    const reviewLog = getCollection('review_log');
    await reviewLog.insertOne({
      user_id,
      word,
      grade,
      state: fsrsData.state,
      stability: fsrsData.stability,
      difficulty: fsrsData.difficulty,
      elapsed_days,
      scheduled_days,
      review_duration_seconds: duration_seconds,
      last_elapsed_days: elapsed_days,
      review_time: new Date()
    });
  } catch (error) {
    console.error('[FSRS] Failed to log review:', error);
  }
}

/**
 * 计算间隔天数
 */
function calculateIntervalDays(due_date) {
  if (!due_date) return 0;
  const now = new Date();
  const due = new Date(due_date);
  const days = (due - now) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.round(days * 10) / 10);
}

/**
 * 计算学习连续天数
 */
async function calculateStudyStreak(user_id) {
  const reviewLog = getCollection('review_log');
  
  // 获取所有复习日期（去重）
  const reviews = await reviewLog.aggregate([
    { $match: { user_id } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$review_time' }
        }
      }
    },
    { $sort: { _id: -1 } }
  ]).toArray();

  if (reviews.length === 0) {
    return { current_streak: 0, total_days: 0 };
  }

  let current_streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < reviews.length; i++) {
    const reviewDate = new Date(reviews[i]._id);
    reviewDate.setHours(0, 0, 0, 0);
    
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);
    
    if (reviewDate.getTime() === expectedDate.getTime()) {
      current_streak++;
    } else {
      break;
    }
  }

  return {
    current_streak,
    total_days: reviews.length
  };
}

/**
 * 计算保留率
 */
async function calculateRetentionRate(user_id) {
  const reviewLog = getCollection('review_log');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await reviewLog.aggregate([
    { $match: { user_id, review_time: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        success: { $sum: { $cond: [{ $gte: ['$grade', 3] }, 1, 0] } }
      }
    }
  ]).toArray();

  if (!result || result.length === 0 || result[0].total === 0) {
    return 90; // 默认90%
  }

  return Math.round((result[0].success / result[0].total) * 100 * 10) / 10;
}

/**
 * 格式化数据库记录为卡片对象
 */
function formatCardFromDB(record) {
  return {
    state: record.state || 0,
    stability: record.stability || 0,
    difficulty: record.difficulty || 5.0,
    due_date: record.due_date,
    last_review: record.last_review,
    reps: record.reps || 0,
    lapses: record.lapses || 0
  };
}

module.exports = {
  initCard,
  reviewCard,
  getDueCards,
  getStats,
  resetCard,
  enrichCardData,
  GRADE_MAP,
  STATE_MAP
};
