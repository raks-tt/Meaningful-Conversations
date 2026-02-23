import { SurveyResult, STRESS_ITEMS } from '../components/PersonalitySurvey';

// --- 1. DATA FOR INTERPRETATION (English Only) ---

type Language = 'en';

// Riemann dimension labels (for display)
const RIEMANN_LABELS: Record<string, string> = {
  distanz: 'Distance',
  naehe: 'Proximity',
  dauer: 'Duration',
  wechsel: 'Change'
};

// Riemann descriptions
const RIEMANN_DATA: Record<string, { ressource: string; blindSpot: string; overdone: string }> = {
  distanz: {
    ressource: 'Analytical, objective, and independent. Keeps a cool head in chaos.',
    blindSpot: 'Emotional needs of the team, closeness/commitment, warmth.',
    overdone: 'Appears unapproachable, cold, or arrogant. Communicates too little.'
  },
  naehe: {
    ressource: 'Empathetic, loyal, ensures harmony and team cohesion.',
    blindSpot: 'Ability to take criticism, objective boundaries, saying a clear "No".',
    overdone: 'Becomes emotional quickly and takes conflicts personally. Victim mentality.'
  },
  dauer: {
    ressource: 'Reliable, thorough, structured, and principled.',
    blindSpot: 'Flexibility, spontaneity, taking calculated risks.',
    overdone: 'Blocks innovation, pedantic, fear-driven regarding change.'
  },
  wechsel: {
    ressource: 'Innovative, inspiring, flexible, and quick to initiate new ideas.',
    blindSpot: 'Attention to detail, long-term planning, completing routines.',
    overdone: 'Unreliable, dramatic, starts many things but abandons them quickly.'
  }
};

// OCEAN trait labels (for display)
const BIG5_LABELS: Record<string, string> = {
  openness: 'Openness',
  conscientiousness: 'Conscientiousness',
  extraversion: 'Extraversion',
  agreeableness: 'Agreeableness',
  neuroticism: 'Emotional Stability'
};

// OCEAN descriptions
const BIG5_DATA: Record<string, { high: string; low: string; blindSpotHigh: string; blindSpotLow: string }> = {
  openness: {
    high: 'Innovative, curious, loves new ideas and change.',
    low: 'Conservative, pragmatic, prefers the familiar and proven.',
    blindSpotHigh: 'Gets lost in theories, overlooks practical details, appears unfocused.',
    blindSpotLow: 'Resistance to necessary changes, dogmatism.'
  },
  conscientiousness: {
    high: 'Extremely reliable, organized, and goal-oriented.',
    low: 'Spontaneous, flexible, prone to procrastination and disorder.',
    blindSpotHigh: 'Perfectionism, inflexibility, slows down through excessive planning.',
    blindSpotLow: 'Lack of reliability, lack of commitment.'
  },
  extraversion: {
    high: 'Sociable, energetic, impulsive, seeks social stimulation.',
    low: 'Reserved, reflective, prefers working/recovering in quiet.',
    blindSpotHigh: 'Persuades others, doesn\'t listen, appears superficial.',
    blindSpotLow: 'Gets overlooked, withdraws too much in crises (isolation).'
  },
  agreeableness: {
    high: 'Cooperative, empathetic, harmony-seeking, helpful.',
    low: 'Competitive, skeptical, asserts own interests.',
    blindSpotHigh: 'Gets taken advantage of, can\'t show a clear edge (conflict avoidance).',
    blindSpotLow: 'Perceived as insensitive, cold, or uncooperative.'
  },
  neuroticism: {
    high: 'Emotionally unstable, worried, stress-prone (avoided by filter).',
    low: 'Extremely balanced, calm, resilient.',
    blindSpotHigh: 'Surprising emotional outbursts or panic (not our primary focus).',
    blindSpotLow: 'Appears carefree/risk-taking, overlooks real risks.'
  }
};

