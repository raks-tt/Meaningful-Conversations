/**
 * Context Analyzer Service
 *
 * Analyzes conversational context to improve keyword weighting accuracy.
 * Detects:
 * - Topic (work, relationships, values, personal growth)
 * - Linguistic patterns ("ich bin", "ich schätze", "ich brauche")
 * - Co-occurring keywords within the same sentence
 *
 * Performance: ~10ms per message
 */

// ============================================
// TOPIC DETECTION PATTERNS
// ============================================

const TOPIC_PATTERNS = {
  work: {
    en: ['work', 'job', 'career', 'profession', 'project', 'colleague', 'boss', 'company',
         'office', 'meeting', 'deadline', 'firm', 'department', 'supervisor', 'task',
         'professional', 'business', 'employee', 'industry', 'position']
  },
  relationships: {
    en: ['relationship', 'friend', 'family', 'partner', 'love', 'closeness', 'marriage',
         'parents', 'children', 'siblings', 'trust', 'separation', 'together',
         'bond', 'affection', 'intimacy', 'friendship']
  },
  values: {
    en: ['value', 'principle', 'moral', 'ethic', 'belief', 'conviction', 'meaning',
         'purpose', 'justice', 'truth', 'ideal', 'responsibility',
         'duty', 'conscience', 'attitude', 'stance']
  },
  personalGrowth: {
    en: ['development', 'growth', 'learning', 'change', 'goal', 'potential',
         'strength', 'weakness', 'reflection', 'progress', 'self', 'aware',
         'insight', 'maturity', 'personality', 'improve']
  }
};

// ============================================
// LINGUISTIC PATTERNS
// ============================================

const LINGUISTIC_PATTERNS = {
  // "i am..." → Describes personality trait → Big5 primary
  trait: {
    en: [
      /\bi am\b/i,
      /\bi feel\b/i,
      /\bi've always been\b/i,
      /\bby nature\b/i,
      /\bi tend to\b/i
    ]
  },
  // "i value..." → Describes values → Spiral Dynamics primary
  value: {
    en: [
      /\bi value\b/i,
      /\bi appreciate\b/i,
      /\bimportant to me\b/i,
      /\bi believe in\b/i,
      /\bi stand for\b/i,
      /\bwhat matters to me\b/i
    ]
  },
  // "i need..." → Describes need → Riemann primary
  need: {
    en: [
      /\bi need\b/i,
      /\bi require\b/i,
      /\bit's important for me\b/i,
      /\bi miss\b/i,
      /\bi long for\b/i,
      /\bi wish for\b/i
    ]
  }
};

// ============================================
// TOPIC DETECTION
// ============================================

/**
 * Detect conversation topic from recent messages.
 * Uses keyword counting across recent history.
 *
 * @param {string[]} recentMessages - Last 3-5 user messages
 * @param {string} lang - Language code ('de' or 'en')
 * @returns {{ topic: string|null, confidence: number, scores: object }}
 */
function detectTopic(recentMessages, lang = 'en') {
  if (!recentMessages || recentMessages.length === 0) {
    return { topic: null, confidence: 0, scores: {} };
  }

  const combinedText = recentMessages.join(' ').toLowerCase();
  const scores = {};

  for (const [topic, patterns] of Object.entries(TOPIC_PATTERNS)) {
    const langPatterns = patterns[lang] || patterns.en;
    let score = 0;

    for (const keyword of langPatterns) {
      // Count occurrences
      const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
      const matches = combinedText.match(regex);
      if (matches) {
        score += matches.length;
      }
    }

    scores[topic] = score;
  }

  // Find dominant topic
  const sortedTopics = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topScore = sortedTopics[0][1];
  const secondScore = sortedTopics.length > 1 ? sortedTopics[1][1] : 0;

  // Only return topic if there's a clear winner (at least 2 keywords, and 1.5x the runner-up)
  if (topScore >= 2 && (secondScore === 0 || topScore / secondScore >= 1.5)) {
    return {
      topic: sortedTopics[0][0],
      confidence: Math.min(1.0, topScore / 5), // 5 keywords = max confidence
      scores
    };
  }

  return { topic: null, confidence: 0, scores };
}

