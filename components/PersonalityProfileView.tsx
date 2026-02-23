import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useModalOpen } from '../utils/modalUtils';
import { useLocalization } from '../context/LocalizationContext';
import * as api from '../services/api';
import { updateCoachingMode } from '../services/userService';
import { decryptPersonalityProfile } from '../utils/personalityEncryption';
import { SurveyResult, NarrativeProfile, SpiralDynamicsResult, LensType } from './PersonalitySurvey';
import { generatePDF, generateSurveyPdfFilename } from '../utils/pdfGeneratorReact';
import { detectPII, PIIDetectionResult } from '../utils/piiDetection';
import Spinner from './shared/Spinner';
import Button from './shared/Button';
import { InfoIcon } from './icons/InfoIcon';
import NarrativeStoriesModal from './NarrativeStoriesModal';
import SpiralDynamicsVisualization from './SpiralDynamicsVisualization';
import { User, CoachingMode } from '../types';

// Narrative Profile Display Component
interface NarrativeProfileSectionProps {
  narrativeProfile: NarrativeProfile;
  t: (key: string) => string;
}

const NarrativeProfileSection: React.FC<NarrativeProfileSectionProps> = ({ narrativeProfile, t }) => {
  // Safely extract operatingSystem - handle both string and object formats
  const operatingSystemText = typeof narrativeProfile.operatingSystem === 'string' 
    ? narrativeProfile.operatingSystem 
    : (narrativeProfile.operatingSystem as any)?.core || 
      (narrativeProfile.operatingSystem as any)?.dynamics ||
      JSON.stringify(narrativeProfile.operatingSystem);
  
  return (
    <div>
      {/* Operating System - The main paradox synthesis */}
      <div className="prose prose-sm dark:prose-invert max-w-none mb-8">
        <div className="text-content-primary leading-relaxed whitespace-pre-line">
          {operatingSystemText}
        </div>
      </div>

      {/* Superpowers */}
      <div className="mb-8">
        <h4 className="text-lg font-semibold mb-4 text-content-primary flex items-center gap-2">
          {t('narrative_profile_superpowers_title') || '⚡ Deine geheimen Superkräfte'}
        </h4>
        <div className="space-y-4">
          {narrativeProfile.superpowers.map((power, index) => (
            <div 
              key={index}
              className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
            >
              <div className="font-bold text-yellow-800 dark:text-yellow-300 mb-2">
                {index + 1}. {power.name}
              </div>
              <p className="text-content-secondary text-sm leading-relaxed">
                {power.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Blindspots */}
      <div className="mb-8">
        <h4 className="text-lg font-semibold mb-4 text-content-primary flex items-center gap-2">
          {t('narrative_profile_blindspots_title') || '🌑 Potenzielle Blindspots'}
        </h4>
        <div className="space-y-4">
          {narrativeProfile.blindspots.map((spot, index) => (
            <div 
              key={index}
              className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
            >
              <div className="font-bold text-red-800 dark:text-red-300 mb-2">
                {index + 1}. {spot.name}
              </div>
              <p className="text-content-secondary text-sm leading-relaxed">
                {spot.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Growth Opportunities */}
      <div>
        <h4 className="text-lg font-semibold mb-4 text-content-primary flex items-center gap-2">
          {t('narrative_profile_growth_title') || '🌱 Wachstumsmöglichkeiten'}
        </h4>
        <div className="space-y-4">
          {narrativeProfile.growthOpportunities.map((opp, index) => (
            <div 
              key={index}
              className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
            >
              <div className="font-bold text-green-800 dark:text-green-300 mb-2">
                {index + 1}. {opp.title}
              </div>
              <p className="text-content-secondary text-sm leading-relaxed">
                {opp.recommendation}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Generation timestamp */}
      {narrativeProfile.generatedAt && (
        <div className="mt-6 text-xs text-content-tertiary text-right">
          {t('narrative_generated_at') || 'Generiert'}: {new Date(narrativeProfile.generatedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
};

// Riemann-Thomann Cross (Quadrant Diagram)
// Converts constant-sum data (4 dimensions) into 2 bipolar axes (classical Riemann-Kreuz):
//   X-axis: Wechsel − Dauer  (right = Wechsel/Spontaneity)
//   Y-axis: Distanz − Nähe   (up = Distanz/Distance)
interface RiemannCrossChartProps {
  data: {
    beruf: Record<string, number>;
    privat: Record<string, number>;
    selbst: Record<string, number>;
  };
  t: (key: string) => string;
}

const RiemannCrossChart: React.FC<RiemannCrossChartProps> = ({ data, t }) => {
  const size = 320;
  const padX = 30; // extra horizontal space for rotated axis labels
  const padY = 20; // extra vertical space for axis labels
  const center = size / 2;
  const axisLen = (size / 2) - 45; // space for labels

  const dimensionLabels: Record<string, string> = {
    dauer: t('riemann_dimension_dauer') || 'Beständigkeit',
    naehe: t('riemann_dimension_naehe') || 'Nähe',
    wechsel: t('riemann_dimension_wechsel') || 'Spontanität',
    distanz: t('riemann_dimension_distanz') || 'Distanz',
  };

  // Convert constant-sum data to bipolar coordinates (classical Riemann-Kreuz)
  const toCoord = (ctx: Record<string, number>) => ({
    x: (ctx.wechsel || 0) - (ctx.dauer || 0),    // positive = Wechsel (right)
    y: (ctx.distanz || 0) - (ctx.naehe || 0),     // positive = Distanz (up)
  });

  const contexts = [
    { key: 'beruf' as const, color: '#3b82f6', name: t('profile_view_beruf') || 'Beruf' },
    { key: 'privat' as const, color: '#22c55e', name: t('profile_view_privat') || 'Privat' },
    { key: 'selbst' as const, color: '#f97316', name: t('profile_view_selbst') || 'Selbst' },
  ];

  // Compute coordinates and dynamic scale
  const coords = contexts.map(c => toCoord(data[c.key]));
  const maxAbs = Math.max(...coords.flatMap(c => [Math.abs(c.x), Math.abs(c.y)]), 1);
  const scale = Math.ceil(maxAbs);

  const toPixel = (val: number) => (val / scale) * axisLen;

  // Detect overlapping points and apply jitter
  const OVERLAP_THRESHOLD = 8; // pixels - points closer than this are considered overlapping
  const JITTER_RADIUS = 10; // pixels - radius of jitter circle
  
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
    <div className="flex flex-col items-center w-full">
      <svg
        viewBox={`${-padX} ${-padY} ${size + padX * 2} ${size + padY * 2}`}
        className="w-full max-w-[400px] h-auto"
        style={{ minHeight: '280px' }}
      >
        {/* Quadrant background shading */}
        <rect x={center} y={0} width={center} height={center}
          className="fill-blue-50/40 dark:fill-blue-900/10" />
        <rect x={0} y={0} width={center} height={center}
          className="fill-purple-50/40 dark:fill-purple-900/10" />
        <rect x={0} y={center} width={center} height={center}
          className="fill-gray-50/40 dark:fill-gray-800/10" />
        <rect x={center} y={center} width={center} height={center}
          className="fill-green-50/40 dark:fill-green-900/10" />

        {/* Grid lines at 50% */}
        {[-0.5, 0.5].map(frac => (
          <g key={frac}>
            <line
              x1={center + toPixel(frac * scale)} y1={center - axisLen}
              x2={center + toPixel(frac * scale)} y2={center + axisLen}
              stroke="currentColor" strokeWidth="0.5" strokeDasharray="4,4"
              className="text-gray-200 dark:text-gray-700"
            />
            <line
              x1={center - axisLen} y1={center - toPixel(frac * scale)}
              x2={center + axisLen} y2={center - toPixel(frac * scale)}
              stroke="currentColor" strokeWidth="0.5" strokeDasharray="4,4"
              className="text-gray-200 dark:text-gray-700"
            />
          </g>
        ))}

        {/* Main cross axes */}
        <line x1={center - axisLen} y1={center} x2={center + axisLen} y2={center}
          stroke="currentColor" strokeWidth="1.5" className="text-gray-400 dark:text-gray-500" />
        <line x1={center} y1={center - axisLen} x2={center} y2={center + axisLen}
          stroke="currentColor" strokeWidth="1.5" className="text-gray-400 dark:text-gray-500" />

        {/* Triangle connecting the 3 context dots - uses original positions */}
        <polygon
          points={adjustedCoords.map(c =>
            `${center + toPixel(c.x)},${center - toPixel(c.y)}`
          ).join(' ')}
          fill="rgba(148, 163, 184, 0.12)"
          stroke="rgba(148, 163, 184, 0.35)"
          strokeWidth="1"
          strokeDasharray="4,3"
        />

        {/* Context dots with glow and tooltips */}
        {contexts.map((ctx, i) => {
          const adj = adjustedCoords[i];
          const px = adj.px;
          const py = adj.py;
          return (
            <g key={ctx.key} className="group cursor-help">
              {/* Glow effect */}
              <circle cx={px} cy={py} r="12" fill={ctx.color} opacity="0.15" />
              {/* Main dot */}
              <circle 
                cx={px} 
                cy={py} 
                r="7" 
                fill={ctx.color} 
                stroke="white" 
                strokeWidth="2.5"
                className="transition-all group-hover:r-[9]"
              />
              {/* Tooltip on hover */}
              <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <rect
                  x={px - 35}
                  y={py - 35}
                  width="70"
                  height="24"
                  rx="4"
                  className="fill-gray-900 dark:fill-gray-100"
                  opacity="0.95"
                />
                <text
                  x={px}
                  y={py - 20}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  className="fill-white dark:fill-gray-900"
                >
                  {ctx.name}
                </text>
              </g>
            </g>
          );
        })}

        {/* Axis end-labels (classical Riemann-Kreuz) — use SVG-native fontSize
            so labels scale proportionally with the chart on small screens */}
        {/* Right: Wechsel/Spontaneity — rotated 90° */}
        <text x={center + axisLen + 22} y={center}
          textAnchor="middle"
          transform={`rotate(90, ${center + axisLen + 22}, ${center})`}
          fontSize="14" fontWeight="bold"
          className="fill-gray-700 dark:fill-gray-200">
          {dimensionLabels.wechsel}
        </text>
        {/* Left: Dauer/Stability — rotated -90° */}
        <text x={center - axisLen - 22} y={center}
          textAnchor="middle"
          transform={`rotate(-90, ${center - axisLen - 22}, ${center})`}
          fontSize="14" fontWeight="bold"
          className="fill-gray-700 dark:fill-gray-200">
          {dimensionLabels.dauer}
        </text>
        {/* Top: Distanz/Distance */}
        <text x={center} y={center - axisLen - 20} textAnchor="middle"
          fontSize="14" fontWeight="bold"
          className="fill-gray-700 dark:fill-gray-200">
          {dimensionLabels.distanz}
        </text>
        {/* Bottom: Nähe/Closeness */}
        <text x={center} y={center + axisLen + 30} textAnchor="middle"
          fontSize="14" fontWeight="bold"
          className="fill-gray-700 dark:fill-gray-200">
          {dimensionLabels.naehe}
        </text>
      </svg>

      {/* Legend */}
      <div className="flex gap-6 mt-3 flex-wrap justify-center">
        {contexts.map(ctx => (
          <div key={ctx.key} className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: ctx.color }} />
            <span className="text-sm font-medium text-content-secondary">{ctx.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface PersonalityProfileViewProps {
  encryptionKey: CryptoKey | null;
  onStartNewTest: (existingProfile?: Partial<SurveyResult>, targetLens?: LensType) => void;
  currentUser: User | null;
  onUserUpdate: (user: User) => void;
  lifeContext?: string; // For PII detection when activating DPC/DPFL
  onEditLifeContext?: () => void; // Navigate to Life Context editor for PII cleanup
}

interface ProfileMetadata {
  testType: string; // Legacy field
  completedLenses: LensType[]; // New: which facets are completed
  createdAt: string;
  updatedAt: string;
  sessionCount: number;
  adaptationMode: 'adaptive' | 'stable';
}

const PersonalityProfileView: React.FC<PersonalityProfileViewProps> = ({ encryptionKey, onStartNewTest, currentUser, onUserUpdate, lifeContext, onEditLifeContext }) => {
  const { t, language } = useLocalization();
  // Premium or higher: isPremium (premium), isClient (client), or isAdmin (admin/developer)
  const isPremiumOrHigher = !!(currentUser?.isPremium || currentUser?.isClient || currentUser?.isAdmin);
  const [isLoading, setIsLoading] = useState(true);
  const [decryptedData, setDecryptedData] = useState<any>(null); // riemann or big5 data
  const [profileMetadata, setProfileMetadata] = useState<ProfileMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Warning modal moved to PersonalitySurvey.tsx - shows only when repeating an already-completed test
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const [isNarrativeExpanded, setIsNarrativeExpanded] = useState(false);
  const [showNarrativeStoriesModal, setShowNarrativeStoriesModal] = useState(false);
  const [isUpdatingCoachingMode, setIsUpdatingCoachingMode] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDpcWarning, setShowDpcWarning] = useState(false);
  const [pendingCoachingMode, setPendingCoachingMode] = useState<CoachingMode | null>(null);
  useModalOpen(showDpcWarning || showDeleteWarning);
  
  // Get current coaching mode from user, default to 'off'
  const currentCoachingMode = currentUser?.coachingMode || 'off';
  
  // Check if user has ever used DPC/DPFL before (stored in localStorage)
  const hasSeenDpcWarning = localStorage.getItem('hasSeenDpcWarning') === 'true';
  
  // Detect PII in life context when DPC warning is shown
  const piiDetectionResult = useMemo<PIIDetectionResult | null>(() => {
    if (!showDpcWarning || !lifeContext) return null;
    return detectPII(lifeContext, language as 'de' | 'en');
  }, [showDpcWarning, lifeContext, language]);
  
  const handleCoachingModeChange = async (newMode: CoachingMode) => {
    if (!currentUser || isUpdatingCoachingMode) return;
    
    // Show warning when switching to DPC/DPFL for the first time from 'off'
    if ((newMode === 'dpc' || newMode === 'dpfl') && currentCoachingMode === 'off' && !hasSeenDpcWarning) {
      setPendingCoachingMode(newMode);
      setShowDpcWarning(true);
      return;
    }
    
    await applyCoachingModeChange(newMode);
  };
  
  const applyCoachingModeChange = async (newMode: CoachingMode) => {
    if (!currentUser || isUpdatingCoachingMode) return;
    
    setIsUpdatingCoachingMode(true);
    try {
      const { user } = await updateCoachingMode(newMode);
      onUserUpdate(user);
    } catch (err) {
      console.error('Failed to update coaching mode:', err);
    } finally {
      setIsUpdatingCoachingMode(false);
    }
  };
  
  const confirmDpcActivation = async () => {
    if (pendingCoachingMode) {
      localStorage.setItem('hasSeenDpcWarning', 'true');
      setShowDpcWarning(false);
      await applyCoachingModeChange(pendingCoachingMode);
      setPendingCoachingMode(null);
    }
  };
  
  const cancelDpcActivation = () => {
    setShowDpcWarning(false);
    setPendingCoachingMode(null);
  };

  const handleDeleteProfile = async () => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    try {
      await api.deletePersonalityProfile();
      
      // Update user to reflect coaching mode reset
      if (currentUser) {
        onUserUpdate({ ...currentUser, coachingMode: 'off' });
      }
      
      // Clear local state
      setDecryptedData(null);
      setProfileMetadata(null);
      setShowDeleteWarning(false);
      
      // Show success message
      alert(t('profile_delete_success') || 'Persönlichkeitsprofil wurde erfolgreich gelöscht.');
      
      // Optionally redirect to start new test
      onStartNewTest();
    } catch (err) {
      console.error('Failed to delete profile:', err);
      alert(t('profile_delete_error') || 'Fehler beim Löschen des Profils. Bitte versuche es erneut.');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const encryptedProfile = await api.loadPersonalityProfile();
      
      if (!encryptedProfile) {
        setDecryptedData(null);
        setProfileMetadata(null);
        return;
      }

      // Decrypt profile data first to determine completed lenses
      let decrypted = null;
      if (encryptionKey && encryptedProfile.encryptedData) {
        decrypted = await decryptPersonalityProfile(encryptedProfile.encryptedData, encryptionKey);
        setDecryptedData(decrypted);
      }

      // Determine completedLenses from decrypted data
      const completedLenses: LensType[] = [];
      if (decrypted?.spiralDynamics) completedLenses.push('sd');
      if (decrypted?.riemann) completedLenses.push('riemann');
      if (decrypted?.big5) completedLenses.push('ocean');

      // Store metadata
      const metadata: ProfileMetadata = {
        testType: encryptedProfile.testType, // Legacy
        completedLenses,
        createdAt: encryptedProfile.createdAt,
        updatedAt: encryptedProfile.updatedAt,
        sessionCount: encryptedProfile.sessionCount || 0,
        adaptationMode: encryptedProfile.adaptationMode || 'stable'
      };
      setProfileMetadata(metadata);
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError(t('profile_view_error_load') || 'Fehler beim Laden des Profils');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!decryptedData || !profileMetadata) return;
    
    try {
      // Determine completedLenses from profile data
      const completedLenses: LensType[] = [];
      if (decryptedData.spiralDynamics) completedLenses.push('sd');
      if (decryptedData.riemann) completedLenses.push('riemann');
      if (decryptedData.big5) completedLenses.push('ocean');
      
      // Check for language mismatch in narrative
      const narrativeLangMismatch = decryptedData.narrativeProfile?.generatedLanguage 
        && decryptedData.narrativeProfile.generatedLanguage !== language;
      
      if (narrativeLangMismatch) {
        const confirmMsg = 'Your signature was generated in a different language. The PDF will contain mixed languages.\n\nWould you like to update the signature first (Cancel) or download the PDF anyway (OK)?';
        if (!window.confirm(confirmMsg)) {
          setShowNarrativeStoriesModal(true);
          return;
        }
      }
      
      // Reconstruct full SurveyResult for formatting
      const surveyResult: SurveyResult = {
        completedLenses,
        path: profileMetadata.testType as 'RIEMANN' | 'BIG5' | 'SD',
        filter: undefined, // Filter scores no longer used
        spiralDynamics: decryptedData.spiralDynamics,
        riemann: decryptedData.riemann,
        big5: decryptedData.big5,
        narratives: decryptedData.narratives,
        adaptationMode: decryptedData.adaptationMode,
        narrativeProfile: decryptedData.narrativeProfile
      };
      
      const filename = generateSurveyPdfFilename(surveyResult.path, language);
      await generatePDF(surveyResult, filename, language, currentUser?.email);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert(t('personality_survey_error_pdf'));
    }
  };

  const handleGenerateNarrative = async (newStories: { flowStory: string; frictionStory: string }) => {
    if (!decryptedData || !profileMetadata) return;
    
    setIsGeneratingNarrative(true);
    setNarrativeError(null);
    setShowNarrativeStoriesModal(false); // Close modal
    
    try {
      // Prepare quantitative data based on completed lenses
      const quantitativeData = {
        completedLenses: profileMetadata.completedLenses,
        spiralDynamics: decryptedData.spiralDynamics,
        riemann: decryptedData.riemann,
        big5: decryptedData.big5
      };
      
      // Call API to generate narrative with NEW stories
      const response = await api.generateNarrativeProfile({
        quantitativeData,
        narratives: newStories,
        language
      });
      
      if (response.narrativeProfile) {
        // Update local state with NEW stories and narrativeProfile
        const updatedData = {
          ...decryptedData,
          narratives: newStories, // Save the NEW stories!
          narrativeProfile: response.narrativeProfile
        };
        setDecryptedData(updatedData);
        
        // Auto-expand to show results
        setIsNarrativeExpanded(true);
        
        // Persist to backend - re-encrypt and save
        if (encryptionKey && profileMetadata) {
          try {
            const { encryptPersonalityProfile } = await import('../utils/personalityEncryption');
            const surveyResult = {
              completedLenses: profileMetadata.completedLenses,
              spiralDynamics: updatedData.spiralDynamics,
              riemann: updatedData.riemann,
              big5: updatedData.big5,
              narratives: newStories, // Save NEW stories to DB
              adaptationMode: updatedData.adaptationMode,
              narrativeProfile: response.narrativeProfile
            };
            const encryptedData = await encryptPersonalityProfile(surveyResult as any, encryptionKey);
            await api.savePersonalityProfile({
              testType: profileMetadata.testType || 'RIEMANN', // Legacy field required by backend
              completedLenses: profileMetadata.completedLenses,
              encryptedData,
              adaptationMode: updatedData.adaptationMode
            });
          } catch (saveErr) {
            console.error('Failed to save narrative profile:', saveErr);
            // Don't show error to user - local state is still updated
          }
        }
      }
    } catch (err) {
      console.error('Narrative generation failed:', err);
      setNarrativeError(t('narrative_generation_error') || 'Signatur-Generierung fehlgeschlagen. Bitte versuche es später erneut.');
    } finally {
      setIsGeneratingNarrative(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner />
        <p className="mt-4 text-content-secondary">{t('profile_view_loading') || 'Profil wird geladen...'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-4 pb-10 animate-fadeIn max-w-4xl mx-auto">
        <div className="bg-background-secondary dark:bg-transparent border border-border-secondary dark:border-border-primary rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-4 text-content-primary">{t('profile_view_error_title') || 'Fehler'}</h2>
          <p className="text-status-danger-foreground mb-4">{error}</p>
          <Button onClick={loadProfile}>
            {t('profile_view_retry') || 'Erneut versuchen'}
          </Button>
        </div>
      </div>
    );
  }

  if (!decryptedData || !profileMetadata) {
    return (
      <div className="pt-4 pb-10 animate-fadeIn max-w-4xl mx-auto">
        <div className="bg-background-secondary dark:bg-transparent border border-border-secondary dark:border-border-primary rounded-lg shadow-md p-6 text-center">
          <h2 className="text-2xl font-bold mb-4 text-content-primary">
            {t('profile_view_no_profile_title') || 'Kein Profil vorhanden'}
          </h2>
          <p className="text-content-secondary mb-6">
            {t('profile_view_no_profile_desc') || 'Du hast noch keinen Persönlichkeitstest absolviert. Starte jetzt und erhalte Zugang zu experimentellen Coaching-Modi.'}
          </p>
          <Button onClick={() => onStartNewTest()} size="lg">
            {t('profile_view_start_test') || 'Test starten'}
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const chipBase = 'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium';
  const chipMuted = `${chipBase} bg-background-secondary text-content-tertiary border-border-secondary dark:border-border-primary`;
  const chipMutedInteractive = `${chipMuted} opacity-70 hover:opacity-100 hover:bg-background-tertiary hover:text-content-primary transition-colors`;
  // Fall-inspired color palette
  const chipAmber = `${chipBase} bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-300/70 dark:border-amber-700/60`;  // What Drives You - golden warmth
  const chipRose = `${chipBase} bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-300/70 dark:border-rose-700/60`;  // How You Interact - warm connection
  const chipTeal = `${chipBase} bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-teal-300/70 dark:border-teal-700/60`;  // What Defines You - grounded depth

  const coachingSelectBase =
    'px-3 py-1.5 text-sm font-semibold rounded-lg border bg-background-secondary dark:bg-background-secondary/60 cursor-pointer transition-colors appearance-none bg-no-repeat bg-right pr-8 flex-shrink-0 self-start sm:self-auto';
  const coachingSelectState =
    currentCoachingMode === 'off'
      ? 'border-border-secondary text-content-tertiary'
      : currentCoachingMode === 'dpc'
      ? 'border-blue-400 text-blue-700 dark:text-blue-300'
      : 'border-green-500 text-green-700 dark:text-green-300';

  return (
    <div className="pt-4 pb-10 animate-fadeIn max-w-4xl mx-auto">
      <div className="bg-background-secondary dark:bg-transparent border border-border-secondary dark:border-border-primary rounded-lg shadow-md p-6">
        {/* Compact Header - Option A: Integrated with Dropdown */}
        <div className="mb-6 rounded-lg border border-border-secondary dark:border-border-primary bg-background-tertiary dark:bg-background-tertiary p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <h2 className="text-2xl font-bold text-content-primary text-center sm:text-left">
              {t('profile_view_title') || 'Mein Persönlichkeitsprofil'}
            </h2>
            {/* Coaching Mode Dropdown */}
            <select
                value={currentCoachingMode}
                onChange={(e) => handleCoachingModeChange(e.target.value as 'off' | 'dpc' | 'dpfl')}
                disabled={isUpdatingCoachingMode}
                className={`${coachingSelectBase} ${coachingSelectState} ${isUpdatingCoachingMode ? 'opacity-50 cursor-wait' : ''}`}
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundSize: '1.25rem', backgroundPosition: 'right 0.5rem center' }}
                title={
                  currentCoachingMode === 'off' 
                    ? (t('profile_coaching_mode_off_desc') || 'Klassisches Coaching')
                    : currentCoachingMode === 'dpc'
                    ? (t('profile_coaching_mode_dpc_desc') || 'Profil wird genutzt')
                    : (t('profile_coaching_mode_dpfl_desc') || 'Profil wird verfeinert')
                }
              >
                <option value="off">{t('profile_coaching_mode_off_short') || 'Aus'}</option>
                <option value="dpc">DPC</option>
                <option value="dpfl" disabled={!isPremiumOrHigher || decryptedData?.adaptationMode === 'stable'}>
                  {isPremiumOrHigher ? 'DPFL' : `🔒 DPFL (${t('feature_requires_premium') || 'Premium'})`}
                </option>
              </select>
          </div>
          {/* Compact metadata line */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-content-secondary mt-3">
            <span>{t('profile_view_created') || 'Erstellt'}: {formatDate(profileMetadata.createdAt)}</span>
            <div className="flex items-center gap-x-4">
              {profileMetadata.sessionCount > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  ✓ {profileMetadata.sessionCount} {profileMetadata.sessionCount === 1 
                    ? (t('profile_session_singular') || 'Session') 
                    : (t('profile_session_plural') || 'Sessions')}
                </span>
              )}
              {profileMetadata.updatedAt && profileMetadata.updatedAt !== profileMetadata.createdAt && (
                <span className="text-green-600 dark:text-green-400">
                  {t('profile_view_updated') || 'Aktualisiert'}: {formatDate(profileMetadata.updatedAt)}
                </span>
              )}
            </div>
          </div>
          
          {/* All facets indicators - completed ones colorful, pending ones clickable to add */}
          <div className="mt-5 flex flex-wrap items-center justify-evenly gap-2">
            {profileMetadata.completedLenses.includes('sd') ? (
              <span className={chipAmber}>
                ✓ {t('lens_sd_name') || 'Was dich antreibt'}
              </span>
            ) : isPremiumOrHigher ? (
              <button
                onClick={() => onStartNewTest({
                  completedLenses: profileMetadata.completedLenses,
                  spiralDynamics: decryptedData?.spiralDynamics,
                  riemann: decryptedData?.riemann,
                  big5: decryptedData?.big5,
                  narratives: decryptedData?.narratives,
                  adaptationMode: profileMetadata.adaptationMode,
                }, 'sd')}
                className={`${chipMutedInteractive} hover:border-amber-300/70 hover:text-amber-700 dark:hover:text-amber-300`}
              >
                + {t('lens_sd_name') || 'Was dich antreibt'}
              </button>
            ) : (
              <span className={chipMuted} title={t('feature_requires_premium') || 'Premium erforderlich'}>
                🔒 {t('lens_sd_name') || 'Was dich antreibt'}
              </span>
            )}
            {profileMetadata.completedLenses.includes('riemann') ? (
              <span className={chipRose}>
                ✓ {t('lens_riemann_name') || 'Wie du interagierst'}
              </span>
            ) : isPremiumOrHigher ? (
              <button
                onClick={() => onStartNewTest({
                  completedLenses: profileMetadata.completedLenses,
                  spiralDynamics: decryptedData?.spiralDynamics,
                  riemann: decryptedData?.riemann,
                  big5: decryptedData?.big5,
                  narratives: decryptedData?.narratives,
                  adaptationMode: profileMetadata.adaptationMode,
                }, 'riemann')}
                className={`${chipMutedInteractive} hover:border-rose-300/70 hover:text-rose-700 dark:hover:text-rose-300`}
              >
                + {t('lens_riemann_name') || 'Wie du interagierst'}
              </button>
            ) : (
              <span className={chipMuted} title={t('feature_requires_premium') || 'Premium erforderlich'}>
                🔒 {t('lens_riemann_name') || 'Wie du interagierst'}
              </span>
            )}
            {profileMetadata.completedLenses.includes('ocean') ? (
              <span className={chipTeal}>
                ✓ {t('lens_ocean_name') || 'Was dich ausmacht'}
              </span>
            ) : (
              <button
                onClick={() => onStartNewTest({
                  completedLenses: profileMetadata.completedLenses,
                  spiralDynamics: decryptedData?.spiralDynamics,
                  riemann: decryptedData?.riemann,
                  big5: decryptedData?.big5,
                  narratives: decryptedData?.narratives,
                  adaptationMode: profileMetadata.adaptationMode,
                }, 'ocean')}
                className={`${chipMutedInteractive} hover:border-teal-300/70 hover:text-teal-700 dark:hover:text-teal-300`}
              >
                + {t('lens_ocean_name') || 'Was dich ausmacht'}
              </button>
            )}
          </div>
        </div>

        {/* Narrative Profile Section - Moved up */}
        {decryptedData.narrativeProfile ? (
          <div data-signature-section className="mb-6 bg-background-tertiary dark:bg-background-tertiary rounded-lg border border-border-secondary dark:border-border-primary overflow-hidden">
            {/* Collapsible Header */}
            <button
              onClick={() => setIsNarrativeExpanded(!isNarrativeExpanded)}
              className="w-full px-4 sm:px-5 py-4 flex items-center justify-between hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
            >
              <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2">
                🧬 {t('narrative_profile_title') || 'Deine Signatur'}
              </h3>
              <span className={`text-xl text-content-tertiary transition-transform ${isNarrativeExpanded ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            
            {/* Language mismatch warning */}
            {decryptedData.narrativeProfile.generatedLanguage && decryptedData.narrativeProfile.generatedLanguage !== language && (
              <div className="mx-4 sm:mx-5 mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg flex items-center justify-between gap-3">
                <p className="text-amber-800 dark:text-amber-300 text-sm flex-1">
                  ⚠️ {t('narrative_language_mismatch') || 'Diese Signatur wurde in einer anderen Sprache generiert. Aktualisiere sie, um sie in deiner aktuellen Sprache zu erhalten.'}
                </p>
                <Button
                  onClick={() => setShowNarrativeStoriesModal(true)}
                  disabled={isGeneratingNarrative}
                  size="sm"
                  variant="primary"
                  loading={isGeneratingNarrative}
                >
                  🔄 {t('narrative_regenerate_language') || 'Neu generieren'}
                </Button>
              </div>
            )}

            {/* Collapsible Content */}
            {isNarrativeExpanded && (
              <div className="px-4 sm:px-5 pb-4">
                <NarrativeProfileSection narrativeProfile={decryptedData.narrativeProfile} t={t} />
              </div>
            )}
            
            {/* Action Buttons Row */}
            <div className="px-4 sm:px-5 pb-4 pt-3 flex flex-wrap items-center justify-evenly gap-2 border-t border-border-secondary/50 dark:border-border-primary/50">
              <Button
                onClick={() => setShowNarrativeStoriesModal(true)}
                disabled={isGeneratingNarrative}
                size="sm"
                loading={isGeneratingNarrative}
                variant="secondary"
              >
                {isGeneratingNarrative 
                  ? (t('narrative_generating') || 'Generiere...')
                  : <>🔄 {t('narrative_update_button') || 'Aktualisieren'}</>
                }
              </Button>
              <Button
                onClick={handleDownloadPdf}
                size="sm"
                variant="secondary"
              >
                📄 {t('profile_view_download_pdf') || 'Als PDF herunterladen'}
              </Button>
              <Button
                onClick={() => {
                  // Warning moved to PersonalitySurvey - shows only when repeating an already-completed test
                  onStartNewTest({
                    completedLenses: profileMetadata?.completedLenses || [],
                    spiralDynamics: decryptedData?.spiralDynamics,
                    riemann: decryptedData?.riemann,
                    big5: decryptedData?.big5,
                    narratives: decryptedData?.narratives,
                    adaptationMode: profileMetadata?.adaptationMode,
                    sessionCount: profileMetadata?.sessionCount || 0,
                  });
                }}
                size="sm"
                variant="secondary"
              >
                🔧 {t('profile_update_facet_button') || 'Facette aktualisieren'}
              </Button>
              {narrativeError && (
                <span className="text-red-600 dark:text-red-400 text-sm w-full text-center">{narrativeError}</span>
              )}
            </div>
          </div>
        ) : decryptedData.narratives?.flowStory && decryptedData.narratives?.frictionStory ? (
          <div data-signature-section className="mb-6 p-4 sm:p-5 bg-background-tertiary dark:bg-background-tertiary rounded-lg border border-border-secondary dark:border-border-primary">
            <h3 className="text-lg font-semibold mb-3 text-content-primary flex items-center gap-2">
              🧬 {t('narrative_profile_title') || 'Deine Signatur'}
            </h3>
            <p className="text-sm text-content-secondary mb-4">
              {t('narrative_profile_generate_desc') || 'Basierend auf deinen Test-Ergebnissen und persönlichen Erfahrungen können wir eine einzigartige Persönlichkeits-Signatur für dich erstellen.'}
            </p>
            
            {narrativeError && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-600 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="text-xl mt-0.5">🚨</div>
                  <p className="text-sm text-content-secondary">{narrativeError}</p>
                </div>
              </div>
            )}
            
            <div className="flex flex-wrap items-center justify-evenly gap-2 pt-3">
              <Button
                onClick={() => setShowNarrativeStoriesModal(true)}
                disabled={isGeneratingNarrative}
                loading={isGeneratingNarrative}
                variant="primary"
              >
                {isGeneratingNarrative 
                  ? (t('narrative_generating') || 'Generiere...')
                  : <>✨ {t('narrative_generate_button') || 'Signatur generieren'}</>
                }
              </Button>
              <Button
                onClick={() => {
                  // Warning moved to PersonalitySurvey - shows only when repeating an already-completed test
                  onStartNewTest({
                    completedLenses: profileMetadata?.completedLenses || [],
                    spiralDynamics: decryptedData?.spiralDynamics,
                    riemann: decryptedData?.riemann,
                    big5: decryptedData?.big5,
                    narratives: decryptedData?.narratives,
                    adaptationMode: profileMetadata?.adaptationMode,
                    sessionCount: profileMetadata?.sessionCount || 0,
                  });
                }}
                size="sm"
                variant="secondary"
              >
                🔧 {t('profile_update_facet_button') || 'Facette aktualisieren'}
              </Button>
            </div>
          </div>
        ) : (decryptedData.spiralDynamics || decryptedData.riemann || decryptedData.big5) ? (
          // User has test results but no narratives yet - prompt to add stories
          <div data-signature-section className="mb-6 p-4 sm:p-5 bg-background-tertiary dark:bg-background-tertiary rounded-lg border border-border-secondary dark:border-border-primary">
            <h3 className="text-lg font-semibold mb-3 text-content-primary flex items-center gap-2">
              🧬 {t('narrative_profile_title') || 'Deine Signatur'}
            </h3>
            <p className="text-sm text-content-secondary mb-4">
              {t('narrative_profile_create_desc') || 'Teile zwei kurze Erlebnisse mit uns, um eine einzigartige Persönlichkeits-Signatur basierend auf deinen Test-Ergebnissen zu erstellen.'}
            </p>
            
            {narrativeError && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-600 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="text-xl mt-0.5">🚨</div>
                  <p className="text-sm text-content-secondary">{narrativeError}</p>
                </div>
              </div>
            )}
            
            <div className="flex flex-wrap items-center justify-evenly gap-2 pt-3">
              <Button
                onClick={() => setShowNarrativeStoriesModal(true)}
                disabled={isGeneratingNarrative}
                loading={isGeneratingNarrative}
                variant="primary"
              >
                {isGeneratingNarrative 
                  ? (t('narrative_generating') || 'Generiere...')
                  : <>✨ {t('narrative_create_button') || 'Signatur erstellen'}</>
                }
              </Button>
              <Button
                onClick={() => {
                  // Warning moved to PersonalitySurvey - shows only when repeating an already-completed test
                  onStartNewTest({
                    completedLenses: profileMetadata?.completedLenses || [],
                    spiralDynamics: decryptedData?.spiralDynamics,
                    riemann: decryptedData?.riemann,
                    big5: decryptedData?.big5,
                    narratives: decryptedData?.narratives,
                    adaptationMode: profileMetadata?.adaptationMode,
                    sessionCount: profileMetadata?.sessionCount || 0,
                  });
                }}
                size="sm"
                variant="secondary"
              >
                🔧 {t('profile_update_facet_button') || 'Facette aktualisieren'}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Spiral Dynamics Results */}
        {decryptedData.spiralDynamics && (
          <section className="mb-6 rounded-xl border border-border-secondary dark:border-border-primary bg-background-tertiary dark:bg-background-tertiary p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-content-primary">
                {t('lens_sd_name') || 'Was dich antreibt'}
              </h3>
              <p className="text-sm text-content-tertiary">
                {t('profile_view_results') || 'Ergebnisse'}
              </p>
            </div>
            <SpiralDynamicsVisualization result={decryptedData.spiralDynamics} />
            <p className="mt-3 text-xs text-content-tertiary text-center font-semibold">
              {t('sd_mapping_note')}
            </p>
            <div className="mt-2 text-xs text-content-tertiary italic text-center">
              <p>{t('sd_citation')}</p>
              <p className="mt-1">{t('survey_pvq21_citation')}</p>
              <a 
                href={t('survey_pvq21_source_url')} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-accent-primary transition-colors"
              >
                {t('survey_pvq21_source_label')} ↗
              </a>
            </div>
          </section>
        )}

        {/* Riemann Results - Radar Chart */}
        {decryptedData.riemann && (
          <section className="mb-6 rounded-xl border border-border-secondary dark:border-border-primary bg-background-tertiary dark:bg-background-tertiary p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-content-primary">
                {t('lens_riemann_name') || 'Wie du interagierst'}
              </h3>
              <p className="text-sm text-content-tertiary">
                {t('profile_view_results') || 'Ergebnisse'}
              </p>
            </div>
            
            <div className="p-4 bg-background-secondary dark:bg-background-secondary rounded-lg border border-border-secondary/70">
              <RiemannCrossChart data={decryptedData.riemann} t={t} />
            </div>

            {/* DPC/DPFL coaching context note */}
            <p className="mt-3 text-xs text-content-tertiary text-center font-semibold">
              {t('riemann_coaching_context_note')}
            </p>
            
            {/* Stress Reaction Ranking */}
            {decryptedData.riemann.stressRanking && decryptedData.riemann.stressRanking.length > 0 && (
              <div className="mt-5 p-4 rounded-lg bg-background-secondary dark:bg-background-secondary border border-border-secondary/70">
                <h4 className="font-semibold text-content-primary mb-3 flex items-center gap-2">
                  <span>⚡</span>
                  {t('stress_reaction_title') || 'Stress-Reaktionsmuster'}
                </h4>
                <p className="text-sm text-content-secondary mb-3">
                  {t('stress_reaction_description') || 'So reagierst du typischerweise unter Druck (1 = erste Reaktion):'}
                </p>
                <div className="space-y-2">
                  {decryptedData.riemann.stressRanking.map((reactionId: string, index: number) => {
                    const stressLabels: Record<string, { label: string; description: string; emoji: string }> = {
                      distanz: { label: t('stress_reaction_distanz_label') || 'Rückzug', description: t('stress_reaction_distanz_desc') || 'Tür zu, Problem alleine lösen', emoji: '🚪' },
                      naehe: { label: t('stress_reaction_naehe_label') || 'Anpassung', description: t('stress_reaction_naehe_desc') || 'Unterstützung suchen, nachgeben', emoji: '🤝' },
                      dauer: { label: t('stress_reaction_dauer_label') || 'Kontrolle', description: t('stress_reaction_dauer_desc') || 'Auf Regeln pochen, Ordnung schaffen', emoji: '📋' },
                      wechsel: { label: t('stress_reaction_wechsel_label') || 'Aktionismus', description: t('stress_reaction_wechsel_desc') || 'Hektisch werden, viele Dinge anfangen', emoji: '⚡' }
                    };
                    const reaction = stressLabels[reactionId] || { label: reactionId, description: '', emoji: '❓' };
                    const isFirst = index === 0;
                    
                    return (
                      <div 
                        key={reactionId}
                        className={`flex items-center gap-3 p-2 rounded-lg ${
                          isFirst 
                            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                            : 'bg-background-tertiary dark:bg-background-primary'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                          isFirst 
                            ? 'bg-red-500 text-white' 
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="text-lg">{reaction.emoji}</span>
                        <div className="flex-1">
                          <span className={`font-medium ${isFirst ? 'text-red-700 dark:text-red-400' : 'text-content-primary'}`}>
                            {reaction.label}
                          </span>
                          <span className="text-sm text-content-secondary ml-2">
                            – {reaction.description}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="mt-3 text-xs text-content-tertiary italic text-center">
              {t('survey_riemann_disclaimer')}
            </p>
          </section>
        )}

        {/* OCEAN / BFI-2 Results */}
        {decryptedData.big5 && (() => {
          const big5 = decryptedData.big5;
          const domainKeys = ['extraversion', 'agreeableness', 'conscientiousness', 'neuroticism', 'openness'] as const;
          const traitIcon: Record<string, string> = {
            openness: '🎨', conscientiousness: '📋', extraversion: '💬', agreeableness: '🤝', neuroticism: '🌊'
          };
          // Facet keys grouped by domain
          const domainFacets: Record<string, string[]> = {
            extraversion: ['sociability', 'assertiveness', 'energyLevel'],
            agreeableness: ['compassion', 'respectfulness', 'trust'],
            conscientiousness: ['organization', 'productiveness', 'responsibility'],
            neuroticism: ['anxiety', 'depression', 'emotionalVolatility'],
            openness: ['aestheticSensitivity', 'intellectualCuriosity', 'creativeImagination'],
          };
          const variantLabel = big5.variant === 's' ? 'BFI-2-S' : big5.variant === 'xs' ? 'BFI-2-XS' : '';
          
          return (
            <section className="mb-6 rounded-xl border border-border-secondary dark:border-border-primary bg-background-tertiary dark:bg-background-tertiary p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-content-primary">
                  {t('lens_ocean_name') || 'Was dich ausmacht'}
                </h3>
                <p className="text-sm text-content-tertiary">
                  {t('profile_view_results') || 'Ergebnisse'}
                  {variantLabel && <span className="ml-2 text-xs opacity-60">({variantLabel})</span>}
                </p>
              </div>
              <div className="space-y-4">
                {domainKeys.map(trait => {
                  const score = big5[trait] as number;
                  if (typeof score !== 'number') return null;
                  const percentage = score * 20;
                  const traitKey = `big5_${trait}`;
                  const translatedTrait = t(traitKey) || trait;
                  const facets = big5.facets ? domainFacets[trait] : null;
                  
                  return (
                    <div key={trait}>
                      <div className="group rounded-lg border border-border-secondary/70 bg-background-secondary dark:bg-background-secondary p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-base opacity-70">{traitIcon[trait] || '•'}</span>
                            <span className="text-sm font-medium text-content-primary">{translatedTrait}</span>
                          </div>
                          <span className="text-sm font-semibold text-accent-primary">
                            {score.toFixed(1)}
                          </span>
                        </div>
                        <div className="w-full bg-background-tertiary rounded h-2.5 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-accent-primary/80 to-accent-primary h-full rounded transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        {/* Facets (BFI-2-S only) */}
                        {facets && (
                          <div className="mt-2 pt-2 border-t border-border-secondary/50 space-y-1.5">
                            {facets.map(facetKey => {
                              const facetScore = (big5.facets as any)?.[facetKey] as number;
                              if (typeof facetScore !== 'number') return null;
                              const facetPct = facetScore * 20;
                              const facetLabel = t(`bfi2_facet_${facetKey.replace(/([A-Z])/g, '_$1').toLowerCase()}`) || facetKey;
                              return (
                                <div key={facetKey} className="flex items-center gap-2">
                                  <span className="text-xs text-content-tertiary w-28 truncate" title={facetLabel}>{facetLabel}</span>
                                  <div className="flex-1 bg-background-tertiary rounded h-1.5 overflow-hidden">
                                    <div 
                                      className="bg-accent-primary/50 h-full rounded transition-all duration-500"
                                      style={{ width: `${facetPct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-content-tertiary w-8 text-right">{facetScore.toFixed(1)}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Scale legend */}
              <p className="mt-3 text-xs text-content-tertiary text-center tracking-wide font-semibold">
                {t('big5_scale_legend')}
              </p>
              {/* Citation & source */}
              <div className="mt-2 text-xs text-content-tertiary italic text-center">
                <p>{t('survey_bfi2_citation')}</p>
                <a 
                  href={t('survey_bfi2_source_url')} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-accent-primary transition-colors"
                >
                  {t('survey_bfi2_source_label')} ↗
                </a>
              </div>
            </section>
          );
        })()}


        {/* Delete Profile - Very subtle, at the bottom */}
        <div className="mt-8 pt-4 border-t border-border-secondary text-center">
          <button
            onClick={() => setShowDeleteWarning(true)}
            className="text-xs text-content-tertiary hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            {t('profile_delete_button') || 'Profil löschen'}
          </button>
        </div>
      </div>

      {/* Delete Profile Warning Modal */}
      {/* DPC/DPFL Activation Warning Modal */}
      {showDpcWarning && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
          aria-modal="true"
          role="dialog"
          onClick={cancelDpcActivation}
        >
          <div 
            className="bg-white dark:bg-gray-900 w-full max-w-lg p-6 border border-blue-400 dark:border-blue-500/50 shadow-xl rounded-lg mx-4 my-auto max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                🔐 {language === 'de' ? 'Personalisiertes Coaching aktivieren' : 'Activate Personalized Coaching'}
              </h2>
              <button 
                onClick={cancelDpcActivation}
                className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                aria-label={t('modal_close') || 'Schließen'}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <p className="text-blue-800 dark:text-blue-300 font-medium mb-2">
                  {language === 'de' 
                    ? 'Um dein Coaching-Erlebnis zu personalisieren, werden folgende Daten an den KI-Anbieter (Google oder Mistral) übermittelt:'
                    : 'To personalize your coaching experience, the following data will be sent to the AI provider (Google or Mistral):'}
                </p>
                <ul className="text-blue-700 dark:text-blue-400 text-sm list-disc list-inside space-y-1 mt-3">
                  <li>{language === 'de' ? 'Abstrakte Persönlichkeitsmerkmale (z.B. Nähe-Präferenz, Wechsel-Präferenz)' : 'Abstract personality traits (e.g., proximity preference, change preference)'}</li>
                  <li>{language === 'de' ? 'Deine Persönlichkeits-Signatur (falls generiert)' : 'Your personality signature (if generated)'}</li>
                  <li>{language === 'de' ? 'Kommunikationsstil-Präferenzen' : 'Communication style preferences'}</li>
                </ul>
              </div>
              
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                <p className="text-green-800 dark:text-green-300 font-medium mb-2">
                  ✅ {language === 'de' ? 'Was NICHT übermittelt wird:' : 'What is NOT transmitted:'}
                </p>
                <ul className="text-green-700 dark:text-green-400 text-sm list-disc list-inside space-y-1">
                  <li>{language === 'de' ? 'Deine E-Mail-Adresse oder Benutzer-ID' : 'Your email address or user ID'}</li>
                  <li>{language === 'de' ? 'Deine IP-Adresse' : 'Your IP address'}</li>
                  <li>{language === 'de' ? 'Direkt identifizierende Informationen' : 'Directly identifying information'}</li>
                </ul>
              </div>
              
              {/* PII Detection Warning */}
              {piiDetectionResult?.hasPII && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                  <p className="text-amber-800 dark:text-amber-300 font-medium mb-2">
                    ⚠️ {language === 'de' 
                      ? 'Mögliche persönliche Daten in deinem Lebenskontext erkannt:'
                      : 'Potential personal data detected in your Life Context:'}
                  </p>
                  <ul className="text-amber-700 dark:text-amber-400 text-sm list-disc list-inside space-y-1">
                    {piiDetectionResult.detectedTypes.map((type, idx) => (
                      <li key={idx}>
                        {type}
                        {piiDetectionResult.examples[idx] && (
                          <span className="text-amber-600 dark:text-amber-500 ml-1">
                            ({language === 'de' ? 'z.B.' : 'e.g.'} "{piiDetectionResult.examples[idx]}")
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="text-amber-700 dark:text-amber-400 text-sm mt-3">
                    {language === 'de'
                      ? '💡 Empfehlung: Ersetze echte Namen und Firmennamen durch Pseudonyme (z.B. "mein Chef" statt "Hans Müller").'
                      : '💡 Recommendation: Replace real names and company names with pseudonyms (e.g., "my boss" instead of "John Smith").'}
                  </p>
                  {onEditLifeContext && (
                    <button
                      onClick={() => {
                        setShowDpcWarning(false);
                        setPendingCoachingMode(null);
                        onEditLifeContext();
                      }}
                      className="mt-3 w-full py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors text-sm"
                    >
                      📝 {language === 'de' ? 'Lebenskontext jetzt bereinigen' : 'Clean up Life Context now'}
                    </button>
                  )}
                </div>
              )}

              <p className="text-content-secondary text-sm">
                {language === 'de' 
                  ? 'Die übermittelten Daten sind pseudonymisiert und können nicht auf dich als Person zurückgeführt werden. Mehr Informationen findest du in unserer Datenschutzerklärung.'
                  : 'The transmitted data is pseudonymized and cannot be traced back to you as an individual. More information can be found in our Privacy Policy.'}
              </p>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                onClick={cancelDpcActivation}
                variant="secondary"
                size="md"
                className="flex-1"
              >
                {language === 'de' ? 'Abbrechen' : 'Cancel'}
              </Button>
              <Button
                onClick={confirmDpcActivation}
                variant="primary"
                size="md"
                className="flex-1"
              >
                {language === 'de' ? 'Verstanden, aktivieren' : 'Understood, activate'}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDeleteWarning && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
          aria-modal="true"
          role="dialog"
          onClick={() => !isDeleting && setShowDeleteWarning(false)}
        >
          <div 
            className="bg-red-50 dark:bg-gray-900 w-full max-w-lg p-6 border-2 border-red-400 dark:border-red-600 shadow-xl rounded-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 uppercase flex items-center gap-2">
                🗑️ {t('profile_delete_title') || 'Profil löschen'}
              </h2>
              <button 
                onClick={() => setShowDeleteWarning(false)} 
                disabled={isDeleting}
                className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white disabled:opacity-50"
                aria-label={t('modal_close') || 'Schließen'}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-600 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="text-2xl mt-0.5">🚨</div>
                  <div>
                    <p className="font-semibold text-content-primary mb-1">
                      {t('profile_delete_warning') || 'Diese Aktion kann nicht rückgängig gemacht werden!'}
                    </p>
                    <p className="text-sm text-content-secondary">
                      {t('profile_delete_data_loss') || 
                        'Dein Persönlichkeitsprofil, deine Signatur und alle Coaching-Verfeinerungen werden dauerhaft gelöscht.'}
                    </p>
                  </div>
                </div>
              </div>
              
              {profileMetadata && profileMetadata.sessionCount > 0 && (
                <p className="text-amber-700 dark:text-amber-400 text-sm">
                  📊 {t('profile_delete_sessions', { count: profileMetadata.sessionCount }) || 
                    `Dein Profil wurde durch ${profileMetadata.sessionCount} Coaching-Sessions verfeinert. Diese Anpassungen gehen verloren.`}
                </p>
              )}
              
              <p className="text-gray-600 dark:text-gray-400">
                {t('profile_delete_confirm_question') || 'Bist du sicher, dass du dein Persönlichkeitsprofil löschen möchtest?'}
              </p>
            </div>
            
            <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button 
                onClick={() => setShowDeleteWarning(false)} 
                variant="secondary"
                disabled={isDeleting}
              >
                {t('profile_delete_cancel') || 'Abbrechen'}
              </Button>
              
              <Button
                onClick={handleDeleteProfile}
                variant="danger"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('profile_delete_deleting') || 'Wird gelöscht...'}
                  </span>
                ) : (
                  t('profile_delete_confirm') || 'Ja, Profil löschen'
                )}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Narrative Stories Modal */}
      {showNarrativeStoriesModal && (
        <NarrativeStoriesModal
          onComplete={handleGenerateNarrative}
          onCancel={() => setShowNarrativeStoriesModal(false)}
          oldStories={decryptedData?.narratives}
        />
      )}
    </div>
  );
};

export default PersonalityProfileView;

