// Dictionary service
// Provides word lookup functionality using ECDICT

const { dictDbGet, dictDbAll, connectDictDb } = require('../utils/database');

class DictionaryService {
  constructor() {
    this.ready = false;
    this.init();
  }

  async init() {
    try {
      const db = await connectDictDb();
      this.ready = !!db;
      if (this.ready) {
        console.log('✓ Dictionary service ready (ECDICT loaded)');
      } else {
        console.log('⚠ Dictionary service unavailable - ECDICT not loaded');
      }
    } catch (error) {
      console.error('Dictionary service initialization failed:', error);
      this.ready = false;
    }
  }

  /**
   * Look up a word in the dictionary
   * @param {string} word - Word to look up
   * @returns {Object|null} Dictionary entry or null if not found
   */
  async lookup(word) {
    if (!this.ready) {
      return null;
    }

    try {
      const lowerWord = word.toLowerCase();
      
      const entry = await dictDbGet(`
        SELECT 
          word,
          phonetic,
          translation,
          definition,
          pos,
          collins,
          oxford,
          frq,
          bnc,
          exchange
        FROM stardict 
        WHERE word = ? COLLATE NOCASE
      `, [lowerWord]);

      if (!entry) {
        return null;
      }

      // Parse and format the entry
      return {
        word: entry.word,
        phonetic: entry.phonetic || '',
        translation: this.parseTranslation(entry.translation),
        definition: entry.definition || '',
        pos: entry.pos || '',
        collins: entry.collins || 0,
        oxford: entry.oxford || 0,
        frequency_rank: entry.frq || entry.bnc || null,
        exchange: entry.exchange || ''
      };
    } catch (error) {
      console.error('[Dictionary] Lookup error:', error);
      return null;
    }
  }

  /**
   * Batch lookup multiple words
   * @param {string[]} words - Array of words to look up
   * @returns {Object} Map of word -> dictionary entry
   */
  async batchLookup(words) {
    if (!this.ready || !words || words.length === 0) {
      return {};
    }

    try {
      const lowerWords = words.map(w => w.toLowerCase());
      const placeholders = lowerWords.map(() => '?').join(',');
      
      const entries = await dictDbAll(`
        SELECT 
          word,
          phonetic,
          translation,
          definition,
          pos,
          collins,
          oxford,
          frq,
          bnc
        FROM stardict 
        WHERE word IN (${placeholders}) COLLATE NOCASE
      `, lowerWords);

      const results = {};
      entries.forEach(entry => {
        results[entry.word.toLowerCase()] = {
          word: entry.word,
          phonetic: entry.phonetic || '',
          translation: this.parseTranslation(entry.translation),
          definition: entry.definition || '',
          pos: entry.pos || '',
          collins: entry.collins || 0,
          oxford: entry.oxford || 0,
          frequency_rank: entry.frq || entry.bnc || null
        };
      });

      return results;
    } catch (error) {
      console.error('[Dictionary] Batch lookup error:', error);
      return {};
    }
  }

  /**
   * Parse translation text (handle multi-line translations)
   * @param {string} translation - Raw translation text
   * @returns {string} Formatted translation
   */
  parseTranslation(translation) {
    if (!translation) return '';
    
    // ECDICT translations can have multiple lines
    // Take the first line or combine them intelligently
    const lines = translation.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return '';
    if (lines.length === 1) return lines[0];
    
    // If multiple lines, take up to 2 main meanings
    return lines.slice(0, 2).join('；');
  }

  /**
   * Get word difficulty based on ECDICT data
   * @param {string} word - Word to check
   * @returns {Object} Difficulty assessment
   */
  async getDifficulty(word) {
    const entry = await this.lookup(word);
    
    if (!entry) {
      return {
        level: 'unknown',
        score: 50,
        factors: {}
      };
    }

    // Calculate difficulty based on multiple factors
    let score = 50; // Base score
    const factors = {};

    // Collins star rating (higher = more common = easier)
    if (entry.collins >= 4) {
      score += 25;
      factors.collins = '+25 (4-5 stars)';
    } else if (entry.collins >= 2) {
      score += 15;
      factors.collins = '+15 (2-3 stars)';
    } else if (entry.collins >= 1) {
      score += 5;
      factors.collins = '+5 (1 star)';
    }

    // Oxford 3000
    if (entry.oxford) {
      score += 20;
      factors.oxford = '+20 (Oxford 3000)';
    }

    // Word frequency (lower rank = more common = easier)
    if (entry.frequency_rank) {
      if (entry.frequency_rank <= 1000) {
        score += 25;
        factors.frequency = '+25 (top 1000)';
      } else if (entry.frequency_rank <= 5000) {
        score += 15;
        factors.frequency = '+15 (top 5000)';
      } else if (entry.frequency_rank <= 10000) {
        score += 5;
        factors.frequency = '+5 (top 10000)';
      }
    }

    // Word length penalty (longer = harder)
    const length = word.length;
    if (length >= 12) {
      score -= 10;
      factors.length = '-10 (very long)';
    } else if (length >= 9) {
      score -= 5;
      factors.length = '-5 (long)';
    }

    // Determine level
    let level = 'unknown';
    if (score >= 80) level = 'easy';
    else if (score >= 60) level = 'medium';
    else level = 'hard';

    return {
      level,
      score: Math.max(0, Math.min(100, score)),
      factors
    };
  }

  /**
   * Check if dictionary is ready
   * @returns {boolean}
   */
  isReady() {
    return this.ready;
  }
}

// Export singleton instance
const dictionaryService = new DictionaryService();
module.exports = dictionaryService;
