import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ProposedUpdate, Bot, GamificationState, SolutionBlockage, User, Message } from '../types';
import { DownloadIcon } from './icons/DownloadIcon';
import DiffViewer from './DiffViewer';
import { useLocalization } from '../context/LocalizationContext';
import { UsersIcon } from './icons/UsersIcon';
import BlockageScoreGauge from './BlockageScoreGauge';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { serializeGamificationState } from '../utils/gamificationSerializer';
import { StarIcon } from './icons/StarIcon';
import Button from './shared/Button';
import * as userService from '../services/userService';
import { buildUpdatedContext, getExistingHeadlines, AppliedUpdatePayload, HeadlineOption, normalizeHeadline, fuzzyMatchHeadline, getEmojiForHeadline } from '../utils/contextUpdater';
import { FileTextIcon } from './icons/FileTextIcon';
import { downloadTextFile } from '../utils/fileDownload';
import { CalendarIcon } from './icons/CalendarIcon';
import { exportSingleEvent, exportAllEvents, exportSingleEventWithDate } from '../utils/calendarExport';
import DatePickerModal from './DatePickerModal';
import ComfortCheckModal from './ComfortCheckModal';
import ProfileRefinementModal from './ProfileRefinementModal';
import { RefinementPreviewResult } from '../services/api';


const removeGamificationKey = (text: string) => {
    // Regex to find and remove the key comment, including potential trailing whitespace
    return text.replace(/<!-- (gmf-data|do_not_delete): (.*?) -->\s*$/, '').trim();
};

// This map normalizes blockage names from API to i18n keys
const blockageApiToKeyMap: Record<string, string> = {
    'self-reproach': 'self-reproach',
    'blaming others': 'blaming_others',
    'expectational attitudes': 'expectational_attitudes',
    'age regression': 'age_regression',
    'dysfunctional loyalties': 'dysfunctional_loyalties',
};


interface SessionReviewProps {
    newFindings: string;
    proposedUpdates: ProposedUpdate[];
    nextSteps: { action: string; deadline: string }[];
    completedSteps: string[];
    accomplishedGoals: string[];
    solutionBlockages: SolutionBlockage[];
    blockageScore: number;
    hasConversationalEnd: boolean;
    hasAccomplishedGoal: boolean;
    originalContext: string;
    selectedBot: Bot;
    onContinueSession: (newContext: string, options: { preventCloudSave: boolean }) => Promise<void>;
    onSwitchCoach: (newContext: string, options: { preventCloudSave: boolean }) => Promise<void>;
    onReturnToStart: () => void;
    onReturnToAdmin?: (options?: { openTestRunner?: boolean }) => void; // For test mode: return to admin console
    gamificationState: GamificationState;
    currentUser: User | null;
    isInterviewReview?: boolean;
    interviewResult?: string;
    chatHistory: Message[];
    isTestMode?: boolean;
    refinementPreview?: RefinementPreviewResult | null;
    isLoadingRefinementPreview?: boolean;
    refinementPreviewError?: string | null;
    hasPersonalityProfile?: boolean;
    onStartPersonalitySurvey?: () => void;
    encryptionKey?: CryptoKey | null;
}

// Questionnaire recommendation based on session content
type QuestionnaireType = 'sd' | 'riemann' | 'ocean';

interface QuestionnaireRecommendation {
    type: QuestionnaireType;
    reason: string;
    confidence: number;
}

const TOPIC_KEYWORDS: Record<string, QuestionnaireType[]> = {
    // Interpersonal conflict keywords → Riemann
    'konflikt': ['riemann'],
    'conflict': ['riemann'],
    'chef': ['riemann'],
    'boss': ['riemann'],
    'kollege': ['riemann'],
    'colleague': ['riemann'],
    'team': ['riemann'],
    'beziehung': ['riemann'],
    'relationship': ['riemann'],
    'partner': ['riemann'],
    'kommunikation': ['riemann'],
    'communication': ['riemann'],
    'streit': ['riemann'],
    'argument': ['riemann'],
    'missverständnis': ['riemann'],
    'misunderstanding': ['riemann'],
    
    // Meaning & motivation keywords → SD
    'sinn': ['sd'],
    'meaning': ['sd'],
    'purpose': ['sd'],
    'werte': ['sd'],
    'values': ['sd'],
    'motivation': ['sd'],
    'antrieb': ['sd'],
    'drive': ['sd'],
    'erfüllung': ['sd'],
    'fulfillment': ['sd'],
    'unzufrieden': ['sd'],
    'dissatisfied': ['sd'],
    'orientierungslos': ['sd'],
    'lost': ['sd'],
    'frustriert': ['sd'],
    'frustrated': ['sd'],
    'warum': ['sd'],
    'why': ['sd'],
    
    // Self-understanding keywords → OCEAN (lower priority)
    'persönlichkeit': ['ocean'],
    'personality': ['ocean'],
    'eigenschaften': ['ocean'],
    'traits': ['ocean'],
    'muster': ['ocean', 'riemann'],
    'pattern': ['ocean', 'riemann'],
};

function analyzeSessionForRecommendation(
    newFindings: string,
    chatHistory: Message[],
    language: string
): QuestionnaireRecommendation | null {
    const allText = [
        newFindings,
        ...chatHistory.map(m => m.text)
    ].join(' ').toLowerCase();
    
    const scores: Record<QuestionnaireType, number> = {
        sd: 0,
        riemann: 0,
        ocean: 0
    };
    
    // Count keyword matches
    for (const [keyword, types] of Object.entries(TOPIC_KEYWORDS)) {
        const regex = new RegExp(keyword, 'gi');
        const matches = (allText.match(regex) || []).length;
        if (matches > 0) {
            types.forEach(type => {
                scores[type] += matches;
            });
        }
    }
    
    // Find highest score
    const entries = Object.entries(scores) as [QuestionnaireType, number][];
    entries.sort((a, b) => b[1] - a[1]);
    
    const [topType, topScore] = entries[0];
    
    // Only recommend if there's meaningful signal
    if (topScore < 2) {
        // Default to SD if no clear signal (most motivating)
        return {
            type: 'sd',
            reason: 'Understand what truly drives you',
            confidence: 0.3
        };
    }
    
    const reasons: Record<QuestionnaireType, string> = {
        riemann: 'Understand why relationships sometimes struggle',
        sd: 'Understand what truly drives and motivates you',
        ocean: 'Discover your stable personality traits'
    };

    return {
        type: topType,
        reason: reasons[topType],
        confidence: Math.min(topScore / 10, 1)
    };
}

