// Dictionary service - ECDICT lookup
// Provides word translations, phonetics, and metadata

const { dictDb } = require('../utils/database');

class DictionaryService {
  constructor() {
    this.available = dictDb !== null;
    if (!this.available) {
      console.warn('Dictionary service unavailable - ECDICT not loaded');
    }
  }

  /**
   * Look up a word in the dictionary
   * @param {string} word - Word to look up
   * @returns {Object|null} - Dictionary entry or null
   */
  lookup(word) {
    if (!this.available) {
      return null;
    }

    const lowerWord = word.toLowerCase();

    try {
      // ECDICT schema: word, phonetic, definition, translation, pos, collins, oxford, tag, bnc, frq
      const stmt = dictDb.prepare(`
        SELECT word, phonetic, translation, definition, frq, collins, oxford
        FROM stardict
        WHERE word = ? COLLATE NOCASE
        LIMIT 1
      `);

      const result = stmt.get(lowerWord);

      if (!result) {
        return null;
      }

      // Parse translation (format: "中文1\n中文2\n...")
      let translations = [];
      if (result.translation) {
        translations = result.translation.split('\n').filter(t => t.trim());
      }

      return {
        word: result.word,
        phonetic: result.phonetic || '',
        translation: translations[0] || '',  // Primary translation
        translations: translations.slice(0, 3),  // Top 3 translations
        definition: result.definition || '',
        frequency_rank: result.frq || 999999,  // Lower number = more common
        collins_stars: result.collins || 0,
        oxford_3000: result.oxford === 3
      };
    } catch (error) {
      console.error(`Dictionary lookup error for "${word}":`, error.message);
      return null;
    }
  }

  /**
   * Batch lookup multiple words
   * @param {string[]} words - Array of words
   * @returns {Object} - Map of word to dictionary entry
   */
  batchLookup(words) {
    const results = {};
    
    for (const word of words) {
      const entry = this.lookup(word);
      if (entry) {
        results[word.toLowerCase()] = entry;
      }
    }

    return results;
  }

  /**
   * Check if dictionary is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.available;
  }
}

module.exports = new DictionaryService();

