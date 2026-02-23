// DPC Strategy Merger
// Intelligently merges personality strategies from multiple models (Riemann, Big5, SD)
// with conflict detection and resolution

const { RIEMANN_STRATEGIES, BIG5_STRATEGIES, SD_STRATEGIES } = require('./dpcStrategies');

/**
 * StrategyMerger Class
 * Extracts dimensions from all personality models, detects conflicts, and merges strategies intelligently
 */
class StrategyMerger {
  constructor(profile, lang = 'en') {
    this.profile = profile;
    this.lang = lang;
    this.dimensions = []; // All weighted dimensions from all models
    this.conflicts = [];  // Detected contradictions
  }

  /**
   * Main method: Extract, detect, merge
   * @returns {Object} Merged strategy result
   */
  merge() {
    this.extractDimensions();
    this.detectConflicts();
    return this.mergeStrategies();
  }

  /**
   * 1. Extract and weight all dimensions from all models
   */
  extractDimensions() {
    // Riemann: Weight by extremity (distance from 50)
    // Uses 'selbst' (self-image) as primary context for coaching — the client
    // shows up as "themselves" in a coaching session, not in a work or private role.
    // DPFL refinement only updates 'selbst'; beruf and privat are set in the questionnaire.
    if (this.profile.riemann && this.profile.riemann.selbst) {
      const traits = ['dauer', 'wechsel', 'naehe', 'distanz'];
      traits.forEach(trait => {
        const score = this.profile.riemann.selbst[trait];
        if (score !== undefined && score !== null) {
          const isHigh = score > 50;
          const level = isHigh ? 'high' : 'low';
          const strategy = RIEMANN_STRATEGIES[trait]?.[level]?.[this.lang] ||
                          RIEMANN_STRATEGIES[trait]?.[level]?.['en'];
          
          if (strategy) {
            this.dimensions.push({
              model: 'riemann',
              trait,
              score,
              weight: Math.abs(score - 50) / 50, // 0-1 scale: how far from neutral
              isHigh,
              strategy
            });
          }
        }
      });
    }

    // Big5: Weight by extremity (distance from 3)
    if (this.profile.big5) {
      const traits = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
      traits.forEach(trait => {
        const score = this.profile.big5[trait];
        if (score !== undefined && score !== null) {
          const isHigh = score >= 4;
          const level = isHigh ? 'high' : 'low';
          const strategy = BIG5_STRATEGIES[trait]?.[level]?.[this.lang] ||
                          BIG5_STRATEGIES[trait]?.[level]?.['en'];
          
          if (strategy) {
            this.dimensions.push({
              model: 'big5',
              trait,
              score,
              weight: Math.abs(score - 3) / 2, // 0-1 scale: 1-5 normalized to distance from 3
              isHigh,
              strategy
            });
          }
        }
      });
    }

    // Spiral Dynamics: Weight top 2 levels
    if (this.profile.spiralDynamics && this.profile.spiralDynamics.levels) {
      const sd = this.profile.spiralDynamics;
      const levels = ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise'];
      
      // Sort levels by ranking (1 = most dominant)
      const rankedLevels = levels
        .map(level => ({
          level,
          rank: sd.levels[level] || 8
        }))
        .sort((a, b) => a.rank - b.rank);
      
      // Take top 2 dominant levels
      rankedLevels.slice(0, 2).forEach((levelData, index) => {
        const strategy = SD_STRATEGIES[levelData.level]?.high?.[this.lang] ||
                        SD_STRATEGIES[levelData.level]?.high?.['en'];
        
        if (strategy) {
          this.dimensions.push({
            model: 'sd',
            trait: levelData.level,
            score: levelData.rank,
            weight: index === 0 ? 1.0 : 0.7, // Primary level gets full weight, secondary 70%
            isHigh: true,
            strategy
          });
        }
      });
    }

    // Sort by weight (most extreme/significant first)
    this.dimensions.sort((a, b) => b.weight - a.weight);
  }