const SessionReview: React.FC<SessionReviewProps> = ({
    newFindings,
    proposedUpdates,
    nextSteps,
    completedSteps,
    accomplishedGoals,
    solutionBlockages,
    blockageScore,
    hasConversationalEnd,
    hasAccomplishedGoal,
    originalContext,
    selectedBot,
    onContinueSession,
    onSwitchCoach,
    onReturnToStart,
    onReturnToAdmin,
    gamificationState,
    currentUser,
    isInterviewReview,
    interviewResult,
    chatHistory,
    isTestMode,
    refinementPreview,
    isLoadingRefinementPreview,
    refinementPreviewError,
    hasPersonalityProfile,
    onStartPersonalitySurvey,
    encryptionKey: encryptionKeyProp,
}) => {
    const { t, language } = useLocalization();
    const [isBlockagesExpanded, setIsBlockagesExpanded] = useState(false);
    
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle');
    const [isSaving, setIsSaving] = useState(false);
    const [calendarExportStatus, setCalendarExportStatus] = useState<string | null>(null);
    const [datePickerModal, setDatePickerModal] = useState<{ isOpen: boolean; action: string; deadline: string } | null>(null);
    const [showComfortCheck, setShowComfortCheck] = useState(false);
    const [showRefinementModal, setShowRefinementModal] = useState(false);
    
    // Use prop if provided, otherwise maintain local state
    const [localEncryptionKey, setLocalEncryptionKey] = useState<CryptoKey | null>(null);
    const encryptionKey = encryptionKeyProp || localEncryptionKey;
    
    // Generate stable session ID for this session review (used across multiple API calls)
    const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    
    // Track which next steps are selected (all selected by default)
    const [selectedNextSteps, setSelectedNextSteps] = useState<Set<number>>(
        new Set(nextSteps.map((_, index) => index))
    );
    
    // Show comfort check for DPFL after EVERY completed session
    // 
    // IMPORTANT: Comfort Check is only shown when the session has a conversational end
    // (hasConversationalEnd === true), which means the coaching session was completed
    // with proper closure and goals were addressed. This aligns with XP rewards:
    // - XP is awarded when hasConversationalEnd === true (+50 XP bonus)
    // - Comfort Check appears under the same conditions
    //
    // This ensures that only substantive, properly concluded sessions are considered
    // for profile refinement, not incomplete or abandoned conversations.
    //
    // This allows user to:
    // 1. Rate session authenticity (1-5 scale)
    // 2. Opt-out of using this session for profile refinement ("Skip" button)
    // 
    // Sessions with score >= 3 and not opted-out are considered "authentic"
    // and used for profile refinement calculations.
    // 
    // Refinement is proposed after 2nd authentic session (if in adaptive mode).
    // User can then accept or reject the suggested changes.
    //
    // Never shown for:
    // - Nobody bot (nexus-gps) - not a full coaching session
    // - Users without coachingMode === 'dpfl'
    // - Sessions without conversational end (hasConversationalEnd === false)
    useEffect(() => {
        // #region agent log
        console.log('[SESSION-REVIEW] Comfort Check useEffect triggered:', {
            currentUser: currentUser?.email,
            coachingMode: currentUser?.coachingMode,
            isTestMode,
            hasRefinementPreview: !!refinementPreview,
            selectedBot: selectedBot.id,
            hasConversationalEnd
        });
        // #endregion
        
        const isNobodyBot = selectedBot.id === 'nexus-gps';
        const isDPFLTest = isTestMode && refinementPreview && !isNobodyBot;
        const isDPFLProduction = currentUser?.coachingMode === 'dpfl' && !isTestMode && !isNobodyBot;
        
        // #region agent log
        console.log('[SESSION-REVIEW] Comfort Check conditions:', {
            isNobodyBot,
            isDPFLTest,
            isDPFLProduction,
            hasConversationalEnd
        });
        // #endregion
        
        // CRITICAL: Only show comfort check if session has conversational end
        // This aligns with XP reward logic (hasConversationalEnd = +50 XP bonus)
        const hasProperClosure = hasConversationalEnd;
        
        if ((isDPFLTest || isDPFLProduction) && hasProperClosure) {
            // #region agent log
            console.log('[SESSION-REVIEW] ✓ All conditions met - showing Comfort Check after 1s delay');
            // #endregion
            // Show comfort check after brief delay
            setTimeout(() => setShowComfortCheck(true), 1000);
        } else {
            // #region agent log
            console.log('[SESSION-REVIEW] ✗ Conditions NOT met - Comfort Check will NOT show');
            // #endregion
        }
    }, [currentUser?.coachingMode, isTestMode, refinementPreview, selectedBot.id, hasConversationalEnd]);

    // Toggle individual next step selection
    const toggleNextStep = (index: number) => {
        setSelectedNextSteps(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    // Select/deselect all next steps
    const toggleAllNextSteps = (selectAll: boolean) => {
        if (selectAll) {
            setSelectedNextSteps(new Set(nextSteps.map((_, index) => index)));
        } else {
            setSelectedNextSteps(new Set());
        }
    };

    // Get only selected next steps for context update
    const getSelectedNextSteps = useCallback(() => {
        return nextSteps.filter((_, index) => selectedNextSteps.has(index));
    }, [nextSteps, selectedNextSteps]);

    // Create effective proposed updates that respect next step selection
    const effectiveProposedUpdates = useMemo(() => {
        const nextStepsHeadlines = [
            'Achievable Next Steps',
            '✅ Achievable Next Steps',
            'Realisierbare nächste Schritte',
            '✅ Realisierbare nächste Schritte'
        ];
        
        return proposedUpdates.map(update => {
            const isNextStepsUpdate = nextStepsHeadlines.some(headline => 
                update.headline.toLowerCase().includes(headline.toLowerCase())
            );
            
            if (isNextStepsUpdate && nextSteps.length > 0) {
                // Only include selected steps in content
                const selectedSteps = getSelectedNextSteps();
                const selectedStepsContent = selectedSteps
                    .map(step => `* ${step.action} (Deadline: ${step.deadline})`)
                    .join('\n');
                
                return { ...update, content: selectedStepsContent };
            }
            return update;
        });
    }, [proposedUpdates, nextSteps, getSelectedNextSteps]);

    const handleRatingClick = (starValue: number) => {
        if (feedbackStatus !== 'idle') return;

        if (rating === starValue) {
            setRating(0);
            setFeedbackText('');
        } else {
            setRating(starValue);
        }
    };

    const cleanOriginalContext = useMemo(() => isInterviewReview ? '' : removeGamificationKey(originalContext), [originalContext, isInterviewReview]);
    const isGuest = !currentUser;

    const submitRating = useCallback(async (ratingToSubmit: number, comments: string) => {
        if (feedbackStatus === 'submitting' || feedbackStatus === 'submitted') return;

        setFeedbackStatus('submitting');

        try {
            await userService.submitFeedback({
                rating: ratingToSubmit,
                comments,
                botId: selectedBot.id,
                isAnonymous: !currentUser,
            });
            setFeedbackStatus('submitted');
        } catch (err) {
            console.error('Failed to submit session feedback:', err);
            alert('Failed to submit feedback. Please try again.');
            setFeedbackStatus('idle');
        }
    }, [feedbackStatus, selectedBot.id, currentUser]);

    const handleFeedbackSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        submitRating(rating, feedbackText);
    };

    const handleExportSingleStep = async (action: string, deadline: string) => {
        const result = await exportSingleEvent(action, deadline, language);
        if (result.success) {
            setCalendarExportStatus(t('calendar_export_success'));
            setTimeout(() => setCalendarExportStatus(null), 5000);
        } else if (result.needsManualInput) {
            // Open date picker modal for manual date selection
            setDatePickerModal({ isOpen: true, action, deadline });
        } else {
            setCalendarExportStatus(t('calendar_export_error', { error: result.error || 'Unknown error' }));
            setTimeout(() => setCalendarExportStatus(null), 5000);
        }
    };

    const handleDatePickerConfirm = async (date: Date) => {
        if (!datePickerModal) return;
        
        setDatePickerModal(null);
        const result = await exportSingleEventWithDate(datePickerModal.action, date, language);
        
        if (result.success) {
            setCalendarExportStatus(t('calendar_export_success'));
            setTimeout(() => setCalendarExportStatus(null), 5000);
        } else {
            setCalendarExportStatus(t('calendar_export_error', { error: result.error || 'Unknown error' }));
            setTimeout(() => setCalendarExportStatus(null), 5000);
        }
    };

    const handleDatePickerCancel = () => {
        setDatePickerModal(null);
    };

    const handleExportAllSteps = async () => {
        const stepsToExport = getSelectedNextSteps();
        if (stepsToExport.length === 0) return;
        
        const result = await exportAllEvents(stepsToExport, language);
        if (result.success) {
            if (result.count === 1) {
                setCalendarExportStatus(t('calendar_export_success'));
            } else {
                setCalendarExportStatus(t('calendar_export_success_multiple', { count: result.count }));
            }
            setTimeout(() => setCalendarExportStatus(null), 5000);
        } else {
            const errorMsg = result.errors.length > 0 ? result.errors[0] : 'Unknown error';
            setCalendarExportStatus(t('calendar_export_error', { error: errorMsg }));
            setTimeout(() => setCalendarExportStatus(null), 5000);
        }
    };

    const existingHeadlines: HeadlineOption[] = useMemo(() => {
        return getExistingHeadlines(cleanOriginalContext);
    }, [cleanOriginalContext]);

    const hierarchicalKeyToValueMap = useMemo(() => {
        return new Map(existingHeadlines.map(opt => [opt.hierarchicalKey, opt.value]));
    }, [existingHeadlines]);
    
    const canSeeBlockages = useMemo(() => {
        // PEP Solution Blockages (Dr. Bohne) require Client, Admin, or Developer access
        if (currentUser?.isClient || currentUser?.isAdmin) return true;
        return false;
    }, [currentUser]);

    // Headlines that should default to 'append' (adding new items) rather than 'replace_section'
    const appendDefaultHeadlines = useMemo(() => [
        'Achievable Next Steps',
        '✅ Achievable Next Steps',
        'Realisierbare nächste Schritte',
        '✅ Realisierbare nächste Schritte'
    ], []);

    const [appliedUpdates, setAppliedUpdates] = useState<Map<number, AppliedUpdatePayload>>(() => {
        return new Map(proposedUpdates.map((update, index): [number, AppliedUpdatePayload] => {
            // Use fuzzy matching to find the best match for AI-proposed headlines
            const targetValue = fuzzyMatchHeadline(update.headline, hierarchicalKeyToValueMap);

            if (targetValue) {
                // The AI proposed a headline that matches an existing one.
                // For Next Steps: default to 'append' since we're adding new goals
                // For other sections: use what the AI suggested
                const isAppendDefault = appendDefaultHeadlines.some(h => 
                    update.headline.toLowerCase().includes(h.toLowerCase())
                );
                
                let type: 'append' | 'replace_section' | 'create_headline';
                if (update.type === 'create_headline') {
                    type = 'append';
                } else if (isAppendDefault) {
                    type = 'append'; // Default to append for Next Steps
                } else {
                    type = update.type;
                }
                
                return [index, { type, targetHeadline: targetValue }];
            } else {
                // The AI proposed a new headline.
                return [index, { type: 'create_headline', targetHeadline: update.headline }];
            }
        }));
    });

    const [editableContext, setEditableContext] = useState('');
    const [isFinalContextVisible, setIsFinalContextVisible] = useState(false);
    const [preventCloudSave, setPreventCloudSave] = useState(false);


    const handleToggleUpdate = (index: number) => {
        setAppliedUpdates(prev => {
            const newMap = new Map(prev);
            if (newMap.has(index)) {
                newMap.delete(index);
            } else {
                // Re-run the initial state logic for the specific item being toggled on.
                const originalUpdate = proposedUpdates[index];
                // Use fuzzy matching to find the best match
                const targetValue = fuzzyMatchHeadline(originalUpdate.headline, hierarchicalKeyToValueMap);
                if (targetValue) {
                    // For Next Steps: default to 'append' since we're adding new goals
                    const isAppendDefault = appendDefaultHeadlines.some(h => 
                        originalUpdate.headline.toLowerCase().includes(h.toLowerCase())
                    );
                    
                    let type: 'append' | 'replace_section' | 'create_headline';
                    if (originalUpdate.type === 'create_headline') {
                        type = 'append';
                    } else if (isAppendDefault) {
                        type = 'append';
                    } else {
                        type = originalUpdate.type;
                    }
                    
                    newMap.set(index, { type, targetHeadline: targetValue });
                } else {
                    newMap.set(index, { type: 'create_headline', targetHeadline: originalUpdate.headline });
                }
            }
            return newMap;
        });
    };
    
    const handleActionChange = (index: number, newTargetValue: string) => {
        setAppliedUpdates(prev => {
            const newMap = new Map<number, AppliedUpdatePayload>(prev);
            const existingUpdate = newMap.get(index);
            if (!existingUpdate) return prev;
            
            // When switching from a 'create_headline' to an existing one, default to 'append'.
            const newType = existingUpdate.type === 'create_headline' ? 'append' : existingUpdate.type;

            newMap.set(index, { ...existingUpdate, type: newType, targetHeadline: newTargetValue });
            return newMap;
        });
    };

    const handleUpdateTypeChange = (index: number, newType: 'append' | 'replace_section') => {
        setAppliedUpdates(prev => {
            const newMap = new Map<number, AppliedUpdatePayload>(prev);
            const updatePayload = newMap.get(index);
            if (updatePayload && (newType === 'append' || newType === 'replace_section')) {
                newMap.set(index, { ...updatePayload, type: newType });
            }
            return newMap;
        });
    };

    const updatedContext = useMemo(() => {
        if (isInterviewReview) {
            return interviewResult || '';
        }
        // Use effectiveProposedUpdates to respect next step selection
        return buildUpdatedContext(cleanOriginalContext, effectiveProposedUpdates, appliedUpdates, completedSteps, accomplishedGoals);
    }, [isInterviewReview, interviewResult, cleanOriginalContext, effectiveProposedUpdates, appliedUpdates, completedSteps, accomplishedGoals]);

    // updatedContext now already respects selectedNextSteps via effectiveProposedUpdates
    useEffect(() => {
        setEditableContext(updatedContext);
    }, [updatedContext]);

    const addGamificationDataToContext = (context: string): string => {
        // Remove any old gamification data comment to ensure a clean slate.
        let finalContext = context.replace(/<!-- (gmf-data|do_not_delete): (.*?) -->/g, '').trim();
        const dataToSerialize = serializeGamificationState(gamificationState);
        
        // 1. Encode to Base64
        const encodedData = btoa(dataToSerialize);
        // 2. Obfuscate by reversing the string. This makes it non-standard and not directly decodable.
        const obfuscatedData = encodedData.split('').reverse().join('');
        // 3. Embed with the new key.
        const dataComment = `<!-- do_not_delete: ${obfuscatedData} -->`;

        if (finalContext) {
            finalContext = `${finalContext.trimEnd()}\n\n${dataComment}`;
        } else {
            finalContext = dataComment;
        }
        return finalContext ? `${finalContext.trim()}\n` : '';
    };

    const handleDownloadContext = () => {
        // Always embed the latest gamification state to ensure the download is a complete backup.
        const contentToDownload = addGamificationDataToContext(editableContext);
        const blob = new Blob([contentToDownload], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Life_Context_Updated.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleContinue = async () => {
        setIsSaving(true);
        // Add a small artificial delay to ensure the spinner is visible, enhancing UX.
        await new Promise(resolve => setTimeout(resolve, 200)); 
        await onContinueSession(editableContext, { preventCloudSave });
        // No need to set isSaving back to false as the component unmounts.
    };

    const handleSwitch = async () => {
        setIsSaving(true);
        // Add a small artificial delay to ensure the spinner is visible, enhancing UX.
        await new Promise(resolve => setTimeout(resolve, 200));
        await onSwitchCoach(editableContext, { preventCloudSave });
    };

    const getBlockageNameTranslation = (blockageName: string) => {
        // Normalize the name from the API: just lowercase it to match the map keys.
        const normalizedApiName = (blockageName || '').toLowerCase();
        // Find the canonical key part from our map, or fall back to a simple transformation
        const keyPart = blockageApiToKeyMap[normalizedApiName] || normalizedApiName.replace(/ /g, '_');
        // Construct the final i18n key
        const key = `blockage_${keyPart}`;
        return t(key);
    };

    const handleDownloadSummary = async () => {
        let summaryContent = `${t('sessionReview_summary')}\n---------------------------------\n${newFindings}\n\n`;
        if (solutionBlockages && solutionBlockages.length > 0) {
            summaryContent += `${t('sessionReview_blockages_title')}\n---------------------------------\n`;
            solutionBlockages.forEach(blockage => {
                summaryContent += `Blockage: ${getBlockageNameTranslation(blockage.blockage)}\nExplanation: ${blockage.explanation}\nQuote: "${blockage.quote}"\n\n`;
            });
        }
        try {
            await downloadTextFile(summaryContent.trim(), 'Session_Summary.txt');
        } catch (err) {
            console.error('Summary download failed:', err);
        }
    };

    const handleDownloadTranscript = async () => {
        const today = new Date();
        const formattedDate = today.toLocaleDateString('en-CA');
        const formattedDateTime = today.toLocaleString(language, { dateStyle: 'long', timeStyle: 'short' });

        let transcriptContent = `Session Transcript\n`;
        transcriptContent += `Coach: ${selectedBot.name}\n`;
        transcriptContent += `Date: ${formattedDateTime}\n`;
        transcriptContent += `---------------------------------\n\n`;

        chatHistory.forEach(message => {
            const timestamp = new Date(message.timestamp).toLocaleTimeString('en-US', { hour12: false });
            const role = message.role === 'user' ? 'User' : selectedBot.name;
            transcriptContent += `[${timestamp}] ${role}: ${message.text}\n\n`;
        });

        try {
            await downloadTextFile(transcriptContent.trim(), `Session_Transcript_${formattedDate}.txt`);
        } catch (err) {
            console.error('Transcript download failed:', err);
        }
    };
    
    const getActionTypeTranslation = (type: string) => {
        return t(`sessionReview_action_${type.toLowerCase()}`);
    };

    const getActionTypeClasses = (type: 'append' | 'replace_section' | 'create_headline') => {
        switch (type) {
            case 'append':
                return {
                    bg: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
                    border: 'border-green-200 dark:border-green-700',
                };
            case 'replace_section':
                return {
                    bg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
                    border: 'border-yellow-200 dark:border-yellow-700',
                };
            case 'create_headline':
                return {
                    bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
                    border: 'border-blue-200 dark:border-blue-700',
                };
            default:
                return {
                    bg: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
                    border: 'border-gray-200 dark:border-gray-700',
                };
        }
    };

    const primaryActionText = (currentUser && !preventCloudSave) ? t('sessionReview_saveAndContinue', { botName: selectedBot.name }) : t('sessionReview_continueWith', { botName: selectedBot.name });
    const secondaryActionText = (currentUser && !preventCloudSave) ? t('sessionReview_saveAndSwitch') : t('sessionReview_switchCoach');
    
    const blockageGridClass = "grid grid-cols-1 gap-4";

    return (
        <div className="flex flex-col items-center justify-center pt-4 pb-10 animate-fadeIn">
            <div className="w-full max-w-4xl p-8 space-y-8 bg-background-secondary dark:bg-transparent border border-border-secondary dark:border-border-primary rounded-lg shadow-lg">
                
                {isTestMode && (
                    <div className="p-4 mb-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 dark:border-blue-600 rounded-lg">
                        <div className="flex items-start gap-3">
                            <div className="text-2xl mt-0.5">💡</div>
                            <div>
                                <h3 className="font-bold text-lg text-content-primary">{t('sessionReview_testMode_warning_title')}</h3>
                                <p className="mt-2 text-sm text-content-secondary md:hidden">{t('sessionReview_testMode_warning_desc_short')}</p>
                                <p className="mt-2 text-sm text-content-secondary hidden md:block">{t('sessionReview_testMode_warning_desc')}</p>
                            </div>
                        </div>
                    </div>
                )}

                {isGuest && (
                    <div className="p-4 mb-6 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg">
                        <div className="flex items-start gap-3">
                            <div className="text-2xl mt-0.5">⚠️</div>
                            <div>
                                <h3 className="font-bold text-lg text-content-primary">{t('sessionReview_guestWarning_title')}</h3>
                                <p className="mt-2 text-sm text-content-secondary" dangerouslySetInnerHTML={{ __html: t('sessionReview_guestWarning_p1') }} />
                                <p className="mt-1 text-sm text-content-secondary" dangerouslySetInnerHTML={{ __html: t('sessionReview_guestWarning_p2') }} />
                                <p className="mt-1 text-sm text-content-secondary" dangerouslySetInnerHTML={{ __html: t('sessionReview_guestWarning_p3') }} />
                            </div>
                        </div>
                    </div>
                )}

                <div className="text-center">
                    <h1 className="text-4xl font-bold text-content-primary dark:text-content-primary uppercase">{t('sessionReview_title')}</h1>
                    <p className="mt-2 text-lg text-content-secondary dark:text-content-secondary">{isInterviewReview ? t('sessionReview_g_subtitle') : t('sessionReview_subtitle')}</p>
                </div>

                <div className="p-4 bg-background-tertiary dark:bg-background-tertiary border border-border-primary dark:border-border-primary">
                    <div className="flex justify-between items-center gap-4">
                        <h2 className="text-xl font-semibold text-content-primary dark:text-content-primary">{isInterviewReview ? t('sessionReview_g_summary_title') : t('sessionReview_summary')}</h2>
                         {!isInterviewReview && (
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleDownloadTranscript} 
                                    className="flex-shrink-0 flex items-center gap-2 px-3 py-1 text-xs font-bold text-accent-primary bg-transparent border border-accent-primary uppercase hover:bg-accent-primary hover:text-button-foreground-on-accent rounded-lg shadow-sm hover:shadow-md"
                                    title={t('sessionReview_downloadTranscript')}
                                >
                                    <FileTextIcon className="w-4 h-4" />
                                    <span className="hidden sm:inline whitespace-nowrap">{t('sessionReview_downloadTranscript')}</span>
                                </button>
                                <button 
                                    onClick={handleDownloadSummary} 
                                    className="flex-shrink-0 flex items-center gap-2 px-3 py-1 text-xs font-bold text-accent-primary bg-transparent border border-accent-primary uppercase hover:bg-accent-primary hover:text-button-foreground-on-accent rounded-lg shadow-sm hover:shadow-md"
                                    title={t('sessionReview_downloadSummary')}
                                >
                                    <DownloadIcon className="w-4 h-4" />
                                    <span className="hidden sm:inline whitespace-nowrap">{t('sessionReview_downloadSummary')}</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <p className="mt-2 text-content-secondary dark:text-content-secondary whitespace-pre-wrap">{newFindings}</p>
                </div>

                {!isInterviewReview && (
                    <div className="p-4 bg-background-tertiary dark:bg-background-tertiary border border-border-primary dark:border-border-primary">
                        <h2 className="text-xl font-semibold text-center text-content-primary dark:text-content-primary">{t('sessionReview_rating_title')}</h2>
                        <p className="mt-1 text-center text-content-secondary dark:text-content-secondary">{t('sessionReview_rating_prompt', { botName: selectedBot.name })}</p>
                        <div className="flex justify-center items-center gap-2 my-4">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => handleRatingClick(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    className={`focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-background-primary focus:ring-yellow-400 rounded-full ${feedbackStatus !== 'idle' ? 'cursor-default' : ''}`}
                                    aria-label={`Rate ${star} out of 5 stars`}
                                    disabled={feedbackStatus !== 'idle'}
                                >
                                    <StarIcon 
                                        className={`w-10 h-10 transition-colors ${
                                            star <= (hoverRating || rating)
                                            ? 'text-yellow-400'
                                            : 'text-gray-300 dark:text-gray-600'
                                        }`}
                                        fill={star <= (hoverRating || rating) ? 'currentColor' : 'none'}
                                    />
                                </button>
                            ))}
                        </div>

                        {rating > 0 && feedbackStatus !== 'submitted' && (
                            <form onSubmit={handleFeedbackSubmit} className="space-y-3 animate-fadeIn max-w-lg mx-auto">
                                <label htmlFor="feedback" className="font-semibold text-content-primary dark:text-content-primary">
                                    {rating <= 3 ? t('sessionReview_feedback_prompt') : t('sessionReview_feedback_prompt_optional')}
                                </label>
                                <textarea
                                    id="feedback"
                                    rows={3}
                                    value={feedbackText}
                                    onChange={(e) => setFeedbackText(e.target.value)}
                                    placeholder={rating <= 3 ? t('sessionReview_feedback_placeholder') : t('sessionReview_feedback_placeholder_optional')}
                                    className="w-full p-2 bg-background-secondary dark:bg-background-secondary text-content-primary dark:text-content-primary border border-border-secondary dark:border-border-secondary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                                    required={rating <= 3}
                                />
                                {currentUser && (
                                    <p className="text-xs text-content-subtle dark:text-content-subtle !mt-2 text-center">
                                        {t('sessionReview_contact_consent')}
                                    </p>
                                )}
                                <Button
                                    type="submit"
                                    disabled={(rating <= 3 && !feedbackText.trim()) || feedbackStatus === 'submitting'}
                                    loading={feedbackStatus === 'submitting'}
                                    fullWidth
                                    className="bg-accent-secondary hover:bg-accent-secondary-hover"
                                >
                                    {t('sessionReview_feedback_submit')}
                                </Button>
                            </form>
                        )}
                        
                        {feedbackStatus === 'submitted' && (
                            <div className="text-center p-4 bg-status-success-background dark:bg-status-success-background border border-status-success-border dark:border-status-success-border/30 max-w-lg mx-auto animate-fadeIn">
                                <p className="font-semibold text-status-success-foreground dark:text-status-success-foreground">{t('sessionReview_feedback_thanks')}</p>
                            </div>
                        )}
                    </div>
                )}

                {!isInterviewReview && (hasConversationalEnd || hasAccomplishedGoal) && (
                    <div className="p-4 bg-status-success-background dark:bg-status-success-background border border-status-success-border dark:border-status-success-border/30 space-y-2 rounded-lg">
                        {hasConversationalEnd && <p className="text-sm text-status-success-foreground dark:text-status-success-foreground font-semibold">{t('sessionReview_xpBonus_formalClose')}</p>}
                        {hasAccomplishedGoal && <p className="text-sm text-status-success-foreground dark:text-status-success-foreground font-semibold">{t('sessionReview_xpBonus_goalAccomplished')}</p>}
                    </div>
                )}
                
                {!isInterviewReview && nextSteps && nextSteps.length > 0 && (
                    <div className="p-4 bg-background-tertiary dark:bg-background-tertiary border border-border-primary dark:border-border-primary">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xl font-semibold text-content-primary dark:text-content-primary">{t('sessionReview_nextSteps')}</h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => toggleAllNextSteps(selectedNextSteps.size !== nextSteps.length)}
                                    className="text-xs text-accent-primary dark:text-accent-secondary hover:underline"
                                >
                                    {selectedNextSteps.size === nextSteps.length 
                                        ? t('sessionReview_deselect_all') || 'Alle abwählen'
                                        : t('sessionReview_select_all') || 'Alle auswählen'}
                                </button>
                                <button
                                    onClick={handleExportAllSteps}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-accent-primary dark:text-accent-secondary hover:bg-accent-primary/10 dark:hover:bg-accent-secondary/10 rounded-md transition-colors"
                                    title={t('calendar_export_all')}
                                >
                                    <CalendarIcon className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('calendar_export_all')}</span>
                                </button>
                            </div>
                        </div>
                        {calendarExportStatus && (
                            <div className="mb-3 p-2 text-sm bg-accent-primary/10 dark:bg-accent-secondary/10 text-content-primary dark:text-content-primary rounded-md">
                                {calendarExportStatus}
                            </div>
                        )}
                        <p className="text-xs text-content-subtle dark:text-content-subtle mb-3 italic">
                            {t('sessionReview_nextSteps_hint') || 'Wähle aus, welche Schritte übernommen werden sollen:'}
                        </p>
                        <ul className="text-content-secondary dark:text-content-secondary space-y-2 list-none">
                            {nextSteps.map((step, index) => (
                                <li key={index} className={`flex items-start gap-3 p-2 rounded-md transition-colors ${selectedNextSteps.has(index) ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800/50 opacity-60'}`}>
                                    <input
                                        type="checkbox"
                                        checked={selectedNextSteps.has(index)}
                                        onChange={() => toggleNextStep(index)}
                                        className="mt-1 w-4 h-4 accent-green-600 cursor-pointer"
                                    />
                                    <button
                                        onClick={() => handleExportSingleStep(step.action, step.deadline)}
                                        className="flex-shrink-0 mt-0.5 p-1 text-accent-primary dark:text-accent-secondary hover:bg-accent-primary/10 dark:hover:bg-accent-secondary/10 rounded transition-colors"
                                        title={t('calendar_export_single')}
                                    >
                                        <CalendarIcon className="w-4 h-4" />
                                    </button>
                                    <span className={selectedNextSteps.has(index) ? '' : 'line-through'}><strong>{step.action}</strong> (Deadline: {step.deadline})</span>
                                </li>
                            ))}
                        </ul>
                        {selectedNextSteps.size < nextSteps.length && (
                            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                                ⚠️ {t('sessionReview_nextSteps_partial', { count: nextSteps.length - selectedNextSteps.size })}
                            </p>
                        )}
                    </div>
                )}

                {!isInterviewReview && canSeeBlockages && solutionBlockages && (
                    <div className="bg-blue-50 dark:bg-background-primary/30 border border-blue-300 dark:border-blue-500/50 rounded-lg overflow-hidden">
                        <button onClick={() => setIsBlockagesExpanded(p => !p)} className="w-full p-4 flex justify-between items-center text-left hover:bg-blue-100/50 dark:hover:bg-background-tertiary/50 transition-colors" aria-expanded={isBlockagesExpanded} aria-controls="blockages-content">
                            <div className="flex items-center gap-3">
                                <UsersIcon className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                                <h2 className="text-xl font-semibold text-content-primary dark:text-content-primary">{t('sessionReview_blockages_title')}</h2>
                                {!isBlockagesExpanded && solutionBlockages.length > 0 && (
                                    <span className="ml-2 px-2 py-0.5 text-xs font-bold text-white bg-blue-500 rounded-full animate-fadeIn">
                                        {solutionBlockages.length}
                                    </span>
                                )}
                            </div>
                            <ChevronDownIcon className={`w-6 h-6 text-content-secondary dark:text-content-secondary transition-transform duration-300 ${isBlockagesExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isBlockagesExpanded && (
                            <div id="blockages-content" className="p-4 pt-0 space-y-4 animate-fadeIn">
                                <div className="border-t border-blue-200 dark:border-blue-500/30 mt-4 pt-4 space-y-4">
                                     <p className="text-sm text-blue-700 dark:text-blue-300 italic">{t('sessionReview_blockages_subtitle')}</p>
                                    {solutionBlockages.length > 0 ? (
                                        <>
                                            <div className={blockageGridClass}>
                                                {solutionBlockages.map((blockage, index) => (
                                                    <div key={index} className="p-3 bg-background-secondary dark:bg-background-tertiary/50 border border-border-primary dark:border-border-primary/50">
                                                        <h4 className="font-bold text-blue-800 dark:text-blue-300">{getBlockageNameTranslation(blockage.blockage)}</h4>
                                                        <p className="text-sm text-content-secondary dark:text-content-secondary mt-1">{blockage.explanation}</p>
                                                        <p className="text-sm text-content-subtle dark:text-content-subtle mt-2 border-l-2 border-blue-300 dark:border-blue-500 pl-2 italic">"{blockage.quote}"</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <BlockageScoreGauge score={blockageScore} />
                                        </>
                                    ) : ( <p className="text-center text-content-secondary dark:text-content-secondary py-4">{t('sessionReview_no_blockages')}</p> )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {!isInterviewReview && effectiveProposedUpdates && effectiveProposedUpdates.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-bold text-content-primary dark:text-content-primary mb-4 border-b border-border-primary dark:border-border-primary pb-2">{t('sessionReview_proposedUpdates')}</h2>
                        <div className="flex items-center gap-4 mb-3">
                            <button onClick={() => {
                                const newUpdates = effectiveProposedUpdates.map((update, index) => {
                                    // Use fuzzy matching for Select All as well
                                    const targetValue = fuzzyMatchHeadline(update.headline, hierarchicalKeyToValueMap);
                                    
                                    // Apply the same type conversion logic as initial state
                                    let type: 'append' | 'replace_section' | 'create_headline' = update.type;
                                    if (targetValue) {
                                        const isAppendDefault = appendDefaultHeadlines.some(h => 
                                            update.headline.toLowerCase().includes(h.toLowerCase())
                                        );
                                        if (update.type === 'create_headline') {
                                            type = 'append';
                                        } else if (isAppendDefault) {
                                            type = 'append';
                                        }
                                    } else {
                                        type = 'create_headline';
                                    }
                                    
                                    return [index, { type, targetHeadline: targetValue || update.headline }] as [number, AppliedUpdatePayload];
                                });
                                setAppliedUpdates(new Map(newUpdates));
                            }} className="text-sm text-green-500 dark:text-green-400 hover:underline">{t('sessionReview_select_all')}</button>
                            <button onClick={() => setAppliedUpdates(new Map())} className="text-sm text-yellow-500 dark:text-yellow-400 hover:underline">{t('sessionReview_deselect_all')}</button>
                        </div>
                        <div className="space-y-3 max-h-80 overflow-y-auto p-3 bg-background-tertiary dark:bg-background-tertiary border border-border-primary dark:border-border-primary">
                            {effectiveProposedUpdates.map((update, index) => {
                                const appliedUpdate = appliedUpdates.get(index);
                                const isApplied = !!appliedUpdate;
                                const isNewHeadline = appliedUpdate?.type === 'create_headline';
                                const canChangeType = isApplied && !isNewHeadline;

                                return (
                                    <div key={index} className={`flex items-start gap-3 p-3 transition-colors ${isApplied ? 'bg-background-secondary dark:bg-background-secondary/50' : 'bg-background-primary dark:bg-background-primary/20 opacity-60'} border border-border-secondary dark:border-border-primary/50`}>
                                        <input type="checkbox" id={`update-${index}`} checked={isApplied} onChange={() => handleToggleUpdate(index)} className="mt-1 h-5 w-5 rounded bg-background-secondary dark:bg-background-tertiary border-border-secondary dark:border-border-secondary text-accent-primary focus:ring-accent-primary cursor-pointer [color-scheme:light] dark:[color-scheme:dark]" />
                                        <div className="flex-1">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                                {canChangeType ? (
                                                    <select
                                                        value={appliedUpdate.type}
                                                        onChange={(e) => handleUpdateTypeChange(index, e.target.value as 'append' | 'replace_section')}
                                                        disabled={!isApplied}
                                                        className={`p-1 text-sm font-mono border ${getActionTypeClasses(appliedUpdate.type).bg} ${getActionTypeClasses(appliedUpdate.type).border} focus:outline-none focus:ring-1 focus:ring-green-500`}
                                                    >
                                                        <option value="append">{t('sessionReview_action_append')}</option>
                                                        <option value="replace_section">{t('sessionReview_action_replace_section')}</option>
                                                    </select>
                                                ) : (
                                                    <div className={`inline-flex items-center gap-2 text-sm font-mono px-2 py-0.5 rounded ${getActionTypeClasses(appliedUpdate?.type || update.type).bg} whitespace-nowrap`}>
                                                        <span>{getActionTypeTranslation(appliedUpdate?.type || update.type)}</span>
                                                    </div>
                                                )}
                                                {!isNewHeadline && <span className="text-sm text-content-subtle dark:text-content-subtle hidden sm:inline">{t('sessionReview_to')}</span>}
                                                <select value={appliedUpdate?.targetHeadline} onChange={(e) => handleActionChange(index, e.target.value)} disabled={!isApplied} className="w-full sm:w-auto p-1 text-sm bg-background-secondary dark:bg-background-secondary border border-border-secondary dark:border-border-secondary focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-background-primary dark:disabled:bg-background-primary/50 text-content-primary dark:text-content-primary">
                                                    <optgroup label={t('sessionReview_optgroup_existing')}>
                                                        {existingHeadlines.map(opt => (
                                                            <option
                                                                key={opt.value}
                                                                value={opt.value}
                                                                className="text-content-primary dark:text-content-primary"
                                                            >
                                                                {opt.label.replace(/ /g, '\u00A0')}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                    {isNewHeadline && (
                                                        <optgroup label={t('sessionReview_optgroup_new')}>
                                                            <option value={appliedUpdate.targetHeadline}>
                                                                {`${appliedUpdate.targetHeadline} (New)`}
                                                            </option>
                                                        </optgroup>
                                                    )}
                                                </select>
                                            </div>
                                            <p className="mt-2 text-content-primary dark:text-content-primary text-sm whitespace-pre-wrap font-mono p-2 bg-background-primary dark:bg-background-primary/50 border-l-2 border-border-secondary dark:border-border-secondary">{update.content}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div>
                    <h2 className="text-2xl font-bold text-content-primary dark:text-content-primary mb-2 border-b border-border-primary dark:border-border-primary pb-2">{t('sessionReview_diffView')}</h2>
                     <div className="flex items-center gap-4 text-sm mb-2 text-content-secondary dark:text-content-secondary">
                        <div className="flex items-center gap-2"><span className="w-4 h-4 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-500"></span><span>{t('sessionReview_removed')}</span></div>
                        <div className="flex items-center gap-2"><span className="w-4 h-4 bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-500"></span><span>{t('sessionReview_added')}</span></div>
                    </div>
                    <DiffViewer oldText={cleanOriginalContext} newText={updatedContext} />
                </div>
                
                 <div>
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-2xl font-bold text-content-primary dark:text-content-primary">{t('sessionReview_finalContext')}</h2>
                        <button onClick={() => setIsFinalContextVisible(p => !p)} className="text-sm text-accent-primary hover:text-accent-primary-hover hover:underline">
                            {isFinalContextVisible ? t('sessionReview_hide') : t('sessionReview_showEdit')}
                        </button>
                    </div>
                    {isFinalContextVisible && ( <textarea value={editableContext} onChange={(e) => setEditableContext(e.target.value)} rows={15} className="w-full p-3 font-mono text-sm bg-background-secondary dark:bg-background-tertiary text-content-primary dark:text-content-primary border border-border-secondary dark:border-border-secondary focus:outline-none focus:ring-1 focus:ring-accent-primary" /> )}
                </div>

                {currentUser && (
                    <div className="p-4 bg-status-warning-background dark:bg-status-warning-background border border-status-warning-border dark:border-status-warning-border/30 rounded-md">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={preventCloudSave}
                                onChange={(e) => setPreventCloudSave(e.target.checked)}
                                className="h-5 w-5 rounded bg-background-secondary dark:bg-background-tertiary border-border-secondary dark:border-border-secondary text-accent-secondary focus:ring-accent-secondary [color-scheme:light] dark:[color-scheme:dark]"
                            />
                            <div className="ml-3">
                                <span className="font-semibold text-content-primary">{t('sessionReview_preventSave_label')}</span>
                                <p className="text-sm text-status-warning-foreground dark:text-status-warning-foreground">{t('sessionReview_preventSave_desc')}</p>
                            </div>
                        </label>
                    </div>
                )}

                {/* Questionnaire Recommendation - Variante B: Subtler Hinweis */}
                {currentUser && !hasPersonalityProfile && !isInterviewReview && onStartPersonalitySurvey && (() => {
                    const recommendation = analyzeSessionForRecommendation(newFindings, chatHistory, language);
                    if (!recommendation) return null;
                    
                    const questionnaireLabels: Record<QuestionnaireType, string> = {
                        riemann: 'How you interact',
                        sd: 'What drives you',
                        ocean: 'What defines you'
                    };

                    const label = questionnaireLabels[recommendation.type];
                    
                    return (
                        <div className="py-3 px-4 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-400 dark:border-purple-600 rounded-lg text-sm">
                            <div className="flex items-start gap-3">
                                <div className="text-xl mt-0.5">💡</div>
                                <div>
                                    <span className="text-purple-700 dark:text-purple-300">
                                        {t('sessionReview_questionnaire_hint') || 'Tipp'}: {t('sessionReview_questionnaire_recommendation') || 'Der Fragebogen'} „{label}" {t('sessionReview_questionnaire_could_help') || 'könnte bei deinem Thema helfen'}.{' '}
                                    </span>
                                    <button 
                                        onClick={onStartPersonalitySurvey}
                                        className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 underline font-medium"
                                    >
                                        {t('sessionReview_questionnaire_learn_more') || 'Mehr erfahren'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-border-primary dark:border-border-primary">
                    <Button onClick={handleDownloadContext} size="lg" className="flex-1 bg-accent-secondary hover:bg-accent-secondary-hover" leftIcon={<DownloadIcon className="w-5 h-5"/>}>
                        {currentUser ? t('sessionReview_backupContext') : t('sessionReview_downloadContext')}
                    </Button>
                    {!isInterviewReview && (
                        <Button onClick={handleContinue} disabled={isSaving} loading={isSaving} size="lg" className="flex-1">
                            {primaryActionText}
                        </Button>
                    )}
                    <Button onClick={handleSwitch} disabled={isSaving} loading={isSaving} variant="outline" size="lg" className="flex-1">
                        {secondaryActionText}
                    </Button>
                </div>
                 <div className="text-center pt-4">
                    <button onClick={onReturnToStart} className="text-sm text-content-subtle dark:text-content-subtle hover:underline">
                        {t('sessionReview_startOver')}
                    </button>
                </div>
            </div>

            {/* Date Picker Modal for manual date selection */}
            {datePickerModal && (
                <DatePickerModal
                    isOpen={datePickerModal.isOpen}
                    action={datePickerModal.action}
                    suggestedDate={null}
                    onConfirm={handleDatePickerConfirm}
                    onCancel={handleDatePickerCancel}
                />
            )}
            
            {/* DPFL Comfort Check Modal */}
            {showComfortCheck && (
                <ComfortCheckModal
                    chatHistory={chatHistory}
                    sessionId={sessionId}
                    coachingMode={currentUser?.coachingMode}
                    onComplete={() => {
                        setShowComfortCheck(false);
                        // After comfort check, show refinement modal if there are suggestions
                        if (refinementPreview?.refinementResult?.hasSuggestions) {
                            setShowRefinementModal(true);
                        }
                        // In test mode, automatically return to admin console and open test runner
                        if (isTestMode && onReturnToAdmin) {
                            setTimeout(() => {
                                onReturnToAdmin({ openTestRunner: true });
                            }, 500); // Small delay for smooth UX
                        }
                    }}
                    encryptionKey={encryptionKey}
                />
            )}
            
            {/* DPFL Profile Refinement Modal */}
            {showRefinementModal && (
                <ProfileRefinementModal
                    isOpen={showRefinementModal}
                    refinementPreview={refinementPreview || null}
                    isLoading={isLoadingRefinementPreview}
                    error={refinementPreviewError}
                    isTestMode={isTestMode}
                    onAccept={() => {
                        // In test mode: just show feedback, no actual save
                        // In production: would save the refinement via API
                        setShowRefinementModal(false);
                        // Toast or notification could be added here
                    }}
                    onReject={() => {
                        setShowRefinementModal(false);
                    }}
                />
            )}
        </div>
    );
};

export default SessionReview;