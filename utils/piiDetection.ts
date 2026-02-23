/**
 * PII (Personally Identifiable Information) Detection Utility
 *
 * This utility scans text for potential full names (first name + last name)
 * to warn users before transmitting data to AI providers.
 *
 * IMPORTANT: This is a heuristic-based detection and may produce false positives.
 * It is meant as a warning system, not a blocking mechanism.
 */

export interface PIIDetectionResult {
  hasPII: boolean;
  detectedTypes: string[];
  examples: string[];
}

// Common German and Austrian first names
const COMMON_FIRST_NAMES = new Set([
  // German male
  'alexander', 'andreas', 'benjamin', 'christian', 'daniel', 'david', 'dominik',
  'felix', 'florian', 'johannes', 'julian', 'kevin', 'lukas', 'manuel', 'marcel',
  'markus', 'martin', 'matthias', 'maximilian', 'michael', 'niklas', 'patrick',
  'paul', 'peter', 'philipp', 'sebastian', 'simon', 'stefan', 'thomas', 'tobias',
  'wolfgang', 'bernhard', 'gerald', 'josef', 'franz', 'karl', 'heinrich', 'günter',
  'gernot', 'werner', 'hermann', 'hans', 'helmut', 'hubert', 'horst', 'dieter',
  'ernst', 'erich', 'georg', 'gerhard', 'gottfried', 'klaus', 'konrad', 'kurt',
  'leopold', 'ludwig', 'otto', 'rainer', 'reinhard', 'roland', 'rudolf', 'walter',
  // German female
  'alexandra', 'anna', 'christina', 'claudia', 'daniela', 'elena', 'elisabeth',
  'eva', 'hannah', 'jasmin', 'jennifer', 'jessica', 'julia', 'katharina', 'katrin',
  'laura', 'lea', 'lena', 'lisa', 'maria', 'marie', 'melanie', 'nadine', 'nicole',
  'nina', 'petra', 'sabine', 'sandra', 'sarah', 'silvia', 'sophia', 'stefanie', 'susanne',
  'monika', 'helga', 'ingrid', 'renate', 'ursula', 'brigitte', 'gisela', 'hildegard',
  'helene', 'gertrud', 'margarete', 'elfriede', 'irmgard', 'lieselotte', 'anneliese',
  // English common
  'james', 'john', 'robert', 'william', 'richard', 'joseph', 'charles', 'christopher',
  'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'margaret',
  'david', 'michael', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul',
  'andrew', 'joshua', 'kenneth', 'kevin', 'brian', 'george', 'timothy', 'ronald',
  'edward', 'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric',
  'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon', 'benjamin', 'samuel',
]);

// Common words that should NOT be treated as surnames
const COMMON_WORDS = new Set([
  // German articles, pronouns, prepositions, conjunctions, common nouns
  'der', 'die', 'das', 'und', 'oder', 'aber', 'wenn', 'dann', 'weil', 'dass',
  'ich', 'du', 'sie', 'wir', 'ihr', 'mit', 'von', 'bei', 'nach', 'auf',
  'zu', 'aus', 'für', 'über', 'unter', 'zwischen', 'neben', 'vor', 'hinter',
  'mein', 'dein', 'sein', 'unser', 'euer', 'heute', 'morgen', 'gestern',
  'arbeit', 'projekt', 'team', 'chef', 'kollege', 'meeting', 'termin', 'ziel',
  'problem', 'lösung', 'idee', 'plan', 'aufgabe', 'erfolg', 'stress', 'leben',
  'woche', 'monat', 'jahr', 'tag', 'stunde', 'minute', 'zeit', 'ort', 'stelle',
  'seite', 'teil', 'weise', 'art', 'fall', 'grund', 'folge', 'form', 'frage',
  'antwort', 'anfang', 'ende', 'mitte', 'rand', 'ecke', 'spitze', 'basis',
  // English common words
  'the', 'and', 'but', 'for', 'with', 'from', 'this', 'that', 'have', 'has',
  'work', 'project', 'team', 'boss', 'colleague', 'meeting', 'goal', 'problem',
  'solution', 'idea', 'plan', 'task', 'success', 'stress', 'coach', 'session',
  'life', 'week', 'month', 'year', 'day', 'hour', 'minute', 'time', 'place',
  'side', 'part', 'way', 'kind', 'case', 'reason', 'result', 'form', 'question',
  'answer', 'start', 'end', 'middle', 'edge', 'corner', 'top', 'base', 'practice',
  'salsa', 'dance', 'sport', 'music', 'hobby', 'app', 'software', 'program',
]);

/**
 * Detect potential full names (first name + last name) in a given text
 */
export function detectPII(text: string, language: 'de' | 'en' = 'en'): PIIDetectionResult {
  const detectedTypes: string[] = [];
  const examples: string[] = [];

  // Split text into words, preserving some context
  const words = text.split(/\s+/);
  const potentialNames: string[] = [];

  for (let i = 0; i < words.length - 1; i++) {
    // Clean words for comparison
    const word1Clean = words[i].replace(/[^a-zA-ZäöüÄÖÜß]/g, '');
    const word2Clean = words[i + 1].replace(/[^a-zA-ZäöüÄÖÜß]/g, '');

    // Skip if either word is too short
    if (word1Clean.length < 3 || word2Clean.length < 3) continue;

    const word1Lower = word1Clean.toLowerCase();
    const word2Lower = word2Clean.toLowerCase();

    // Check if first word is a known first name
    if (COMMON_FIRST_NAMES.has(word1Lower)) {
      // Check if second word looks like a surname:
      // - Starts with uppercase
      // - At least 3 characters
      // - NOT a common word
      // - NOT also a first name (to avoid "Maria Anna" style combinations triggering)
      const startsWithUppercase = word2Clean[0] === word2Clean[0].toUpperCase() &&
                                   word2Clean[0] !== word2Clean[0].toLowerCase();

      if (startsWithUppercase &&
          !COMMON_WORDS.has(word2Lower) &&
          !COMMON_FIRST_NAMES.has(word2Lower)) {
        // Additional check: surname should look like a proper name, not random text
        // It should be mostly letters, no numbers
        if (/^[A-ZÄÖÜa-zäöüß]+$/.test(word2Clean)) {
          potentialNames.push(`${word1Clean} ${word2Clean}`);
        }
      }
    }
  }

  // Only report if we found potential names
  if (potentialNames.length > 0) {
    detectedTypes.push('Potential full names');
    // Show first example (deduplicated)
    const uniqueNames = [...new Set(potentialNames)];
    examples.push(uniqueNames[0]);

    // If multiple names found, mention that
    if (uniqueNames.length > 1) {
      examples[0] = `${uniqueNames[0]} (and ${uniqueNames.length - 1} more)`;
    }
  }

  return {
    hasPII: detectedTypes.length > 0,
    detectedTypes,
    examples,
  };
}