  /**
   * 2. Detect conflicts between strategies
   */
  detectConflicts() {
    // Only check dimensions with significant weight (> 0.4)
    const significantDims = this.dimensions.filter(d => d.weight > 0.4);

    for (let i = 0; i < significantDims.length; i++) {
      for (let j = i + 1; j < significantDims.length; j++) {
        const conflict = this.checkStrategyConflict(significantDims[i], significantDims[j]);
        if (conflict) {
          this.conflicts.push({
            dim1: significantDims[i],
            dim2: significantDims[j],
            type: conflict.type,
            severity: conflict.severity
          });
        }
      }
    }
  }

  /**
   * Check if two dimensions have conflicting strategies
   * @param {Object} dim1 - First dimension
   * @param {Object} dim2 - Second dimension
   * @returns {Object|null} Conflict object or null
   */
  checkStrategyConflict(dim1, dim2) {
    const lang1 = dim1.strategy.language?.toLowerCase() || '';
    const lang2 = dim2.strategy.language?.toLowerCase() || '';
    const tone1 = dim1.strategy.tone?.toLowerCase() || '';
    const tone2 = dim2.strategy.tone?.toLowerCase() || '';

    // Define conflict pairs
    const conflictPairs = [
      {
        keywords: ['structured', 'planned', 'organised'],
        opposite: ['spontaneous', 'flexible', 'improv']
      },
      {
        keywords: ['rational', 'objective', 'factual'],
        opposite: ['empathetic', 'warm', 'emotional', 'caring']
      },
      {
        keywords: ['brief', 'concise', 'short'],
        opposite: ['elaborate', 'detailed', 'comprehensive']
      },
      {
        keywords: ['reserved', 'quiet', 'introspective'],
        opposite: ['sociable', 'energetic', 'expressive']
      }
    ];

    // Check language conflicts
    for (const pair of conflictPairs) {
      const has1 = pair.keywords.some(k => lang1.includes(k) || tone1.includes(k));
      const has2 = pair.opposite.some(k => lang2.includes(k) || tone2.includes(k));
      
      if (has1 && has2) {
        return { 
          type: 'language_tone_conflict', 
          severity: Math.min(dim1.weight, dim2.weight),
          description: `${dim1.model}:${dim1.trait} vs ${dim2.model}:${dim2.trait}`
        };
      }
    }

    return null;
  }

  /**
   * 3. Merge strategies based on conflicts
   * @returns {Object} Final merged strategy
   */
  mergeStrategies() {
    if (this.conflicts.length === 0) {
      // No conflicts - use weighted combination
      return this.simpleWeightedMerge();
    } else {
      // Resolve conflicts and merge
      return this.conflictAwareMerge();
    }
  }

  /**
   * Simple weighted merge (no conflicts)
   * @returns {Object} Merged strategy result
   */
  simpleWeightedMerge() {
    // Take top 3 dimensions with significant weight
    const topDimensions = this.dimensions.filter(d => d.weight > 0.3).slice(0, 3);
    
    if (topDimensions.length === 0) {
      return this.getEmptyResult();
    }

    return {
      primary: {
        language: this.combineStrategies(topDimensions, 'language'),
        tone: this.combineStrategies(topDimensions, 'tone'),
        approach: this.combineStrategies(topDimensions, 'approach')
      },
      blindspots: this.getWeightedBlindspots(),
      conflicts: [],
      metadata: {
        models: [...new Set(topDimensions.map(d => d.model))],
        topDimensions: topDimensions.map(d => ({
          model: d.model,
          trait: d.trait,
          weight: d.weight,
          included: true
        })),
        mergeType: 'simple_weighted'
      }
    };
  }

