import React from 'react';

export type Language = 'en' | 'de';

export type NavView =
    | 'welcome'
    | 'auth'
    | 'login'
    | 'landing'
    | 'piiWarning'
    | 'questionnaire'
    | 'botSelection'
    | 'chat'
    | 'sessionReview'
    | 'contextChoice'
    | 'achievements'
    | 'userGuide'
    | 'formattingHelp'
    | 'faq'
    | 'about'
    | 'disclaimer'
    | 'legal'
    | 'accountManagement'
    | 'editProfile'
    | 'admin'
    | 'changePassword'
    | 'exportData'
    | 'personalitySurvey'
    | 'personalityProfile'
    | 'lifeContextEditor'
    | 'transcriptEval'
    | 'interviewTranscript';

export type CoachingMode = 'off' | 'dpc' | 'dpfl';

export interface User {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    preferredLanguage?: string;
    newsletterConsent?: boolean;
    newsletterConsentDate?: string | null;
    isPremium: boolean;
    isClient?: boolean;
    isAdmin: boolean;
    isDeveloper?: boolean;
    unlockedCoaches: string[];
    createdAt?: string;
    accessExpiresAt?: string;
    premiumExpiresAt?: string;
    loginCount?: number;
    lastLogin?: string;
    encryptionSalt?: string; // Hex-encoded string
    gamificationState?: string;
    status?: 'PENDING' | 'ACTIVE';
    coachingMode?: CoachingMode; // off = standard coaching, dpc = profile used but not refined, dpfl = profile used and refined
    hasProfile?: boolean;
    completedLenses?: string[];
}

export interface Bot {
    id: string;
    name: string;
    description: string;
    description_de: string;
    avatar: string;
    style: string;
    style_de: string;
}

export interface BotWithAvailability extends Bot {
    isAvailable: boolean;
}

export interface Message {
    id: string;
    role: 'user' | 'bot';
    text: string;
    timestamp: string;
}

export interface GamificationState {
    xp: number;
    level: number;
    streak: number;
    totalSessions: number;
    lastSessionDate: string | null;
    unlockedAchievements: Set<string>;
    coachesUsed: Set<string>;
}

export interface ProposedUpdate {
    type: 'append' | 'replace_section' | 'create_headline';
    headline: string;
    content: string;
}

export interface SolutionBlockage {
    blockage: string;
    explanation: string;
    quote: string;
}

export interface SessionAnalysis {
    newFindings: string;
    proposedUpdates: ProposedUpdate[];
    nextSteps: { action: string; deadline: string }[];
    completedSteps: string[];
    accomplishedGoals: string[];
    solutionBlockages: SolutionBlockage[];
    blockageScore: number;
    hasConversationalEnd: boolean;
    hasAccomplishedGoal: boolean;
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    isUnlocked: (state: GamificationState) => boolean;
}

export interface Ticket {
    id: string;
    type: 'PASSWORD_RESET';
    status: 'OPEN' | 'RESOLVED';
    payload: { email: string };
    createdAt: string;
}

export interface Feedback {
    id: string;
    rating: number | null;
    comments: string;
    botId: string;
    lastUserMessage: string | null;
    botResponse: string | null;
    isAnonymous: boolean;
    createdAt: string;
    user: { email: string } | null;
    guestEmail?: string | null;
}

export interface CalendarEvent {
    action: string;
    deadline: string;
    description?: string;
}

// Transcript Evaluation types
export interface TranscriptPreAnswers {
    situationName: string;
    goal: string;
    personalTarget: string;
    assumptions: string;
    satisfaction: number; // 1-5
    difficult?: string;
}

export interface BotRecommendationEntry {
    botId: string;
    botName: string;
    rationale: string;
    examplePrompt: string;
}

export interface BotRecommendation {
    developmentArea: string;
    primary: BotRecommendationEntry;
    secondary: BotRecommendationEntry;
}

export interface TranscriptEvaluationResult {
    summary: string;
    goalAlignment: { score: number; evidence: string; gaps: string };
    behavioralAlignment: { score: number; evidence: string; blindspotEvidence: string[] };
    assumptionCheck: { confirmed: string[]; challenged: string[]; newInsights: string[] };
    calibration: { selfRating: number; evidenceRating: number; delta: string; interpretation: string };
    personalityInsights: { dimension: string; observation: string; recommendation: string }[];
    strengths: string[];
    developmentAreas: string[];
    nextSteps: { action: string; rationale: string }[];
    botRecommendations?: BotRecommendation[];
    contextUpdates: ProposedUpdate[];
    overallScore: number; // 1-10
    // User rating fields
    id?: string;
    userRating?: number | null;
    userFeedback?: string | null;
    contactOptIn?: boolean;
}

export interface TranscriptEvaluationResponse {
    id: string;
    evaluation: TranscriptEvaluationResult;
    durationMs: number;
}

export interface TranscriptEvaluationSummary {
    id: string;
    createdAt: string;
    lang: string;
    goal: string;
    summary: string;
    overallScore: number;
    preAnswers: TranscriptPreAnswers;
    evaluationData: TranscriptEvaluationResult;
    // User rating fields
    userRating?: number | null;
    userFeedback?: string | null;
    contactOptIn?: boolean;
}