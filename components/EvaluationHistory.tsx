import React, { useState, useEffect } from 'react';
import { useLocalization } from '../context/LocalizationContext';
import { TranscriptEvaluationSummary, TranscriptEvaluationResult, TranscriptPreAnswers } from '../types';
import { getTranscriptEvaluations, deleteTranscriptEvaluation } from '../services/geminiService';
import EvaluationReview from './EvaluationReview';
import EvaluationRating from './EvaluationRating';
import Spinner from './shared/Spinner';
import { exportTranscriptEvaluationPDF } from '../utils/transcriptEvaluationPDF';

interface EvaluationHistoryProps {
    onBack: () => void;
    currentUser?: { email?: string; isPremium?: boolean; isClient?: boolean; isAdmin?: boolean; isDeveloper?: boolean; unlockedCoaches?: string[] };
    onStartSession?: (botId: string, examplePrompt: string) => void;
}

const EvaluationHistory: React.FC<EvaluationHistoryProps> = ({ onBack, currentUser, onStartSession }) => {
    const { t, language } = useLocalization();
    const [evaluations, setEvaluations] = useState<TranscriptEvaluationSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEval, setSelectedEval] = useState<TranscriptEvaluationSummary | null>(null);
    const [exportingId, setExportingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchEvaluations = async () => {
            try {
                const data = await getTranscriptEvaluations();
                setEvaluations(data);
            } catch (error) {
                console.error('Failed to fetch evaluations:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchEvaluations();
    }, []);

    const handleExportPDF = async (evalItem: TranscriptEvaluationSummary, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening detail view
        setExportingId(evalItem.id);
        try {
            await exportTranscriptEvaluationPDF(
                evalItem.evaluationData,
                evalItem.preAnswers,
                currentUser?.email,
                language as 'de' | 'en'
            );
        } catch (error) {
            console.error('PDF export failed:', error);
            alert(t('te_export_error'));
        } finally {
            setExportingId(null);
        }
    };

    const handleDelete = async (evalItem: TranscriptEvaluationSummary, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening detail view

        const confirmMessage = 'Are you sure you want to delete this evaluation? This action cannot be undone.';

        if (!confirm(confirmMessage)) return;

        setDeletingId(evalItem.id);
        try {
            await deleteTranscriptEvaluation(evalItem.id);
            // Remove from local state
            setEvaluations(prev => prev.filter(e => e.id !== evalItem.id));
        } catch (error) {
            console.error('Delete failed:', error);
            const errorMessage = 'Delete failed. Please try again.';
            alert(errorMessage);
        } finally {
            setDeletingId(null);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    // Detail view
    if (selectedEval) {
        return (
            <div>
                <div className="max-w-3xl mx-auto px-4 pt-6">
                    <button
                        onClick={() => setSelectedEval(null)}
                        className="mb-2 text-sm text-content-secondary hover:text-content-primary transition-colors"
                    >
                        ← {t('te_history_back')}
                    </button>
                </div>
                <EvaluationReview
                    evaluation={selectedEval.evaluationData}
                    preAnswers={selectedEval.preAnswers}
                    currentUser={currentUser}
                    onDone={() => setSelectedEval(null)}
                    onStartSession={onStartSession}
                />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-6">
            <button
                onClick={onBack}
                className="mb-4 text-sm text-content-secondary hover:text-content-primary transition-colors"
            >
                ← {t('te_input_back')}
            </button>

            <h2 className="text-2xl font-bold text-content-primary mb-6">{t('te_history_title')}</h2>

            {evaluations.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-4xl mb-3">📋</div>
                    <p className="text-content-secondary">{t('te_history_empty')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {evaluations.map((evalItem) => {
                        const date = new Date(evalItem.createdAt);
                        const dateStr = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                        const scoreColor = evalItem.overallScore >= 7 ? 'text-green-600 dark:text-green-400'
                            : evalItem.overallScore >= 4 ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-600 dark:text-red-400';
                        const isExpanded = expandedIds.has(evalItem.id);

                        return (
                            <div
                                key={evalItem.id}
                                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-background-secondary dark:bg-transparent hover:border-accent-primary hover:shadow-md transition-all"
                            >
                                {/* Header - Always visible, clickable to expand */}
                                <div
                                    onClick={() => toggleExpand(evalItem.id)}
                                    className="p-4 cursor-pointer flex items-start justify-between gap-3"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-content-secondary">{dateStr}</span>
                                            <span className={`text-sm font-bold ${scoreColor}`}>
                                                {t('te_history_score')}: {evalItem.overallScore}/10
                                            </span>
                                        </div>
                                        {evalItem.preAnswers.situationName && (
                                            <p className="text-sm font-bold text-content-primary mb-1">{evalItem.preAnswers.situationName}</p>
                                        )}
                                        <p className="text-sm text-content-secondary truncate">
                                            <span className="font-medium text-content-primary">{t('te_pre_q1_label')}:</span> {evalItem.goal}
                                        </p>
                                    </div>

                                    {/* Expand/Collapse Icon */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleExpand(evalItem.id);
                                        }}
                                        className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
                                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                    >
                                        <svg
                                            className={`w-5 h-5 text-content-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-0 space-y-3">
                                        {/* Summary */}
                                        <p className="text-xs text-content-secondary">{evalItem.summary}</p>

                                        {/* Vorreflexions-Details */}
                                        <div className="grid grid-cols-1 gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                            <p className="text-xs text-content-secondary">
                                                <span className="font-semibold text-content-primary">{t('te_pre_q2_label')}:</span> {evalItem.preAnswers.personalTarget}
                                            </p>
                                            <p className="text-xs text-content-secondary">
                                                <span className="font-semibold text-content-primary">{t('te_pre_q3_label')}:</span> {evalItem.preAnswers.assumptions}
                                            </p>
                                            <p className="text-xs text-content-secondary">
                                                <span className="font-semibold text-content-primary">{t('te_pre_q4_label')}:</span> {evalItem.preAnswers.satisfaction}/5
                                            </p>
                                            {evalItem.preAnswers.difficult && (
                                                <p className="text-xs text-content-secondary">
                                                    <span className="font-semibold text-content-primary">{t('te_pre_q5_label')}:</span> {evalItem.preAnswers.difficult}
                                                </p>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-600">
                                            {/* View Details Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedEval(evalItem);
                                                }}
                                                className="flex-1 py-2 px-3 rounded-lg text-sm font-medium text-white bg-accent-primary hover:bg-accent-primary/90 transition-colors"
                                            >
                                                {t('te_history_view_details') || 'Details anzeigen'}
                                            </button>

                                            {/* PDF Export - für Premium, Clients, Admins und Developers */}
                                            {(currentUser?.isPremium || currentUser?.isClient || currentUser?.isAdmin || currentUser?.isDeveloper) && (
                                                <button
                                                    onClick={(e) => handleExportPDF(evalItem, e)}
                                                    disabled={exportingId === evalItem.id}
                                                    className="py-2 px-3 rounded-lg text-sm font-medium text-accent-primary bg-white dark:bg-gray-800 border border-accent-primary hover:bg-accent-primary hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title={t('te_export_pdf')}
                                                >
                                                    {exportingId === evalItem.id ? (
                                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            )}

                                            {/* Delete Button - kleines Icon */}
                                            <button
                                                onClick={(e) => handleDelete(evalItem, e)}
                                                disabled={deletingId === evalItem.id}
                                                className="py-2 px-3 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title={t('delete') || 'Löschen'}
                                            >
                                                {deletingId === evalItem.id ? (
                                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>

                                        {/* Rating Section */}
                                        <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                                            <EvaluationRating
                                                evaluationId={evalItem.id}
                                                existingRating={evalItem.userRating}
                                                existingFeedback={evalItem.userFeedback}
                                                existingContactOptIn={evalItem.contactOptIn}
                                                onRated={async () => {
                                                    // Refresh list to show updated rating
                                                    try {
                                                        const data = await getTranscriptEvaluations();
                                                        setEvaluations(data);
                                                    } catch (error) {
                                                        console.error('Failed to refresh evaluations:', error);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default EvaluationHistory;
