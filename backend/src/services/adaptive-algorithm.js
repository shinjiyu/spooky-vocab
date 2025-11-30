// Adaptive Learning Algorithm
// Calculates and updates familiarity scores for words

const dictionaryService = require('./dictionary');

class AdaptiveLearningAlgorithm {
  /**
   * Calculate initial familiarity score for a word
   * @param {string} word - The word
   * @param {string} userLevel - User's CEFR level (A1-C2)
   * @returns {number} - Initial score (0-100)
   */
  calculateInitialScore(word, userLevel = 'B1') {
    let score = 0;

    // Get word metadata from dictionary
    const dictEntry = dictionaryService.lookup(word);

    if (dictEntry) {
      // 1. Frequency contribution (0-40 points)
      // Lower frequency_rank = more common = higher score
      const freqRank = dictEntry.frequency_rank;
      if (freqRank < 3000) {
        score += 40;
      } else if (freqRank < 10000) {
        score += 25;
      } else if (freqRank < 30000) {
        score += 15;
      } else {
        score += 5;
      }

      // 2. Collins Stars (0-15 points)
      // More stars = more common
      const collins = dictEntry.collins_stars || 0;
      score += Math.min(collins * 3, 15);

      // 3. Oxford 3000 (0-15 points)
      if (dictEntry.oxford_3000) {
        score += 15;
      }
    } else {
      // Unknown word, assume medium difficulty
      score += 20;
    }

    // 4. User CEFR level adjustment (0-20 points)
    const userLevelScores = {
      'A1': 0,
      'A2': 5,
      'B1': 10,
      'B2': 15,
      'C1': 18,
      'C2': 20
    };
    score += userLevelScores[userLevel] || 10;

    // Clamp score to 0-100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Update familiarity score based on user feedback
   * @param {number} currentScore - Current familiarity score
   * @param {string} action - Action type: 'known', 'unknown', 'encounter'
   * @param {Object} metadata - Additional metadata (encounter_count, etc.)
   * @returns {number} - New score
   */
  updateScore(currentScore, action, metadata = {}) {
    let newScore = currentScore;

    switch (action) {
      case 'known':
        // User clicked "I know this word"
        newScore += 15;
        
        // Special rule: 3 consecutive "known" clicks = mastered
        if (metadata.known_feedback_count >= 3) {
          newScore = Math.max(newScore, 80);
        }
        break;

      case 'unknown':
        // User requested translation (double-click/long-press)
        newScore -= 10;
        break;

      case 'encounter':
        // User encountered this word (shown translation)
        newScore += 2;
        break;

      default:
        break;
    }

    // Apply time decay if last encounter was long ago
    if (metadata.last_encountered) {
      const daysSinceLastEncounter = this.getDaysSince(metadata.last_encountered);
      if (daysSinceLastEncounter > 30) {
        const decayMonths = Math.floor(daysSinceLastEncounter / 30);
        newScore -= decayMonths * 5;
      }
    }

    // Clamp score to 0-100
    return Math.max(0, Math.min(100, newScore));
  }

  /**
   * Determine if a word needs translation based on familiarity score
   * @param {number} score - Familiarity score
   * @returns {boolean} - True if translation should be shown
   */
  needsTranslation(score) {
    // Threshold: score < 65 means "not familiar enough"
    return score < 65;
  }

  /**
   * Get days since a date
   * @param {string} dateString - ISO date string
   * @returns {number} - Days since the date
   */
  getDaysSince(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Get review priority for a word
   * @param {Object} wordRecord - Word record from database
   * @returns {number} - Priority score (higher = more urgent)
   */
  getReviewPriority(wordRecord) {
    let priority = 0;

    // Lower familiarity = higher priority
    priority += (100 - wordRecord.familiarity_score) * 0.5;

    // Words encountered recently but not mastered
    if (wordRecord.encounter_count > 0) {
      priority += Math.min(wordRecord.encounter_count * 5, 30);
    }

    // Words with low feedback engagement
    const totalFeedback = wordRecord.known_feedback_count + wordRecord.unknown_feedback_count;
    if (totalFeedback < 3) {
      priority += 20;
    }

    // Time since last encounter
    if (wordRecord.last_encountered) {
      const daysSince = this.getDaysSince(wordRecord.last_encountered);
      if (daysSince > 7 && daysSince < 30) {
        priority += 15;  // Sweet spot for review
      }
    }

    return priority;
  }
}

module.exports = new AdaptiveLearningAlgorithm();

