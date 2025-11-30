// Vocabulary routes
// Endpoints for checking words and getting translations

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { userDb, dbGet, dbRun, dbAll } = require('../utils/database');
const dictionaryService = require('../services/dictionary');

// Apply auth middleware to all routes
router.use(authMiddleware);

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
    // Get user settings
    const userSettings = await dbGet(userDb, `
      SELECT cefr_level FROM user_settings WHERE user_id = ?
    `, [user_id]);

    const userLevel = userSettings?.cefr_level || 'B1';

    // Batch lookup translations if dictionary available
    let dictEntries = {};
    if (dictionaryService.isReady()) {
      dictEntries = await dictionaryService.batchLookup(words);
    }

    const results = {};

    for (const word of words) {
      const lowerWord = word.toLowerCase();

      // Get user's record for this word
      let wordRecord = await dbGet(userDb, `
        SELECT * FROM word_records 
        WHERE user_id = ? AND word = ?
      `, [user_id, lowerWord]);

      // Get dictionary entry
      const dictEntry = dictEntries[lowerWord];
      
      // Calculate initial score using dictionary data if available
      let initialScore;
      if (dictEntry && !wordRecord) {
        // Use dictionary-based scoring
        const difficulty = await dictionaryService.getDifficulty(lowerWord);
        initialScore = difficulty.score;
      } else if (wordRecord) {
        // Use existing score
        initialScore = wordRecord.familiarity_score;
      } else {
        // Fallback to simple judgment
        const judgment = simpleWordJudgment(lowerWord, userLevel, wordRecord);
        initialScore = judgment.score;
      }
      
      // 如果没有记录，创建一个
      if (!wordRecord) {
        await dbRun(userDb, `
          INSERT INTO word_records (
            user_id, word, familiarity_score, encounter_count
          ) VALUES (?, ?, ?, 0)
        `, [user_id, lowerWord, initialScore]);
        
        wordRecord = { 
          familiarity_score: initialScore,
          encounter_count: 0
        };
      }

      // Determine if translation needed
      const needsTranslation = wordRecord.familiarity_score < 65;

      // 构建响应
      results[lowerWord] = {
        needs_translation: needsTranslation,
        familiarity_score: wordRecord.familiarity_score
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

    // Get user's record for this word
    const wordRecord = await dbGet(userDb, `
      SELECT * FROM word_records 
      WHERE user_id = ? AND word = ?
    `, [user_id, lowerWord]);

    // Get user settings for judgment
    const userSettings = await dbGet(userDb, `
      SELECT cefr_level FROM user_settings WHERE user_id = ?
    `, [user_id]);

    const userLevel = userSettings?.cefr_level || 'B1';
    const judgment = simpleWordJudgment(lowerWord, userLevel, wordRecord);

    res.json({
      success: true,
      data: {
        word: lowerWord,
        needs_translation: judgment.needs_translation,
        familiarity_score: wordRecord?.familiarity_score || judgment.score,
        translation: {
          translation: '(需要安装ECDICT词典)',
          phonetic: ''
        },
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
