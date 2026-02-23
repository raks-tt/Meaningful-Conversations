import React from 'react';
import { Document, Page, View, Text, StyleSheet, pdf, Svg, Circle, Line, Polygon, Rect, G, Path } from '@react-pdf/renderer';
import { SurveyResult } from '../components/PersonalitySurvey';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

// ============================================================================
// STYLES
// ============================================================================

const colors = {
  primary: '#1B7272',
  primaryDark: '#0F5858',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  teal50: '#f0fdfa',
  teal100: '#ccfbf1',
  teal400: '#2dd4bf',
  teal500: '#14b8a6',
  amber50: '#fffbeb',
  amber100: '#fef3c7',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  amber600: '#d97706',
  amber700: '#b45309',
  rose50: '#fff1f2',
  rose100: '#ffe4e6',
  rose300: '#fda4af',
  rose400: '#fb7185',
  rose700: '#be123c',
  rose800: '#9f1239',
  green50: '#f0fdf4',
  green100: '#dcfce7',
  green300: '#86efac',
  green400: '#4ade80',
  green600: '#16a34a',
  green700: '#15803d',
  green800: '#166534',
  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue300: '#93c5fd',
  blue400: '#60a5fa',
  blue500: '#3b82f6',
  blue700: '#1d4ed8',
  blue800: '#1e40af',
  blue900: '#1e3a8a',
  sky50: '#f0f9ff',
  sky100: '#e0f2fe',
  sky300: '#7dd3fc',
  sky500: '#0ea5e9',
  sky700: '#0369a1',
  sky800: '#075985',
  sky900: '#0c4a6e',
  orange500: '#f97316',
  red500: '#ef4444',
  red100: '#fee2e2',
  red200: '#fecaca',
  red600: '#dc2626',
  yellow500: '#eab308',
  purple500: '#8b5cf6',
};

