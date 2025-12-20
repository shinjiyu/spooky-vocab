// Vocabulary routes
// Endpoints for checking words and getting translations

const express = require('express');
const router = express.Router();
// 注意：认证已在server.js中统一处理，无需在此处重复
const { getCollection } = require('../utils/database');
const dictionaryService = require('../services/dictionary');

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
  
  // 极常见词（不需要翻译）- 包括助动词、介词、连词、代词、基础动词等
  const veryCommonWords = new Set([
    // be动词及其变形
    'be', 'is', 'am', 'are', 'was', 'were', 'been', 'being',
    // 助动词/情态动词
    'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'done',
    'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
    // 代词
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
    'this', 'that', 'these', 'those', 'who', 'whom', 'whose', 'which', 'what',
    'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'themselves',
    // 冠词
    'a', 'an', 'the',
    // 介词
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'down',
    'into', 'out', 'over', 'under', 'about', 'through', 'between', 'after', 'before',
    'above', 'below', 'during', 'without', 'within', 'along', 'around', 'behind',
    'beside', 'beyond', 'near', 'off', 'since', 'until', 'upon', 'against', 'among',
    // 连词
    'and', 'or', 'but', 'so', 'if', 'when', 'while', 'because', 'although', 'though',
    'as', 'than', 'that', 'whether', 'unless', 'since', 'where', 'after', 'before',
    // 副词
    'not', 'no', 'yes', 'very', 'too', 'also', 'just', 'only', 'still', 'even',
    'now', 'then', 'here', 'there', 'how', 'why', 'when', 'where', 'well', 'much',
    'more', 'most', 'less', 'least', 'never', 'always', 'often', 'sometimes', 'again',
    'already', 'soon', 'today', 'tomorrow', 'yesterday', 'really', 'quite', 'rather',
    // 基础动词
    'go', 'get', 'make', 'know', 'take', 'see', 'come', 'think', 'look', 'want',
    'give', 'use', 'find', 'tell', 'ask', 'work', 'seem', 'feel', 'try', 'leave',
    'call', 'need', 'become', 'keep', 'let', 'begin', 'show', 'hear', 'play', 'run',
    'move', 'live', 'believe', 'hold', 'bring', 'happen', 'write', 'provide', 'sit', 'stand',
    'say', 'said', 'put', 'set', 'read', 'meet', 'pay', 'buy', 'lead', 'understand',
    // 基础名词
    'time', 'year', 'people', 'way', 'day', 'man', 'woman', 'child', 'world', 'life',
    'hand', 'part', 'place', 'case', 'week', 'thing', 'home', 'water', 'room', 'side',
    // 基础形容词
    'good', 'new', 'first', 'last', 'long', 'great', 'little', 'own', 'other', 'old',
    'right', 'big', 'high', 'small', 'large', 'next', 'young', 'important', 'few', 'same',
    'able', 'different', 'early', 'possible', 'bad', 'best', 'better', 'sure', 'free', 'true',
    // 数词
    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'hundred', 'thousand', 'million', 'billion', 'first', 'second', 'third',
    // 其他常用词
    'all', 'any', 'some', 'many', 'each', 'every', 'both', 'few', 'more', 'most',
    'another', 'such', 'none', 'own', 'same', 'else', 'enough', 'several'
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
