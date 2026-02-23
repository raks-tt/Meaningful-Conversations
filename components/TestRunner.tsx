import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocalization } from '../context/LocalizationContext';
import { useModalOpen } from '../utils/modalUtils';
import { Bot, Message, SessionAnalysis } from '../types';
import { BOTS } from '../constants';
import { 
  DynamicTestScenario, 
  TestRunResult, 
  getDynamicTestScenarios,
  getTestableBots,
  getCategoryIcon,
  getCategoryName,
  TestCategory,
  // New multi-select profile imports
  RiemannProfileBlock,
  SDProfileBlock,
  OCEANProfileBlock,
  RIEMANN_PROFILES,
  SD_PROFILES,
  OCEAN_PROFILES,
  combineProfiles,
  CombinedTestProfile
} from '../utils/testScenarios';
import { getApiBaseUrl, getSession, testRefinementWithMockSessions, RefinementPreviewResult } from '../services/api';
import { analyzeSession } from '../services/geminiService';
import { CheckIcon } from './icons/CheckIcon';
import { XIcon } from './icons/XIcon';
import Spinner from './shared/Spinner';
import { decryptPersonalityProfile } from '../utils/personalityEncryption';
import ProfileRefinementModal from './ProfileRefinementModal';

// ============================================
// MOCK SESSION DATA FOR REFINEMENT TESTING
// ============================================

// Mock sessions for Riemann-Thomann profile testing
// Format must match behaviorLogger output: *High, *Low, *Delta, *FoundHigh, *FoundLow
const MOCK_RIEMANN_SESSIONS = [
  {
    // Session 1: Strong Dauer + moderate Naehe signal
    dauerHigh: 5, dauerLow: 0, dauerDelta: 5,
    dauerFoundHigh: ['sicherheit', 'planung', 'struktur', 'verlässlichkeit', 'routine'],
    dauerFoundLow: [],
    wechselHigh: 1, wechselLow: 2, wechselDelta: -1,
    wechselFoundHigh: ['spontan'],
    wechselFoundLow: ['vorhersehbar', 'gewohnt'],
    naeheHigh: 3, naeheLow: 0, naeheDelta: 3,
    naeheFoundHigh: ['teamarbeit', 'vertrauen', 'gemeinsam'],
    naeheFoundLow: [],
    distanzHigh: 0, distanzLow: 1, distanzDelta: -1,
    distanzFoundHigh: [],
    distanzFoundLow: ['eigenständig'],
    comfortScore: 5
  },
  {
    // Session 2: Confirming Dauer + Naehe pattern
    dauerHigh: 4, dauerLow: 0, dauerDelta: 4,
    dauerFoundHigh: ['ordnung', 'systematisch', 'disziplin', 'pünktlichkeit'],
    dauerFoundLow: [],
    wechselHigh: 0, wechselLow: 1, wechselDelta: -1,
    wechselFoundHigh: [],
    wechselFoundLow: ['abwechslung'],
    naeheHigh: 2, naeheLow: 0, naeheDelta: 2,
    naeheFoundHigh: ['beziehung', 'empathie'],
    naeheFoundLow: [],
    distanzHigh: 0, distanzLow: 0, distanzDelta: 0,
    distanzFoundHigh: [],
    distanzFoundLow: [],
    comfortScore: 4
  }
];

// Mock sessions for Big5/OCEAN profile testing
const MOCK_BIG5_SESSIONS = [
  {
    // Session 1: High Conscientiousness + moderate Openness
    opennessHigh: 4, opennessLow: 0, opennessDelta: 4,
    opennessFoundHigh: ['kreativ', 'neugierig', 'experimentierfreudig', 'innovativ'],
    opennessFoundLow: [],
    conscientiousnessHigh: 6, conscientiousnessLow: 0, conscientiousnessDelta: 6,
    conscientiousnessFoundHigh: ['organisiert', 'pünktlich', 'strukturiert', 'diszipliniert', 'gewissenhaft', 'zuverlässig'],
    conscientiousnessFoundLow: [],
    extraversionHigh: 2, extraversionLow: 1, extraversionDelta: 1,
    extraversionFoundHigh: ['gesellig', 'gesprächig'],
    extraversionFoundLow: ['zurückgezogen'],
    agreeablenessHigh: 3, agreeablenessLow: 0, agreeablenessDelta: 3,
    agreeablenessFoundHigh: ['hilfsbereit', 'kooperativ', 'freundlich'],
    agreeablenessFoundLow: [],
    neuroticismHigh: 3, neuroticismLow: 0, neuroticismDelta: 3,
    neuroticismFoundHigh: ['nervös', 'besorgt', 'gestresst'],
    neuroticismFoundLow: [],
    comfortScore: 5
  },
  {
    // Session 2: Confirming Conscientiousness + Agreeableness
    opennessHigh: 3, opennessLow: 0, opennessDelta: 3,
    opennessFoundHigh: ['aufgeschlossen', 'ideenreich', 'offen für neues'],
    opennessFoundLow: [],
    conscientiousnessHigh: 5, conscientiousnessLow: 0, conscientiousnessDelta: 5,
    conscientiousnessFoundHigh: ['ordentlich', 'sorgfältig', 'verantwortungsvoll', 'gründlich', 'geplant'],
    conscientiousnessFoundLow: [],
    extraversionHigh: 1, extraversionLow: 0, extraversionDelta: 1,
    extraversionFoundHigh: ['aktiv'],
    extraversionFoundLow: [],
    agreeablenessHigh: 4, agreeablenessLow: 0, agreeablenessDelta: 4,
    agreeablenessFoundHigh: ['vertrauensvoll', 'mitfühlend', 'einfühlsam', 'warmherzig'],
    agreeablenessFoundLow: [],
    neuroticismHigh: 2, neuroticismLow: 0, neuroticismDelta: 2,
    neuroticismFoundHigh: ['unsicher', 'ängstlich'],
    neuroticismFoundLow: [],
    comfortScore: 4
  }
];

// Mock sessions for Spiral Dynamics profile testing
const MOCK_SD_SESSIONS = [
  {
    // Session 1: Strong Blue + Green signal
    blueHigh: 4, blueLow: 0, blueDelta: 4,
    blueFoundHigh: ['ordnung', 'regeln', 'pflicht', 'verantwortung'],
    blueFoundLow: [],
    greenHigh: 3, greenLow: 0, greenDelta: 3,
    greenFoundHigh: ['mitgefühl', 'einfühlungsvermögen', 'gemeinsames gefühl'],
    greenFoundLow: [],
    orangeHigh: 2, orangeLow: 1, orangeDelta: 1,
    orangeFoundHigh: ['leistung', 'effizienz'],
    orangeFoundLow: ['wettbewerb'],
    redHigh: 0, redLow: 2, redDelta: -2,
    redFoundHigh: [],
    redFoundLow: ['kampfbereit', 'sofort handeln'],
    yellowHigh: 1, yellowLow: 0, yellowDelta: 1,
    yellowFoundHigh: ['systemisch'],
    yellowFoundLow: [],
    purpleHigh: 0, purpleLow: 0, purpleDelta: 0,
    purpleFoundHigh: [], purpleFoundLow: [],
    turquoiseHigh: 1, turquoiseLow: 0, turquoiseDelta: 1,
    turquoiseFoundHigh: ['universell verbunden'],
    turquoiseFoundLow: [],
    beigeHigh: 0, beigeLow: 0, beigeDelta: 0,
    beigeFoundHigh: [], beigeFoundLow: [],
    comfortScore: 5
  },
  {
    // Session 2: Confirming Blue + Green
    blueHigh: 3, blueLow: 0, blueDelta: 3,
    blueFoundHigh: ['disziplin', 'loyalität', 'autorität'],
    blueFoundLow: [],
    greenHigh: 4, greenLow: 0, greenDelta: 4,
    greenFoundHigh: ['harmonie', 'konsens', 'gleichberechtigung', 'inklusion'],
    greenFoundLow: [],
    orangeHigh: 1, orangeLow: 0, orangeDelta: 1,
    orangeFoundHigh: ['zielorientiert'],
    orangeFoundLow: [],
    redHigh: 0, redLow: 1, redDelta: -1,
    redFoundHigh: [],
    redFoundLow: ['dominanz'],
    yellowHigh: 0, yellowLow: 0, yellowDelta: 0,
    yellowFoundHigh: [], yellowFoundLow: [],
    purpleHigh: 1, purpleLow: 0, purpleDelta: 1,
    purpleFoundHigh: ['zugehörigkeit'],
    purpleFoundLow: [],
    turquoiseHigh: 0, turquoiseLow: 0, turquoiseDelta: 0,
    turquoiseFoundHigh: [], turquoiseFoundLow: [],
    beigeHigh: 0, beigeLow: 0, beigeDelta: 0,
    beigeFoundHigh: [], beigeFoundLow: [],
    comfortScore: 4
  }
];

interface TestRunnerProps {
  onClose: () => void;
  userProfile?: any; // User's actual personality profile (encrypted from DB)
  encryptionKey: CryptoKey | null; // Encryption key to decrypt the profile
}

type TestPhase = 'setup' | 'running' | 'analyzing' | 'validation' | 'complete';