const styles = StyleSheet.create({
  page: {
    padding: 12,
    fontFamily: 'Helvetica',
    fontSize: 11, // Increased from 10
    color: colors.gray800,
    backgroundColor: colors.white,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    padding: '8 16',
    borderRadius: 6,
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18, // Increased from 16
    fontWeight: 'bold',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: 10, // Increased from 9
    color: colors.white,
    opacity: 0.8,
  },
  headerRight: {
    textAlign: 'right',
  },
  headerRightText: {
    fontSize: 9, // Increased from 8
    color: colors.white,
    opacity: 0.7,
  },
  // Grid layouts
  grid2: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  gridHalf: {
    flex: 1,
  },
  // Box styles
  box: {
    border: `1 solid ${colors.gray200}`,
    borderRadius: 8,
    padding: '8 10',
    backgroundColor: colors.gray50,
  },
  boxAccent: {
    backgroundColor: colors.teal50,
    borderColor: colors.teal400,
  },
  boxWarm: {
    backgroundColor: colors.amber50,
    borderColor: colors.amber400,
  },
  boxRose: {
    backgroundColor: colors.rose50,
    borderColor: colors.rose300,
  },
  boxGreen: {
    backgroundColor: colors.green50,
    borderColor: colors.green300,
  },
  boxPlaceholder: {
    backgroundColor: colors.gray100,
    borderColor: colors.gray300,
    opacity: 0.6,
  },
  boxTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 3,
  },
  boxTitleAmber: {
    color: colors.amber700,
    borderBottomColor: colors.amber500,
  },
  boxTitleRose: {
    color: colors.rose700,
    borderBottomColor: colors.rose400,
  },
  boxTitleGreen: {
    color: colors.green700,
    borderBottomColor: colors.green400,
  },
  boxTitlePlaceholder: {
    color: colors.gray400,
    borderBottomColor: colors.gray300,
  },
  // Signature text
  signatureText: {
    fontSize: 11, // Increased from 10
    lineHeight: 1.5,
    color: colors.gray700,
    fontStyle: 'italic',
  },
  // Placeholder text
  placeholderText: {
    fontSize: 10, // Increased from 9
    color: colors.gray400,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '20 10',
  },
  // Compact list
  compactListItem: {
    padding: '3 5',
    marginBottom: 3,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  compactListTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.gray700,
  },
  compactListDesc: {
    fontSize: 10, // Increased from 9
    color: colors.gray500,
    marginTop: 1,
  },
  // Section headers
  sectionHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.gray500,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Bars (compact to fit on one page)
  barContainer: {
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  barLabel: {
    width: 70,
    flexDirection: 'row',
    alignItems: 'center',
  },
  barDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  barName: {
    fontSize: 8,
    color: colors.gray700,
  },
  barTrack: {
    flex: 1,
    height: 14,
    backgroundColor: colors.gray200,
    borderRadius: 7,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  barValue: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.white,
  },
  // OCEAN
  oceanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  oceanItem: {
    flex: 1,
    alignItems: 'center',
  },
  oceanName: {
    fontSize: 9, // Increased from 8
    color: colors.gray500,
    marginBottom: 2,
  },
  oceanScore: {
    fontSize: 16, // Increased from 14
    fontWeight: 'bold',
  },
  oceanLabel: {
    fontSize: 8, // Increased from 7
    fontWeight: 'bold',
  },
  // Riemann section
  riemannContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  riemannText: {
    fontSize: 9,
    color: colors.gray600,
    lineHeight: 1.3,
  },
  stressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4, // Increased from 3
    marginBottom: 8,
  },
  stressItem: {
    width: '48%',
    fontSize: 9, // Increased from 8
    padding: '4 6', // Increased padding
    borderRadius: 4,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  stressItemFirst: {
    backgroundColor: colors.red100,
    borderColor: colors.red200,
  },
  stressTitle: {
    fontWeight: 'bold',
    color: colors.gray700,
  },
  stressTitleFirst: {
    color: colors.red600,
  },
  stressDesc: {
    fontSize: 9, // Increased from 8
    color: colors.gray500,
    marginTop: 1,
  },
  // Usage guide
  usageGuide: {
    marginTop: 10,
    padding: '10 12', // Increased padding
    backgroundColor: colors.sky50,
    borderWidth: 1,
    borderColor: colors.sky300,
    borderRadius: 8,
  },
  usageTitle: {
    fontSize: 11, // Increased from 10
    fontWeight: 'bold',
    color: colors.sky900,
    marginBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: colors.sky500,
    paddingBottom: 4,
  },
  usageContent: {
    flexDirection: 'row',
    gap: 15,
  },
  usageItem: {
    flex: 1,
    fontSize: 9, // Increased from 8
    color: colors.blue900,
    lineHeight: 1.4,
  },
  usageItemTitle: {
    fontWeight: 'bold',
    color: colors.sky700,
  },
  // Footer - fixed at bottom of every page (outer container for positioning)
  footerContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  // Footer inner content (styled separately to avoid height collapse bug)
  footer: {
    textAlign: 'center',
    paddingTop: 8,
    fontSize: 9,
    color: colors.gray400,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  footerBold: {
    fontWeight: 'bold',
  },
  // Pending tests compact section
  pendingSection: {
    marginTop: 10,
    marginBottom: 30, // Space for footer
    padding: '8 10',
    backgroundColor: colors.gray100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  pendingTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.gray500,
    marginBottom: 6,
  },
  pendingItem: {
    fontSize: 9,
    color: colors.gray400,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  // Legend
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12, // Increased from 10
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5, // Increased from 4
  },
  legendDot: {
    width: 10, // Increased from 8
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 9, // Increased from 8
    color: colors.gray700,
  },
});

// ============================================================================
// TRANSLATIONS
// ============================================================================

const translations = {
  title: 'Personality Signature',
  narrativeOS: 'Personality Signature',
  narrativeSuperpowers: 'Your Secret Superpowers',
  narrativeBlindspots: 'Potential Blindspots',
  narrativeGrowth: 'Growth Opportunities',
  whatDrivesYou: 'What Drives You',
  howYouInteract: 'How You Interact',
  whatDefinesYou: 'What Defines You',
  selfOriented: 'Self-oriented',
  communityOriented: 'Community-oriented',
  stressPattern: 'Your Stress Reaction Pattern:',
  radarLegend: 'The radar shows your behavior in 3 contexts:',
  work: 'Work',
  private: 'Private',
  self: 'Self-image',
  howToUse: 'How to Use This Profile',
  reflect: '1. Reflect:',
  reflectDesc: 'Do you recognize yourself? What surprises you? Think of concrete situations.',
  noJudgment: '2. No judgment:',
  noJudgmentDesc: 'There is no "good" or "bad" – just patterns that work differently in context.',
  dialogue: '3. Seek dialogue:',
  dialogueDesc: 'Share insights with trusted people and ask for their perspective.',
  grow: '4. Grow gently:',
  growDesc: 'Blindspots are invitations, not flaws. Grow at your own pace.',
  confidential: 'This analysis is confidential and intended for personal use only.',
  signatureNotCreated: 'Signature not yet created',
  availableAfterSignature: 'Available after signature creation',
  spiralNotCompleted: 'Spiral Dynamics test not yet completed',
  riemannNotCompleted: 'Riemann-Thomann test not yet completed',
  oceanNotCompleted: 'OCEAN/Big Five test not yet completed',
  blindspotsDesc: 'Areas you may not be aware of that could limit your growth:',
  growthDesc: 'Concrete steps that can help you reach your full potential:',
  high: 'High',
  medium: 'Med',
  low: 'Low',
  axesExplanation: 'Horizontal axis: Stability ↔ Spontaneity (structure vs. flexibility). Vertical axis: Distance ↔ Proximity (autonomy vs. connection). Your position shows your tendency in each context.',
  differencesExplanation: 'The dots show your position in three contexts. Large distances between dots may indicate flexibility or inner tension.',
  openness: 'Openness',
  conscientiousness: 'Conscientiousness',
  extraversion: 'Extraversion',
  agreeableness: 'Agreeableness',
  neuroticism: 'Emotional Stability',
  pendingTests: 'Not yet completed',
  bfi2Citation: 'BFI-2 — Soto & John (2017). J. of Personality and Social Psychology, 113(1), 117–143.',
  scaleLegend: 'Scale: 1 (low) — 3 (average) — 5 (high)',
  pvq21Citation: 'PVQ-21 — Schwartz, S. H. (2003/2021). European Social Survey. License: CC BY-NC-ND 3.0.',
  sdCitation: 'Spiral Dynamics — Beck, D. E. & Cowan, C. C. (1996). Spiral Dynamics: Mastering Values, Leadership and Change. Blackwell. Based on Graves, C. W. (1970).',
  sdMappingNote: 'This visualization uses the Spiral Dynamics color model. It is based on the PVQ-21 (Schwartz Values), whose 10 value dimensions are mapped to SD levels.',
  riemannDisclaimer: 'Coaching-based self-assessment using the Riemann-Thomann model (Riemann, 1961; Thomann, 1988). Not a standardized psychometric instrument.',
  riemannInlineHint: 'Self-assessment based on the Riemann-Thomann model.',
  oceanInlineHint: 'Measured using the Big Five Inventory-2 (BFI-2) questionnaire.',
  footnotesTitle: 'Sources',
  footnotesOnNextPage: 'Sources listed on page 2.',
};

// Spiral Dynamics levels
const sdLevels: Record<string, { color: string; keyword: string }> = {
  yellow: { color: colors.yellow500, keyword: 'Integration' },
  orange: { color: colors.orange500, keyword: 'Achievement' },
  red: { color: colors.red500, keyword: 'Power' },
  beige: { color: '#C4A66B', keyword: 'Safety' },
  turquoise: { color: colors.teal500, keyword: 'Holism' },
  green: { color: colors.green600, keyword: 'Harmony' },
  blue: { color: colors.blue500, keyword: 'Order' },
  purple: { color: colors.purple500, keyword: 'Belonging' },
};

// Stress labels
const stressLabels = {
  distanz: { label: 'Withdrawal', desc: 'Close door, solve problems alone, gain distance' },
  naehe: { label: 'Adaptation', desc: 'Seek support, restore harmony with others' },
  dauer: { label: 'Control', desc: 'Create structure, establish rules & order' },
  wechsel: { label: 'Actionism', desc: 'Start many things, become hectic, seek distraction' },
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

// Ship wheel logo as SVG - simplified for @react-pdf/renderer compatibility
// Matches visual appearance of brand LogoIcon.tsx using basic elements only
const ShipWheelLogo = () => {
  const size = 28;
  const center = 12;
  const ringRadius = 7;      // Ring positioned between center and spoke ends
  const spokeLength = 10;    // Spokes extend beyond ring
  const hubRadius = 1.75;    // Matches LogoIcon
  const ringStroke = 2;      // Thick ring stroke to match donut appearance
  const spokeStroke = 1.8;   // Spoke thickness
  
  // Calculate 8 spoke endpoints
  const spokes = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * 45) * (Math.PI / 180);
    spokes.push({
      x1: center - spokeLength * Math.cos(angle),
      y1: center - spokeLength * Math.sin(angle),
      x2: center + spokeLength * Math.cos(angle),
      y2: center + spokeLength * Math.sin(angle),
    });
  }
  
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* 8 spokes as lines (4 lines, each creating 2 spokes through center) */}
      {spokes.slice(0, 4).map((spoke, i) => (
        <Line
          key={`spoke-${i}`}
          x1={spoke.x1}
          y1={spoke.y1}
          x2={spoke.x2}
          y2={spoke.y2}
          stroke="white"
          strokeWidth={spokeStroke}
          strokeLinecap="round"
        />
      ))}
      {/* Ring as stroked circle (no fill) */}
      <Circle 
        cx={center} 
        cy={center} 
        r={ringRadius} 
        fill="none" 
        stroke="white" 
        strokeWidth={ringStroke} 
      />
      {/* Center hub */}
      <Circle cx={center} cy={center} r={hubRadius} fill="white" />
    </Svg>
  );
};