  /**
   * Conflict-aware merge (with conflict resolution)
   * @returns {Object} Merged strategy result
   */
  conflictAwareMerge() {
    // Sort conflicts by severity (highest first)
    this.conflicts.sort((a, b) => b.severity - a.severity);

    // Track which dimensions to keep and exclude
    const excluded = new Set();

    // For each conflict, exclude the lower-weighted dimension
    for (const conflict of this.conflicts) {
      // Skip if either dimension already processed
      if (excluded.has(conflict.dim1) || excluded.has(conflict.dim2)) continue;

      // Keep higher-weighted dimension, exclude lower
      if (conflict.dim1.weight > conflict.dim2.weight) {
        excluded.add(conflict.dim2);
      } else {
        excluded.add(conflict.dim1);
      }
    }

    // Build strategy from non-conflicting dimensions
    const usableDimensions = this.dimensions
      .filter(d => !excluded.has(d) && d.weight > 0.3)
      .slice(0, 3);

    if (usableDimensions.length === 0) {
      return this.getEmptyResult();
    }

    return {
      primary: {
        language: this.combineStrategies(usableDimensions, 'language'),
        tone: this.combineStrategies(usableDimensions, 'tone'),
        approach: this.combineStrategies(usableDimensions, 'approach')
      },
      blindspots: this.getWeightedBlindspots(),
      conflicts: this.conflicts.map(c => ({
        kept: `${c.dim1.model}:${c.dim1.trait} (weight: ${c.dim1.weight.toFixed(2)})`,
        excluded: `${c.dim2.model}:${c.dim2.trait} (weight: ${c.dim2.weight.toFixed(2)})`,
        reason: c.type,
        severity: c.severity.toFixed(2)
      })),
      metadata: {
        models: [...new Set(usableDimensions.map(d => d.model))],
        topDimensions: this.dimensions.slice(0, 5).map(d => ({
          model: d.model,
          trait: d.trait,
          weight: d.weight,
          included: !excluded.has(d) && d.weight > 0.3
        })),
        mergeType: 'conflict_aware'
      }
    };
  }

  /**
   * Combine strategy field from multiple dimensions
   * @param {Array} dimensions - Dimensions to combine
   * @param {string} field - Field to combine (language, tone, approach)
   * @returns {string} Combined strategy text
   */
  combineStrategies(dimensions, field) {
    if (dimensions.length === 0) return '';
    if (dimensions.length === 1) return dimensions[0].strategy[field] || '';

    // For multiple dimensions: prioritize by weight, combine top 2
    const sorted = dimensions
      .filter(d => d.strategy[field])
      .sort((a, b) => b.weight - a.weight);

    if (sorted.length === 0) return '';
    if (sorted.length === 1) return sorted[0].strategy[field];

    // Combine top 2 with weight indication
    const primary = sorted[0];
    const secondary = sorted[1];

    // If weights are very similar (within 0.15), treat equally
    if (Math.abs(primary.weight - secondary.weight) < 0.15) {
      return `${primary.strategy[field]}; ${secondary.strategy[field]}`;
    } else {
      // Primary dominates, secondary as supplement
      return `${primary.strategy[field]} (primary); ${secondary.strategy[field]} (supplementary)`;
    }
  }

  /**
   * Get weighted blindspots from low/weak dimensions
   * @returns {Array} Array of blindspot objects
   */
  getWeightedBlindspots() {
    // Get all dimensions that represent weaknesses/blindspots
    const blindspotDimensions = [];

    // Riemann: traits with low scores (< 30) — uses 'selbst' context (see extractDimensions)
    if (this.profile.riemann && this.profile.riemann.selbst) {
      const traits = ['dauer', 'wechsel', 'naehe', 'distanz'];
      traits.forEach(trait => {
        const score = this.profile.riemann.selbst[trait];
        if (score < 30) {
          const strategy = RIEMANN_STRATEGIES[trait]?.low?.[this.lang] ||
                          RIEMANN_STRATEGIES[trait]?.low?.['en'];
          if (strategy) {
            blindspotDimensions.push({
              model: 'riemann',
              trait,
              score,
              weight: (30 - score) / 30, // Higher weight for lower scores
              strategy
            });
          }
        }
      });
    }

    // Big5: traits with extreme low or high scores
    if (this.profile.big5) {
      const traits = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
      traits.forEach(trait => {
        const score = this.profile.big5[trait];
        if (score < 2.5 || score > 4.5) {
          const isLow = score < 2.5;
          const level = isLow ? 'low' : 'high';
          const strategy = BIG5_STRATEGIES[trait]?.[level]?.[this.lang] ||
                          BIG5_STRATEGIES[trait]?.[level]?.['en'];
          if (strategy && strategy.blindspot) {
            blindspotDimensions.push({
              model: 'big5',
              trait,
              score,
              weight: Math.abs(score - 3) / 2,
              strategy
            });
          }
        }
      });
    }

    // SD: underdeveloped levels (rank 6-8)
    if (this.profile.spiralDynamics && this.profile.spiralDynamics.levels) {
      const sd = this.profile.spiralDynamics;
      const levels = ['beige', 'purple', 'red', 'blue', 'orange', 'green', 'yellow', 'turquoise'];
      
      const rankedLevels = levels
        .map(level => ({
          level,
          rank: sd.levels[level] || 8
        }))
        .sort((a, b) => a.rank - b.rank);
      
      // Get underdeveloped levels (rank 6-8)
      rankedLevels.slice(5, 8).forEach(levelData => {
        const strategy = SD_STRATEGIES[levelData.level]?.low?.[this.lang] ||
                        SD_STRATEGIES[levelData.level]?.low?.['en'];
        if (strategy) {
          blindspotDimensions.push({
            model: 'sd',
            trait: levelData.level,
            score: levelData.rank,
            weight: (levelData.rank - 5) / 3, // Rank 6=0.33, 7=0.66, 8=1.0
            strategy
          });
        }
      });
    }

    // Sort by weight (most severe first) and return top 3
    return blindspotDimensions
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(b => ({
        model: b.model,
        trait: b.trait,
        severity: b.weight,
        blindspot: b.strategy.blindspot,
        challenge: b.strategy.challenge
      }));
  }