const TestRunner: React.FC<TestRunnerProps> = ({ onClose, userProfile, encryptionKey }) => {
  const { t, language } = useLocalization();
  useModalOpen();
  
  // Decrypted personality profile state
  const [decryptedProfile, setDecryptedProfile] = useState<any>(null);
  
  // Setup state
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<DynamicTestScenario | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<TestCategory | 'all'>('all');
  
  // Multi-select profile state
  const [selectedRiemann, setSelectedRiemann] = useState<RiemannProfileBlock | null>(null);
  const [selectedSD, setSelectedSD] = useState<SDProfileBlock | null>(null);
  const [selectedOCEAN, setSelectedOCEAN] = useState<OCEANProfileBlock | null>(null);
  const [useMyProfile, setUseMyProfile] = useState(false);
  
  // Execution state
  const [phase, setPhase] = useState<TestPhase>('setup');
  const [isRunning, setIsRunning] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Session analysis state (for session category tests)
  const [sessionAnalysisResult, setSessionAnalysisResult] = useState<SessionAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Manual check state
  const [manualCheckResults, setManualCheckResults] = useState<Record<string, boolean | null>>({});
  const [manualNotes, setManualNotes] = useState<Record<string, string>>({});
  
  // Refinement mock test state
  const [refinementPreview, setRefinementPreview] = useState<RefinementPreviewResult | null>(null);
  const [showRefinementModal, setShowRefinementModal] = useState(false);
  
  // Decrypt user profile when available
  useEffect(() => {
    const decryptProfile = async () => {
      if (userProfile && userProfile.encryptedData && encryptionKey) {
        try {
          const decrypted = await decryptPersonalityProfile(userProfile.encryptedData, encryptionKey);
          setDecryptedProfile(decrypted);
        } catch (error) {
          console.error('[TestRunner] Failed to decrypt personality profile:', error);
          setDecryptedProfile(null);
        }
      } else {
        setDecryptedProfile(null);
      }
    };
    decryptProfile();
  }, [userProfile, encryptionKey]);
  
  // Determine which lenses the user profile has
  const userProfileLenses = useMemo(() => {
    if (!decryptedProfile) return [];
    const lenses: string[] = [];
    if (decryptedProfile.riemann) lenses.push('riemann');
    if (decryptedProfile.spiralDynamics) lenses.push('sd');
    if (decryptedProfile.big5) lenses.push('ocean');
    return lenses;
  }, [decryptedProfile]);

  const scenarios = getDynamicTestScenarios(t);
  const bots = getTestableBots();
  const interviewBot = BOTS.find(b => b.id === 'gloria-life-context') || null;
  const categories: TestCategory[] = ['core', 'session', 'personality', 'safety', 'bot'];
  
  const filteredScenarios = categoryFilter === 'all' 
    ? scenarios 
    : scenarios.filter(s => s.category === categoryFilter);

  // Handle scenario selection - auto-select interview bot for interview scenario
  const handleScenarioSelect = (scenario: DynamicTestScenario) => {
    setSelectedScenario(scenario);
    if (scenario.id === 'bot_interview' && interviewBot) {
      setSelectedBot(interviewBot);
    } else if (selectedBot?.id === 'gloria-life-context') {
      // Clear interview bot if switching away from interview scenario
      setSelectedBot(null);
    }
  };

  // Check if at least one profile option is selected
  const hasProfileSelection = useMemo(() => {
    return useMyProfile || selectedRiemann || selectedSD || selectedOCEAN;
  }, [useMyProfile, selectedRiemann, selectedSD, selectedOCEAN]);

  // Get combined profile name for display
  const getProfileDisplayName = useCallback((): string => {
    if (useMyProfile) return '👤 ' + t('test_runner_my_profile');
    
    const parts: string[] = [];
    if (selectedRiemann) parts.push(selectedRiemann.name);
    if (selectedSD) parts.push(selectedSD.name);
    if (selectedOCEAN) parts.push(selectedOCEAN.name);
    
    return parts.length > 0 ? parts.join(' + ') : t('test_runner_no_profile');
  }, [useMyProfile, selectedRiemann, selectedSD, selectedOCEAN, t]);

  // Get the profile to use for testing
  const getTestProfile = useCallback((): CombinedTestProfile | null => {
    if (useMyProfile && decryptedProfile) {
      // Use the REAL decrypted profile data!
      return decryptedProfile;
    }
    
    // Combine selected profile blocks
    if (selectedRiemann || selectedSD || selectedOCEAN) {
      return combineProfiles(selectedRiemann, selectedSD, selectedOCEAN);
    }
    
    return null;
  }, [useMyProfile, decryptedProfile, selectedRiemann, selectedSD, selectedOCEAN]);

  // Run a single test message
  const runTestMessage = useCallback(async (
    message: string, 
    bot: Bot, 
    profile: any,
    chatHistory: Message[]
  ): Promise<{ response: string; responseTime: number; telemetry?: any; llmMetadata?: any }> => {
    const apiBaseUrl = getApiBaseUrl();
    const startTime = Date.now();
    
    const session = getSession();
    if (!session?.token) {
      throw new Error('Not authenticated');
    }
    const token = session.token;

    // Build request with test profile override
    const response = await fetch(`${apiBaseUrl}/api/gemini/chat/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Test-Mode': 'true', // Signal to backend this is a test
      },
      body: JSON.stringify({
        botId: bot.id,
        userMessage: message,
        history: chatHistory,
        lang: language,
        context: '', // Could be extended to test with context
        testProfileOverride: profile, // Backend will use this instead of user's actual profile
        includeTestTelemetry: true, // Request DPC/DPFL telemetry in response
      }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    return {
      response: data.text,
      responseTime,
      telemetry: data.testTelemetry, // DPC/DPFL info from backend
      llmMetadata: data.llmMetadata, // LLM metadata for comparison
    };
  }, [language]);

  // Fallback follow-up messages - these should sound like a COACHEE sharing their struggles
  const fallbackFollowUps = useMemo(() => [
    'Yes, I think it\'s mainly the amount of different things happening at the same time.',
    'This has been bothering me for a while, to be honest.',
    'I don\'t really know where to start. It all feels so overwhelming.',
    'Sometimes I feel like I\'m not doing justice to anyone - neither myself nor others.',
    'I\'ve tried several things already, but nothing seems to really help.',
    'The difficult part is that I often can\'t say no when someone needs something from me.',
    'I notice that this is taking quite an emotional toll on me.',
  ], []);

  // Get personality description for the coachee based on selected profile
  const getCoacheePersonalityDescription = useCallback((): string => {
    const parts: string[] = [];

    if (selectedRiemann) {
      const r = selectedRiemann;
      if (r.data.naehe > 60) parts.push('You seek closeness and connection, need emotional support');
      if (r.data.distanz > 60) parts.push('You need distance and independence, tend to be analytical');
      if (r.data.dauer > 60) parts.push('You need security and structure, don\'t like surprises');
      if (r.data.wechsel > 60) parts.push('You love change and variety, are spontaneous');
    }

    if (selectedOCEAN) {
      const o = selectedOCEAN;
      if (o.data.neuroticism > 60) parts.push('You are emotionally sensitive and react strongly to stress');
      if (o.data.extraversion > 60) parts.push('You are extroverted and like to share your thoughts');
      if (o.data.extraversion < 40) parts.push('You are rather introverted and reserved');
    }

    return parts.length > 0 ? parts.join('. ') + '.' : '';
  }, [selectedRiemann, selectedOCEAN]);

  // Generate a dynamic follow-up message using dedicated coachee simulation endpoint
  const generateFollowUpMessage = useCallback(async (
    chatHistory: Message[],
    scenarioDescription: string,
    turnNumber: number,
    _botId: string // Not used anymore, kept for API compatibility
  ): Promise<string> => {
    const apiBaseUrl = getApiBaseUrl();
    const session = getSession();
    if (!session?.token) {
      throw new Error('Not authenticated');
    }

    // Get last bot response for context
    const lastBotMessage = [...chatHistory].reverse().find(m => m.role === 'bot')?.text || '';
    const lastUserMessage = [...chatHistory].reverse().find(m => m.role === 'user')?.text || '';

    // Get personality context for the coachee
    const personalityContext = getCoacheePersonalityDescription();

    try {
      // Use dedicated coachee simulation endpoint (no bot personality interference)
      const response = await fetch(`${apiBaseUrl}/api/gemini/test/simulate-coachee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          lastBotMessage: lastBotMessage.substring(0, 500),
          lastUserMessage: lastUserMessage.substring(0, 300),
          scenarioDescription,
          personalityContext: personalityContext || undefined,
          lang: language,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const generatedText = data.text?.trim();
        
        // Validate the generated text (basic checks)
        if (generatedText && generatedText.length > 5 && generatedText.length < 2000) {
          return generatedText;
        }
      }
    } catch (err) {
      console.warn('Coachee simulation failed:', err);
    }

    // Fallback to varied follow-up messages (English only)
    const fallbackIndex = (turnNumber - 1) % fallbackFollowUps.length;
    return fallbackFollowUps[fallbackIndex];
  }, [fallbackFollowUps, getCoacheePersonalityDescription]);

  // Run the full test scenario
  const runTest = useCallback(async () => {
    if (!selectedBot || !hasProfileSelection || !selectedScenario) return;

    setPhase('running');
    setIsRunning(true);
    setError(null);
    setCurrentMessageIndex(0);
    
    const profile = getTestProfile();
    const responses: TestRunResult['responses'] = [];
    const chatHistory: Message[] = [];
    let lastTelemetry: any = null;
    
    // Cumulative keyword tracking across ALL messages in the test
    const cumulativeKeywords: {
      riemann: string[];
      big5: string[];
      spiralDynamics: string[];
    } = { riemann: [], big5: [], spiralDynamics: [] };
    
    const accumulateTelemetry = (telemetry: any) => {
      if (!telemetry?.allFrameworkKeywords) return;
      const afk = telemetry.allFrameworkKeywords;
      if (afk.riemann) cumulativeKeywords.riemann.push(...afk.riemann);
      if (afk.big5) cumulativeKeywords.big5.push(...afk.big5);
      if (afk.spiralDynamics) cumulativeKeywords.spiralDynamics.push(...afk.spiralDynamics);
    };

    try {
      // Add initial bot greeting to simulate realistic conversation start
      // In real conversations, the bot greets first, then the user responds
      const initialGreeting: Message = {
        id: 'test-bot-greeting',
        role: 'bot',
        text: 'Hello! Nice to see you. What\'s on your mind today?',
        timestamp: new Date().toISOString(),
      };
      chatHistory.push(initialGreeting);

      for (let i = 0; i < selectedScenario.testMessages.length; i++) {
        setCurrentMessageIndex(i);
        const testMsg = selectedScenario.testMessages[i];
        
        // Add user message to history
        const userMessage: Message = {
          id: `test-user-${i}`,
          role: 'user',
          text: testMsg.text,
          timestamp: new Date().toISOString(),
        };
        chatHistory.push(userMessage);

        // Run the API call
        const result = await runTestMessage(testMsg.text, selectedBot, profile, chatHistory);
        
        // Add bot response to history
        const botMessage: Message = {
          id: `test-bot-${i}`,
          role: 'bot',
          text: result.response,
          timestamp: new Date().toISOString(),
        };
        chatHistory.push(botMessage);

        responses.push({
          userMessage: testMsg.text,
          botResponse: result.response,
          responseTime: result.responseTime,
          llmMetadata: result.llmMetadata || null,
        });

        if (result.telemetry) {
          lastTelemetry = result.telemetry;
          accumulateTelemetry(result.telemetry);
        }
      }

      // Dynamic continuation: generate follow-up messages until minConversationTurns is reached
      const minTurns = selectedScenario.minConversationTurns ?? selectedScenario.testMessages.length;
      const enableDynamic = selectedScenario.enableDynamicContinuation ?? false;
      let currentTurn = selectedScenario.testMessages.length;

      if (enableDynamic && currentTurn < minTurns) {
        while (currentTurn < minTurns) {
          setCurrentMessageIndex(currentTurn);
          
          // Generate a contextual follow-up message
          const followUpText = await generateFollowUpMessage(
            chatHistory,
            selectedScenario.description,
            currentTurn + 1,
            selectedBot.id
          );

          // Add generated user message to history
          const userMessage: Message = {
            id: `test-user-dynamic-${currentTurn}`,
            role: 'user',
            text: followUpText,
            timestamp: new Date().toISOString(),
          };
          chatHistory.push(userMessage);

          // Run the API call
          const result = await runTestMessage(followUpText, selectedBot, profile, chatHistory);

          // Add bot response to history
          const botMessage: Message = {
            id: `test-bot-dynamic-${currentTurn}`,
            role: 'bot',
            text: result.response,
            timestamp: new Date().toISOString(),
          };
          chatHistory.push(botMessage);

          responses.push({
            userMessage: followUpText,
            botResponse: result.response,
            responseTime: result.responseTime,
            isDynamic: true, // Mark as dynamically generated
            llmMetadata: result.llmMetadata || null,
          });

          if (result.telemetry) {
            lastTelemetry = result.telemetry;
            accumulateTelemetry(result.telemetry);
          }

          currentTurn++;
        }
      }

      // ============================================
      // SPECIAL TEST MODE: REFINEMENT MOCK
      // ============================================
      // Check for special test mode: refinement_mock
      // This mode skips normal conversation and directly tests the ProfileRefinementModal
      // with hardcoded mock session data
      if (selectedScenario.specialTestMode === 'refinement_mock') {
        setPhase('analyzing');
        
        try {
          // Detect profile type from user's profile or selected test profile
          let profileType: 'RIEMANN' | 'BIG5' | 'SD' = 'RIEMANN';
          let decryptedProfileData: any = null;
          
          if (useMyProfile && decryptedProfile) {
            // Use actual user profile - detect type from available data
            if (decryptedProfile.spiralDynamics) {
              profileType = 'SD';
            } else if (decryptedProfile.big5) {
              profileType = 'BIG5';
            } else {
              profileType = 'RIEMANN';
            }
            decryptedProfileData = decryptedProfile;
          } else {
            // Use selected test profile
            if (selectedRiemann) {
              profileType = 'RIEMANN';
            } else {
              profileType = 'BIG5';
            }
            decryptedProfileData = profile;
          }
          
          // Select appropriate mock sessions based on profile type
          const mockSessions = profileType === 'RIEMANN' 
            ? MOCK_RIEMANN_SESSIONS 
            : profileType === 'SD'
              ? MOCK_SD_SESSIONS
              : MOCK_BIG5_SESSIONS;
          
          // Call backend API with mock session data
          const refinementResult = await testRefinementWithMockSessions({
            profileType,
            decryptedProfile: decryptedProfileData,
            mockSessions
          });
          
          // Store preview in state for modal display
          setRefinementPreview(refinementResult);
          setShowRefinementModal(true);
          
          // Build minimal test result for manual checks only
          setTestResult({
            scenarioId: selectedScenario.id,
            botId: selectedBot?.id || 'mock',
            profileId: 'mock_profile',
            timestamp: new Date().toISOString(),
            responses: [{
              userMessage: '🧪 Mock Test: 2 simulated sessions with hardcoded keywords',
              botResponse: 'Refinement preview is being calculated with mock data...',
              responseTime: 0
            }],
            telemetry: {
              dpcInjectionPresent: false,
              dpcInjectionLength: 0,
              dpcStrategiesUsed: [],
              dpflKeywordsDetected: [],
              stressKeywordsDetected: false,
            },
            autoCheckResults: [], // No auto-checks for this special test
            dpflKeywordsInfo: '🧪 Mock keywords were used (see modal for details)',
            manualCheckResults: selectedScenario.manualChecks.map((check, idx) => ({
              checkId: `manual_${idx}`,
              passed: null,
            })),
          });
          
          // Set phase to validation (manual checks only)
          setPhase('validation');
          setIsRunning(false);
          return; // Skip normal test flow
          
        } catch (error) {
          console.error('[TestRunner] Refinement mock test failed:', error);
          setError(`Refinement mock test failed: ${error instanceof Error ? error.message : String(error)}`);
          setIsRunning(false);
          setPhase('setup');
          return;
        }
      }

      // Build auto-check results
      const autoCheckResults: TestRunResult['autoCheckResults'] = [];
      
      // Check DPC injection
      if (selectedScenario.autoChecks.dpcRequired) {
        const dpcPresent = lastTelemetry?.dpcInjectionPresent ?? false;
        autoCheckResults.push({
          checkId: 'dpc_present',
          passed: dpcPresent,
          details: dpcPresent ? `DPC: ${lastTelemetry?.dpcInjectionLength || 0} chars` : 'No DPC injection found',
        });

        if (selectedScenario.autoChecks.minDpcLength) {
          const lengthOk = (lastTelemetry?.dpcInjectionLength || 0) >= selectedScenario.autoChecks.minDpcLength;
          autoCheckResults.push({
            checkId: 'dpc_length',
            passed: lengthOk,
            details: `Length: ${lastTelemetry?.dpcInjectionLength || 0} / ${selectedScenario.autoChecks.minDpcLength} required`,
          });
        }
      }

      // Store DPFL keywords for info display (not as pass/fail check)
      // Use cumulative keywords from ALL messages, ALL frameworks
      const detectedKeywords = lastTelemetry?.dpflKeywordsDetected || [];
      
      // Parse cumulative keywords grouped by framework and dimension
      const parseFrameworkKeywords = (entries: string[]) => {
        const grouped: Record<string, { high: string[], low: string[] }> = {};
        const seen = new Set<string>(); // deduplicate
        entries.forEach((entry: string) => {
          const parts = entry.split(':');
          // Format: "framework:dimension:level:keyword"
          if (parts.length === 4) {
            const [, dimension, level, keyword] = parts;
            const key = `${dimension}:${level}:${keyword}`;
            if (seen.has(key)) return;
            seen.add(key);
            if (!grouped[dimension]) grouped[dimension] = { high: [], low: [] };
            if (level === 'high') grouped[dimension].high.push(keyword);
            else if (level === 'low') grouped[dimension].low.push(keyword);
          }
        });
        return grouped;
      };
      
      const cumulativeRiemann = parseFrameworkKeywords(cumulativeKeywords.riemann);
      const cumulativeBig5 = parseFrameworkKeywords(cumulativeKeywords.big5);
      const cumulativeSD = parseFrameworkKeywords(cumulativeKeywords.spiralDynamics);
      
      // Format cumulative keywords for the simple text display
      const formatGrouped = (grouped: Record<string, { high: string[], low: string[] }>) => {
        const lines: string[] = [];
        for (const [dimension, levels] of Object.entries(grouped)) {
          const dimName = dimension.charAt(0).toUpperCase() + dimension.slice(1);
          if (levels.high.length > 0) lines.push(`${dimName} (hoch): ${levels.high.join(', ')}`);
          if (levels.low.length > 0) lines.push(`${dimName} (niedrig): ${levels.low.join(', ')}`);
        }
        return lines.join(' · ');
      };
      
      let dpflKeywordsInfo = '';
      const riemannInfo = formatGrouped(cumulativeRiemann);
      const big5Info = formatGrouped(cumulativeBig5);
      const sdInfo = formatGrouped(cumulativeSD);
      if (riemannInfo || big5Info || sdInfo) {
        const parts: string[] = [];
        if (riemannInfo) parts.push(`[Riemann] ${riemannInfo}`);
        if (big5Info) parts.push(`[Big5] ${big5Info}`);
        if (sdInfo) parts.push(`[SD] ${sdInfo}`);
        dpflKeywordsInfo = parts.join('\n');
      }

      // Check expected keywords (only if explicitly testing for specific keywords)
      // Search across ALL cumulative keywords from ALL frameworks
      if (selectedScenario.autoChecks.expectedKeywords?.length) {
        const allCumulativeEntries = [
          ...cumulativeKeywords.riemann,
          ...cumulativeKeywords.big5,
          ...cumulativeKeywords.spiralDynamics
        ];
        const expectedFound = selectedScenario.autoChecks.expectedKeywords.filter(
          k => allCumulativeEntries.some((d: string) => d.toLowerCase().includes(k.toLowerCase()))
        );
        
        autoCheckResults.push({
          checkId: 'expected_keywords',
          passed: expectedFound.length > 0,
          details: expectedFound.length > 0 
            ? `Erwartete Keywords gefunden: ${expectedFound.join(', ')}`
            : `Erwartete Keywords nicht gefunden: ${selectedScenario.autoChecks.expectedKeywords.join(', ')}`,
        });
      }

      // Check stress keywords detection
      if (selectedScenario.autoChecks.expectStressKeywords) {
        const stressDetected = lastTelemetry?.stressKeywordsDetected ?? false;
        autoCheckResults.push({
          checkId: 'stress_keywords',
          passed: stressDetected,
          details: stressDetected ? 'Stress keywords detected in telemetry' : 'No stress keywords detected',
        });
      }

      // Initialize manual check results
      const initialManualResults: Record<string, boolean | null> = {};
      selectedScenario.manualChecks.forEach((check, idx) => {
        initialManualResults[`manual_${idx}`] = null;
      });
      setManualCheckResults(initialManualResults);

      // Build profile ID from selections
      const profileId = useMyProfile 
        ? 'user_profile'
        : [selectedRiemann?.id, selectedSD?.id, selectedOCEAN?.id].filter(Boolean).join('+');

      const result: TestRunResult = {
        scenarioId: selectedScenario.id,
        botId: selectedBot.id,
        profileId: profileId || 'no_profile',
        timestamp: new Date().toISOString(),
        responses,
        telemetry: {
          ...lastTelemetry,
          // Cumulative all-framework keywords for detailed display
          cumulativeKeywords: {
            riemann: cumulativeRiemann,
            big5: cumulativeBig5,
            spiralDynamics: cumulativeSD,
            totalCount: cumulativeKeywords.riemann.length + cumulativeKeywords.big5.length + cumulativeKeywords.spiralDynamics.length
          }
        },
        autoCheckResults,
        dpflKeywordsInfo, // Add DPFL keywords as info (not check)
        manualCheckResults: selectedScenario.manualChecks.map((check, idx) => ({
          checkId: `manual_${idx}`,
          passed: null,
        })),
      };

      setTestResult(result);
      
      // For session category tests, run session analysis before validation
      if (selectedScenario.category === 'session') {
        setPhase('analyzing');
        setIsAnalyzing(true);
        try {
          const analysis = await analyzeSession(chatHistory, '', language);
          // #region agent log
          fetch(`${getApiBaseUrl()}/api/debug/log`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TestRunner.tsx:session-analysis',message:'Session analysis result',data:{hasConversationalEnd:analysis?.hasConversationalEnd,hasAccomplishedGoal:analysis?.hasAccomplishedGoal,updatesCount:analysis?.proposedUpdates?.length,nextStepsCount:analysis?.nextSteps?.length,newFindings:analysis?.newFindings?.substring(0,100)},timestamp:Date.now(),sessionId:'test-debug'})}).catch(()=>{});
          // #endregion
          setSessionAnalysisResult(analysis);
          
          // Add session analysis auto-checks
          const sessionAutoChecks: TestRunResult['autoCheckResults'] = [];
          
          if (selectedScenario.autoChecks.expectSessionUpdates) {
            const hasUpdates = (analysis?.proposedUpdates?.length ?? 0) > 0;
            const count = analysis?.proposedUpdates?.length ?? 0;
            sessionAutoChecks.push({
              checkId: 'session_updates',
              passed: hasUpdates,
              details: hasUpdates 
                ? t('test_runner_autocheck_updates_found', { count })
                : t('test_runner_autocheck_no_updates'),
            });
          }
          
          if (selectedScenario.autoChecks.expectSessionNextSteps) {
            const hasNextSteps = (analysis?.nextSteps?.length ?? 0) > 0;
            const count = analysis?.nextSteps?.length ?? 0;
            sessionAutoChecks.push({
              checkId: 'session_nextsteps',
              passed: hasNextSteps,
              details: hasNextSteps 
                ? t('test_runner_autocheck_nextsteps_found', { count })
                : t('test_runner_autocheck_no_nextsteps'),
            });
          }
          
          // Update result with session auto-checks
          if (sessionAutoChecks.length > 0) {
            setTestResult(prev => prev ? {
              ...prev,
              autoCheckResults: [...prev.autoCheckResults, ...sessionAutoChecks]
            } : null);
          }
          
        } catch (analysisErr) {
          console.error('Session analysis failed:', analysisErr);
          // Add failed checks for expected session analysis
          const failedChecks: TestRunResult['autoCheckResults'] = [];
          const failedMsg = t('test_runner_autocheck_analysis_failed');
          
          if (selectedScenario.autoChecks.expectSessionUpdates) {
            failedChecks.push({
              checkId: 'session_updates',
              passed: false,
              details: failedMsg,
            });
          }
          
          if (selectedScenario.autoChecks.expectSessionNextSteps) {
            failedChecks.push({
              checkId: 'session_nextsteps',
              passed: false,
              details: failedMsg,
            });
          }
          
          if (failedChecks.length > 0) {
            setTestResult(prev => prev ? {
              ...prev,
              autoCheckResults: [...prev.autoCheckResults, ...failedChecks]
            } : null);
          }
          
          setSessionAnalysisResult(null);
        } finally {
          setIsAnalyzing(false);
        }
      }
      
      setPhase('validation');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
      setPhase('setup');
    } finally {
      setIsRunning(false);
    }
  }, [selectedBot, hasProfileSelection, selectedScenario, getTestProfile, runTestMessage, generateFollowUpMessage, useMyProfile, selectedRiemann, selectedSD, selectedOCEAN, t, language]);

  // Update manual check
  const handleManualCheck = (checkId: string, passed: boolean) => {
    setManualCheckResults(prev => ({ ...prev, [checkId]: passed }));
  };

  // Complete the test
  const completeTest = () => {
    if (!testResult) return;
    
    // Update result with manual checks
    const finalResult: TestRunResult = {
      ...testResult,
      manualCheckResults: Object.entries(manualCheckResults).map(([checkId, passed]) => ({
        checkId,
        passed,
        notes: manualNotes[checkId],
      })),
    };

    // Could save to backend here for test history
    console.log('Test completed:', finalResult);
    setPhase('complete');
  };

  // Render setup phase
  const renderSetup = () => (
    <div className="space-y-6">
      {/* Bot Selection */}
      <div>
        <h4 className="font-semibold mb-2 text-content-primary">1. {t('test_runner_step_bot')}</h4>
        {selectedScenario?.id === 'bot_interview' ? (
          // Interview scenario: Show only interview bot (auto-selected)
          <div className="p-3 rounded-lg border border-accent-primary bg-accent-primary/10">
            <div className="font-medium text-content-primary">🎤 {t('test_runner_interview_bot_name')}</div>
            <div className="text-xs text-content-secondary">{t('test_runner_interview_auto_selected')}</div>
          </div>
        ) : (
          // Normal scenarios: Show all testable bots
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {bots.map(bot => (
              <button
                key={bot.id}
                onClick={() => setSelectedBot(bot)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  selectedBot?.id === bot.id
                    ? 'border-accent-primary bg-accent-primary/10'
                    : 'border-border-secondary hover:border-accent-primary/50'
                }`}
              >
                <div className="font-medium text-content-primary">{bot.name}</div>
                <div className="text-xs text-content-secondary truncate">
                  {bot.style}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Profile Selection - Multi-Select */}
      <div>
        <h4 className="font-semibold mb-2 text-content-primary">2. {t('test_runner_step_profile')}</h4>
        
        {/* My Profile Option */}
        <div className="mb-4 p-3 border rounded-lg border-border-secondary">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useMyProfile}
              onChange={(e) => {
                setUseMyProfile(e.target.checked);
                if (e.target.checked) {
                  // Clear manual selections when using my profile
                  setSelectedRiemann(null);
                  setSelectedSD(null);
                  setSelectedOCEAN(null);
                }
              }}
              disabled={!userProfile}
              className="mt-1 w-4 h-4 accent-accent-primary"
            />
            <div className={`flex-1 ${!userProfile ? 'opacity-50' : ''}`}>
              <div className="font-medium text-content-primary">👤 {t('test_runner_use_my_profile')}</div>
              <div className="text-xs text-content-secondary">
                {userProfile ? (
                  <>
                    {t('test_runner_uses_all_lenses')}
                    {userProfileLenses.length > 0 && (
                      <span className="ml-1 text-accent-primary">
                        ({userProfileLenses.map(l => l === 'riemann' ? 'Riemann' : l === 'sd' ? 'SD' : 'OCEAN').join(', ')})
                      </span>
                    )}
                  </>
                ) : (
                  t('test_runner_no_profile_available')
                )}
              </div>
            </div>
          </label>
        </div>
        
        {/* Manual Profile Selection - disabled when using my profile */}
        <div className={`space-y-3 ${useMyProfile ? 'opacity-40 pointer-events-none' : ''}`}>
          {/* Riemann Selection */}
          <div className="p-3 border rounded-lg border-border-secondary">
            <div className="text-sm font-medium text-content-primary mb-2">{t('test_runner_riemann_optional')}</div>
            <div className="flex gap-2 flex-wrap">
              {RIEMANN_PROFILES.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => setSelectedRiemann(selectedRiemann?.id === profile.id ? null : profile)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedRiemann?.id === profile.id
                      ? 'bg-accent-primary text-white'
                      : 'bg-background-tertiary text-content-secondary hover:bg-background-secondary'
                  }`}
                >
                  {profile.name}
                </button>
              ))}
            </div>
          </div>

          {/* Spiral Dynamics Selection */}
          <div className="p-3 border rounded-lg border-border-secondary">
            <div className="text-sm font-medium text-content-primary mb-2">{t('test_runner_sd_optional')}</div>
            <div className="flex gap-2 flex-wrap">
              {SD_PROFILES.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => setSelectedSD(selectedSD?.id === profile.id ? null : profile)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedSD?.id === profile.id
                      ? 'bg-accent-primary text-white'
                      : 'bg-background-tertiary text-content-secondary hover:bg-background-secondary'
                  }`}
                >
                  {profile.name}
                </button>
              ))}
            </div>
          </div>

          {/* OCEAN Selection */}
          <div className="p-3 border rounded-lg border-border-secondary">
            <div className="text-sm font-medium text-content-primary mb-2">{t('test_runner_ocean_optional')}</div>
            <div className="flex gap-2 flex-wrap">
              {OCEAN_PROFILES.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => setSelectedOCEAN(selectedOCEAN?.id === profile.id ? null : profile)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedOCEAN?.id === profile.id
                      ? 'bg-accent-primary text-white'
                      : 'bg-background-tertiary text-content-secondary hover:bg-background-secondary'
                  }`}
                >
                  {profile.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selection Summary */}
        {hasProfileSelection && (
          <div className="mt-3 p-2 bg-accent-primary/10 rounded-lg text-sm text-content-primary">
            <strong>{t('test_runner_active')}:</strong> {getProfileDisplayName()}
          </div>
        )}
        
        {!hasProfileSelection && (
          <div className="mt-3 p-2 bg-yellow-500/10 rounded-lg text-sm text-yellow-600 dark:text-yellow-400">
            ⚠️ {t('test_runner_profile_required')}
          </div>
        )}
      </div>

      {/* Scenario Selection */}
      <div>
        <h4 className="font-semibold mb-2 text-content-primary">3. {t('test_runner_step_scenario')}</h4>
        
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              categoryFilter === 'all'
                ? 'bg-accent-primary text-white'
                : 'bg-background-tertiary text-content-secondary hover:bg-background-secondary'
            }`}
          >
            {t('test_runner_filter_all')}
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                categoryFilter === cat
                  ? 'bg-accent-primary text-white'
                  : 'bg-background-tertiary text-content-secondary hover:bg-background-secondary'
              }`}
            >
              {getCategoryIcon(cat)} {getCategoryName(cat, t)}
            </button>
          ))}
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filteredScenarios.map(scenario => (
            <button
              key={scenario.id}
              onClick={() => handleScenarioSelect(scenario)}
              className={`w-full p-3 rounded-lg border text-left transition-colors ${
                selectedScenario?.id === scenario.id
                  ? 'border-accent-primary bg-accent-primary/10'
                  : 'border-border-secondary hover:border-accent-primary/50'
              }`}
            >
              <div className="font-medium text-content-primary">{scenario.name}</div>
              <div className="text-xs text-content-secondary">{scenario.description}</div>
              <div className="flex gap-1 mt-1">
                {scenario.testsFeatures.map(f => (
                  <span key={f} className="px-1.5 py-0.5 bg-background-tertiary rounded text-xs">
                    {f.toUpperCase()}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Run Button */}
      <button
        onClick={runTest}
        disabled={!selectedBot || !hasProfileSelection || !selectedScenario}
        className="w-full py-3 px-6 bg-accent-primary text-white rounded-lg font-semibold
                   disabled:opacity-50 disabled:cursor-not-allowed
                   hover:bg-accent-primary/90 transition-colors"
      >
        🚀 {t('test_runner_start')}
      </button>
    </div>
  );

  // Render running phase
  const renderRunning = () => {
    const minTurns = selectedScenario?.minConversationTurns ?? selectedScenario?.testMessages.length ?? 0;
    const predefinedCount = selectedScenario?.testMessages.length ?? 0;
    const isDynamicPhase = currentMessageIndex >= predefinedCount;
    const currentMessage = isDynamicPhase 
      ? '🤖 Generating follow-up...'
      : `"${selectedScenario?.testMessages[currentMessageIndex]?.text}"`;

    return (
      <div className="text-center py-12">
        <Spinner />
        <h3 className="text-xl font-semibold mt-4 text-content-primary">{t('test_runner_running')}</h3>
        <p className="text-content-secondary mt-2">
          {t('test_runner_message_progress', { current: currentMessageIndex + 1, total: minTurns })}
        </p>
        {isDynamicPhase && (
          <p className="text-accent-primary text-sm mt-1">
            🔄 Dynamic continuation
          </p>
        )}
        <div className="mt-4 p-4 bg-background-tertiary rounded-lg text-left max-w-md mx-auto">
          <div className="text-sm text-content-secondary mb-1">{t('test_runner_current_message')}:</div>
          <div className="text-content-primary">
            {currentMessage}
          </div>
        </div>
      </div>
    );
  };

  // Render analyzing phase (for session category tests)
  const renderAnalyzing = () => (
    <div className="text-center py-12">
      <Spinner />
      <h3 className="text-xl font-semibold mt-4 text-content-primary">{t('test_runner_analyzing')}</h3>
      <p className="text-content-secondary mt-2">
        {t('test_runner_analyzing_desc')}
      </p>
    </div>
  );

  // Render validation phase
  const renderValidation = () => {
    if (!testResult || !selectedScenario) return null;

    const allManualChecked = Object.values(manualCheckResults).every(v => v !== null);
    const autoPassCount = testResult.autoCheckResults.filter(r => r.passed).length;
    const autoTotalCount = testResult.autoCheckResults.length;
    const manualPassCount = Object.values(manualCheckResults).filter(v => v === true).length;
    const manualTotalCount = selectedScenario.manualChecks.length;

    return (
      <div className="space-y-6">
        {/* Mock Data Notice for Refinement Mock Test */}
        {selectedScenario.specialTestMode === 'refinement_mock' && (
          <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-xl">ℹ️</span>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                <strong>{t('test_mock_data_notice_title')}</strong>
                <p className="mt-1">{t('test_mock_data_notice_desc')}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* ProfileRefinementModal for Refinement Mock Test */}
        {showRefinementModal && refinementPreview && (
          <ProfileRefinementModal
            isOpen={showRefinementModal}
            refinementPreview={refinementPreview}
            isLoading={false}
            error={null}
            isTestMode={true}
            onAccept={() => {
              setShowRefinementModal(false);
              // In test mode: just close, no API call
            }}
            onReject={() => {
              setShowRefinementModal(false);
            }}
          />
        )}
        
        {/* Test Guide (Collapsible) */}
        <div className="p-3 bg-accent-primary/5 border border-accent-primary/20 rounded-lg">
          <details className="group">
            <summary className="cursor-pointer font-semibold text-content-primary flex items-center gap-2 hover:text-accent-primary transition-colors">
              <span className="group-open:rotate-90 transition-transform">▶</span>
              📖 Test-Anleitung: {selectedScenario.name}
            </summary>
            <div className="mt-3 pt-3 border-t border-border-secondary space-y-3 text-sm">
              {/* Test Description */}
              <div>
                <div className="font-medium text-content-primary mb-1">Beschreibung:</div>
                <div className="text-content-secondary">{selectedScenario.description}</div>
              </div>
              
              {/* Test Structure */}
              <div>
                <div className="font-medium text-content-primary mb-1">Test-Aufbau:</div>
                <ul className="text-content-secondary space-y-1 pl-4">
                  <li>• <span className="font-medium">{testResult.responses.filter(r => !r.isDynamic).length} vordefinierte Nachricht(en)</span> {selectedScenario.testMessages.length > 0 && '(mit erwarteten Verhaltensweisen)'}</li>
                  {selectedScenario.enableDynamicContinuation && (
                    <li>• <span className="font-medium">{testResult.responses.filter(r => r.isDynamic).length} dynamisch generierte Nachricht(en)</span> (KI-gesteuert)</li>
                  )}
                  <li>• <span className="font-medium">Mindestens {selectedScenario.minConversationTurns || selectedScenario.testMessages.length} Austausche</span> (User-Bot-Paare)</li>
                  <li>• Profil: <span className="font-medium">{testResult.profileId}</span></li>
                </ul>
              </div>
              
              {/* What is tested automatically */}
              <div>
                <div className="font-medium text-content-primary mb-1">Automatische Prüfungen:</div>
                <ul className="text-content-secondary space-y-1 pl-4">
                  {selectedScenario.autoChecks.dpcRequired && (
                    <li>• <span className="font-medium">DPC Injection:</span> Dynamic Personality Coaching muss aktiviert sein (min. {selectedScenario.autoChecks.minDpcLength || 200} chars)</li>
                  )}
                  {selectedScenario.autoChecks.expectedKeywords && selectedScenario.autoChecks.expectedKeywords.length > 0 && (
                    <li>• <span className="font-medium">Erwartete Keywords:</span> System soll spezifische Keywords erkennen: {selectedScenario.autoChecks.expectedKeywords.join(', ')}</li>
                  )}
                  {selectedScenario.autoChecks.expectStressKeywords && (
                    <li>• <span className="font-medium">Stress-Schlüsselwörter:</span> System soll Stress-Indikatoren im User-Text erkennen</li>
                  )}
                  {selectedScenario.autoChecks.expectSessionUpdates && (
                    <li>• <span className="font-medium">Session Updates:</span> Bot soll Kontext-Updates vorschlagen</li>
                  )}
                  {selectedScenario.autoChecks.expectSessionNextSteps && (
                    <li>• <span className="font-medium">Next Steps:</span> Bot soll konkrete nächste Schritte definieren</li>
                  )}
                </ul>
              </div>
              
              {/* What needs manual checking */}
              {selectedScenario.manualChecks.length > 0 && (
                <div>
                  <div className="font-medium text-content-primary mb-1">Manuelle Prüfungen (durch Sie als Tester):</div>
                  <ul className="text-content-secondary space-y-1 pl-4">
                    {selectedScenario.manualChecks.map((check, idx) => (
                      <li key={idx}>• {check}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Telemetry explanation */}
              <div>
                <div className="font-medium text-content-primary mb-1">{t('test_runner_telemetry_data')}:</div>
                <ul className="text-content-secondary space-y-1 pl-4 text-xs">
                  <li>• <span className="font-medium">{t('test_runner_dpc_injection')}:</span> {t('test_runner_telemetry_desc_dpc_injection')}</li>
                  <li>• <span className="font-medium">{t('test_runner_dpc_strategies')}:</span> {t('test_runner_telemetry_desc_dpc_strategies')}</li>
                  <li>• <span className="font-medium">{t('test_runner_dpfl_keywords')} ({t('test_runner_cumulative')}):</span> {t('test_runner_telemetry_desc_dpfl')}</li>
                  <li>• <span className="font-medium">{t('test_runner_stress_keywords')}:</span> {t('test_runner_telemetry_desc_stress')}</li>
                  <li>• <span className="font-medium">{t('test_runner_strategy_merge')}:</span> {t('test_runner_telemetry_desc_merge')}</li>
                  <li>• <span className="font-medium">{t('test_runner_adaptive_weighting')}:</span> {t('test_runner_telemetry_desc_adaptive')}</li>
                </ul>
              </div>
              
              {/* Tested Features */}
              <div>
                <div className="font-medium text-content-primary mb-1">Getestete Features:</div>
                <div className="flex flex-wrap gap-1">
                  {selectedScenario.testsFeatures.map((feature, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-accent-primary/20 text-accent-primary rounded-full text-xs font-medium">
                      {feature.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </div>
        
        {/* Responses */}
        <div>
          <h4 className="font-semibold mb-2 text-content-primary">
            📝 {t('test_runner_responses')} ({testResult.responses.length} exchanges)
          </h4>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {testResult.responses.map((r, idx) => (
              <div key={idx} className={`p-3 rounded-lg border ${r.isDynamic ? 'border-accent-primary/40' : 'border-border-secondary'} bg-background-tertiary`}>
                <div className="flex items-center gap-2 text-sm text-content-secondary mb-1">
                  <span>{t('test_runner_user')}:</span>
                  {r.isDynamic && (
                    <span className="px-1.5 py-0.5 bg-accent-primary/20 text-accent-primary rounded text-xs">
                      🤖 Dynamic
                    </span>
                  )}
                </div>
                <div className="text-content-primary mb-2 text-sm">{r.userMessage}</div>
                <div className="text-sm text-content-secondary mb-1">
                  Bot <span className="text-xs opacity-70">({r.responseTime}ms)</span>:
                </div>
                <div className="text-content-primary text-sm whitespace-pre-wrap">{r.botResponse}</div>
                {!r.isDynamic && selectedScenario.testMessages[idx]?.expectedBehavior && (
                  <div className="mt-2 p-2 bg-yellow-500/10 rounded text-xs">
                    <span className="font-semibold">{t('test_runner_expected')}:</span> {selectedScenario.testMessages[idx].expectedBehavior}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Telemetry */}
        {testResult.telemetry && (
          <div>
            <h4 className="font-semibold mb-2 text-content-primary">📊 {t('test_runner_telemetry')}</h4>
            <div className="space-y-2 overflow-hidden">
              
              {/* DPC Injection */}
              <div className="p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-content-primary">{t('test_runner_dpc_injection')}:</span>
                  <span className="text-content-secondary">
                    {testResult.telemetry.dpcInjectionPresent 
                      ? `✓ ${testResult.telemetry.dpcInjectionLength} chars` 
                      : `✗ ${t('test_runner_dpc_not_present')}`}
                  </span>
                </div>
              </div>

              {/* DPC Strategien */}
              {testResult.telemetry.dpcStrategiesUsed && testResult.telemetry.dpcStrategiesUsed.length > 0 && (
                <div className="p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <div className="text-sm">
                    <span className="font-medium text-content-primary">{t('test_runner_dpc_strategies')}:</span>
                    <div className="mt-1 text-content-secondary break-words">{testResult.telemetry.dpcStrategiesUsed.join(', ')}</div>
                  </div>
                </div>
              )}

              {/* Strategy Merge Details (Accordion) */}
              {testResult.telemetry.dpcMergeMetadata && (
                <div className="p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-content-primary flex items-center gap-2 hover:text-accent-primary transition-colors">
                      <span className="group-open:rotate-90 transition-transform text-xs">▶</span>
                      {t('test_runner_strategy_merge')}
                    </summary>
                    <div className="mt-3 pt-2 border-t border-border-secondary space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-content-secondary">{t('test_runner_merge_type')}:</span>
                        <span className="font-semibold text-content-primary">
                          {testResult.telemetry.dpcMergeMetadata.mergeType === 'simple_weighted' && t('test_runner_merge_weighted')}
                          {testResult.telemetry.dpcMergeMetadata.mergeType === 'conflict_aware' && t('test_runner_merge_conflict')}
                          {testResult.telemetry.dpcMergeMetadata.mergeType === 'empty' && t('test_runner_merge_empty')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-content-secondary">{t('test_runner_models_used')}:</span>
                        <span className="text-content-primary">{testResult.telemetry.dpcMergeMetadata.models?.join(', ') || 'N/A'}</span>
                      </div>
                      {testResult.telemetry.dpcMergeMetadata.conflicts > 0 && (
                        <div className="flex justify-between">
                          <span className="text-content-secondary">{t('test_runner_conflicts_resolved')}:</span>
                          <span className="text-orange-500 font-semibold">{testResult.telemetry.dpcMergeMetadata.conflicts}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-content-secondary">{t('test_runner_narrative_consistent')}:</span>
                        <span className={testResult.telemetry.dpcMergeMetadata.narrativeConsistent ? 'text-green-500' : 'text-yellow-500'}>
                          {testResult.telemetry.dpcMergeMetadata.narrativeConsistent ? '✓' : '⚠️'}
                        </span>
                      </div>
                      {/* Top Dimensions Visualization */}
                      {testResult.telemetry.dpcMergeMetadata.topDimensions && testResult.telemetry.dpcMergeMetadata.topDimensions.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border-secondary">
                          <div className="text-content-secondary mb-2">{t('test_runner_top_dimensions')}:</div>
                          <div className="space-y-1.5">
                            {testResult.telemetry.dpcMergeMetadata.topDimensions.slice(0, 5).map((dim: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 min-w-0">
                                <div className={`h-1.5 rounded shrink-0 ${dim.included ? 'bg-accent-primary' : 'bg-gray-400'}`} style={{width: `${Math.min(dim.weight * 60 + 20, 80)}px`}}></div>
                                <span className={`text-xs truncate ${dim.included ? 'text-content-primary' : 'text-content-tertiary line-through'}`}>
                                  {dim.model}:{dim.trait} ({(dim.weight * 100).toFixed(0)}%)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}
              
              {/* DPFL Keywords - All Frameworks, Cumulative */}
              <div className="p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg overflow-hidden">
                <details className="group" open>
                  <summary className="cursor-pointer text-sm font-medium text-content-primary flex flex-wrap items-center gap-1.5 hover:text-accent-primary transition-colors">
                    <span className="group-open:rotate-90 transition-transform text-xs">▶</span>
                    <span>{t('test_runner_dpfl_keywords')} ({t('test_runner_cumulative')})</span>
                    {testResult.telemetry.cumulativeKeywords && testResult.telemetry.cumulativeKeywords.totalCount > 0 && (
                      <span className="text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        {testResult.telemetry.cumulativeKeywords.totalCount} {t('test_runner_total')}
                      </span>
                    )}
                  </summary>
                  <div className="mt-2 pt-2 border-t border-border-secondary space-y-2 text-xs overflow-hidden">
                    {/* Riemann */}
                    {testResult.telemetry.cumulativeKeywords?.riemann && Object.keys(testResult.telemetry.cumulativeKeywords.riemann).length > 0 && (
                      <div>
                        <div className="font-medium text-content-primary mb-1">{t('test_runner_fw_riemann')}</div>
                        <div className="space-y-0.5 pl-2">
                          {Object.entries(testResult.telemetry.cumulativeKeywords.riemann).map(([dim, levels]: [string, any]) => (
                            <div key={dim} className="flex flex-wrap gap-1 items-baseline">
                              <span className="text-content-secondary shrink-0">{dim.charAt(0).toUpperCase() + dim.slice(1)}:</span>
                              {levels.high?.map((k: string) => (
                                <span key={`h-${k}`} className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 break-all">{k} ↑</span>
                              ))}
                              {levels.low?.map((k: string) => (
                                <span key={`l-${k}`} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 break-all">{k} ↓</span>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Big5 */}
                    {testResult.telemetry.cumulativeKeywords?.big5 && Object.keys(testResult.telemetry.cumulativeKeywords.big5).length > 0 && (
                      <div>
                        <div className="font-medium text-content-primary mb-1">{t('test_runner_fw_big5')}</div>
                        <div className="space-y-0.5 pl-2">
                          {Object.entries(testResult.telemetry.cumulativeKeywords.big5).map(([dim, levels]: [string, any]) => (
                            <div key={dim} className="flex flex-wrap gap-1 items-baseline">
                              <span className="text-content-secondary shrink-0">{dim.charAt(0).toUpperCase() + dim.slice(1)}:</span>
                              {levels.high?.map((k: string) => (
                                <span key={`h-${k}`} className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 break-all">{k} ↑</span>
                              ))}
                              {levels.low?.map((k: string) => (
                                <span key={`l-${k}`} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 break-all">{k} ↓</span>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Spiral Dynamics */}
                    {testResult.telemetry.cumulativeKeywords?.spiralDynamics && Object.keys(testResult.telemetry.cumulativeKeywords.spiralDynamics).length > 0 && (
                      <div>
                        <div className="font-medium text-content-primary mb-1">{t('test_runner_fw_sd')}</div>
                        <div className="space-y-0.5 pl-2">
                          {Object.entries(testResult.telemetry.cumulativeKeywords.spiralDynamics).map(([dim, levels]: [string, any]) => (
                            <div key={dim} className="flex flex-wrap gap-1 items-baseline">
                              <span className="text-content-secondary shrink-0">{dim.charAt(0).toUpperCase() + dim.slice(1)}:</span>
                              {levels.high?.map((k: string) => (
                                <span key={`h-${k}`} className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 break-all">{k} ↑</span>
                              ))}
                              {levels.low?.map((k: string) => (
                                <span key={`l-${k}`} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 break-all">{k} ↓</span>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Empty state */}
                    {(!testResult.telemetry.cumulativeKeywords || testResult.telemetry.cumulativeKeywords.totalCount === 0) && (
                      <div className="text-content-tertiary">{t('test_runner_none')}</div>
                    )}
                  </div>
                </details>
              </div>

              {/* DPFL Quality Summary */}
              {testResult.telemetry.cumulativeKeywords && testResult.telemetry.cumulativeKeywords.totalCount > 0 && (() => {
                const ck = testResult.telemetry.cumulativeKeywords;
                const MIN_SIGNAL = 3;
                const MIN_TOTAL = 15;
                
                // Build rankings per framework
                const buildRanking = (framework: Record<string, { high: string[], low: string[] }> | undefined) => {
                  if (!framework) return [];
                  return Object.entries(framework)
                    .map(([dim, levels]: [string, any]) => ({
                      dim,
                      count: (levels.high?.length || 0) + (levels.low?.length || 0),
                      highCount: levels.high?.length || 0,
                    }))
                    .filter(d => d.count > 0)
                    .sort((a, b) => b.count - a.count);
                };
                
                const riemannRank = buildRanking(ck.riemann);
                const big5Rank = buildRanking(ck.big5);
                const sdRank = buildRanking(ck.spiralDynamics);
                
                // Find weak signals (dimensions with < MIN_SIGNAL keywords)
                const allDims = [...riemannRank, ...big5Rank, ...sdRank];
                const weakSignals = allDims.filter(d => d.count < MIN_SIGNAL && d.count > 0);
                const totalOk = ck.totalCount >= MIN_TOTAL;
                
                const formatDim = (dim: string) => dim.charAt(0).toUpperCase() + dim.slice(1);
                
                return (
                  <div className="p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg overflow-hidden">
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium text-content-primary flex flex-wrap items-center gap-1.5 hover:text-accent-primary transition-colors">
                        <span className="group-open:rotate-90 transition-transform text-xs">▶</span>
                        <span>{t('test_runner_quality_summary')}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                          totalOk && weakSignals.length === 0
                            ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                            : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        }`}>
                          {totalOk && weakSignals.length === 0 ? '✓' : '⚠'} {ck.totalCount} {t('test_runner_keywords_detected')}
                        </span>
                      </summary>
                      <div className="mt-2 pt-2 border-t border-border-secondary space-y-2.5 text-xs overflow-hidden">
                        
                        {/* Total Coverage */}
                        <div className="flex items-center gap-2">
                          <span className={totalOk ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                            {totalOk ? '✓' : '⚠'}
                          </span>
                          <span className="text-content-secondary">
                            {t('test_runner_quality_coverage')}: <span className="font-medium text-content-primary">{ck.totalCount}</span> {t('test_runner_quality_min', { min: MIN_TOTAL })}
                          </span>
                        </div>
                        
                        {/* Framework Rankings */}
                        {riemannRank.length > 0 && (
                          <div>
                            <div className="text-content-secondary mb-0.5">{t('test_runner_fw_riemann')} — {t('test_runner_quality_ranking')}:</div>
                            <div className="flex flex-wrap gap-1 pl-2">
                              {riemannRank.map((d, i) => (
                                <span key={d.dim} className={`px-1.5 py-0.5 rounded border ${
                                  i === 0
                                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 font-medium'
                                    : d.count < MIN_SIGNAL
                                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                                      : 'bg-surface-secondary text-content-secondary border-border-secondary'
                                }`}>
                                  {i === 0 && '① '}{formatDim(d.dim)} ({d.count})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {big5Rank.length > 0 && (
                          <div>
                            <div className="text-content-secondary mb-0.5">{t('test_runner_fw_big5')} — {t('test_runner_quality_ranking')}:</div>
                            <div className="flex flex-wrap gap-1 pl-2">
                              {big5Rank.map((d, i) => (
                                <span key={d.dim} className={`px-1.5 py-0.5 rounded border ${
                                  i === 0
                                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 font-medium'
                                    : d.count < MIN_SIGNAL
                                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                                      : 'bg-surface-secondary text-content-secondary border-border-secondary'
                                }`}>
                                  {i === 0 && '① '}{formatDim(d.dim)} ({d.count})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {sdRank.length > 0 && (
                          <div>
                            <div className="text-content-secondary mb-0.5">{t('test_runner_fw_sd')} — {t('test_runner_quality_ranking')}:</div>
                            <div className="flex flex-wrap gap-1 pl-2">
                              {sdRank.map((d, i) => (
                                <span key={d.dim} className={`px-1.5 py-0.5 rounded border ${
                                  i === 0
                                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 font-medium'
                                    : d.count < MIN_SIGNAL
                                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                                      : 'bg-surface-secondary text-content-secondary border-border-secondary'
                                }`}>
                                  {i === 0 && '① '}{formatDim(d.dim)} ({d.count})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Weak Signals Warning */}
                        {weakSignals.length > 0 && (
                          <div className="flex items-start gap-2 p-1.5 bg-amber-500/10 rounded border border-amber-500/20">
                            <span className="text-amber-600 dark:text-amber-400 shrink-0">⚠</span>
                            <span className="text-content-secondary">
                              {t('test_runner_quality_weak')}: {weakSignals.map(d => `${formatDim(d.dim)} (${d.count})`).join(', ')}
                            </span>
                          </div>
                        )}
                        
                      </div>
                    </details>
                  </div>
                );
              })()}
              
              {/* Stress-Schlüsselwörter */}
              <div className="p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-content-primary">{t('test_runner_stress_keywords')}:</span>
                  <span className="text-content-secondary">
                    {testResult.telemetry.stressKeywordsDetected ? '✓ ' + t('test_runner_detected') : '✗ ' + t('test_runner_not_detected')}
                  </span>
                </div>
              </div>

              {/* Phase 2a: Adaptive Weighting Details */}
              {testResult.telemetry.adaptiveWeighting && (
                <div className="p-2.5 bg-purple-500/5 border border-purple-500/20 rounded-lg overflow-hidden">
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-content-primary flex flex-wrap items-center gap-1.5 hover:text-accent-primary transition-colors">
                      <span className="group-open:rotate-90 transition-transform text-xs">▶</span>
                      <span className="break-words">{t('test_runner_adaptive_weighting')}</span>
                      {(testResult.telemetry.adaptiveWeighting.adjustedKeywordCount ?? 0) > 0 && (
                        <span className="text-xs bg-purple-500/20 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          {testResult.telemetry.adaptiveWeighting.adjustedKeywordCount} {t('test_runner_adjustments')}
                        </span>
                      )}
                    </summary>
                    <div className="mt-3 pt-2 border-t border-border-secondary space-y-2 text-xs overflow-hidden">
                      {/* Context Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        <div className="flex flex-wrap gap-x-1">
                          <span className="text-content-secondary whitespace-nowrap">{t('test_runner_context_topic')}:</span>
                          <span className="font-medium text-content-primary break-words">
                            {testResult.telemetry.adaptiveWeighting.context?.topic
                              ? `${t('context_topic_' + testResult.telemetry.adaptiveWeighting.context.topic)} (${Math.round((testResult.telemetry.adaptiveWeighting.context.topicConfidence || 0) * 100)}%)`
                              : t('test_runner_none')}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-1">
                          <span className="text-content-secondary whitespace-nowrap">{t('test_runner_linguistic_pattern')}:</span>
                          <span className="font-medium text-content-primary break-words">
                            {testResult.telemetry.adaptiveWeighting.context?.linguisticPattern
                              ? `${t('context_pattern_' + testResult.telemetry.adaptiveWeighting.context.linguisticPattern)} (${Math.round((testResult.telemetry.adaptiveWeighting.context.patternConfidence || 0) * 100)}%)`
                              : t('test_runner_none')}
                          </span>
                        </div>
                      </div>
                      {/* Sentiment */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-content-secondary">{t('test_runner_sentiment')}:</span>
                        <span className={`font-medium ${
                          (testResult.telemetry.adaptiveWeighting.sentiment?.polarity || 0) > 0.2
                            ? 'text-green-600 dark:text-green-400'
                            : (testResult.telemetry.adaptiveWeighting.sentiment?.polarity || 0) < -0.2
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-content-secondary'
                        }`}>
                          {((testResult.telemetry.adaptiveWeighting.sentiment?.polarity || 0) > 0 ? '+' : '')}
                          {((testResult.telemetry.adaptiveWeighting.sentiment?.polarity || 0) * 100).toFixed(0)}%
                        </span>
                        {testResult.telemetry.adaptiveWeighting.sentiment?.emotionalContext && testResult.telemetry.adaptiveWeighting.sentiment.emotionalContext !== 'neutral' && (
                          <span className="text-content-tertiary break-words">
                            ({t('context_emotion_' + testResult.telemetry.adaptiveWeighting.sentiment.emotionalContext)})
                          </span>
                        )}
                      </div>
                      {/* Weighting Details */}
                      {testResult.telemetry.adaptiveWeighting.weightingDetails && testResult.telemetry.adaptiveWeighting.weightingDetails.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border-secondary">
                          <div className="text-content-secondary mb-1">{t('test_runner_weight_adjustments')}:</div>
                          <div className="space-y-1.5">
                            {testResult.telemetry.adaptiveWeighting.weightingDetails.map((detail: any, idx: number) => (
                              <div key={idx} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                                <span className="font-mono text-content-primary break-all">
                                  {detail.keyword}
                                </span>
                                <span className="text-content-tertiary">→</span>
                                <span className="text-content-secondary break-all">
                                  {detail.framework}:{detail.dimension}
                                </span>
                                <span className={`font-medium whitespace-nowrap ${detail.weight > 1 ? 'text-green-600 dark:text-green-400' : detail.weight < 0.5 ? 'text-red-600 dark:text-red-400' : 'text-content-secondary'}`}>
                                  ×{detail.weight.toFixed(2)}
                                </span>
                                {!detail.isPrimary && (
                                  <span className="text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-1 rounded whitespace-nowrap">
                                    {t('test_runner_secondary')}
                                  </span>
                                )}
                                {detail.sentimentAdjusted && (
                                  <span className="text-xs bg-purple-500/20 text-purple-600 dark:text-purple-400 px-1 rounded whitespace-nowrap">
                                    {t('test_runner_sentiment_adj')}
                                  </span>
                                )}
                                {detail.originalDirection !== detail.adjustedDirection && (
                                  <span className="text-xs bg-red-500/20 text-red-600 dark:text-red-400 px-1 rounded whitespace-nowrap">
                                    {detail.originalDirection} → {detail.adjustedDirection}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Session Analysis (for session category tests) */}
        {sessionAnalysisResult && selectedScenario.category === 'session' && (
          <div>
            <h4 className="font-semibold mb-2 text-content-primary">📋 {t('test_runner_session_analysis')}</h4>
            <div className="p-3 bg-background-tertiary rounded-lg text-sm space-y-3">
              {/* Proposed Updates */}
              {sessionAnalysisResult.proposedUpdates.length > 0 && (
                <div>
                  <div className="font-medium text-accent-primary mb-1">✏️ {t('test_runner_proposed_updates')}:</div>
                  <div className="space-y-2 pl-2">
                    {sessionAnalysisResult.proposedUpdates.map((update, idx) => (
                      <div key={idx} className="p-2 bg-background-secondary rounded border-l-2 border-accent-primary">
                        <div className="font-medium text-content-primary">{update.headline}</div>
                        <div className="text-content-secondary text-xs whitespace-pre-wrap mt-1">{update.content}</div>
                        <div className="text-xs text-accent-secondary mt-1">{t('test_runner_type')}: {update.type}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Next Steps */}
              {sessionAnalysisResult.nextSteps.length > 0 && (
                <div>
                  <div className="font-medium text-accent-primary mb-1">🎯 {t('test_runner_next_steps')}:</div>
                  <ul className="list-disc pl-6 space-y-1">
                    {sessionAnalysisResult.nextSteps.map((step, idx) => (
                      <li key={idx} className="text-content-secondary">
                        {step.action} {step.deadline && <span className="text-xs opacity-70">({step.deadline})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* New Findings */}
              {sessionAnalysisResult.newFindings && (
                <div>
                  <div className="font-medium text-accent-primary mb-1">💡 {t('test_runner_new_findings')}:</div>
                  <div className="text-content-secondary whitespace-pre-wrap">{sessionAnalysisResult.newFindings}</div>
                </div>
              )}
              
              {/* No analysis available */}
              {!sessionAnalysisResult.proposedUpdates.length && !sessionAnalysisResult.nextSteps.length && !sessionAnalysisResult.newFindings && (
                <div className="text-content-secondary italic">{t('test_runner_no_analysis')}</div>
              )}
            </div>
          </div>
        )}

        {/* Auto Checks */}
        {testResult.autoCheckResults.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 text-content-primary">
              🤖 {t('test_runner_auto_checks')} ({autoPassCount}/{autoTotalCount})
            </h4>
            <div className="space-y-2">
              {testResult.autoCheckResults.map((check, idx) => (
                <div 
                  key={idx}
                  className={`p-2 rounded-lg flex items-center gap-2 ${
                    check.passed ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}
                >
                  {check.passed ? (
                    <CheckIcon className="w-5 h-5 text-green-500" />
                  ) : (
                    <XIcon className="w-5 h-5 text-red-500" />
                  )}
                  <span className="text-sm text-content-primary">{check.details}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Checks */}
        <div>
          <h4 className="font-semibold mb-2 text-content-primary">
            👤 {t('test_runner_manual_checks')} ({manualPassCount}/{manualTotalCount})
          </h4>
          <div className="space-y-2">
            {selectedScenario.manualChecks.map((check, idx) => {
              const checkId = `manual_${idx}`;
              const result = manualCheckResults[checkId];
              
              return (
                <div key={idx} className="p-3 bg-background-tertiary rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => handleManualCheck(checkId, true)}
                        className={`p-1 rounded transition-colors ${
                          result === true
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 hover:bg-green-100'
                        }`}
                      >
                        <CheckIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleManualCheck(checkId, false)}
                        className={`p-1 rounded transition-colors ${
                          result === false
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 hover:bg-red-100'
                        }`}
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <div className="text-content-primary text-sm">{check}</div>
                      <input
                        type="text"
                        placeholder={t('test_runner_notes_optional')}
                        value={manualNotes[checkId] || ''}
                        onChange={(e) => setManualNotes(prev => ({ ...prev, [checkId]: e.target.value }))}
                        className="mt-1 w-full px-2 py-1 text-xs bg-background-primary border border-border-secondary rounded"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Complete Button */}
        <button
          onClick={completeTest}
          disabled={!allManualChecked}
          className="w-full py-3 px-6 bg-accent-primary text-white rounded-lg font-semibold
                     disabled:opacity-50 disabled:cursor-not-allowed
                     hover:bg-accent-primary/90 transition-colors"
        >
          ✓ {t('test_runner_complete')}
        </button>
      </div>
    );
  };

  // Export test result as JSON
  const exportTestResult = useCallback(() => {
    if (!testResult || !selectedScenario || !selectedBot) return;

    const exportData: any = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      scenario: {
        id: selectedScenario.id,
        name: selectedScenario.name,
        category: selectedScenario.category,
      },
      bot: {
        id: selectedBot.id,
        name: selectedBot.name,
      },
      profile: {
        type: useMyProfile ? 'user_profile' : 'manual',
        riemann: selectedRiemann?.id || null,
        sd: selectedSD?.id || null,
        ocean: selectedOCEAN?.id || null,
      },
      result: {
        ...testResult,
        manualCheckResults: Object.entries(manualCheckResults).map(([checkId, passed]) => ({
          checkId,
          checkText: selectedScenario.manualChecks[parseInt(checkId.replace('manual_', ''))],
          passed,
          notes: manualNotes[checkId] || null,
        })),
      },
      sessionAnalysis: sessionAnalysisResult || null,
    };

    // Add aggregated LLM statistics for easy comparison
    const responsesWithMetadata = testResult.responses.filter(r => r.llmMetadata);
    if (responsesWithMetadata.length > 0) {
      const llmStats = {
        totalTokens: responsesWithMetadata.reduce((sum, r) => 
          sum + (r.llmMetadata?.tokenUsage.total || 0), 0),
        avgResponseTime: Math.round(
          responsesWithMetadata.reduce((sum, r) => 
            sum + (r.llmMetadata?.responseTimeMs || 0), 0) / responsesWithMetadata.length
        ),
        models: [...new Set(responsesWithMetadata.map(r => r.llmMetadata?.model).filter(Boolean))],
        providers: [...new Set(responsesWithMetadata.map(r => r.llmMetadata?.provider).filter(Boolean))],
        cacheHitRate: responsesWithMetadata.filter(r => r.llmMetadata?.cacheUsed).length / responsesWithMetadata.length,
        responsesTracked: responsesWithMetadata.length,
        totalResponses: testResult.responses.length,
      };
      exportData.llmStats = llmStats;
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-${selectedScenario.id}-${selectedBot.id}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [testResult, selectedScenario, selectedBot, useMyProfile, selectedRiemann, selectedSD, selectedOCEAN, manualCheckResults, manualNotes, sessionAnalysisResult]);

  // Render complete phase
  const renderComplete = () => {
    if (!testResult || !selectedScenario) return null;

    const autoPassCount = testResult.autoCheckResults.filter(r => r.passed).length;
    const autoTotalCount = testResult.autoCheckResults.length;
    const manualPassCount = Object.values(manualCheckResults).filter(v => v === true).length;
    const manualTotalCount = selectedScenario.manualChecks.length;
    const totalPassed = autoPassCount + manualPassCount;
    const totalChecks = autoTotalCount + manualTotalCount;
    const passRate = Math.round((totalPassed / totalChecks) * 100);

    return (
      <div className="text-center py-8">
        <div className="text-6xl mb-4">
          {passRate >= 80 ? '✅' : passRate >= 50 ? '⚠️' : '❌'}
        </div>
        <h3 className="text-2xl font-bold text-content-primary">
          {t('test_runner_completed')}
        </h3>
        <p className="text-4xl font-bold mt-2 text-accent-primary">
          {passRate}%
        </p>
        <p className="text-content-secondary mt-1">
          {t('test_runner_checks_passed', { passed: totalPassed, total: totalChecks })}
        </p>
        
        <div className="mt-6 p-4 bg-background-tertiary rounded-lg text-left max-w-md mx-auto">
          <div className="text-sm space-y-1">
            <div>{t('test_runner_result_bot')}: <span className="font-medium">{selectedBot?.name}</span></div>
            <div>{t('test_runner_result_profile')}: <span className="font-medium">{getProfileDisplayName()}</span></div>
            <div>{t('test_runner_result_scenario')}: <span className="font-medium">{selectedScenario.name}</span></div>
            <div>{t('test_runner_result_auto')}: <span className="font-medium">{autoPassCount}/{autoTotalCount}</span></div>
            <div>{t('test_runner_result_manual')}: <span className="font-medium">{manualPassCount}/{manualTotalCount}</span></div>
          </div>
        </div>

        <div className="mt-6 flex gap-3 justify-center flex-wrap">
          <button
            onClick={exportTestResult}
            className="py-2 px-6 bg-green-600 text-white rounded-lg
                       hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            📥 Export Result
          </button>
          <button
            onClick={() => {
              setPhase('setup');
              setTestResult(null);
              setManualCheckResults({});
              setManualNotes({});
              setCurrentMessageIndex(0);
              setError(null);
              setSessionAnalysisResult(null);
              // Reset profile selections
              setSelectedRiemann(null);
              setSelectedSD(null);
              setSelectedOCEAN(null);
              setUseMyProfile(false);
            }}
            className="py-2 px-6 bg-background-tertiary text-content-primary rounded-lg
                       hover:bg-background-secondary transition-colors"
          >
            {t('test_runner_new_test')}
          </button>
          <button
            onClick={onClose}
            className="py-2 px-6 bg-accent-primary text-white rounded-lg
                       hover:bg-accent-primary/90 transition-colors"
          >
            {t('test_runner_close')}
          </button>
        </div>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-start justify-center overflow-y-auto p-4 pt-16 pb-8">
      <div className="bg-background-primary dark:bg-background-secondary rounded-lg shadow-xl max-w-3xl w-full animate-fadeIn flex flex-col max-h-[85dvh]">
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border-secondary shrink-0">
          <h3 className="text-xl font-bold text-content-primary">
            🧪 {t('test_runner_title')}
          </h3>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="p-2 text-content-secondary hover:text-content-primary disabled:opacity-50"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 min-h-0">
          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-600 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="text-2xl mt-0.5">🚨</div>
                <p className="text-sm text-content-secondary">{error}</p>
              </div>
            </div>
          )}

          {/* Phase Content */}
          {phase === 'setup' && renderSetup()}
          {phase === 'running' && renderRunning()}
          {phase === 'analyzing' && renderAnalyzing()}
          {phase === 'validation' && renderValidation()}
          {phase === 'complete' && renderComplete()}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TestRunner;