// Stress reaction labels
const STRESS_LABELS: Record<string, string> = {
  distanz: 'Withdrawal',
  naehe: 'Adaptation',
  dauer: 'Control',
  wechsel: 'Actionism'
};

// UI text translations for interpretation
const INTERPRETATION_TEXT = {
  mainDrive: '🎯 Main Drive (Work)',
  mainDriveText: (ressource: string, type: string) => `Your dominant drive at work is **${ressource}** (Type: ${type}).`,
  mainDriveAction: 'Your greatest resources lie here. Use this language in dialogue and provide tasks that fulfill this need.',
  blindspotTitle: '🛑 Blindspot (Lowest Score)',
  blindspotText: (blindSpot: string, type: string) => `The least developed area at work is **${blindSpot}** (Type: ${type}).`,
  blindspotAction: 'This area is most easily overlooked. Actively address how this need is secured in the team, as the person won\'t demand it themselves.',
  dangerZoneTitle: '💣 Danger Zone (Stress Reaction)',
  dangerZoneText: (reaction: string) => `Under high pressure, the fourth priority (rank 4) is the reaction **${reaction}**. This behavior is avoided in emergencies, even when objectively necessary.`,
  dangerZoneAction: 'This is the most likely blind spot in a crisis. Proactively ensure that this ability is deliberately used even under stress.',
  inconsistencyTitle: (type: string) => `⚠️ High Inconsistency (${type})`,
  inconsistencyText: (score: number, type: string) => `There is a difference of ${score} on the topic of ${type} between work and private life. This indicates high effort for adaptation.`,
  inconsistencyStressJob: 'Stress from adaptation at work',
  inconsistencyStressPrivate: 'Stress from adaptation in private life',
  inconsistencyAction: (type: string) => `This stress factor must be actively addressed. Ask where the person finds energy for the necessary ${type} 'facade'.`,
  mainResource: '🌟 Your Main Resource',
  mainResourceText: (trait: string, description: string) => `The highest value is in **${trait}**. This means: ${description}`,
  mainResourceAction: 'Use this trait as motivation. If the value is extremely high (5/5): Watch for the blind spot from overdoing it.',
  underdevelopedTitle: '🛑 Blindspot (Underdeveloped Trait)',
  underdevelopedText: (trait: string, weakness: string) => `The lowest value is in **${trait}**. This is your natural blind spot. Possible weakness: ${weakness}`,
  underdevelopedAction: 'Conscious energy must be invested here. For example, if agreeableness is low, you need to actively involve the team.',
  overdriveTitle: (trait: string) => `⚠️ Resource Overdrive (${trait})`,
  overdriveText: (blindSpot: string) => `The extremely high score can lead to overdrive. Possible blind spot from overdoing: ${blindSpot}`,
  overdriveAction: 'Ask in dialogue whether the person consciously \'downshifts\' to avoid overwhelming colleagues.',
  errorTitle: 'Error',
  errorText: 'No valid results found.'
};

// --- 2. HELPER FUNCTIONS ---

/**
 * Finds the highest and lowest Riemann score in a block.
 */
const findDominantAndLow = (scores: Record<string, number>): { dominant: string; low: string } => {
  let dominant = '';
  let maxScore = -1;
  let low = '';
  let minScore = 11;

  for (const type in scores) {
    if (scores[type] > maxScore) {
      maxScore = scores[type];
      dominant = type;
    }
    if (scores[type] < minScore) {
      minScore = scores[type];
      low = type;
    }
  }
  return { dominant, low };
};

/**
 * Compares scores from Work and Private contexts.
 */
const checkConsistency = (r: SurveyResult['riemann']): { type: string; typeLabel: string; stress: string; score: number }[] => {
  if (!r) return [];
  const results = [];
  const keys = ['distanz', 'naehe', 'dauer', 'wechsel'];
  const t = INTERPRETATION_TEXT;

  for (const key of keys) {
      const diff = Math.abs((r.beruf[key] || 0) - (r.privat[key] || 0));
    if (diff >= 6) { // Significant deviation at 10 points (>= 60% difference)
          results.push({
              type: key,
        typeLabel: RIEMANN_LABELS[key],
        stress: (r.beruf[key] || 0) > (r.privat[key] || 0) ? t.inconsistencyStressJob : t.inconsistencyStressPrivate,
              score: diff
          });
      }
  }
  return results;
};