// Riemann-Thomann Cross (Quadrant Diagram) for PDF
// Vertical text label component (characters stacked vertically) — for PDF axis labels
const VerticalLabel = ({ text, color = colors.gray700 }: { text: string; color?: string }) => (
  <View style={{ justifyContent: 'center', alignItems: 'center', width: 10 }}>
    {text.toUpperCase().split('').map((char, i) => (
      <Text key={i} style={{ fontSize: 6, fontWeight: 'bold', color, lineHeight: 0.95, textAlign: 'center' }}>
        {char}
      </Text>
    ))}
  </View>
);

// Converts constant-sum data into 2 bipolar axes (classical Riemann-Kreuz):
//   X-axis: Wechsel − Dauer  (right = Wechsel/Spontaneity)
//   Y-axis: Distanz − Nähe   (up = Distanz/Distance)
const RiemannCross = ({ data }: {
  data: { beruf: Record<string, number>; privat: Record<string, number>; selbst: Record<string, number> };
}) => {
  const size = 150;
  const center = size / 2;
  const axisLen = (size / 2) - 20; // space for labels

  const dimLabels = { distanz: 'Distance', wechsel: 'Spontaneity', naehe: 'Proximity', dauer: 'Stability' };

  // Convert constant-sum to bipolar coordinates (classical Riemann-Kreuz)
  const toCoord = (ctx: Record<string, number>) => ({
    x: (ctx.wechsel || 0) - (ctx.dauer || 0),    // positive = Wechsel (right)
    y: (ctx.distanz || 0) - (ctx.naehe || 0),     // positive = Distanz (up)
  });

  const contexts = [
    { key: 'beruf' as const, color: colors.blue500 },
    { key: 'privat' as const, color: colors.green600 },
    { key: 'selbst' as const, color: colors.orange500 },
  ];

  const coords = contexts.map(c => toCoord(data[c.key]));
  const maxAbs = Math.max(...coords.flatMap(c => [Math.abs(c.x), Math.abs(c.y)]), 1);
  const scale = Math.ceil(maxAbs);

  const toPixel = (val: number) => (val / scale) * axisLen;

  // Detect overlapping points and apply jitter
  const OVERLAP_THRESHOLD = 6; // pixels - adjusted for PDF smaller size
  const JITTER_RADIUS = 7; // pixels - radius of jitter circle for PDF
  
  const adjustedCoords = coords.map((c, i) => {
    const px = center + toPixel(c.x);
    const py = center - toPixel(c.y);
    
    // Check if this point overlaps with any previous point
    let hasOverlap = false;
    for (let j = 0; j < i; j++) {
      const prevPx = center + toPixel(coords[j].x);
      const prevPy = center - toPixel(coords[j].y);
      const dist = Math.sqrt((px - prevPx) ** 2 + (py - prevPy) ** 2);
      if (dist < OVERLAP_THRESHOLD) {
        hasOverlap = true;
        break;
      }
    }
    
    // Apply jitter if overlapping - arrange in a circle
    if (hasOverlap) {
      const angle = (i * 120) * (Math.PI / 180); // 120° apart for 3 points
      return {
        x: c.x,
        y: c.y,
        px: px + Math.cos(angle) * JITTER_RADIUS,
        py: py + Math.sin(angle) * JITTER_RADIUS,
        isJittered: true
      };
    }
    
    return { x: c.x, y: c.y, px, py, isJittered: false };
  });

  return (
    <View style={{ alignItems: 'center' }}>
      {/* Top label: Distanz/Distance — spaced letters to match vertical label style */}
      <Text style={{ fontSize: 6, fontWeight: 'bold', color: colors.gray700, marginBottom: -2, letterSpacing: 3 }}>
        {dimLabels.distanz.toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Left label: Dauer/Stability — vertical character stacking */}
        <VerticalLabel text={dimLabels.dauer} />
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Quadrant background shading */}
          <Rect x={center} y={0} width={center} height={center} fill="#eff6ff" fillOpacity={0.5} />
          <Rect x={0} y={0} width={center} height={center} fill="#faf5ff" fillOpacity={0.5} />
          <Rect x={0} y={center} width={center} height={center} fill={colors.gray50} fillOpacity={0.5} />
          <Rect x={center} y={center} width={center} height={center} fill="#f0fdf4" fillOpacity={0.5} />

          {/* Dashed grid at 50% */}
          <Line x1={center + toPixel(0.5 * scale)} y1={center - axisLen} x2={center + toPixel(0.5 * scale)} y2={center + axisLen} stroke={colors.gray200} strokeWidth={0.5} strokeDasharray="3,3" />
          <Line x1={center + toPixel(-0.5 * scale)} y1={center - axisLen} x2={center + toPixel(-0.5 * scale)} y2={center + axisLen} stroke={colors.gray200} strokeWidth={0.5} strokeDasharray="3,3" />
          <Line x1={center - axisLen} y1={center - toPixel(0.5 * scale)} x2={center + axisLen} y2={center - toPixel(0.5 * scale)} stroke={colors.gray200} strokeWidth={0.5} strokeDasharray="3,3" />
          <Line x1={center - axisLen} y1={center - toPixel(-0.5 * scale)} x2={center + axisLen} y2={center - toPixel(-0.5 * scale)} stroke={colors.gray200} strokeWidth={0.5} strokeDasharray="3,3" />

          {/* Main cross axes */}
          <Line x1={center - axisLen} y1={center} x2={center + axisLen} y2={center} stroke={colors.gray400} strokeWidth={1.5} />
          <Line x1={center} y1={center - axisLen} x2={center} y2={center + axisLen} stroke={colors.gray400} strokeWidth={1.5} />

          {/* Triangle connecting the 3 context dots - uses original positions */}
          <Polygon
            points={adjustedCoords.map(c =>
              `${center + toPixel(c.x)},${center - toPixel(c.y)}`
            ).join(' ')}
            fill={colors.gray200}
            fillOpacity={0.3}
            stroke={colors.gray300}
            strokeWidth={0.8}
            strokeDasharray="3,2"
          />

          {/* Context dots with jitter adjustment */}
          {contexts.map((ctx, i) => {
            const adj = adjustedCoords[i];
            const px = adj.px;
            const py = adj.py;
            return (
              <G key={ctx.key}>
                <Circle cx={px} cy={py} r={8} fill={ctx.color} fillOpacity={0.15} />
                <Circle cx={px} cy={py} r={5} fill={ctx.color} stroke="white" strokeWidth={1.5} />
              </G>
            );
          })}
        </Svg>
        {/* Right label: Wechsel/Change — vertical character stacking */}
        <VerticalLabel text={dimLabels.wechsel} />
      </View>
      {/* Bottom label: Nähe/Proximity — spaced letters to match vertical label style */}
      <Text style={{ fontSize: 6, fontWeight: 'bold', color: colors.gray700, marginTop: -2, letterSpacing: 3 }}>
        {dimLabels.naehe.toUpperCase()}
      </Text>
    </View>
  );
};