  /**
   * Get empty result structure
   * @returns {Object} Empty result
   */
  getEmptyResult() {
    return {
      primary: {
        language: '',
        tone: '',
        approach: ''
      },
      blindspots: [],
      conflicts: [],
      metadata: {
        models: [],
        topDimensions: [],
        mergeType: 'empty'
      }
    };
  }

  /**
   * Validate narrative consistency with quantitative strategies
   * @param {Object} narrativeProfile - AI-generated narrative profile
   * @param {Object} quantStrategies - Merged quantitative strategies
   * @returns {Object} Validation result
   */
  static validateNarrativeConsistency(narrativeProfile, quantStrategies) {
    if (!narrativeProfile || !quantStrategies || !quantStrategies.primary) {
      return {
        isConsistent: true,
        inconsistencies: [],
        recommendation: 'No validation needed'
      };
    }

    const inconsistencies = [];

    // Extract text from narrative
    const narrativeTexts = [
      narrativeProfile.operatingSystem || '',
      ...(narrativeProfile.superpowers?.map(s => s.description || '') || []),
      ...(narrativeProfile.blindspots?.map(b => b.description || '') || [])
    ];
    const narrativeText = narrativeTexts.join(' ').toLowerCase();

    // Extract text from quantitative strategies
    const quantText = [
      quantStrategies.primary.language || '',
      quantStrategies.primary.tone || '',
      quantStrategies.primary.approach || ''
    ].join(' ').toLowerCase();

    // Define contradiction patterns
    const contradictions = [
      {
        quantKeywords: ['rational', 'factual', 'objective'],
        narrativeKeywords: ['empathetic', 'emotional', 'feeling', 'warm'],
        type: 'rational_vs_emotional'
      },
      {
        quantKeywords: ['structured', 'planned', 'organised'],
        narrativeKeywords: ['spontaneous', 'flexible', 'adaptiv'],
        type: 'structured_vs_spontaneous'
      },
      {
        quantKeywords: ['reserved', 'quiet', 'reflective'],
        narrativeKeywords: ['extroverted', 'sociable', 'outgoing'],
        type: 'introverted_vs_extroverted'
      },
      {
        quantKeywords: ['brief', 'concise'],
        narrativeKeywords: ['elaborate', 'detailed', 'comprehensive'],
        type: 'concise_vs_elaborate'
      }
    ];

    // Check for contradictions
    for (const check of contradictions) {
      const hasQuant = check.quantKeywords.some(k => quantText.includes(k));
      const hasNarrative = check.narrativeKeywords.some(k => narrativeText.includes(k));

      if (hasQuant && hasNarrative) {
        inconsistencies.push({
          type: check.type,
          quantitative: quantText.substring(0, 150) + '...',
          narrative: narrativeText.substring(0, 150) + '...',
          severity: 'medium'
        });
      }
    }

    return {
      isConsistent: inconsistencies.length === 0,
      inconsistencies,
      recommendation: inconsistencies.length > 0 
        ? 'Prioritize quantitative strategies; use narrative as contextual background'
        : 'Narrative and quantitative strategies align well'
    };
  }
}

module.exports = { StrategyMerger };
