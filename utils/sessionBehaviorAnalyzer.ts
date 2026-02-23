/**
 * Client-side session behavior analyzer for DPFL
 * Mirrors the backend behaviorLogger.js functionality
 * Analyzes chat messages for personality dimension keywords
 */

// Riemann-Thomann Keywords (bidirectional)
const RIEMANN_KEYWORDS = {
  naehe: {
    high: ['connection', 'relationship', 'harmony', 'togetherness', 'belonging',
      'warmth', 'trust', 'closeness', 'intimacy', 'together', 'team', 'empathy', 'care'],
    low: ['distant', 'detached', 'withdrawn', 'isolated', 'lonely', 'cold', 'impersonal']
  },
  distanz: {
    high: ['autonomy', 'freedom', 'independence', 'self-reliant', 'boundaries',
      'privacy', 'autonomous', 'alone', 'rational', 'logic', 'objective', 'factual'],
    low: ['dependent', 'reliant', 'bound', 'obligated', 'constrained', 'helpless']
  },
  dauer: {
    high: ['security', 'stability', 'planning', 'order', 'reliability',
      'routine', 'structure', 'consistent', 'predictable', 'systematic', 'organized'],
    low: ['insecurity', 'chaos', 'unplanned', 'unstable', 'erratic', 'unreliable']
  },
  wechsel: {
    high: ['change', 'variety', 'novelty', 'spontaneity', 'flexibility',
      'dynamic', 'improvisation', 'creative', 'innovation', 'adventure', 'curious'],
    low: ['stuck', 'rigid', 'monotonous', 'boring', 'inflexible', 'stubborn', 'static']
  }
};

// Big5/OCEAN Keywords (bidirectional)
const BIG5_KEYWORDS = {
  openness: {
    high: ['creative', 'curious', 'imaginative', 'open', 'innovative', 'original', 'philosophical', 'intellectual'],
    low: ['traditional', 'conventional', 'conservative', 'practical', 'routine', 'down-to-earth']
  },
  conscientiousness: {
    high: ['organized', 'punctual', 'structured', 'disciplined', 'conscientious', 'reliable', 'orderly', 'careful'],
    low: ['spontaneous', 'chaotic', 'impulsive', 'forgetful', 'disorganized', 'careless', 'unplanned']
  },
  extraversion: {
    high: ['sociable', 'talkative', 'energetic', 'enthusiastic', 'active', 'outgoing', 'lively'],
    low: ['quiet', 'reserved', 'introverted', 'reflective', 'silent', 'shy', 'withdrawn']
  },
  agreeableness: {
    high: ['helpful', 'cooperative', 'trusting', 'friendly', 'compassionate', 'empathetic', 'warmhearted'],
    low: ['critical', 'competitive', 'skeptical', 'direct', 'confrontational', 'distrustful']
  },
  neuroticism: {
    high: ['anxious', 'nervous', 'insecure', 'worried', 'stressed', 'emotional', 'vulnerable', 'tense'],
    low: ['calm', 'relaxed', 'stable', 'confident', 'balanced', 'serene', 'resilient']
  }
};

// Spiral Dynamics Keywords (bidirectional)
const SD_KEYWORDS = {
  turquoise: {
    high: ['holistic', 'global', 'interconnected', 'ecological', 'collective', 'spiritual', 'consciousness', 'integral'],
    low: ['isolated', 'fragmented', 'short-term', 'materialistic']
  },
  yellow: {
    high: ['systemic', 'complex', 'integrated', 'flexible', 'multiperspective', 'autonomous', 'knowledge', 'functional'],
    low: ['dogmatic', 'rigid', 'one-dimensional', 'simplified']
  },
  green: {
    high: ['community', 'equality', 'harmony', 'consensus', 'inclusion', 'empathy', 'diversity', 'cooperation'],
    low: ['hierarchy', 'exclusion', 'competition', 'dominance', 'elitist']
  },
  orange: {
    high: ['success', 'achievement', 'progress', 'competition', 'profit', 'efficiency', 'strategy', 'innovation'],
    low: ['mediocrity', 'stagnation', 'inefficient', 'unprofessional']
  },
  blue: {
    high: ['order', 'rules', 'duty', 'discipline', 'authority', 'tradition', 'principles', 'responsibility'],
    low: ['chaos', 'lawless', 'irresponsible', 'undisciplined']
  },
  red: {
    high: ['power', 'strength', 'assertion', 'control', 'dominance', 'respect', 'immediate', 'impulse'],
    low: ['weak', 'submissive', 'powerless', 'helpless']
  },
  purple: {
    high: ['belonging', 'ritual', 'tradition', 'ancestors', 'mystical', 'tribe', 'family', 'protection'],
    low: ['uprooted', 'traditionless', 'homeless']
  },
  beige: {
    high: ['survival', 'instinct', 'basic needs', 'safety', 'protection', 'health', 'body'],
    low: ['abundance', 'comfort', 'luxury']
  }
};

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * Count keyword matches in text (bidirectional)
 */
function countKeywords(text: string, highKeywords: string[], lowKeywords: string[]): { high: number; low: number; delta: number } {
  const lowerText = text.toLowerCase();
  let highCount = 0;
  let lowCount = 0;

  for (const word of highKeywords) {
    const regex = new RegExp(`\\b${word}\\w*\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) highCount += matches.length;
  }

  for (const word of lowKeywords) {
    const regex = new RegExp(`\\b${word}\\w*\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) lowCount += matches.length;
  }

  return { high: highCount, low: lowCount, delta: highCount - lowCount };
}

/**
 * Analyze chat history for Riemann-Thomann markers
 */
export function analyzeRiemann(chatHistory: Message[], lang: 'en' = 'en'): Record<string, number> {
  const keywords = RIEMANN_KEYWORDS;
  const userText = chatHistory
    .filter(m => m.role === 'user')
    .map(m => m.text)
    .join(' ');

  const result: Record<string, number> = {};
  for (const [dimension, { high, low }] of Object.entries(keywords)) {
    const { delta } = countKeywords(userText, high, low);
    result[dimension] = delta;
  }

  return result;
}

/**
 * Analyze chat history for Big5/OCEAN markers
 */
export function analyzeBig5(chatHistory: Message[], lang: 'en' = 'en'): Record<string, number> {
  const keywords = BIG5_KEYWORDS;
  const userText = chatHistory
    .filter(m => m.role === 'user')
    .map(m => m.text)
    .join(' ');

  const result: Record<string, number> = {};
  for (const [trait, { high, low }] of Object.entries(keywords)) {
    const { delta } = countKeywords(userText, high, low);
    result[trait] = delta;
  }

  return result;
}

/**
 * Analyze chat history for Spiral Dynamics markers
 */
export function analyzeSD(chatHistory: Message[], lang: 'en' = 'en'): Record<string, number> {
  const keywords = SD_KEYWORDS;
  const userText = chatHistory
    .filter(m => m.role === 'user')
    .map(m => m.text)
    .join(' ');

  const result: Record<string, number> = {};
  for (const [level, { high, low }] of Object.entries(keywords)) {
    const { delta } = countKeywords(userText, high, low);
    result[level] = delta;
  }

  return result;
}

/**
 * Analyze chat history for all profile types
 */
export function analyzeSession(chatHistory: Message[], lang: 'en' = 'en') {
  return {
    riemann: analyzeRiemann(chatHistory, lang),
    big5: analyzeBig5(chatHistory, lang),
    sd: analyzeSD(chatHistory, lang)
  };
}
