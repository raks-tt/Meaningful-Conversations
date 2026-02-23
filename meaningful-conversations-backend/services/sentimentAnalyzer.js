/**
 * Heuristic Sentiment Analyzer
 *
 * Fast, lexicon-based sentiment analysis for keyword context interpretation.
 * Performance: ~20ms per message (no external dependencies, no ML model).
 *
 * Capabilities:
 * - Sentiment polarity detection (-1.0 to +1.0)
 * - Negation recognition ("not spontaneous" → inverted)
 * - Intensity modifiers ("very", "extremely", "somewhat")
 * - Emotional context detection (desired/suffering/neutral)
 * - Caching for repeated messages
 */

// ============================================
// SENTIMENT LEXICONS
// ============================================

const POSITIVE_INDICATORS = {
  en: [
    'enjoy', 'love', 'appreciate', 'like', 'happy', 'fulfills',
    'excited', 'grateful', 'wonderful', 'great', 'amazing',
    'positive', 'pleasant', 'good', 'super', 'awesome',
    'gladly', 'passionate', 'satisfied', 'proud',
    'motivated', 'inspired', 'enriched', 'strengthens'
  ]
};

const NEGATIVE_INDICATORS = {
  en: [
    'annoys', 'bothers', 'burdens', 'disturbs', 'frustrates', 'desperate',
    'unhappy', 'sad', 'anxious', 'stressed', 'overwhelmed',
    'suffer', 'pain', 'problem', 'difficult', 'bad',
    'hate', 'terrible', 'awful', 'unbearable',
    'torments', 'plagues', 'exhausted', 'overloaded'
  ]
};

// ============================================
// INTENSITY MODIFIERS
// ============================================

const INTENSIFIERS = {
  en: {
    high: ['very', 'extremely', 'totally', 'absolutely', 'really', 'incredibly', 'enormously'],
    low: ['somewhat', 'a bit', 'sometimes', 'occasionally', 'slightly', 'rather', 'tends to']
  }
};

const INTENSITY_WEIGHTS = {
  high: 1.5,
  neutral: 1.0,
  low: 0.5
};

// ============================================
// NEGATION PATTERNS
// ============================================

const NEGATION_WORDS = {
  en: ['not', 'no', 'never', 'hardly', 'barely', 'rarely', 'seldom', 'neither']
};

// Window size: how many words before a keyword to check for negation
const NEGATION_WINDOW = 3;

// ============================================
// EMOTIONAL CONTEXT PATTERNS
// ============================================

const DESIRED_PATTERNS = {
  en: [/\benjoy\b/i, /\blove\b/i, /\bappreciate\b/i, /\bneed\b/i, /\bwant\b/i,
       /\bwould like\b/i, /\bgladly\b/i, /\bfulfills me\b/i, /\bmakes me happy\b/i]
};

const SUFFERING_PATTERNS = {
  en: [/\bfeel\b/i, /\bsuffer\b/i, /\bpain\b/i, /\bburdened\b/i,
       /\bstressed\b/i, /\bplagues\b/i, /\btorments\b/i, /\bworries me\b/i,
       /\boverwhelmed\b/i, /\bexhausted\b/i]
};

// ============================================
// SIMPLE IN-MEMORY CACHE
// ============================================

const sentimentCache = new Map();
const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 3600000; // 1 hour

/**
 * Get from cache or null
 */
function getCached(key) {
  const entry = sentimentCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.value;
  }
  if (entry) {
    sentimentCache.delete(key); // Expired
  }
  return null;
}

/**
 * Set cache entry
 */
function setCache(key, value) {
  // Evict oldest entries if at capacity
  if (sentimentCache.size >= CACHE_MAX_SIZE) {
    const firstKey = sentimentCache.keys().next().value;
    sentimentCache.delete(firstKey);
  }
  sentimentCache.set(key, { value, timestamp: Date.now() });
}

/**
 * Clear all cached entries (for testing)
 */
function clearCache() {
  sentimentCache.clear();
}

// ============================================
// CORE SENTIMENT ANALYSIS
// ============================================

/**
 * Detect intensity modifier in context around a word position.
 * @param {string[]} words - Array of words in sentence
 * @param {number} position - Index of the target word
 * @param {string} lang - Language code
 * @returns {'high'|'neutral'|'low'}
 */