// Progress bar component
const ProgressBar = ({ value, color, maxValue = 5 }: { value: number; color: string; maxValue?: number }) => {
  const percentage = Math.min(100, Math.max(25, (value / maxValue) * 100));
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: color }]}>
        <Text style={styles.barValue}>{value.toFixed(1)}</Text>
      </View>
    </View>
  );
};

// ============================================================================
// MAIN DOCUMENT COMPONENT
// ============================================================================

interface PersonalityPdfDocumentProps {
  result: SurveyResult;
  language?: 'en';
  userEmail?: string;
}

const PersonalityPdfDocument: React.FC<PersonalityPdfDocumentProps> = ({ result, language = 'en', userEmail }) => {
  const t = translations;
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const hasSD = !!result.spiralDynamics;
  const hasRiemann = !!result.riemann;
  const hasOcean = !!result.big5;
  const hasNarrative = !!result.narrativeProfile;
  
  // When all 3 tests are completed, use 2 pages
  const useTwoPages = hasSD && hasRiemann && hasOcean;
  
  const getOceanColor = (score: number) => score >= 4 ? colors.teal500 : score >= 3 ? colors.amber500 : colors.red500;
  const getOceanLabel = (score: number) => score >= 4 ? t.high : score >= 3 ? t.medium : t.low;
  
  // Reusable Header component
  const Header = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <ShipWheelLogo />
        <View>
          <Text style={styles.headerTitle}>{t.title}</Text>
          <Text style={styles.headerSubtitle}>Meaningful Conversations</Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.headerRightText}>{date}</Text>
        <Text style={styles.headerRightText}>manualmode.at</Text>
      </View>
    </View>
  );
  
  // Reusable Footer component - fixed prop ensures it appears on every page
  const footerLine1 = `Generated for ${userEmail || 'Unknown'} • Personal and Confidential • ${date}`;
  const Footer = () => (
    <View style={styles.footerContainer} fixed>
      <View style={styles.footer}>
        <Text>{footerLine1}</Text>
        <Text style={{ fontSize: 7, color: colors.gray400, marginTop: 2 }}>
          <Text style={styles.footerBold}>Meaningful Conversations</Text> by manualmode.at
        </Text>
      </View>
    </View>
  );
  
  // OCEAN Section component - only renders if data exists
  const OceanSection = () => {
    if (!hasOcean || !result.big5) return null;
    
    return (
      <View style={[styles.box, { marginBottom: 10 }]}>
        <Text style={styles.boxTitle}>{t.whatDefinesYou}</Text>
        <View style={styles.oceanRow}>
          {[
            { key: 'O', name: t.openness, score: result.big5.openness },
            { key: 'C', name: t.conscientiousness, score: result.big5.conscientiousness },
            { key: 'E', name: t.extraversion, score: result.big5.extraversion },
            { key: 'A', name: t.agreeableness, score: result.big5.agreeableness },
            { key: 'N', name: t.neuroticism, score: result.big5.neuroticism },
          ].map((trait) => (
            <View key={trait.key} style={styles.oceanItem}>
              <Text style={styles.oceanName}>{trait.name}</Text>
              <Text style={[styles.oceanScore, { color: getOceanColor(trait.score) }]}>
                {trait.score}/5
              </Text>
              <Text style={[styles.oceanLabel, { color: getOceanColor(trait.score) }]}>
                {getOceanLabel(trait.score)}
              </Text>
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 7, color: colors.gray400, textAlign: 'center', marginTop: 4 }}>
          {t.scaleLegend}
        </Text>
        <Text style={{ fontSize: 7, color: colors.gray400, textAlign: 'center', marginTop: 1 }}>
          {t.oceanInlineHint} [{oceanFootnote}]
        </Text>
      </View>
    );
  };
  
  // Usage Guide component
  const UsageGuide = () => (
    <View style={styles.usageGuide}>
      <Text style={styles.usageTitle}>{t.howToUse}</Text>
      <View style={styles.usageContent}>
        <View style={styles.usageItem}>
          <Text style={styles.usageItemTitle}>{t.reflect}</Text>
          <Text> {t.reflectDesc}</Text>
        </View>
        <View style={styles.usageItem}>
          <Text style={styles.usageItemTitle}>{t.noJudgment}</Text>
          <Text> {t.noJudgmentDesc}</Text>
        </View>
        <View style={styles.usageItem}>
          <Text style={styles.usageItemTitle}>{t.dialogue}</Text>
          <Text> {t.dialogueDesc}</Text>
        </View>
        <View style={styles.usageItem}>
          <Text style={styles.usageItemTitle}>{t.grow}</Text>
          <Text> {t.growDesc}</Text>
        </View>
      </View>
    </View>
  );
  
  // Blindspots + Growth Section component (reusable) - wrap={false} prevents page break
  const BlindspotsGrowthSection = () => {
    if (!hasNarrative || !result.narrativeProfile) return null;
    
    return (
      <View style={styles.grid2} wrap={false}>
        <View style={[styles.box, styles.boxRose, styles.gridHalf]}>
          <Text style={[styles.boxTitle, styles.boxTitleRose]}>{t.narrativeBlindspots}</Text>
          <Text style={{ fontSize: 9, color: colors.gray500, marginBottom: 3, fontStyle: 'italic' }}>
            {t.blindspotsDesc}
          </Text>
          {result.narrativeProfile.blindspots.map((s: { name: string; description: string }, i: number) => (
            <View key={i} style={[styles.compactListItem, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
              <Text style={[styles.compactListTitle, { color: colors.rose800 }]}>{i + 1}. {s.name}</Text>
              <Text style={styles.compactListDesc}>{s.description}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.box, styles.boxGreen, styles.gridHalf]}>
          <Text style={[styles.boxTitle, styles.boxTitleGreen]}>{t.narrativeGrowth}</Text>
          <Text style={{ fontSize: 9, color: colors.gray500, marginBottom: 3, fontStyle: 'italic' }}>
            {t.growthDesc}
          </Text>
          {result.narrativeProfile.growthOpportunities.map((g: { title: string; recommendation: string }, i: number) => (
            <View key={i} style={[styles.compactListItem, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
              <Text style={[styles.compactListTitle, { color: colors.green800 }]}>{i + 1}. {g.title}</Text>
              <Text style={styles.compactListDesc}>{g.recommendation}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };
  
  // Compact section for pending/incomplete tests - grouped at the end
  const PendingTestsSection = () => {
    const pendingTests: string[] = [];
    if (!hasNarrative) pendingTests.push(t.signatureNotCreated);
    if (!hasSD) pendingTests.push(t.spiralNotCompleted);
    if (!hasRiemann) pendingTests.push(t.riemannNotCompleted);
    if (!hasOcean) pendingTests.push(t.oceanNotCompleted);
    
    if (pendingTests.length === 0) return null;
    
    return (
      <View style={styles.pendingSection}>
        <Text style={styles.pendingTitle}>{t.pendingTests}</Text>
        {pendingTests.map((test, i) => (
          <Text key={i} style={styles.pendingItem}>• {test}</Text>
        ))}
      </View>
    );
  };

  // Compute footnote numbers so inline hints can reference them
  const footnotes: { text: string; section: string }[] = [];
  if (hasSD) {
    footnotes.push({ text: t.sdCitation, section: 'sd' });
    footnotes.push({ text: t.pvq21Citation, section: 'sd' });
  }
  if (hasRiemann) {
    footnotes.push({ text: t.riemannDisclaimer, section: 'riemann' });
  }
  if (hasOcean) {
    footnotes.push({ text: t.bfi2Citation, section: 'ocean' });
  }
  // Footnote number helpers (1-based)
  const sdFootnotes = footnotes.filter(f => f.section === 'sd').map((_, i) => footnotes.findIndex(f => f.section === 'sd') + i + 1);
  const riemannFootnote = footnotes.findIndex(f => f.section === 'riemann') + 1;
  const oceanFootnote = footnotes.findIndex(f => f.section === 'ocean') + 1;

  // Footnotes section - consolidated academic citations at the bottom of the last page
  const FootnotesSection = () => {
    if (footnotes.length === 0) return null;

    return (
      <View style={{ marginTop: 'auto', paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.gray300 }}>
        <Text style={{ fontSize: 6, fontWeight: 'bold', color: colors.gray400, marginBottom: 3 }}>
          {t.footnotesTitle}
        </Text>
        {footnotes.map((f, i) => (
          <Text key={i} style={{ fontSize: 5.5, color: colors.gray400, fontStyle: 'italic', lineHeight: 1.4 }}>
            [{i + 1}] {f.text}
          </Text>
        ))}
      </View>
    );
  };
  
  return (
    <Document>
      {/* PAGE 1 */}
      <Page size="A4" style={[styles.page, { paddingBottom: 50 }]}>
        <Header />
        
        {/* Signature - Full Width - only if available */}
        {hasNarrative && result.narrativeProfile && (
          <View style={[styles.box, styles.boxAccent, { marginBottom: 10 }]}>
            <Text style={styles.boxTitle}>{t.narrativeOS}</Text>
            <Text style={styles.signatureText}>
              {typeof result.narrativeProfile.operatingSystem === 'string' 
                ? result.narrativeProfile.operatingSystem 
                : (result.narrativeProfile.operatingSystem as any)?.core || 
                  (result.narrativeProfile.operatingSystem as any)?.dynamics || 
                  ''}
            </Text>
          </View>
        )}
        
        {/* Superpowers - Full Width - only if available */}
        {hasNarrative && result.narrativeProfile && (
          <View style={[styles.box, styles.boxWarm, { marginBottom: 10 }]}>
            <Text style={[styles.boxTitle, styles.boxTitleAmber]}>{t.narrativeSuperpowers}</Text>
            {result.narrativeProfile.superpowers.map((p: { name: string; description: string }, i: number) => (
              <View key={i} style={styles.compactListItem}>
                <Text style={styles.compactListTitle}>{i + 1}. {p.name}</Text>
                <Text style={styles.compactListDesc}>{p.description}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Spiral Dynamics - only if available */}
        {hasSD && result.spiralDynamics && (
          <View style={[styles.box, { marginBottom: 10 }]}>
            <Text style={styles.boxTitle}>{t.whatDrivesYou}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionHeader}>{t.selfOriented}</Text>
                {['yellow', 'orange', 'red', 'beige'].map((level) => {
                  const value = (result.spiralDynamics!.levels as Record<string, number>)[level] || 0;
                  const info = sdLevels[level];
                  return (
                    <View key={level} style={styles.barContainer}>
                      <View style={styles.barLabel}>
                        <View style={[styles.barDot, { backgroundColor: info.color }]} />
                        <Text style={styles.barName}>{info.keyword}</Text>
                      </View>
                      <ProgressBar value={value} color={info.color} />
                    </View>
                  );
                })}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionHeader}>{t.communityOriented}</Text>
                {['turquoise', 'green', 'blue', 'purple'].map((level) => {
                  const value = (result.spiralDynamics!.levels as Record<string, number>)[level] || 0;
                  const info = sdLevels[level];
                  return (
                    <View key={level} style={styles.barContainer}>
                      <View style={styles.barLabel}>
                        <View style={[styles.barDot, { backgroundColor: info.color }]} />
                        <Text style={styles.barName}>{info.keyword}</Text>
                      </View>
                      <ProgressBar value={value} color={info.color} />
                    </View>
                  );
                })}
              </View>
            </View>
            <Text style={{ fontSize: 7, color: colors.gray400, textAlign: 'center', marginTop: 4 }}>
              {t.sdMappingNote} [{sdFootnotes.join(', ')}]
            </Text>
          </View>
        )}
        
        {/* Riemann - only if available */}
        {hasRiemann && result.riemann && (
          <View style={[styles.box, { marginBottom: 10 }]}>
            <Text style={styles.boxTitle}>{t.howYouInteract}</Text>
            <View style={styles.riemannContainer}>
              <View style={{ alignItems: 'center' }}>
                <RiemannCross data={result.riemann} />
                {/* Legend below diagram */}
                <View style={[styles.legendContainer, { marginTop: 8 }]}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.blue500 }]} />
                    <Text style={styles.legendText}>{t.work}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.green600 }]} />
                    <Text style={styles.legendText}>{t.private}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.orange500 }]} />
                    <Text style={styles.legendText}>{t.self}</Text>
                  </View>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                {result.riemann.stressRanking && result.riemann.stressRanking.length > 0 && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: colors.gray700, marginBottom: 4 }}>
                      {t.stressPattern}
                    </Text>
                    <View style={styles.stressGrid}>
                      {result.riemann.stressRanking.map((id: string, i: number) => {
                        const item = stressLabels[id as keyof typeof stressLabels];
                        const isFirst = i === 0;
                        return (
                          <View key={id} style={[styles.stressItem, isFirst ? styles.stressItemFirst : {}]}>
                            <Text style={[styles.stressTitle, isFirst ? styles.stressTitleFirst : {}]}>
                              {i + 1}. {item?.label || id}
                            </Text>
                            <Text style={styles.stressDesc}>{item?.desc || ''}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
                <Text style={[styles.riemannText, { marginBottom: 4 }]}>{t.differencesExplanation}</Text>
                <Text style={styles.riemannText}>{t.axesExplanation}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 7, color: colors.gray400, textAlign: 'center', marginTop: 4 }}>
              {t.riemannInlineHint} [{riemannFootnote}]
            </Text>
          </View>
        )}
        
        {/* If NOT using two pages, show everything on page 1 */}
        {!useTwoPages && (
          <>
            <BlindspotsGrowthSection />
            <OceanSection />
            <UsageGuide />
            <PendingTestsSection />
            <FootnotesSection />
          </>
        )}
        
        {/* Two-page layout: compact footnote reference on page 1 */}
        {useTwoPages && footnotes.length > 0 && (
          <Text style={{ fontSize: 6, color: colors.gray400, fontStyle: 'italic', textAlign: 'center', marginTop: 6 }}>
            {t.footnotesOnNextPage}
          </Text>
        )}
        
        {/* Fixed footer on every page */}
        <Footer />
      </Page>
      
      {/* PAGE 2 - Only when all 3 tests are completed */}
      {useTwoPages && (
        <Page size="A4" style={[styles.page, { paddingBottom: 50 }]}>
          <Header />
          
          {/* Blindspots + Growth on Page 2 */}
          <BlindspotsGrowthSection />
          
          {/* OCEAN Section */}
          <OceanSection />
          
          {/* Usage Guide */}
          <UsageGuide />
          
          {/* Footnotes - consolidated citations */}
          <FootnotesSection />
          
          {/* Fixed footer on every page */}
          <Footer />
        </Page>
      )}
    </Document>
  );
};

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Generates a PDF from survey results and triggers download
 * @param result - The survey result data
 * @param filename - The desired filename (without extension)
 * @param language - 'en' (legacy parameter, always uses English)
 * @param userEmail - optional user email for footer
 */
export async function generatePDF(result: SurveyResult, filename: string, language: 'en' = 'en', userEmail?: string): Promise<void> {
  try {
    const blob = await pdf(<PersonalityPdfDocument result={result} language={language} userEmail={userEmail} />).toBlob();
    
    // Check if running in Capacitor native app
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
      // Convert blob to base64 for native handling
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const base64Data = await base64Promise;
      const fullFilename = `${filename}.pdf`;
      
      // Write file to cache directory
      const writeResult = await Filesystem.writeFile({
        path: fullFilename,
        data: base64Data,
        directory: Directory.Cache,
      });
      
      // Share the file using native share sheet
      await Share.share({
        title: fullFilename,
        url: writeResult.uri,
      });
    } else {
      // Standard download for web browsers
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error('Failed to generate PDF');
  }
}

/**
 * Generates filename for personality survey PDF
 * @param testType - 'RIEMANN' or 'BIG5' (kept for backwards compatibility)
 * @param language - 'en' (legacy parameter, always uses English)
 */
export function generateSurveyPdfFilename(testType: string, language: 'en' = 'en'): string {
  const dateStr = new Date().toISOString().split('T')[0];
  const type = testType === 'RIEMANN' ? 'riemann' : 'big5';
  const label = 'personality-analysis';

  return `${label}-${type}-${dateStr}`;
}

export default PersonalityPdfDocument;