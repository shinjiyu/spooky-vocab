// FSRS (Free Spaced Repetition Scheduler) Service
// 实现间隔重复算法核心逻辑

const { FSRS, Rating, State, Card } = require('fsrs.js');
const { userDb, dbAll, dbGet, dbRun } = require('../utils/database');
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
  
  // 检查卡片是否已存在
  const existingRecord = await dbGet(userDb, `
    SELECT * FROM word_records WHERE user_id = ? AND word = ?
  `, [user_id, word]);

  if (existingRecord && existingRecord.state !== null && existingRecord.state !== 0) {
    console.log(`[FSRS] Card already exists, returning existing: ${word}`);
    return formatCardFromDB(existingRecord);
  }

  // 创建新卡片
  const now = new Date();
  const card = Card.New();
  const rating = GRADE_MAP[grade] || Rating.Good;
  
  // 使用FSRS调度器计算首次复习
  const scheduling_cards = f.repeat(card, now);
  const scheduled_card = scheduling_cards[rating];
  
  const fsrsData = {
    state: STATE_REVERSE_MAP[scheduled_card.card.state],
    stability: scheduled_card.card.stability,
    difficulty: scheduled_card.card.difficulty,
    due_date: scheduled_card.card.due.toISOString(),
    last_review: now.toISOString(),
    reps: 1,
    lapses: 0
  };

  console.log(`[FSRS] New card data:`, fsrsData);

  // 更新或创建数据库记录
  if (existingRecord) {
    await dbRun(userDb, `
      UPDATE word_records 
      SET stability = ?, difficulty = ?, state = ?, due_date = ?,
          last_review = ?, reps = ?, lapses = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND word = ?
    `, [
      fsrsData.stability,
      fsrsData.difficulty,
      fsrsData.state,
      fsrsData.due_date,
      fsrsData.last_review,
      fsrsData.reps,
      fsrsData.lapses,
      user_id,
      word
    ]);
  } else {
    await dbRun(userDb, `
      INSERT INTO word_records 
      (user_id, word, stability, difficulty, state, due_date, last_review, reps, lapses)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user_id,
      word,
      fsrsData.stability,
      fsrsData.difficulty,
      fsrsData.state,
      fsrsData.due_date,
      fsrsData.last_review,
      fsrsData.reps,
      fsrsData.lapses
    ]);
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

  // 获取现有记录
  const record = await dbGet(userDb, `
    SELECT * FROM word_records WHERE user_id = ? AND word = ?
  `, [user_id, word]);

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
    due_date: scheduled_card.card.due.toISOString(),
    last_review: now.toISOString(),
    reps: scheduled_card.card.reps,
    lapses: scheduled_card.card.lapses
  };

  console.log(`[FSRS] Updated card data:`, {
    word,
    old: { state: old_state, stability: record.stability, due: old_due },
    new: fsrsData
  });

  // 更新数据库
  await dbRun(userDb, `
    UPDATE word_records 
    SET stability = ?, difficulty = ?, state = ?, due_date = ?,
        last_review = ?, reps = ?, lapses = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND word = ?
  `, [
    fsrsData.stability,
    fsrsData.difficulty,
    fsrsData.state,
    fsrsData.due_date,
    fsrsData.last_review,
    fsrsData.reps,
    fsrsData.lapses,
    user_id,
    word
  ]);

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

  const now = new Date().toISOString();
  const statesFilter = states.join(',');
  
  let query = `
    SELECT * FROM word_records
    WHERE user_id = ?
      AND state IN (${statesFilter})
      AND (
        due_date IS NULL 
        OR due_date <= ?
        ${include_new ? 'OR state = 0' : ''}
      )
    ORDER BY 
      CASE 
        WHEN state = 0 THEN 0
        WHEN due_date IS NULL THEN 1
        ELSE 2
      END,
      due_date ASC,
      difficulty DESC
    LIMIT ? OFFSET ?
  `;

  const cards = await dbAll(userDb, query, [user_id, now, limit, offset]);

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

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // 总卡片数和状态分布
  const overview = await dbGet(userDb, `
    SELECT 
      COUNT(*) as total_cards,
      SUM(CASE WHEN state = 0 THEN 1 ELSE 0 END) as new_cards,
      SUM(CASE WHEN state = 1 THEN 1 ELSE 0 END) as learning_cards,
      SUM(CASE WHEN state = 2 THEN 1 ELSE 0 END) as review_cards,
      SUM(CASE WHEN state = 3 THEN 1 ELSE 0 END) as relearning_cards,
      SUM(CASE WHEN due_date IS NOT NULL AND due_date <= ? THEN 1 ELSE 0 END) as due_today
    FROM word_records
    WHERE user_id = ?
  `, [now.toISOString(), user_id]);

  // 今日完成数
  const todayCompleted = await dbGet(userDb, `
    SELECT COUNT(*) as completed_today
    FROM review_log
    WHERE user_id = ? AND review_time >= ?
  `, [user_id, today]);

  // 进度统计
  const progress = await dbGet(userDb, `
    SELECT 
      AVG(CASE WHEN state IN (2, 3) THEN stability ELSE NULL END) as avg_stability,
      AVG(difficulty) as avg_difficulty,
      SUM(CASE WHEN stability > 21 THEN 1 ELSE 0 END) as mature_cards,
      SUM(CASE WHEN stability > 0 AND stability <= 21 THEN 1 ELSE 0 END) as young_cards
    FROM word_records
    WHERE user_id = ? AND state > 0
  `, [user_id]);

  // 预测统计
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const next7days = new Date(now);
  next7days.setDate(next7days.getDate() + 7);
  const next30days = new Date(now);
  next30days.setDate(next30days.getDate() + 30);

  const forecast = await dbGet(userDb, `
    SELECT 
      SUM(CASE WHEN due_date >= ? AND due_date < ? THEN 1 ELSE 0 END) as due_tomorrow,
      SUM(CASE WHEN due_date >= ? AND due_date < ? THEN 1 ELSE 0 END) as due_next_7_days,
      SUM(CASE WHEN due_date >= ? AND due_date < ? THEN 1 ELSE 0 END) as due_next_30_days
    FROM word_records
    WHERE user_id = ? AND due_date IS NOT NULL
  `, [
    tomorrow.toISOString(), new Date(tomorrow.getTime() + 24*60*60*1000).toISOString(),
    now.toISOString(), next7days.toISOString(),
    now.toISOString(), next30days.toISOString(),
    user_id
  ]);

  // 活动统计
  const activity = await dbGet(userDb, `
    SELECT 
      COUNT(CASE WHEN review_time >= ? THEN 1 END) as reviews_today,
      COUNT(CASE WHEN review_time >= datetime('now', '-7 days') THEN 1 END) as reviews_this_week,
      COUNT(CASE WHEN review_time >= datetime('now', '-30 days') THEN 1 END) as reviews_this_month,
      AVG(review_duration_seconds) as avg_review_time
    FROM review_log
    WHERE user_id = ?
  `, [today, user_id]);

  // 计算学习连续天数
  const streak = await calculateStudyStreak(user_id);

  // 时间统计
  const timeStats = await dbGet(userDb, `
    SELECT 
      SUM(CASE WHEN review_time >= ? THEN review_duration_seconds ELSE 0 END) / 60.0 as total_time_today_minutes,
      SUM(review_duration_seconds) / 60.0 as total_time_all_minutes
    FROM review_log
    WHERE user_id = ? AND review_duration_seconds IS NOT NULL
  `, [today, user_id]);

  // 计算保留率
  const retention = await calculateRetentionRate(user_id);

  return {
    overview: {
      total_cards: overview.total_cards || 0,
      new_cards: overview.new_cards || 0,
      learning_cards: overview.learning_cards || 0,
      review_cards: overview.review_cards || 0,
      due_today: overview.due_today || 0,
      completed_today: todayCompleted.completed_today || 0
    },
    progress: {
      retention_rate: retention,
      average_ease: progress.avg_difficulty ? 10 - progress.avg_difficulty : 5, // 转换为易度
      mature_cards: progress.mature_cards || 0,
      young_cards: progress.young_cards || 0
    },
    forecast: {
      due_tomorrow: forecast.due_tomorrow || 0,
      due_next_7_days: forecast.due_next_7_days || 0,
      due_next_30_days: forecast.due_next_30_days || 0
    },
    activity: {
      reviews_today: activity.reviews_today || 0,
      reviews_this_week: activity.reviews_this_week || 0,
      reviews_this_month: activity.reviews_this_month || 0,
      study_streak_days: streak.current_streak,
      total_study_days: streak.total_days
    },
    time_stats: {
      average_review_time_seconds: activity.avg_review_time || 0,
      total_time_today_minutes: timeStats.total_time_today_minutes || 0,
      total_time_all_minutes: timeStats.total_time_all_minutes || 0
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

  const record = await dbGet(userDb, `
    SELECT * FROM word_records WHERE user_id = ? AND word = ?
  `, [user_id, word]);

  if (!record) {
    throw new Error('Word record not found');
  }

  if (reset_type === 'full') {
    // 完全重置
    await dbRun(userDb, `
      UPDATE word_records 
      SET state = 0, stability = 0, difficulty = 5.0, 
          due_date = NULL, last_review = NULL, reps = 0, lapses = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND word = ?
    `, [user_id, word]);
  } else {
    // 保留统计，只重置FSRS参数
    await dbRun(userDb, `
      UPDATE word_records 
      SET state = 0, stability = 0, due_date = NULL, last_review = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND word = ?
    `, [user_id, word]);
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
  const dictEntry = await dictionaryService.lookup(record.word);
  
  // 获取例句上下文
  const contexts = await dbAll(userDb, `
    SELECT id, sentence, url, created_at
    FROM word_contexts
    WHERE user_id = ? AND word = ?
    ORDER BY created_at DESC
    LIMIT 3
  `, [user_id, record.word]);

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
      id: c.id,
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
    await dbRun(userDb, `
      INSERT INTO review_log 
      (user_id, word, grade, state, stability, difficulty, elapsed_days, scheduled_days, review_duration_seconds, last_elapsed_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user_id,
      word,
      grade,
      fsrsData.state,
      fsrsData.stability,
      fsrsData.difficulty,
      elapsed_days,
      scheduled_days,
      duration_seconds,
      elapsed_days
    ]);
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
  const reviews = await dbAll(userDb, `
    SELECT DISTINCT DATE(review_time) as review_date
    FROM review_log
    WHERE user_id = ?
    ORDER BY review_date DESC
  `, [user_id]);

  if (reviews.length === 0) {
    return { current_streak: 0, total_days: 0 };
  }

  let current_streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < reviews.length; i++) {
    const reviewDate = new Date(reviews[i].review_date);
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
  const result = await dbGet(userDb, `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN grade >= 3 THEN 1 ELSE 0 END) as success
    FROM review_log
    WHERE user_id = ? AND review_time >= datetime('now', '-30 days')
  `, [user_id]);

  if (!result || result.total === 0) {
    return 90; // 默认90%
  }

  return Math.round((result.success / result.total) * 100 * 10) / 10;
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