function detectIntensity(words, position, lang = 'en') {
  const intensifiers = INTENSIFIERS[lang] || INTENSIFIERS.en;

  // Check 2 words before position
  for (let i = Math.max(0, position - 2); i < position; i++) {
    const word = words[i].toLowerCase();

    if (intensifiers.high.some(int => word.includes(int))) {
      return 'high';
    }
    if (intensifiers.low.some(int => word.includes(int))) {
      return 'low';
    }
  }

  return 'neutral';
}

/**
 * Check if a keyword at a given position is negated.
 * @param {string[]} words - Array of words in sentence
 * @param {number} position - Index of the keyword
 * @param {string} lang - Language code
 * @returns {boolean} true if negated
 */
function isNegated(words, position, lang = 'en') {
  const negations = NEGATION_WORDS[lang] || NEGATION_WORDS.en;

  // Check NEGATION_WINDOW words before the keyword
  const startIdx = Math.max(0, position - NEGATION_WINDOW);
  for (let i = startIdx; i < position; i++) {
    const word = words[i].toLowerCase();
    if (negations.some(neg => word === neg)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate sentiment polarity for a sentence.
 *
 * @param {string} sentence - The sentence to analyze
 * @param {string} lang - Language code
 * @returns {number} Polarity from -1.0 (very negative) to +1.0 (very positive)
 */
function calculateSentiment(sentence, lang = 'en') {
  if (!sentence || sentence.trim().length === 0) {
    return 0;
  }

  const words = sentence.toLowerCase().split(/\s+/);
  const positives = POSITIVE_INDICATORS[lang] || POSITIVE_INDICATORS.en;
  const negatives = NEGATIVE_INDICATORS[lang] || NEGATIVE_INDICATORS.en;

  let score = 0;
  let matchCount = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let wordScore = 0;

    // Check positive indicators
    if (positives.some(pos => word.includes(pos))) {
      wordScore = 1.0;
    }
    // Check negative indicators
    else if (negatives.some(neg => word.includes(neg))) {
      wordScore = -1.0;
    }
    else {
      continue;
    }

    // Check for negation
    if (isNegated(words, i, lang)) {
      wordScore *= -0.8; // Invert, slightly reduced (negated positive isn't as strong as direct negative)
    }

    // Check for intensity
    const intensity = detectIntensity(words, i, lang);
    wordScore *= INTENSITY_WEIGHTS[intensity];

    score += wordScore;
    matchCount++;
  }

  // Normalize to -1.0 to +1.0
  if (matchCount === 0) return 0;
  return Math.max(-1.0, Math.min(1.0, score / Math.sqrt(matchCount)));
}

/**
 * Detect the emotional context of a sentence.
 *
 * @param {string} sentence - The sentence
 * @param {number} sentimentScore - Pre-calculated sentiment polarity
 * @param {string} lang - Language code
 * @returns {string} One of: 'desired_positive', 'desired_negative', 'suffering', 'positive', 'negative', 'neutral'
 */
function detectEmotionalContext(sentence, sentimentScore, lang = 'en') {
  if (!sentence) return 'neutral';

  const desired = DESIRED_PATTERNS[lang] || DESIRED_PATTERNS.en;
  const suffering = SUFFERING_PATTERNS[lang] || SUFFERING_PATTERNS.en;

  const hasDesiredPattern = desired.some(pattern => pattern.test(sentence));
  const hasSufferingPattern = suffering.some(pattern => pattern.test(sentence));

  if (hasDesiredPattern && sentimentScore > 0) {
    return 'desired_positive';
  }
  if (hasDesiredPattern && sentimentScore <= 0) {
    return 'desired_negative';
  }
  if (hasSufferingPattern || sentimentScore < -0.3) {
    return 'suffering';
  }
  if (sentimentScore > 0.3) {
    return 'positive';
  }
  if (sentimentScore < -0.1) {
    return 'negative';
  }

  return 'neutral';
}

// ============================================
// KEYWORD-LEVEL SENTIMENT ANALYSIS
// ============================================

/**
 * Analyze sentiment specifically around a keyword in a sentence.
 * This is used by the adaptive weighting engine to adjust keyword weights.
 *
 * @param {string} keyword - The keyword that was found
 * @param {string} sentence - The sentence containing the keyword
 * @param {string} direction - 'high' or 'low' (the keyword's direction)
 * @param {string} lang - Language code
 * @returns {{ adjustedDirection: string, weightMultiplier: number, negated: boolean, intensity: string, emotionalContext: string }}
 */
function analyzeKeywordSentiment(keyword, sentence, direction, lang = 'en') {
  if (!sentence || !keyword) {
    return {
      adjustedDirection: direction,
      weightMultiplier: 1.0,
      negated: false,
      intensity: 'neutral',
      emotionalContext: 'neutral'
    };
  }

  const words = sentence.toLowerCase().split(/\s+/);
  const keywordLower = keyword.toLowerCase();

  // Find keyword position(s) in sentence
  let keywordPosition = -1;
  for (let i = 0; i < words.length; i++) {
    if (words[i].includes(keywordLower)) {
      keywordPosition = i;
      break;
    }
  }

  if (keywordPosition === -1) {
    return {
      adjustedDirection: direction,
      weightMultiplier: 1.0,
      negated: false,
      intensity: 'neutral',
      emotionalContext: 'neutral'
    };
  }

  // Check negation
  const negated = isNegated(words, keywordPosition, lang);

  // Check intensity
  const intensity = detectIntensity(words, keywordPosition, lang);

  // Get sentence-level sentiment
  const sentimentScore = calculateSentiment(sentence, lang);
  const emotionalContext = detectEmotionalContext(sentence, sentimentScore, lang);

  // Determine adjusted direction and weight
  let adjustedDirection = direction;
  let weightMultiplier = INTENSITY_WEIGHTS[intensity];

  // Negation: invert direction
  if (negated) {
    adjustedDirection = direction === 'high' ? 'low' : 'high';
    weightMultiplier *= 0.8; // Slightly reduced confidence for negated keywords
  }

  // Sentiment-based adjustments
  if (direction === 'high' && sentimentScore < -0.3 && emotionalContext === 'suffering') {
    // User mentions a "high" keyword negatively → they might be rejecting it
    // Example: "Teams annoy me" → 'team' is high for Nähe, but user rejects it
    weightMultiplier *= 0.4; // Drastically reduce weight
  } else if (direction === 'high' && sentimentScore > 0.3 && emotionalContext === 'desired_positive') {
    // User explicitly enjoys/values this → boost
    // Example: "I love teamwork" → boost
    weightMultiplier *= 1.3;
  } else if (direction === 'low' && sentimentScore > 0.3 && emotionalContext === 'desired_positive') {
    // User mentions a "low" keyword positively → might be desired, not suffering
    // Example: "I enjoy being alone" → 'alone' is low for Nähe, but positive
    // This means the user VALUES this low-state → adjust
    weightMultiplier *= 0.6; // Reduce, as it's not true "low" (suffering)
  }

  // Cap weight multiplier
  weightMultiplier = Math.max(0.1, Math.min(2.0, weightMultiplier));

  return {
    adjustedDirection,
    weightMultiplier,
    negated,
    intensity,
    emotionalContext,
    sentimentScore
  };
}

// ============================================
// MAIN ANALYSIS FUNCTION (with caching)
// ============================================

/**
 * Analyze sentiment of a full message (cached).
 *
 * @param {string} message - The full user message
 * @param {string} lang - Language code
 * @returns {{ polarity: number, emotionalContext: string, confidence: number, isAmbiguous: boolean }}
 */
function analyzeSentiment(message, lang = 'en') {
  if (!message || message.trim().length === 0) {
    return { polarity: 0, emotionalContext: 'neutral', confidence: 0, isAmbiguous: true };
  }

  // Check cache
  const cacheKey = `${lang}:${message.toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  // Compute
  const polarity = calculateSentiment(message, lang);
  const emotionalContext = detectEmotionalContext(message, polarity, lang);
  const confidence = Math.abs(polarity);
  const isAmbiguous = Math.abs(polarity) < 0.2;

  const result = { polarity, emotionalContext, confidence, isAmbiguous };

  // Cache result
  setCache(cacheKey, result);

  return result;
}

module.exports = {
  analyzeSentiment,
  analyzeKeywordSentiment,
  calculateSentiment,
  detectEmotionalContext,
  isNegated,
  detectIntensity,
  clearCache,
  NEGATION_WORDS,
  POSITIVE_INDICATORS,
  NEGATIVE_INDICATORS
};
