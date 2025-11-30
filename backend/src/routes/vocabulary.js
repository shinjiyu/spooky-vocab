// Vocabulary routes
// Endpoints for checking words and getting translations

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const dictionaryService = require('../services/dictionary');
const adaptiveAlgorithm = require('../services/adaptive-algorithm');
const { userDb } = require('../utils/database');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/vocabulary/batch-check
 * Check multiple words and return translation info
 */
router.post('/batch-check', (req, res) => {
  const { words } = req.body;
  const user_id = req.user_id;

  if (!Array.isArray(words) || words.length === 0) {
    return res.status(400).json({ 
      error: 'Bad Request',
      message: 'Expected "words" array in request body'
    });
  }

  // Limit batch size
  if (words.length > 1000) {
    return res.status(400).json({ 
      error: 'Bad Request',
      message: 'Maximum 1000 words per request'
    });
  }

  try {
    // Get user settings
    const userSettings = userDb.prepare(`
      SELECT cefr_level FROM user_settings WHERE user_id = ?
    `).get(user_id);

    const userLevel = userSettings?.cefr_level || 'B1';

    const results = {};

    for (const word of words) {
      const lowerWord = word.toLowerCase();

      // Get or create word record
      let wordRecord = userDb.prepare(`
        SELECT * FROM word_records 
        WHERE user_id = ? AND word = ?
      `).get(user_id, lowerWord);

      if (!wordRecord) {
        // First time encountering this word - calculate initial score
        const initialScore = adaptiveAlgorithm.calculateInitialScore(lowerWord, userLevel);
        
        userDb.prepare(`
          INSERT INTO word_records (user_id, word, familiarity_score, encounter_count)
          VALUES (?, ?, ?, 0)
        `).run(user_id, lowerWord, initialScore);

        wordRecord = { familiarity_score: initialScore };
      }

      // Check if translation is needed
      const needsTranslation = adaptiveAlgorithm.needsTranslation(wordRecord.familiarity_score);

      if (needsTranslation) {
        // Get translation from dictionary
        const dictEntry = dictionaryService.lookup(lowerWord);

        if (dictEntry) {
          results[lowerWord] = {
            needTranslation: true,
            translation: dictEntry.translation,
            phonetic: dictEntry.phonetic,
            familiarity_score: wordRecord.familiarity_score
          };
        } else {
          results[lowerWord] = {
            needTranslation: true,
            translation: '(暂无翻译)',
            phonetic: '',
            familiarity_score: wordRecord.familiarity_score
          };
        }
      } else {
        results[lowerWord] = {
          needTranslation: false,
          familiarity_score: wordRecord.familiarity_score
        };
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error in batch-check:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
});

/**
 * GET /api/vocabulary/word/:word
 * Get detailed information about a single word
 */
router.get('/word/:word', (req, res) => {
  const { word } = req.params;
  const user_id = req.user_id;

  try {
    const lowerWord = word.toLowerCase();

    // Get dictionary entry
    const dictEntry = dictionaryService.lookup(lowerWord);

    if (!dictEntry) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: 'Word not found in dictionary'
      });
    }

    // Get user's record for this word
    const wordRecord = userDb.prepare(`
      SELECT * FROM word_records 
      WHERE user_id = ? AND word = ?
    `).get(user_id, lowerWord);

    res.json({
      word: dictEntry.word,
      phonetic: dictEntry.phonetic,
      translation: dictEntry.translation,
      translations: dictEntry.translations,
      definition: dictEntry.definition,
      frequency_rank: dictEntry.frequency_rank,
      user_record: wordRecord ? {
        familiarity_score: wordRecord.familiarity_score,
        encounter_count: wordRecord.encounter_count,
        last_encountered: wordRecord.last_encountered
      } : null
    });
  } catch (error) {
    console.error('Error in word lookup:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
});

module.exports = router;

