import React from 'react';
import { Document, Page, View, Text, StyleSheet, pdf, Svg, Circle, Line } from '@react-pdf/renderer';
import { TranscriptEvaluationResult, TranscriptPreAnswers } from '../types';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

// ============================================================================
// STYLES
// ============================================================================

const colors = {
  primary: '#1B7272',
  white: '#ffffff',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray400: '#9ca3af',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  teal50: '#f0fdfa',
  green500: '#16a34a',
  yellow500: '#eab308',
  red500: '#ef4444',
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: colors.gray800,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    padding: '10 16',
    borderRadius: 6,
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: 10,
    color: colors.white,
    opacity: 0.85,
  },
  headerRight: {
    textAlign: 'right',
  },
  headerRightText: {
    fontSize: 9,
    color: colors.white,
    opacity: 0.7,
  },
  section: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.gray100,
    borderRadius: 4,
    breakInside: 'avoid', // Verhindert Seitenumbrüche innerhalb von Abschnitten
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  scoreBadge: {
    backgroundColor: colors.primary,
    color: colors.white,
    padding: '4 8',
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 'bold',
  },
  text: {
    fontSize: 10,
    lineHeight: 1.5,
    color: colors.gray700,
    marginBottom: 4,
  },
  bulletList: {
    marginTop: 4,
    marginBottom: 8,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 6,
    breakInside: 'avoid', // Verhindert, dass Bullet-Items getrennt werden
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginRight: 6,
    marginTop: 5,
  },
  bulletText: {
    fontSize: 10,
    lineHeight: 1.4,
    color: colors.gray700,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginVertical: 12,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
  },
  footer: {
    textAlign: 'center',
    paddingTop: 8,
    fontSize: 8,
    color: colors.gray400,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  footerBold: {
    fontWeight: 'bold',
  },
});

// ============================================================================
// SHIP WHEEL LOGO (matches pdfGeneratorReact.tsx / brand LogoIcon.tsx)
// ============================================================================

const ShipWheelLogo = () => {
  const size = 28;
  const center = 12;
  const ringRadius = 7;
  const spokeLength = 10;
  const hubRadius = 1.75;
  const ringStroke = 2;
  const spokeStroke = 1.8;

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
      <Circle cx={center} cy={center} r={ringRadius} fill="none" stroke="white" strokeWidth={ringStroke} />
      <Circle cx={center} cy={center} r={hubRadius} fill="white" />
    </Svg>
  );
};

// ============================================================================
// PDF DOCUMENT COMPONENT
// ============================================================================

interface TranscriptEvaluationPDFProps {
  evaluation: TranscriptEvaluationResult;
  preAnswers: TranscriptPreAnswers;
  userEmail?: string;
  lang?: 'en';
}

const BulletList: React.FC<{ items: string[] }> = ({ items }) => {
  if (items.length === 0) return <Text style={styles.text}>—</Text>;
  return (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletItem}>
          <View style={styles.bullet} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
};

