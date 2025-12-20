// Feedback routes
// Endpoints for user feedback (known/unknown words)

const express = require('express');
const router = express.Router();
// 注意：认证已在server.js中统一处理，无需在此处重复
const { getCollection } = require('../utils/database');
const dictionaryService = require('../services/dictionary');

/**
 * 验证单词是否有效（可入库）
 * @param {string} word - 单词
 * @param {Object} dictEntry - 词典条目
 * @param {boolean} dictChecked - 是否已检查词典
 * @returns {Object} { valid: boolean, reason: string }
 */
function isValidWord(word, dictEntry, dictChecked = false) {
  const lowerWord = word.toLowerCase();
  
  // 1. 长度检查
  if (lowerWord.length < 2 || lowerWord.length > 30) {
    return { valid: false, reason: 'invalid_length' };
  }
  
  // 2. 格式检查：只允许纯英文字母（可包含连字符和撇号）
  const validPattern = /^[a-z]([a-z'-]*[a-z])?$/;
  if (!validPattern.test(lowerWord)) {
    return { valid: false, reason: 'invalid_format' };
  }
  
  // 3. 不允许连续的特殊字符
  if (/[-']{2,}/.test(lowerWord)) {
    return { valid: false, reason: 'invalid_format' };
  }
  
  // 4. 如果已检查词典，必须存在（有翻译）
  if (dictChecked && (!dictEntry || !dictEntry.translation)) {
    return { valid: false, reason: 'not_in_dictionary' };
  }
  
  return { valid: true, reason: 'ok' };
}

/**
 * POST /api/feedback/known
 * Mark a word as known by the user
 */
router.post('/known', async (req, res) => {
  const { word, timestamp } = req.body;
  const user_id = req.user_id;

  if (!word) {
    return res.status(400).json({ 
      error: {
        code: 'INVALID_PARAMETERS',
        message: 'Missing required field: word'
      }
    });
  }

  try {
    const lowerWord = word.toLowerCase();
    const wordRecords = getCollection('word_records');
    const now = new Date();

    // Get or create word record
    const wordRecord = await wordRecords.findOne({ user_id, word: lowerWord });

    if (!wordRecord) {
      // 验证单词有效性（只对新单词验证）
      let dictEntry = null;
      if (dictionaryService.isReady()) {
        dictEntry = await dictionaryService.lookup(lowerWord);
      }
      
      const dictChecked = dictionaryService.isReady();
      const validation = isValidWord(lowerWord, dictEntry, dictChecked);
      if (!validation.valid) {
        console.log(`[Feedback API] Rejected invalid word: ${lowerWord}, reason: ${validation.reason}`);
        return res.json({
          success: true,
          data: {
            word: lowerWord,
            action: 'rejected',
            reason: validation.reason
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Create new record with high score
      await wordRecords.insertOne({
        user_id,
        word: lowerWord,
        familiarity_score: 80,
        known_feedback_count: 1,
        unknown_feedback_count: 0,
        encounter_count: 0,
        last_encountered: now,
        created_at: now,
        updated_at: now,
        // FSRS fields
        stability: 0,
        difficulty: 5.0,
        state: 0,
        due_date: null,
        last_review: null,
        reps: 0,
        lapses: 0
      });
    } else {
      // Update existing record
      const newScore = Math.min(100, wordRecord.familiarity_score + 15);
      
      await wordRecords.updateOne(
        { user_id, word: lowerWord },
        {
          $set: {
            familiarity_score: newScore,
            last_encountered: now,
            updated_at: now
          },
          $inc: {
            known_feedback_count: 1
          }
        }
      );
    }

    res.json({
      success: true,
      data: {
        word: lowerWord,
        action: 'marked_as_known'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Feedback API] Error marking word as known:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark word as known',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/feedback/unknown
 * Mark a word as unknown by the user (user requested translation)
 */
router.post('/unknown', async (req, res) => {
  const { word, context, url, timestamp } = req.body;
  const user_id = req.user_id;

  if (!word) {
    return res.status(400).json({ 
      error: {
        code: 'INVALID_PARAMETERS',
        message: 'Missing required field: word'
      }
    });
  }

  try {
    const lowerWord = word.toLowerCase();
    
    // 验证单词有效性
    let dictEntry = null;
    if (dictionaryService.isReady()) {
      dictEntry = await dictionaryService.lookup(lowerWord);
    }
    
    const dictChecked = dictionaryService.isReady();
    const validation = isValidWord(lowerWord, dictEntry, dictChecked);
    if (!validation.valid) {
      console.log(`[Feedback API] Rejected invalid word: ${lowerWord}, reason: ${validation.reason}`);
      return res.json({
        success: true,
        data: {
          word: lowerWord,
          action: 'rejected',
          reason: validation.reason
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const wordRecords = getCollection('word_records');
    const wordContexts = getCollection('word_contexts');
    const now = new Date();

    // Get or create word record
    const wordRecord = await wordRecords.findOne({ user_id, word: lowerWord });

    if (!wordRecord) {
      // Create new record with low score
      await wordRecords.insertOne({
        user_id,
        word: lowerWord,
        familiarity_score: 30,
        known_feedback_count: 0,
        unknown_feedback_count: 1,
        encounter_count: 0,
        last_encountered: now,
        created_at: now,
        updated_at: now,
        // FSRS fields
        stability: 0,
        difficulty: 5.0,
        state: 0,
        due_date: null,
        last_review: null,
        reps: 0,
        lapses: 0
      });
    } else {
      // Update existing record
      const newScore = Math.max(0, wordRecord.familiarity_score - 10);
      
      await wordRecords.updateOne(
        { user_id, word: lowerWord },
        {
          $set: {
            familiarity_score: newScore,
            last_encountered: now,
            updated_at: now
          },
          $inc: {
            unknown_feedback_count: 1
          }
        }
      );
    }

    // Save context if provided
    if (context) {
      await wordContexts.insertOne({
        user_id,
        word: lowerWord,
        sentence: context,
        url: url || '',
        created_at: now
      });
    }

    res.json({
      success: true,
      data: {
        word: lowerWord,
        action: 'marked_as_unknown'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Feedback API] Error marking word as unknown:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark word as unknown',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/feedback/encounter
 * Record that user encountered a word
 */
router.post('/encounter', async (req, res) => {
  const { word, timestamp } = req.body;
  const user_id = req.user_id;

  if (!word) {
    return res.status(400).json({ 
      error: {
        code: 'INVALID_PARAMETERS',
        message: 'Missing required field: word'
      }
    });
  }

  try {
    const lowerWord = word.toLowerCase();
    const wordRecords = getCollection('word_records');
    const now = new Date();

    // Get or create word record
    const wordRecord = await wordRecords.findOne({ user_id, word: lowerWord });

    if (!wordRecord) {
      // Create new record
      await wordRecords.insertOne({
        user_id,
        word: lowerWord,
        familiarity_score: 50,
        known_feedback_count: 0,
        unknown_feedback_count: 0,
        encounter_count: 1,
        last_encountered: now,
        created_at: now,
        updated_at: now,
        // FSRS fields
        stability: 0,
        difficulty: 5.0,
        state: 0,
        due_date: null,
        last_review: null,
        reps: 0,
        lapses: 0
      });
    } else {
      // Update encounter count and slight score increase
      const newScore = Math.min(100, wordRecord.familiarity_score + 2);
      
      await wordRecords.updateOne(
        { user_id, word: lowerWord },
        {
          $set: {
            familiarity_score: newScore,
            last_encountered: now,
            updated_at: now
          },
          $inc: {
            encounter_count: 1
          }
        }
      );
    }

    res.json({
      success: true,
      data: {
        word: lowerWord,
        action: 'encounter_recorded'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Feedback API] Error recording encounter:', error);
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to record encounter',
        details: error.message
      }
    });
  }
});

module.exports = router;