// ============================================
// LINGUISTIC PATTERN DETECTION
// ============================================

/**
 * Detect linguistic pattern in a sentence.
 *
 * @param {string} sentence - Single sentence to analyze
 * @param {string} lang - Language code
 * @returns {{ pattern: string|null, confidence: number }}
 */
function detectLinguisticPattern(sentence, lang = 'en') {
  if (!sentence) {
    return { pattern: null, confidence: 0 };
  }

  for (const [patternName, patterns] of Object.entries(LINGUISTIC_PATTERNS)) {
    const langPatterns = patterns[lang] || patterns.en;

    for (const regex of langPatterns) {
      if (regex.test(sentence)) {
        return {
          pattern: patternName,
          confidence: 0.8 // Regex match → fairly confident
        };
      }
    }
  }

  return { pattern: null, confidence: 0 };
}

// ============================================
// CO-KEYWORD DETECTION
// ============================================

/**
 * Split message into sentences.
 * @param {string} message - Full message
 * @returns {string[]}
 */
function splitIntoSentences(message) {
  // Split on sentence-ending punctuation, keeping sentences that are at least 2 chars
  return message
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 1);
}

/**
 * Find co-occurring keywords within the same sentence.
 *
 * @param {string} sentence - Single sentence
 * @param {string[]} allKeywords - All possible keywords to check
 * @returns {string[]} Keywords found in this sentence
 */
function findCoKeywords(sentence, allKeywords) {
  if (!sentence || !allKeywords || allKeywords.length === 0) {
    return [];
  }

  const lowerSentence = sentence.toLowerCase();
  const found = [];

  for (const keyword of allKeywords) {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\w*\\b`, 'i');
    if (regex.test(lowerSentence)) {
      found.push(keyword.toLowerCase());
    }
  }

  return found;
}

// ============================================
// MAIN CONTEXT ANALYSIS
// ============================================

/**
 * Perform full context analysis on a user message.
 *
 * @param {string} message - Current user message
 * @param {string[]} recentMessages - Last 3-5 user messages (for topic detection)
 * @param {string[]} overlappingKeywords - Keywords that appear in multiple frameworks
 * @param {string} lang - Language code
 * @returns {object} Context analysis result
 */
function analyzeContext(message, recentMessages = [], overlappingKeywords = [], lang = 'en') {
  if (!message) {
    return {
      topic: { topic: null, confidence: 0, scores: {} },
      linguisticPattern: { pattern: null, confidence: 0 },
      sentences: [],
      sentenceContexts: []
    };
  }

  // Include current message in topic detection
  const allMessages = [...recentMessages, message];

  // 1. Detect topic from conversation history
  const topic = detectTopic(allMessages, lang);

  // 2. Split message into sentences for fine-grained analysis
  const sentences = splitIntoSentences(message);

  // 3. Analyze each sentence
  const sentenceContexts = sentences.map(sentence => {
    const linguisticPattern = detectLinguisticPattern(sentence, lang);
    const coKeywords = findCoKeywords(sentence, overlappingKeywords);

    return {
      sentence,
      linguisticPattern,
      coKeywords,
      coKeywordCount: coKeywords.length
    };
  });

  // 4. Overall linguistic pattern (from full message)
  const overallPattern = detectLinguisticPattern(message, lang);

  return {
    topic,
    linguisticPattern: overallPattern,
    sentences,
    sentenceContexts
  };
}

module.exports = {
  analyzeContext,
  detectTopic,
  detectLinguisticPattern,
  findCoKeywords,
  splitIntoSentences,
  TOPIC_PATTERNS,
  LINGUISTIC_PATTERNS
};