// --- 3. MAIN INTERPRETATION FUNCTION ---

export const interpretSurveyResults = (result: SurveyResult, language: Language = 'en'): { title: string; text: string; action: string }[] => {
  const analysis: { title: string; text: string; action: string }[] = [];
  const t = INTERPRETATION_TEXT;
  const riemannLabels = RIEMANN_LABELS;
  const riemannData = RIEMANN_DATA;
  const big5Labels = BIG5_LABELS;
  const big5Data = BIG5_DATA;
  const stressLabels = STRESS_LABELS;

  if (result.path === 'RIEMANN' && result.riemann) {
    const r = result.riemann;

    // A) DOMINANCE AT WORK
    const { dominant: domBeruf, low: lowBeruf } = findDominantAndLow(r.beruf);
    analysis.push({
      title: t.mainDrive,
      text: t.mainDriveText(riemannData[domBeruf].ressource, riemannLabels[domBeruf]),
      action: t.mainDriveAction
    });

    // B) BLINDSPOT 1: Lowest Score at Work
    analysis.push({
      title: t.blindspotTitle,
      text: t.blindspotText(riemannData[lowBeruf].blindSpot, riemannLabels[lowBeruf]),
      action: t.blindspotAction
    });

    // C) BLINDSPOT 2: Stress Ranking (Rank 4)
    const lowRankedStress = r.stressRanking[3]; // Index 3 is rank 4
    const stressReactionLabel = stressLabels[lowRankedStress] || STRESS_ITEMS.find(i => i.id === lowRankedStress)?.label || lowRankedStress;
    analysis.push({
      title: t.dangerZoneTitle,
      text: t.dangerZoneText(stressReactionLabel),
      action: t.dangerZoneAction
    });

    // D) INCONSISTENCY CHECK
    const inconsistencies = checkConsistency(r);
    if (inconsistencies.length > 0) {
      inconsistencies.forEach(inc => {
        analysis.push({
          title: t.inconsistencyTitle(inc.typeLabel),
          text: t.inconsistencyText(inc.score, inc.typeLabel),
          action: t.inconsistencyAction(inc.typeLabel)
        });
      });
    }

  }
  else if (result.path === 'BIG5' && result.big5) {
    const b = result.big5;
    const scores = b;

    // Sort factors by score (from 1 to 5)
    const sortedTraits = Object.entries(scores)
      .sort(([, a], [, b]) => b - a);

    // E) STRENGTH (Top)
    const topTrait = sortedTraits[0];
    const topTraitLabel = big5Labels[topTrait[0]];

    analysis.push({
      title: t.mainResource,
      text: t.mainResourceText(topTraitLabel, big5Data[topTrait[0]].high),
      action: t.mainResourceAction
    });

    // F) BLINDSPOT (Lowest Trait)
    const lowTrait = sortedTraits[sortedTraits.length - 1];
    const lowTraitLabel = big5Labels[lowTrait[0]];

    analysis.push({
      title: t.underdevelopedTitle,
      text: t.underdevelopedText(lowTraitLabel, big5Data[lowTrait[0]].blindSpotLow),
      action: t.underdevelopedAction
    });

    // G) OVERDRIVE (If Top Trait = 5)
    if (topTrait[1] === 5) {
        analysis.push({
        title: t.overdriveTitle(topTraitLabel),
        text: t.overdriveText(big5Data[topTrait[0]].blindSpotHigh),
        action: t.overdriveAction
        });
    }

  } else {
    analysis.push({ title: t.errorTitle, text: t.errorText, action: '' });
  }

  return analysis;
};
