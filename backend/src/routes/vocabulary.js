// Vocabulary routes
// Endpoints for checking words and getting translations

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getCollection } = require('../utils/database');
const dictionaryService = require('../services/dictionary');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * 验证单词是否有效（可入库）
 * @param {string} word - 单词
 * @param {Object} dictEntry - 词典条目（可选）
 * @returns {Object} { valid: boolean, reason: string }
 */
function isValidWord(word, dictEntry = null) {
  const lowerWord = word.toLowerCase();
  
  // 1. 长度检查：太短或太长的都不行
  if (lowerWord.length < 2 || lowerWord.length > 30) {
    return { valid: false, reason: 'invalid_length' };
  }
  
  // 2. 格式检查：只允许纯英文字母（可包含连字符和撇号）
  // 但不允许纯数字、特殊字符开头/结尾
  const validPattern = /^[a-z]([a-z'-]*[a-z])?$/;
  if (!validPattern.test(lowerWord)) {
    return { valid: false, reason: 'invalid_format' };
  }
  
  // 3. 不允许连续的特殊字符
  if (/[-']{2,}/.test(lowerWord)) {
    return { valid: false, reason: 'invalid_format' };
  }
  
  // 4. 如果提供了词典条目，检查是否存在
  if (dictEntry === null) {
    // 没有词典数据时，放行（稍后在词典中检查）
    return { valid: true, reason: 'no_dict_check' };
  }
  
  // 5. 词典中必须存在（有翻译）
  if (!dictEntry || !dictEntry.translation) {
    return { valid: false, reason: 'not_in_dictionary' };
  }
  
  return { valid: true, reason: 'ok' };
}

/**
 * 简单的词汇判断逻辑（在没有ECDICT的情况下）
 * 基于词长、常用词列表和用户等级
 */
function simpleWordJudgment(word, userLevel, userRecord) {
  const lowerWord = word.toLowerCase();
  
  // 如果用户已经标记为"已知"
  if (userRecord && userRecord.known_feedback_count > 0) {
    return { needs_translation: false, score: 80 };
  }
  
  // 极常见的100个词（不分等级都认识）
  const veryCommonWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
    'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
    'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
    'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
    'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did', 'having'
  ]);
  
  if (veryCommonWords.has(lowerWord)) {
    return { needs_translation: false, score: 90 };
  }
  
  // 基于词长的简单判断
  const wordLength = lowerWord.length;
  
  // 用户等级对应的词长容忍度
  const levelThresholds = {
    'A1': 4,  // A1: 4字母以下的词认识
    'A2': 5,
    'B1': 6,
    'B2': 7,
    'C1': 8,
    'C2': 10
  };
  
  const threshold = levelThresholds[userLevel] || 6;
  
  // 短词容易，长词难
  if (wordLength <= threshold) {
    return { needs_translation: false, score: 70 };
  } else {
    // 词越长，分数越低
    const score = Math.max(20, 65 - (wordLength - threshold) * 5);
    return { needs_translation: score < 65, score };
  }
}

/**
 * POST /api/vocabulary/batch-check
 * Check multiple words and return translation info
 */
router.post('/batch-check', async (req, res) => {
  const { words, include_translation } = req.body;
  const user_id = req.user_id;

  if (!Array.isArray(words) || words.length === 0) {
    return res.status(400).json({ 
      error: {
        code: 'INVALID_PARAMETERS',
        message: 'Expected "words" array in request body'
      }
    });
  }

  // Limit batch size
  if (words.length > 1000) {
    return res.status(400).json({ 
      error: {
        code: 'BATCH_TOO_LARGE',
        message: 'Maximum 1000 words per request'
      }
    });
  }

  try {
    const userSettings = getCollection('user_settings');
    const wordRecords = getCollection('word_records');

    // Get user settings
    const settings = await userSettings.findOne({ user_id });
    const userLevel = settings?.cefr_level || 'B1';

    // Batch lookup translations if dictionary available
    let dictEntries = {};
    if (dictionaryService.isReady()) {
      dictEntries = await dictionaryService.batchLookup(words);
    }

    const results = {};

    for (const word of words) {
      const lowerWord = word.toLowerCase();

      // Get user's record for this word
      let wordRecord = await wordRecords.findOne({ user_id, word: lowerWord });

      // Get dictionary entry
      const dictEntry = dictEntries[lowerWord];
      
      // Calculate score (不创建记录，只计算)
      let familiarityScore;
      if (wordRecord) {
        // 使用已有记录的分数
        familiarityScore = wordRecord.familiarity_score;
      } else if (dictEntry) {
        // 使用词典难度评估
        const difficulty = await dictionaryService.getDifficulty(lowerWord);
        familiarityScore = difficulty.score;
      } else {
        // 使用简单判断（单词不在词典中，可能是无效词）
        const judgment = simpleWordJudgment(lowerWord, userLevel, null);
        familiarityScore = judgment.score;
      }
      
      // 注意：batch-check 不再创建记录！
      // 只有用户真正触发翻译浮窗时才会通过 feedback/unknown 创建记录

      // Determine if translation needed
      const needsTranslation = familiarityScore < 65;

      // 构建响应
      results[lowerWord] = {
        needs_translation: needsTranslation,
        familiarity_score: familiarityScore
      };

      // Include translation if requested and needed
      if (include_translation && needsTranslation) {
        if (dictEntry) {
          results[lowerWord].translation = {
            translation: dictEntry.translation,
            phonetic: dictEntry.phonetic
          };
        } else {
          results[lowerWord].translation = {
            translation: '(未找到翻译)',
            phonetic: ''
          };
        }
      }
    }

    res.json({
      success: true,
      data: results,
      meta: {
        user_level: userLevel,
        words_checked: words.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Vocabulary API] Error in batch-check:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check words',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/vocabulary/word/:word
 * Get detailed information about a single word
 */
router.get('/word/:word', async (req, res) => {
  const { word } = req.params;
  const user_id = req.user_id;

  try {
    const lowerWord = word.toLowerCase();
    const wordRecords = getCollection('word_records');
    const userSettings = getCollection('user_settings');

    // Get user's record for this word
    const wordRecord = await wordRecords.findOne({ user_id, word: lowerWord });

    // Get user settings for judgment
    const settings = await userSettings.findOne({ user_id });
    const userLevel = settings?.cefr_level || 'B1';
    const judgment = simpleWordJudgment(lowerWord, userLevel, wordRecord);

    // Get dictionary translation
    let translation = {
      translation: '(未找到翻译)',
      phonetic: ''
    };
    
    if (dictionaryService.isReady()) {
      const dictEntry = await dictionaryService.lookup(lowerWord);
      if (dictEntry) {
        translation = {
          translation: dictEntry.translation,
          phonetic: dictEntry.phonetic || ''
        };
      }
    }

    res.json({
      success: true,
      data: {
        word: lowerWord,
        needs_translation: judgment.needs_translation,
        familiarity_score: wordRecord?.familiarity_score || judgment.score,
        translation: translation,
        user_record: wordRecord ? {
          encounter_count: wordRecord.encounter_count,
          known_feedback_count: wordRecord.known_feedback_count,
          unknown_feedback_count: wordRecord.unknown_feedback_count,
          last_encountered: wordRecord.last_encountered
        } : null
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Vocabulary API] Error in word lookup:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to lookup word',
        details: error.message
      }
    });
  }
});

module.exports = router;