const TranscriptEvaluationPDF: React.FC<TranscriptEvaluationPDFProps> = ({
  evaluation,
  preAnswers,
  userEmail,
  lang = 'en',
}) => {
  const t = (key: string) => {
    const translations: Record<string, string> = {
      title: 'Transcript Evaluation',
      pre_questions: 'Your Pre-Reflection',
      goal: 'Goal',
      personal_target: 'Personal Target',
      assumptions: 'Assumptions',
      satisfaction: 'Expected Satisfaction',
      difficult: 'Challenge',
      overall_score: 'Overall Score',
      goal_alignment: 'Goal Alignment',
      achieved: 'Achieved',
      evidence: 'Evidence',
      behavioral_analysis: 'Behavioral Analysis',
      target_behaviors: 'Target Behaviors Observed',
      assumption_check: 'Assumption Check',
      confirmed: 'Confirmed',
      rejected: 'Rejected',
      challenged: 'Challenged',
      new_insights: 'New Insights',
      calibration: 'Self-Rating vs. Evidence',
      self_rating: 'Your Rating',
      evidence_rating: 'Evidence',
      actual_score: 'Actual Score',
      gaps: 'Gaps',
      score_label: 'Score',
      blindspots: 'Blindspots',
      personality_insights: 'Personality Insights',
      strengths: 'Strengths',
      development: 'Development Areas',
      next_steps: 'Next Steps',
      bot_recommendations: 'Recommended Coaching Profiles',
      bot_primary: 'Primary',
      bot_secondary: 'Alternative',
      bot_conversation_starter: 'Conversation Starter',
      bot_tier_guest: 'Free',
      bot_tier_premium: 'Premium',
      bot_tier_client: 'Exclusive to clients',
      footer_template: 'Generated for {user} • Personal and Confidential • {date}',
    };
    return translations[key] || key;
  };

  const formatDate = () => {
    const date = new Date();
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Document>
      <Page size="A4" style={[styles.page, { paddingBottom: 55 }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ShipWheelLogo />
            <View>
              <Text style={styles.headerTitle}>{t('title')}</Text>
              {preAnswers.situationName && (
                <Text style={[styles.headerSubtitle, { fontSize: 11 }]}>{preAnswers.situationName}</Text>
              )}
              <Text style={styles.headerSubtitle}>Meaningful Conversations</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerRightText}>{formatDate()}</Text>
            {userEmail && <Text style={styles.headerRightText}>{userEmail}</Text>}
            <Text style={styles.headerRightText}>manualmode.at</Text>
          </View>
        </View>

        {/* Pre-Questions Section */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>{t('pre_questions')}</Text>
          <View style={styles.divider} />
          <Text style={styles.text}>
            <Text style={{ fontWeight: 'bold' }}>{t('goal')}: </Text>
            {preAnswers.goal}
          </Text>
          <Text style={styles.text}>
            <Text style={{ fontWeight: 'bold' }}>{t('personal_target')}: </Text>
            {preAnswers.personalTarget}
          </Text>
          <Text style={styles.text}>
            <Text style={{ fontWeight: 'bold' }}>{t('assumptions')}: </Text>
            {preAnswers.assumptions}
          </Text>
          <Text style={styles.text}>
            <Text style={{ fontWeight: 'bold' }}>{t('satisfaction')}: </Text>
            {preAnswers.satisfaction}/5
          </Text>
          {preAnswers.difficult && (
            <Text style={styles.text}>
              <Text style={{ fontWeight: 'bold' }}>{t('difficult')}: </Text>
              {preAnswers.difficult}
            </Text>
          )}
        </View>

        {/* Overall Score */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('overall_score')}</Text>
            <Text style={styles.scoreBadge}>
              {evaluation.overallScore}/10
            </Text>
          </View>
          <Text style={styles.text}>{evaluation.summary}</Text>
        </View>

        {/* Goal Alignment */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>{t('goal_alignment')}</Text>
          <View style={styles.divider} />
          <Text style={styles.text}>
            <Text style={{ fontWeight: 'bold' }}>{t('achieved')}: </Text>
            {evaluation.goalAlignment.score}/5
          </Text>
          <Text style={styles.text}>
            <Text style={{ fontWeight: 'bold' }}>{t('evidence')}: </Text>
            {evaluation.goalAlignment.evidence}
          </Text>
          {evaluation.goalAlignment.gaps && (
            <Text style={styles.text}>
              <Text style={{ fontWeight: 'bold' }}>{t('gaps')}: </Text>
              {evaluation.goalAlignment.gaps}
            </Text>
          )}
        </View>

        {/* Behavioral Analysis */}
        {evaluation.behavioralAlignment && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{t('behavioral_analysis')}</Text>
            <View style={styles.divider} />
            <Text style={styles.text}>
              <Text style={{ fontWeight: 'bold' }}>{t('score_label')}: </Text>
              {evaluation.behavioralAlignment.score}/5
            </Text>
            <Text style={styles.text}>{evaluation.behavioralAlignment.evidence}</Text>
            {evaluation.behavioralAlignment.blindspotEvidence.length > 0 && (
              <>
                <Text style={[styles.text, { marginTop: 8, marginBottom: 4, fontWeight: 'bold' }]}>
                  {t('blindspots')}:
                </Text>
                <BulletList items={evaluation.behavioralAlignment.blindspotEvidence} />
              </>
            )}
          </View>
        )}

        {/* Assumption Check */}
        {evaluation.assumptionCheck && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{t('assumption_check')}</Text>
            <View style={styles.divider} />
            {evaluation.assumptionCheck.confirmed.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={[styles.text, { fontWeight: 'bold', marginBottom: 4 }]}>
                  {t('confirmed')}:
                </Text>
                <BulletList items={evaluation.assumptionCheck.confirmed} />
              </View>
            )}
            {evaluation.assumptionCheck.challenged.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={[styles.text, { fontWeight: 'bold', marginBottom: 4 }]}>
                  {t('challenged')}:
                </Text>
                <BulletList items={evaluation.assumptionCheck.challenged} />
              </View>
            )}
            {evaluation.assumptionCheck.newInsights.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={[styles.text, { fontWeight: 'bold', marginBottom: 4 }]}>
                  {t('new_insights')}:
                </Text>
                <BulletList items={evaluation.assumptionCheck.newInsights} />
              </View>
            )}
          </View>
        )}

        {/* Calibration */}
        {evaluation.calibration && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{t('calibration')}</Text>
            <View style={styles.divider} />
            <Text style={styles.text}>
              <Text style={{ fontWeight: 'bold' }}>{t('self_rating')}: </Text>
              {evaluation.calibration.selfRating}/5
            </Text>
            <Text style={styles.text}>
              <Text style={{ fontWeight: 'bold' }}>{t('evidence_rating')}: </Text>
              {evaluation.calibration.evidenceRating}/5
            </Text>
            <Text style={[styles.text, { marginTop: 8 }]}>{evaluation.calibration.delta}</Text>
            <Text style={styles.text}>{evaluation.calibration.interpretation}</Text>
          </View>
        )}

        {/* Personality Insights */}
        {evaluation.personalityInsights && evaluation.personalityInsights.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{t('personality_insights')}</Text>
            <View style={styles.divider} />
            {evaluation.personalityInsights.map((insight, i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <Text style={[styles.text, { fontWeight: 'bold', color: colors.primary }]}>
                  {insight.dimension}
                </Text>
                <Text style={styles.text}>{insight.observation}</Text>
                <Text style={[styles.text, { fontStyle: 'italic' }]}>
                  → {insight.recommendation}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Strengths */}
        {evaluation.strengths && evaluation.strengths.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{t('strengths')}</Text>
            <View style={styles.divider} />
            <BulletList items={evaluation.strengths} />
          </View>
        )}

        {/* Development Areas */}
        {evaluation.developmentAreas && evaluation.developmentAreas.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{t('development')}</Text>
            <View style={styles.divider} />
            <BulletList items={evaluation.developmentAreas} />
          </View>
        )}

        {/* Next Steps */}
        {evaluation.nextSteps && evaluation.nextSteps.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{t('next_steps')}</Text>
            <View style={styles.divider} />
            {evaluation.nextSteps.map((step, i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <Text style={[styles.text, { fontWeight: 'bold' }]}>
                  {i + 1}. {step.action}
                </Text>
                <Text style={[styles.text, { marginLeft: 12, fontSize: 9, color: colors.gray600 }]}>
                  {step.rationale}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Bot Recommendations */}
        {evaluation.botRecommendations && evaluation.botRecommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('bot_recommendations')}</Text>
            <View style={styles.divider} />
            {evaluation.botRecommendations.map((rec, i) => {
              const tierLabel = (tier: string) =>
                tier === 'client' ? t('bot_tier_client') : tier === 'premium' ? t('bot_tier_premium') : t('bot_tier_guest');
              return (
              <View key={i} wrap={false} style={{ marginBottom: i < evaluation.botRecommendations!.length - 1 ? 14 : 0 }}>
                <Text style={[styles.text, { fontWeight: 'bold', color: colors.primary, marginBottom: 6 }]}>
                  {rec.developmentArea}
                </Text>
                {/* Primary */}
                <View style={{ marginBottom: 8, marginLeft: 8 }}>
                  <Text style={[styles.text, { fontWeight: 'bold' }]}>
                    {t('bot_primary')}: {rec.primary.botName}
                    {rec.primary.requiredTier !== 'guest' && (
                      <Text style={{ fontWeight: 'normal', fontSize: 8, color: colors.gray400 }}>
                        {' '}({tierLabel(rec.primary.requiredTier)})
                      </Text>
                    )}
                  </Text>
                  <Text style={styles.text}>{rec.primary.rationale}</Text>
                  <Text style={[styles.text, { fontStyle: 'italic', fontSize: 9, color: colors.gray600 }]}>
                    {t('bot_conversation_starter')}: &ldquo;{rec.primary.examplePrompt}&rdquo;
                  </Text>
                </View>
                {/* Secondary */}
                <View style={{ marginLeft: 8 }}>
                  <Text style={[styles.text, { fontWeight: 'bold' }]}>
                    {t('bot_secondary')}: {rec.secondary.botName}
                    {rec.secondary.requiredTier !== 'guest' && (
                      <Text style={{ fontWeight: 'normal', fontSize: 8, color: colors.gray400 }}>
                        {' '}({tierLabel(rec.secondary.requiredTier)})
                      </Text>
                    )}
                  </Text>
                  <Text style={styles.text}>{rec.secondary.rationale}</Text>
                  <Text style={[styles.text, { fontStyle: 'italic', fontSize: 9, color: colors.gray600 }]}>
                    {t('bot_conversation_starter')}: &ldquo;{rec.secondary.examplePrompt}&rdquo;
                  </Text>
                </View>
                {i < evaluation.botRecommendations!.length - 1 && <View style={styles.divider} />}
              </View>
              );
            })}
          </View>
        )}

        {/* Footer - fixed: appears on every page */}
        <View style={styles.footerContainer} fixed>
          <View style={styles.footer}>
            <Text>
              {t('footer_template').replace('{user}', userEmail || 'Unknown').replace('{date}', formatDate())}
            </Text>
            <Text style={{ fontSize: 7, color: colors.gray400, marginTop: 2 }}>
              <Text style={styles.footerBold}>Meaningful Conversations</Text> by manualmode.at
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

// ============================================================================
// EXPORT FUNCTION
// ============================================================================

export const exportTranscriptEvaluationPDF = async (
  evaluation: TranscriptEvaluationResult,
  preAnswers: TranscriptPreAnswers,
  userEmail?: string,
  lang: 'en' = 'en'
): Promise<void> => {
  const isNative = Capacitor.isNativePlatform();
  const fileName = `transcript_evaluation_${new Date().toISOString().split('T')[0]}.pdf`;

  try {
    const blob = await pdf(
      <TranscriptEvaluationPDF
        evaluation={evaluation}
        preAnswers={preAnswers}
        userEmail={userEmail}
        lang={lang}
      />
    ).toBlob();

    if (isNative) {
      // Native platform: Save and share
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'Transcript Evaluation',
          text: 'My Transcript Evaluation',
          url: savedFile.uri,
          dialogTitle: 'Share Evaluation',
        });
      };
      reader.readAsDataURL(blob);
    } else {
      // Web platform: Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('PDF export error:', error);
    throw error;
  }
};
