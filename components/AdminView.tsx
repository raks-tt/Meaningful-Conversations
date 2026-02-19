import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useModalOpen } from '../utils/modalUtils';
import * as userService from '../services/userService';
import { User, Ticket, Feedback } from '../types';
import { apiFetch, loadPersonalityProfile } from '../services/api';
import { useLocalization } from '../context/LocalizationContext';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import Spinner from './shared/Spinner';
import { BOTS } from '../constants';
import { CheckIcon } from './icons/CheckIcon';
import { DeleteIcon } from './icons/DeleteIcon';
import { UsersIcon } from './icons/UsersIcon';
import { KeyIcon } from './icons/KeyIcon';
import { InboxIcon } from './icons/InboxIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { XIcon } from './icons/XIcon';
import { StarIcon } from './icons/StarIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { WarningIcon } from './icons/WarningIcon';
import { ChatBubbleIcon } from './icons/ChatBubbleIcon';
import { RepeatIcon } from './icons/RepeatIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ChevronUpIcon } from './icons/ChevronUpIcon';
import { UserPlusIcon } from './icons/UserPlusIcon';
import { UnlockIcon } from './icons/UnlockIcon';
import { ActivityIcon } from './icons/ActivityIcon';
import { DollarIcon } from './icons/DollarIcon';
import { getTestScenarios } from '../utils/testScenarios';
import type { TestScenario } from '../utils/testScenarios';
import { ApiUsageView } from './ApiUsageView';
import NewsletterPanel from './NewsletterPanel';
import TestRunner from './TestRunner';
import TranscriptRatingsView from './TranscriptRatingsView';

interface AdminViewProps {
    currentUser: User | null;
    encryptionKey: CryptoKey | null;
    onRunTestSession: (scenario: TestScenario, adminLifeContext: string) => void;
    onTestComfortCheck?: (withConversationalEnd: boolean) => void;
    lifeContext: string;
    shouldOpenTestRunner?: boolean;
    onTestRunnerOpened?: () => void;
}

type AdminTab = 'users' | 'tickets' | 'feedback' | 'runner' | 'api-usage';
type UserSortKeys = 'email' | 'createdAt' | 'roles' | 'profile' | 'loginCount' | 'xp' | 'lastLogin';

interface GuestLoginStats {
    dateRange: {
        start: string;
        end: string;
    };
    totalCount: number;
    daily: Array<{
        date: string;
        count: number;
    }>;
}

const ResetPasswordSuccessModal: React.FC<{
    data: { email: string; newPass: string };
    onClose: () => void;
}> = ({ data, onClose }) => {
    const { t } = useLocalization();
    useModalOpen();
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(data.newPass).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const description = t('admin_reset_success_desc', { email: data.email });

    return createPortal(
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4" 
            style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div 
                className="bg-white dark:bg-gray-900 w-full max-w-md p-6 border border-gray-300 dark:border-gray-700 shadow-xl rounded-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-200">{t('admin_reset_success_title')}</h2>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-400">
                        {description}
                    </p>
                    <div className="p-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4">
                        <span className="font-mono text-lg text-gray-800 dark:text-gray-200">{data.newPass}</span>
                        <button 
                            onClick={handleCopy}
                            className="flex items-center gap-2 px-3 py-1 text-xs font-bold text-button-foreground-on-accent bg-accent-primary uppercase hover:bg-accent-primary-hover disabled:bg-gray-400 rounded-lg shadow-md"
                        >
                            {isCopied ? <CheckIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}
                            {isCopied ? t('admin_code_copied') : t('admin_copy_code')}
                        </button>
                    </div>
                </div>
                <div className="mt-6 text-right">
                    <button onClick={onClose} className="px-6 py-2 text-base font-bold text-gray-600 dark:text-gray-400 bg-transparent border border-gray-400 dark:border-gray-700 uppercase hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg shadow-md">
                        {t('modal_close')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const ResetConfirmationModal: React.FC<{
    user: User;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ user, onConfirm, onCancel }) => {
    const { t } = useLocalization();
    useModalOpen();

    return createPortal(
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4" 
            style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
            onClick={onCancel}
            role="dialog"
            aria-modal="true"
        >
            <div 
                className="bg-white dark:bg-gray-900 w-full max-w-lg p-6 border border-status-warning-border dark:border-status-warning-border/50 shadow-xl rounded-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                        <WarningIcon className="w-8 h-8 text-status-warning-foreground" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-200">{t('admin_users_reset_password')}</h2>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                          {t('admin_reset_confirm_part1')}<strong>{user.email}</strong>{t('admin_reset_confirm_part2')}
                        </p>
                        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg">
                            <div className="flex items-start gap-3">
                                <div className="text-2xl mt-0.5">⚠️</div>
                                <div>
                                    <p className="font-bold text-content-primary">{t('admin_reset_confirm_warning_title')}</p>
                                    <p className="text-sm text-content-secondary">{t('admin_reset_confirm_warning_desc')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={onCancel} className="px-6 py-2 text-base font-bold text-gray-600 dark:text-gray-400 bg-transparent border border-gray-400 dark:border-gray-700 uppercase hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg shadow-md">
                        {t('deleteAccount_cancel')}
                    </button>
                    <button onClick={onConfirm} className="px-6 py-2 text-base font-bold text-white bg-red-600 uppercase hover:bg-red-700 rounded-lg shadow-md">
                        {t('admin_users_reset_password')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const FeedbackTableRow: React.FC<{ item: Feedback }> = ({ item }) => {
    const { t } = useLocalization();
    const [isCommentExpanded, setIsCommentExpanded] = useState(false);
    const bot = BOTS.find(b => b.id === item.botId);

    const COMMENT_TRUNCATE_LENGTH = 50;
    const hasComment = item.comments && item.comments.trim().length > 0;
    const isLongComment = hasComment && item.comments.length > COMMENT_TRUNCATE_LENGTH;


    return (
        <>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="p-3 align-top">
                    {item.rating != null && (
                        <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(star => (
                                <StarIcon key={star} className={`w-4 h-4 ${star <= item.rating! ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} fill={star <= item.rating! ? 'currentColor' : 'none'} />
                            ))}
                        </div>
                    )}
                </td>
                <td className="p-3 align-top whitespace-normal break-words text-gray-800 dark:text-gray-200">
                     {isLongComment ? (
                        <button onClick={() => setIsCommentExpanded(p => !p)} className="flex items-start gap-2 text-left text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                            <ChatBubbleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <span className="italic">
                                {item.comments.substring(0, COMMENT_TRUNCATE_LENGTH)}...
                            </span>
                        </button>
                    ) : (
                        hasComment ? <p>{item.comments}</p> : <span className="italic text-gray-400 dark:text-gray-500">{t('admin_feedback_no_comment')}</span>
                    )}
                </td>
                <td className="p-3 align-top whitespace-normal break-words text-gray-600 dark:text-gray-400">{bot?.name || item.botId}</td>
                <td className="p-3 align-top whitespace-normal break-all text-gray-600 dark:text-gray-400">
                    {!item.user
                        ? <span className="italic">{t('admin_feedback_guest')}</span>
                        : item.isAnonymous
                            ? <span className="italic">{t('admin_feedback_anonymous')}</span>
                            : item.user.email
                    }
                </td>
                <td className="p-3 align-top text-gray-600 dark:text-gray-400">{new Date(item.createdAt).toLocaleString()}</td>
            </tr>
            {isCommentExpanded && (
                <tr className="bg-gray-50 dark:bg-gray-900/30 animate-fadeIn">
                    <td colSpan={5} className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <h5 className="font-bold text-gray-600 dark:text-gray-300 text-sm mb-1">{t('admin_feedback_full_comment')}</h5>
                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{item.comments}</p>
                    </td>
                </tr>
            )}
        </>
    );
};

const AdminView: React.FC<AdminViewProps> = ({ currentUser, encryptionKey, onRunTestSession, onTestComfortCheck, lifeContext, shouldOpenTestRunner, onTestRunnerOpened }) => {
    const { t } = useLocalization();
    const [activeTab, setActiveTab] = useState<AdminTab>('users');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isUsersExpanded, setIsUsersExpanded] = useState(false);
    const [isNewsletterExpanded, setIsNewsletterExpanded] = useState(false);
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

    const [users, setUsers] = useState<User[]>([]);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [feedback, setFeedback] = useState<Feedback[]>([]);
    const [guestLoginStats, setGuestLoginStats] = useState<GuestLoginStats | null>(null);
    const [showGuestLoginDetails, setShowGuestLoginDetails] = useState(false);

    const [userSortConfig, setUserSortConfig] = useState<{ key: UserSortKeys; direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' });

    const testScenarios = useMemo(() => getTestScenarios(t), [t]);

    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [profileFilter, setProfileFilter] = useState<'all' | 'with' | 'without'>('all');
    const [resetSuccessData, setResetSuccessData] = useState<{ email: string; newPass: string } | null>(null);
    const [userToReset, setUserToReset] = useState<User | null>(null);
    const [selectedBotFilter, setSelectedBotFilter] = useState<string | null>(null);
    const [selectedScenarioId, setSelectedScenarioId] = useState<string>(testScenarios[0]?.id || '');
    const [adminProfileType, setAdminProfileType] = useState<'RIEMANN' | 'BIG5' | null>(null);
    const [showMismatchWarning, setShowMismatchWarning] = useState(false);
    const [pendingScenario, setPendingScenario] = useState<TestScenario | null>(null);
    const [showDynamicTestRunner, setShowDynamicTestRunner] = useState(false);
    const [adminPersonalityProfile, setAdminPersonalityProfile] = useState<any>(null);
    useModalOpen(showMismatchWarning);


    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const [usersData, ticketsData, feedbackData, guestLoginData] = await Promise.all([
                userService.getAdminUsers(),
                userService.getAdminTickets(),
                userService.getAdminFeedback(),
                apiFetch('/analytics/guest-logins/stats'),
            ]);
            setUsers(usersData.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()));
            setTickets(ticketsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            setFeedback(feedbackData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            setGuestLoginStats(guestLoginData);
        } catch (err: any) {
            setError(err.message || 'Failed to load admin data.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Auto-open Test Runner if requested (e.g., after Comfort Check test) - Developer only
    useEffect(() => {
        if (shouldOpenTestRunner && currentUser?.isDeveloper) {
            setShowDynamicTestRunner(true);
            onTestRunnerOpened?.(); // Reset the flag in parent
        }
    }, [shouldOpenTestRunner, onTestRunnerOpened, currentUser?.isDeveloper]);

    // Load admin's profile type and full profile for test scenario matching
    useEffect(() => {
        const loadProfileData = async () => {
            try {
                const profile = await loadPersonalityProfile();
                if (profile) {
                    if (profile.testType) {
                        setAdminProfileType(profile.testType as 'RIEMANN' | 'BIG5');
                    }
                    // Store full profile for TestRunner's "My Profile" option
                    setAdminPersonalityProfile(profile);
                }
            } catch (err) {
                // No profile - that's okay
                setAdminProfileType(null);
                setAdminPersonalityProfile(null);
            }
        };
        if (currentUser) {
            loadProfileData();
        }
    }, [currentUser]);

    const handleAction = async (id: string, action: () => Promise<any>) => {
        setActionLoading(prev => ({ ...prev, [id]: true }));
        try {
            await action();
            await loadData(); // Reload all data to ensure consistency
        } catch (err: any) {
            alert(`Action failed: ${err.message}`);
        } finally {
            setActionLoading(prev => ({ ...prev, [id]: false }));
        }
    };

    const MessageReportTableRow: React.FC<{ item: Feedback }> = ({ item }) => {
        const bot = BOTS.find(b => b.id === item.botId);
        const [isExpanded, setIsExpanded] = useState(false);
    
        return (
            <>
                <tr 
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                    onClick={() => setIsExpanded(p => !p)}
                >
                    <td className="p-3 align-top whitespace-normal break-words text-gray-800 dark:text-gray-200">
                        {item.comments ? <p>{item.comments}</p> : <span className="italic text-gray-400 dark:text-gray-500">{t('admin_feedback_no_comment')}</span>}
                    </td>
                    <td className="p-3 align-top whitespace-normal break-words text-gray-600 dark:text-gray-400">{bot?.name || item.botId}</td>
                    <td className="p-3 align-top whitespace-normal break-all text-gray-600 dark:text-gray-400">
                        {!item.user
                            ? <span className="italic">{t('admin_feedback_guest')}</span>
                            : item.isAnonymous
                                ? <span className="italic">{t('admin_feedback_anonymous')}</span>
                                : item.user.email
                        }
                    </td>
                    <td className="p-3 align-top text-gray-600 dark:text-gray-400">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="p-3 align-top text-right">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAction(`delete-report-${item.id}`, () => userService.deleteMessageReport(item.id));
                            }}
                            disabled={actionLoading[`delete-report-${item.id}`]}
                            className="p-2 text-status-danger-foreground rounded-full hover:bg-status-danger-background disabled:opacity-50" 
                            title={t('admin_codes_delete')}
                        >
                            <DeleteIcon className="w-5 h-5" />
                        </button>
                    </td>
                </tr>
                {isExpanded && (
                    <tr className="bg-gray-50 dark:bg-gray-900/30 animate-fadeIn">
                        <td colSpan={5} className="p-4 border-b border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h5 className="font-bold text-gray-600 dark:text-gray-300 text-sm mb-1">{t('admin_feedback_user_prompt')}</h5>
                                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                        {item.lastUserMessage || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <h5 className="font-bold text-gray-600 dark:text-gray-300 text-sm mb-1">{t('admin_feedback_bot_response')}</h5>
                                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                        {item.botResponse || 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                )}
            </>
        );
    };

    const confirmAndResetPassword = async () => {
        if (!userToReset) return;
        const user = userToReset;
        setUserToReset(null); // Close confirmation modal
        
        const actionId = `reset-${user.id}`;
        setActionLoading(prev => ({ ...prev, [actionId]: true }));
        try {
            const { newPassword } = await userService.resetUserPassword(user.id);
            setResetSuccessData({ email: user.email, newPass: newPassword });
        } catch (err: any) {
            alert(`Password reset failed: ${err.message}`);
        } finally {
            setActionLoading(prev => ({ ...prev, [actionId]: false }));
        }
    };


    const handleCreateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleAction('createCode', () => userService.createUpgradeCode(newCodeBotId, codeReferrer || undefined));
    };

    const handleBulkGenerate = async () => {
        if (bulkQuantity < 1 || bulkQuantity > 100) {
            alert('Quantity must be between 1 and 100.');
            return;
        }

        setActionLoading(prev => ({ ...prev, 'bulkGenerate': true }));
        try {
            const result = await userService.createBulkUpgradeCodes(newCodeBotId, bulkQuantity, codeReferrer || undefined);
            setGeneratedBulkCodes(result.codes);
            await loadData(); // Refresh codes list
            alert(t('admin_codes_bulk_success', { count: result.count }));
        } catch (err: any) {
            alert(`Bulk generation failed: ${err.message}`);
        } finally {
            setActionLoading(prev => ({ ...prev, 'bulkGenerate': false }));
        }
    };

    const downloadCSV = () => {
        if (!generatedBulkCodes || generatedBulkCodes.length === 0) return;

        const productName = getUnlockName(generatedBulkCodes[0].botId);
        const referrer = generatedBulkCodes[0].referrer || '';
        const csvContent = [
            ['Code', 'Product', 'Referrer', 'Created', 'Status'].join(','),
            ...generatedBulkCodes.map(c => [
                c.code,
                productName,
                referrer,
                new Date(c.createdAt).toLocaleString(),
                'Available'
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const filePrefix = referrer ? `codes_${referrer}_` : `codes_`;
        link.href = URL.createObjectURL(blob);
        link.download = `${filePrefix}${newCodeBotId}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };
    
    const handleCopyCode = (codeValue: string, codeId: string) => {
        navigator.clipboard.writeText(codeValue);
        setCopiedCodeId(codeId);
        setTimeout(() => setCopiedCodeId(null), 2000);
    };

    const filteredUsers = useMemo(() => {
        let result = users;
        if (userSearchQuery) {
            result = result.filter(user => user.email.toLowerCase().includes(userSearchQuery.toLowerCase()));
        }
        if (profileFilter === 'with') {
            result = result.filter(user => user.hasProfile);
        } else if (profileFilter === 'without') {
            result = result.filter(user => !user.hasProfile);
        }
        return result;
    }, [users, userSearchQuery, profileFilter]);

    const sortedAndFilteredUsers = useMemo(() => {
        let sortableUsers = [...filteredUsers];
        if (userSortConfig !== null) {
            sortableUsers.sort((a, b) => {
                let compare = 0;
                switch (userSortConfig.key) {
                    case 'email': {
                        compare = a.email.localeCompare(b.email);
                        break;
                    }
                    case 'createdAt': {
                        const aValue = new Date(a.createdAt!).getTime();
                        const bValue = new Date(b.createdAt!).getTime();
                        compare = aValue - bValue;
                        break;
                    }
                    case 'roles': {
                        // Sort by developer first, then admin, then client, then premium
                        const aValue = (a.isDeveloper ? 8 : 0) + (a.isAdmin ? 4 : 0) + (a.isClient ? 2 : 0) + (a.isPremium ? 1 : 0);
                        const bValue = (b.isDeveloper ? 8 : 0) + (b.isAdmin ? 4 : 0) + (b.isClient ? 2 : 0) + (b.isPremium ? 1 : 0);
                        compare = aValue - bValue;
                        break;
                    }
                    case 'profile': {
                        const aValue = (a.completedLenses?.length || 0);
                        const bValue = (b.completedLenses?.length || 0);
                        compare = aValue - bValue;
                        break;
                    }
                    case 'loginCount': {
                        const aValue = a.loginCount || 0;
                        const bValue = b.loginCount || 0;
                        compare = aValue - bValue;
                        break;
                    }
                    case 'xp': {
                        let aXp = 0;
                        let bXp = 0;
                        try {
                            if (a.gamificationState) {
                                const state = JSON.parse(a.gamificationState);
                                aXp = state.xp || 0;
                            }
                        } catch (e) {
                            // Silent fail
                        }
                        try {
                            if (b.gamificationState) {
                                const state = JSON.parse(b.gamificationState);
                                bXp = state.xp || 0;
                            }
                        } catch (e) {
                            // Silent fail
                        }
                        compare = aXp - bXp;
                        break;
                    }
                    case 'lastLogin': {
                        const aValue = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
                        const bValue = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
                        compare = aValue - bValue;
                        break;
                    }
                }
                return userSortConfig.direction === 'asc' ? compare : -compare;
            });
        }
        return sortableUsers;
    }, [filteredUsers, userSortConfig]);

    const filteredCodes = useMemo(() => {
        const trimmedFilter = codeEmailFilter.trim().toLowerCase();
        if (!trimmedFilter) return codes;
        return codes.filter(code => 
            code.usedBy && code.usedBy.email.toLowerCase().includes(trimmedFilter)
        );
    }, [codes, codeEmailFilter]);

    const getUnlockName = useCallback((botId: string): string => {
        if (botId === 'REGISTERED_LIFETIME') return t('admin_codes_registered_lifetime');
        if (botId === 'ACCESS_PASS_1Y') return t('admin_codes_unlock_access_pass');
        if (botId === 'ACCESS_PASS_3M') return t('admin_codes_unlock_access_pass_3m');
        if (botId === 'ACCESS_PASS_1M') return t('admin_codes_unlock_access_pass_1m');
        if (botId === 'premium') return t('admin_codes_unlock_premium');
        if (botId === 'client') return t('admin_codes_unlock_client');
        if (botId === 'big5') return t('admin_codes_unlock_big5');
        const bot = BOTS.find(b => b.id === botId);
        return bot?.name || botId;
    }, [t]);

    const sortedAndFilteredCodes = useMemo(() => {
        let sortableItems = [...filteredCodes];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let compare = 0;
                switch (sortConfig.key) {
                    case 'unlocks': {
                        const aValue = getUnlockName(a.botId);
                        const bValue = getUnlockName(b.botId);
                        compare = aValue.localeCompare(bValue);
                        break;
                    }
                    case 'createdAt': {
                        const aValue = new Date(a.createdAt).getTime();
                        const bValue = new Date(b.createdAt).getTime();
                        compare = aValue - bValue;
                        break;
                    }
                    case 'usage': {
                        const aValue = a.isUsed ? (a.usedBy?.email || 'Used') : 'Available';
                        const bValue = b.isUsed ? (b.usedBy?.email || 'Used') : 'Available';
                        compare = aValue.localeCompare(bValue);
                        break;
                    }
                }
                return sortConfig.direction === 'asc' ? compare : -compare;
            });
        }
        return sortableItems;
    }, [filteredCodes, sortConfig, getUnlockName]);

    const requestSort = (key: CodeSortKeys) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const requestUserSort = (key: UserSortKeys) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (userSortConfig && userSortConfig.key === key && userSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setUserSortConfig({ key, direction });
    };

    const tabConfig: Record<AdminTab, { icon: React.FC<any>, key: string }> = {
        users: { icon: UsersIcon, key: 'admin_users_tab' },
        tickets: { icon: InboxIcon, key: 'admin_tickets_tab' },
        feedback: { icon: StarIcon, key: 'admin_ratings_tab' },
        runner: { icon: ActivityIcon, key: 'admin_runner_tab' },
        'api-usage': { icon: DollarIcon, key: 'admin_api_usage_tab' },
    };

    const sessionFeedback = useMemo(() => feedback.filter(item => item.rating !== null), [feedback]);
    const messageReports = useMemo(() => feedback.filter(item => item.rating === null), [feedback]);

    const ratingStats = useMemo(() => {
        const statsByBot = BOTS
            .filter(bot => bot.id !== 'gloria-life-context')
            .reduce((acc, bot) => {
            acc[bot.id] = {
                id: bot.id,
                name: bot.name,
                avatar: bot.avatar,
                ratings: [] as number[],
                count: 0,
                distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
            };
            return acc;
        }, {} as Record<string, { id: string; name: string; avatar: string; ratings: number[]; count: number; distribution: Record<string, number> }>);

        let totalRatings = 0;
        let totalSum = 0;

        sessionFeedback.forEach(item => {
            if (item.rating && item.rating >= 1 && item.rating <= 5 && statsByBot[item.botId]) {
                const ratingKey = String(item.rating);
                statsByBot[item.botId].ratings.push(item.rating);
                statsByBot[item.botId].count++;
                statsByBot[item.botId].distribution[ratingKey]++;
                totalRatings++;
                totalSum += item.rating;
            }
        });

        const overallAverage = totalRatings > 0 ? (totalSum / totalRatings).toFixed(2) : 'N/A';

        const botStats = Object.values(statsByBot).map(botStat => {
            const sum = botStat.ratings.reduce((a, b) => a + b, 0);
            const average = botStat.count > 0 ? (sum / botStat.count).toFixed(2) : 'N/A';
            return { ...botStat, average };
        }).sort((a,b) => b.count - a.count);

        return { botStats, overallAverage, totalRatings };
    }, [sessionFeedback]);
    
    const filteredFeedback = useMemo(() => {
        if (!selectedBotFilter) return sessionFeedback;
        return sessionFeedback.filter(item => item.botId === selectedBotFilter);
    }, [sessionFeedback, selectedBotFilter]);

    const renderTabs = () => (
        <div className="flex justify-around border-b border-gray-300 dark:border-gray-700">
            {(['users', 'feedback', 'tickets', ...(currentUser?.isDeveloper ? ['runner'] as AdminTab[] : []), 'api-usage'] as AdminTab[]).map(tab => {
                const { icon: Icon, key } = tabConfig[tab];
                let textClass = 'whitespace-pre-line text-center leading-tight';
                if (tab === 'runner' || tab === 'api-usage') {
                    textClass += ' hidden lg:inline';
                } else if (tab === 'tickets' || tab === 'feedback') {
                    textClass += ' hidden md:inline';
                } else {
                    textClass += ' hidden sm:inline';
                }

                return (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-2 md:px-4 py-3 text-xs font-bold uppercase transition-colors focus:outline-none ${
                            activeTab === tab
                                ? 'border-b-2 border-accent-primary text-content-primary'
                                : 'text-content-subtle hover:bg-background-tertiary'
                        }`}
                        aria-label={t(key)}
                    >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className={textClass}>{t(key)}</span>
                    </button>
                )
            })}
        </div>
    );
    
    const renderUsers = () => (
        <div className="space-y-4">
            {/* Users Section Header */}
            <button
                onClick={() => setIsUsersExpanded(!isUsersExpanded)}
                className="w-full flex items-center justify-between p-4 bg-background-secondary dark:bg-background-tertiary border border-border-primary rounded-lg hover:bg-background-tertiary dark:hover:bg-gray-800 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <UsersIcon className="w-6 h-6 text-content-primary" />
                    <h2 className="text-lg font-bold text-content-primary">{t('admin_users_title')}</h2>
                    <span className="text-sm text-content-subtle">({users.length})</span>
                </div>
                {isUsersExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
            </button>

            {isUsersExpanded && (
                <div className="space-y-4 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                            type="search"
                            value={userSearchQuery}
                            onChange={e => setUserSearchQuery(e.target.value)}
                            placeholder={t('admin_search_users_placeholder')}
                            className="flex-1 p-3 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-accent-primary rounded-lg"
                        />
                        <div className="flex gap-1">
                            {(['all', 'with', 'without'] as const).map(f => (
                                <button key={f} onClick={() => setProfileFilter(f)}
                                    title={t(`admin_users_profile_filter_${f}`)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                        profileFilter === f
                                            ? 'bg-accent-primary text-white'
                                            : 'bg-background-secondary text-content-secondary hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}>
                                    <span className="sm:hidden">{f === 'all' ? '👥' : f === 'with' ? '🧠' : '∅'}</span>
                                    <span className="hidden sm:inline">{t(`admin_users_profile_filter_${f}`)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    {filteredUsers.length > 0 ? (
                <div className={`overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg shadow-md overflow-hidden ${filteredUsers.length > 5 ? 'max-h-96 overflow-y-auto' : ''}`}>
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 uppercase text-xs text-gray-500 dark:text-gray-400 sticky top-0">
                            <tr>
                                <th className="p-3">
                                    <button onClick={() => requestUserSort('email')} className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                                        {t('admin_users_email')}
                                        {userSortConfig?.key === 'email' && (userSortConfig.direction === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />)}
                                    </button>
                                </th>
                                <th className="p-3">
                                    <button onClick={() => requestUserSort('createdAt')} className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                                        {t('admin_users_joined')}
                                        {userSortConfig?.key === 'createdAt' && (userSortConfig.direction === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />)}
                                    </button>
                                </th>
                                <th className="p-3">
                                    <button onClick={() => requestUserSort('roles')} className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                                        {t('admin_users_roles')}
                                        {userSortConfig?.key === 'roles' && (userSortConfig.direction === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />)}
                                    </button>
                                </th>
                                <th className="p-3 text-center">
                                    <button onClick={() => requestUserSort('profile')} className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mx-auto">
                                        {t('admin_users_profile')}
                                        {userSortConfig?.key === 'profile' && (userSortConfig.direction === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />)}
                                    </button>
                                </th>
                                <th className="p-3 text-center">
                                    <button onClick={() => requestUserSort('loginCount')} className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mx-auto">
                                        {t('admin_users_logins')}
                                        {userSortConfig?.key === 'loginCount' && (userSortConfig.direction === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />)}
                                    </button>
                                </th>
                                <th className="p-3 text-center">
                                    <button onClick={() => requestUserSort('xp')} className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mx-auto">
                                        {t('admin_users_xp')}
                                        {userSortConfig?.key === 'xp' && (userSortConfig.direction === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />)}
                                    </button>
                                </th>
                                <th className="p-3">
                                    <button onClick={() => requestUserSort('lastLogin')} className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                                        {t('admin_users_last_login')}
                                        {userSortConfig?.key === 'lastLogin' && (userSortConfig.direction === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />)}
                                    </button>
                                </th>
                                <th className="p-3 text-center">{t('admin_users_actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {sortedAndFilteredUsers.map(user => {
                                const isCurrentUser = currentUser?.id === user.id;
                                let userXp = 0;
                                if (user.gamificationState) {
                                    try {
                                        const state = JSON.parse(user.gamificationState);
                                        userXp = state.xp || 0;
                                    } catch (e) {
                                        // Silently fail, userXp remains 0
                                    }
                                }
                                return (
                                    <tr key={user.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${isCurrentUser ? 'bg-status-success-background' : ''} ${user.status === 'PENDING' ? 'bg-status-warning-background' : ''}`}>
                                        <td className="p-3 font-medium text-gray-800 dark:text-gray-200 break-words">{user.email}</td>
                                        <td className="p-3 text-gray-600 dark:text-gray-400">{new Date(user.createdAt!).toLocaleDateString()}</td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-3">
                                                {user.isPremium && (
                                                    <span title={t('admin_users_premium')}>
                                                        <StarIcon className="w-5 h-5 text-status-info-foreground" />
                                                    </span>
                                                )}
                                                {user.isClient && (
                                                    <span title={t('admin_users_client')} className="text-xs font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                                        K
                                                    </span>
                                                )}
                                                {user.isAdmin && (
                                                    <span title={t('admin_users_admin')}>
                                                        <ShieldIcon className="w-5 h-5 text-accent-tertiary" />
                                                    </span>
                                                )}
                                                {user.isDeveloper && (
                                                    <span title={t('admin_users_developer') || 'Developer'} className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                                                        D
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center">
                                            {user.hasProfile ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    {(user.completedLenses || []).map((lens: string) => {
                                                        const label = lens === 'riemann' ? 'R' : lens === 'ocean' ? 'O' : lens === 'sd' ? 'SD' : lens.toUpperCase();
                                                        const colors = lens === 'riemann'
                                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                            : lens === 'ocean'
                                                            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                                                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
                                                        return (
                                                            <span key={lens} title={lens === 'riemann' ? 'Riemann' : lens === 'ocean' ? 'OCEAN / Big Five' : lens === 'sd' ? 'Spiral Dynamics' : lens}
                                                                className={`text-xs font-bold px-1.5 py-0.5 rounded ${colors}`}>
                                                                {label}
                                                            </span>
                                                        );
                                                    })}
                                                    {(user.completedLenses || []).length === 0 && (
                                                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">✓</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 dark:text-gray-600">—</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-gray-600 dark:text-gray-400 text-center">{user.loginCount || 0}</td>
                                        <td className="p-3 text-gray-600 dark:text-gray-400 text-center font-bold">{userXp.toLocaleString()}</td>
                                        <td className="p-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : t('admin_users_never')}</td>
                                        <td className="p-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {user.status === 'PENDING' && (
                                                    <button 
                                                        onClick={() => handleAction(`activate-${user.id}`, () => userService.activateUser(user.id))}
                                                        disabled={actionLoading[`activate-${user.id}`]}
                                                        className="p-2 text-status-success-foreground rounded-full hover:bg-status-success-background disabled:opacity-50" 
                                                        title={t('admin_users_activate')}
                                                    >
                                                        <UnlockIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleAction(`toggle-admin-${user.id}`, () => userService.toggleUserAdmin(user.id))} 
                                                    disabled={actionLoading[`toggle-admin-${user.id}`] || isCurrentUser} 
                                                    className="p-2 text-accent-tertiary rounded-full hover:bg-accent-tertiary/10 disabled:opacity-50 disabled:cursor-not-allowed" 
                                                    title={isCurrentUser ? t('admin_users_cannot_change_self') : t('admin_users_toggle_admin')}
                                                >
                                                    <ShieldIcon className="w-5 h-5" />
                                                </button>
                                                {currentUser?.isDeveloper && (
                                                    <button 
                                                        onClick={() => handleAction(`toggle-developer-${user.id}`, () => userService.toggleUserDeveloper(user.id))} 
                                                        disabled={actionLoading[`toggle-developer-${user.id}`] || isCurrentUser} 
                                                        className="p-2 text-emerald-600 dark:text-emerald-400 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed" 
                                                        title={isCurrentUser ? (t('admin_users_cannot_change_self') || 'Cannot change own role') : (t('admin_users_toggle_developer') || 'Toggle Developer')}
                                                    >
                                                        <span className="text-xs font-bold">D</span>
                                                    </button>
                                                )}
                                                <button onClick={() => setUserToReset(user)} disabled={actionLoading[`reset-${user.id}`]} className="p-2 text-status-warning-foreground rounded-full hover:bg-status-warning-background disabled:opacity-50" title={t('admin_users_reset_password')}><KeyIcon className="w-5 h-5" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <p>{users.length > 0 ? t('admin_no_users_found') : t('admin_no_users_yet')}</p>
                        </div>
                    )}
                </div>
            )}
            
            {/* Newsletter Section Header */}
            <button
                onClick={() => setIsNewsletterExpanded(!isNewsletterExpanded)}
                className="w-full flex items-center justify-between p-4 bg-background-secondary dark:bg-background-tertiary border border-border-primary rounded-lg hover:bg-background-tertiary dark:hover:bg-gray-800 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <InboxIcon className="w-6 h-6 text-content-primary" />
                    <h2 className="text-lg font-bold text-content-primary">{t('admin_newsletter_title')}</h2>
                </div>
                {isNewsletterExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
            </button>

            {isNewsletterExpanded && (
                <div className="animate-fadeIn">
                    <NewsletterPanel />
                </div>
            )}
        </div>
    );
    
    const renderCodes = () => (
        <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 space-y-4 rounded-lg shadow-md">
                 <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">{t('admin_codes_generate_title')}</h3>
                <form onSubmit={handleCreateCode} className="flex flex-col sm:flex-row items-stretch gap-3">
                    <div className="flex-1">
                        <label htmlFor="bot-select" className="sr-only">{t('admin_codes_for_coach')}</label>
                        <select id="bot-select" value={newCodeBotId} onChange={e => setNewCodeBotId(e.target.value)} className="w-full h-full px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-accent-primary">
                            <option disabled>── {t('admin_codes_section_registered')} ──</option>
                            <option value="REGISTERED_LIFETIME">{t('admin_codes_registered_lifetime')}</option>
                            <option disabled>── {t('admin_codes_section_premium')} ──</option>
                            <option value="ACCESS_PASS_1M">{t('admin_codes_unlock_access_pass_1m')}</option>
                            <option value="ACCESS_PASS_3M">{t('admin_codes_unlock_access_pass_3m')}</option>
                            <option value="ACCESS_PASS_1Y">{t('admin_codes_unlock_access_pass')}</option>
                            <option disabled>── Features ──</option>
                            <option value="big5">{t('admin_codes_unlock_big5')}</option>
                            <option disabled>── Coaches ──</option>
                            {botsForCodes.map(bot => {
                                const key = bot.id === 'rob'
                                    ? 'admin_codes_unlock_rob'
                                    : bot.id === 'nexus-gps'
                                    ? 'admin_codes_unlock_nobody'
                                    : '';
                                const displayName = key ? t(key) : bot.name;
                                return <option key={bot.id} value={bot.id}>{displayName}</option>;
                            })}
                            <option disabled>── Status ──</option>
                            <option value="premium">{t('admin_codes_unlock_premium')}</option>
                            <option value="client">{t('admin_codes_unlock_client')}</option>
                        </select>
                    </div>
                    <div className="sm:w-40">
                        <input
                            type="text"
                            value={codeReferrer}
                            onChange={e => setCodeReferrer(e.target.value)}
                            placeholder={t('admin_codes_referrer_placeholder')}
                            maxLength={12}
                            className="w-full h-full px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                        />
                    </div>
                    <button type="submit" disabled={actionLoading['createCode']} className="px-5 py-2 text-base font-bold text-button-foreground-on-accent bg-accent-primary uppercase hover:bg-accent-primary-hover disabled:bg-gray-300 dark:disabled:bg-gray-700 flex items-center justify-center rounded-lg shadow-md">
                        {actionLoading['createCode'] ? <Spinner/> : t('admin_codes_generate')}
                    </button>
                </form>
                
                <hr className="border-gray-300 dark:border-gray-700" />
                
                <div className="space-y-3">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">{t('admin_codes_bulk_generate')}</h3>
                    <div className="flex flex-col sm:flex-row items-stretch gap-3">
                        <div className="flex-1">
                            <label htmlFor="bulk-quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('admin_codes_quantity_label')}
                            </label>
                            <input 
                                id="bulk-quantity"
                                type="number" 
                                min="1" 
                                max="100" 
                                value={bulkQuantity} 
                                onChange={e => setBulkQuantity(parseInt(e.target.value) || 1)}
                                placeholder={t('admin_codes_quantity_placeholder')}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                            />
                        </div>
                        <div className="flex items-end gap-3">
                            <button 
                                type="button"
                                onClick={handleBulkGenerate}
                                disabled={actionLoading['bulkGenerate']}
                                className="px-5 py-2 text-base font-bold text-button-foreground-on-accent bg-accent-secondary uppercase hover:bg-accent-secondary-hover disabled:bg-gray-300 dark:disabled:bg-gray-700 flex items-center justify-center rounded-lg shadow-md whitespace-nowrap"
                            >
                                {actionLoading['bulkGenerate'] ? <Spinner/> : t('admin_codes_bulk_button', { count: bulkQuantity })}
                            </button>
                            {generatedBulkCodes && generatedBulkCodes.length > 0 && (
                                <button 
                                    type="button"
                                    onClick={downloadCSV}
                                    className="px-5 py-2 text-base font-bold text-accent-tertiary-foreground bg-accent-tertiary uppercase hover:bg-accent-tertiary-hover flex items-center gap-2 rounded-lg shadow-md whitespace-nowrap"
                                >
                                    <ClipboardIcon className="w-5 h-5" />
                                    {t('admin_codes_download_csv')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                 <input 
                    type="search"
                    value={codeEmailFilter}
                    onChange={e => setCodeEmailFilter(e.target.value)}
                    placeholder={t('admin_codes_filter_email')}
                    className="w-full p-3 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                />
            </div>
            {codes.length > 0 ? (
                <div className={`overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg shadow-md overflow-hidden ${sortedAndFilteredCodes.length > 5 ? 'max-h-96 overflow-y-auto' : ''}`}>
                    <table className="w-full text-left text-sm">
                         <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 dark:text-gray-400 sticky top-0">
                            <tr>
                                <th className="p-3 uppercase">{t('admin_codes_code')}</th>
                                <th className="p-3 uppercase">
                                    <button onClick={() => requestSort('unlocks')} className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                                        {t('admin_codes_unlocks')}
                                        {sortConfig?.key === 'unlocks' && (sortConfig.direction === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />)}
                                    </button>
                                </th>
                                <th className="p-3 uppercase">{t('admin_codes_referrer')}</th>
                                <th className="p-3 uppercase">
                                    <button onClick={() => requestSort('createdAt')} className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                                        {t('admin_codes_created')}
                                        {sortConfig?.key === 'createdAt' && (sortConfig.direction === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />)}
                                    </button>
                                </th>
                                <th className="p-3 uppercase text-center">
                                    <button onClick={() => requestSort('usage')} className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mx-auto">
                                        {t('admin_codes_usage')}
                                        {sortConfig?.key === 'usage' && (sortConfig.direction === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />)}
                                    </button>
                                </th>
                                <th className="p-3 text-center uppercase">{t('admin_codes_actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {sortedAndFilteredCodes.map(code => (
                                <tr key={code.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="p-3 font-mono text-gray-800 dark:text-gray-200">
                                        <div className="flex items-center">
                                            <span className="whitespace-nowrap">{code.code}</span>
                                            <button onClick={() => handleCopyCode(code.code, code.id)} className="ml-2 p-1 inline-flex align-middle text-gray-400 hover:text-green-500 flex-shrink-0">
                                                {copiedCodeId === code.id ? <CheckIcon className="w-4 h-4 text-green-500"/> : <ClipboardIcon className="w-4 h-4"/>}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-3 text-gray-600 dark:text-gray-400">{getUnlockName(code.botId)}</td>
                                    <td className="p-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{code.referrer || '—'}</td>
                                    <td className="p-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(code.createdAt).toLocaleDateString()}</td>
                                    <td className="p-3 break-all text-gray-600 dark:text-gray-400 text-center">
                                        {code.usedBy?.email ? (
                                            <span>{code.usedBy.email}</span>
                                        ) : (
                                            <div className="flex justify-center" title={t('admin_codes_status_available')}>
                                                <UserPlusIcon className="w-5 h-5 text-status-success-foreground" />
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        {code.isUsed ? (
                                            <button 
                                                onClick={() => handleAction(`revoke-code-${code.id}`, () => userService.revokeUpgradeCode(code.id))}
                                                disabled={actionLoading[`revoke-code-${code.id}`]}
                                                className="p-2 text-status-warning-foreground rounded-full hover:bg-status-warning-background disabled:opacity-50" 
                                                title={t('admin_codes_revoke')}
                                            >
                                                <RepeatIcon className="w-5 h-5" />
                                            </button>
                                        ) : (
                                            <button onClick={() => handleAction(`delete-code-${code.id}`, () => userService.deleteUpgradeCode(code.id))} disabled={actionLoading[`delete-code-${code.id}`]} className="p-2 text-status-danger-foreground rounded-full hover:bg-status-danger-background disabled:opacity-50" title={t('admin_codes_delete')}><DeleteIcon className="w-5 h-5" /></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                 <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <p>{codes.length > 0 ? t('admin_codes_no_filter_results') : t('admin_no_codes_yet')}</p>
                </div>
            )}
        </div>
    );
    
    const renderTickets = () => (
        <div className="space-y-8">
            {/* Guest Login Statistics */}
            <div className="bg-white dark:bg-transparent rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                    onClick={() => setShowGuestLoginDetails(!showGuestLoginDetails)}
                    className="w-full flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <UsersIcon className="w-6 h-6 text-accent-primary" />
                        <div className="text-left">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">
                                {t('admin_guest_logins_title')}
                            </h3>
                            {guestLoginStats && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {t('admin_guest_logins_total', { count: guestLoginStats.totalCount })}
                                </p>
                            )}
                        </div>
                    </div>
                    {showGuestLoginDetails ? (
                        <ChevronUpIcon className="w-5 h-5 text-gray-500" />
                    ) : (
                        <ChevronDownIcon className="w-5 h-5 text-gray-500" />
                    )}
                </button>
                
                {showGuestLoginDetails && guestLoginStats && (
                    <div className="p-4">
                        {guestLoginStats.daily.length > 0 ? (
                            <div className="overflow-x-auto max-h-96 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs uppercase text-gray-500 dark:text-gray-400 sticky top-0">
                                        <tr>
                                            <th className="p-3">{t('admin_guest_date')}</th>
                                            <th className="p-3 text-right">{t('admin_guest_logins')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                        {[...guestLoginStats.daily].reverse().map((day) => (
                                            <tr key={day.date} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="p-3 font-medium text-gray-700 dark:text-gray-300">
                                                    {new Date(day.date).toLocaleDateString()}
                                                </td>
                                                <td className="p-3 text-right text-gray-600 dark:text-gray-400">
                                                    {day.count}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                                {t('admin_guest_logins_none')}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-transparent rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                <h3 className="font-bold text-lg p-4 border-b border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200">{t('admin_message_reports_title')}</h3>
                {messageReports.length > 0 ? (
                    <div className={`overflow-x-auto ${messageReports.length > 5 ? 'max-h-96 overflow-y-auto' : ''}`}>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 uppercase text-xs text-gray-500 dark:text-gray-400 sticky top-0">
                                <tr>
                                    <th className="p-3">{t('admin_feedback_comments')}</th>
                                    <th className="p-3 w-24">{t('admin_feedback_bot')}</th>
                                    <th className="p-3 w-48">{t('admin_feedback_user')}</th>
                                    <th className="p-3 w-44">{t('admin_feedback_submitted')}</th>
                                    <th className="p-3 w-20 text-right">{t('admin_tickets_actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                {messageReports.map(item => <MessageReportTableRow key={item.id} item={item} />)}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-16 text-gray-500 dark:text-gray-400 flex flex-col items-center gap-4">
                        <ChatBubbleIcon className="w-12 h-12 text-gray-400" />
                        <p className="text-lg">{t('admin_no_message_reports')}</p>
                    </div>
                )}
            </div>
            <div className="bg-white dark:bg-transparent rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                <h3 className="font-bold text-lg p-4 border-b border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200">{t('admin_support_tickets_title')}</h3>
                {tickets.length > 0 ? (
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 uppercase text-xs text-gray-500 dark:text-gray-400 sticky top-0">
                                <tr>
                                    <th className="p-3">{t('admin_tickets_details')}</th>
                                    <th className="p-3">{t('admin_tickets_type')}</th>
                                    <th className="p-3">{t('admin_tickets_created')}</th>
                                    <th className="p-3">{t('admin_tickets_status')}</th>
                                    <th className="p-3 text-right">{t('admin_tickets_actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                {tickets.map(ticket => (
                                    <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="p-3 font-medium text-gray-800 dark:text-gray-200 break-all">{ticket.payload.email}</td>
                                        <td className="p-3 text-gray-600 dark:text-gray-400">{ticket.type}</td>
                                        <td className="p-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(ticket.createdAt).toLocaleString()}</td>
                                        <td className="p-3">
                                            {ticket.status === 'OPEN' 
                                                ? <span className="px-2 py-1 text-xs font-bold bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200 rounded-full">{ticket.status}</span>
                                                : <span className="px-2 py-1 text-xs font-bold bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200 rounded-full">{ticket.status}</span>
                                            }
                                        </td>
                                        <td className="p-3 text-right">
                                            {ticket.status === 'OPEN' && (
                                                <button onClick={() => handleAction(`resolve-ticket-${ticket.id}`, () => userService.resolveTicket(ticket.id))} disabled={actionLoading[`resolve-ticket-${ticket.id}`]} className="p-2 text-status-success-foreground rounded-full hover:bg-status-success-background disabled:opacity-50" title={t('admin_tickets_resolve')}>
                                                    <CheckIcon className="w-5 h-5"/>
                                                </button>
                                            )}
                                            {ticket.status === 'RESOLVED' && (
                                                <button 
                                                    onClick={() => handleAction(`delete-ticket-${ticket.id}`, () => userService.deleteTicket(ticket.id))} 
                                                    disabled={actionLoading[`delete-ticket-${ticket.id}`]}
                                                    className="p-2 text-status-danger-foreground rounded-full hover:bg-status-danger-background disabled:opacity-50" 
                                                    title={t('admin_codes_delete')}
                                                >
                                                    <DeleteIcon className="w-5 h-5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-16 text-gray-500 dark:text-gray-400 flex flex-col items-center gap-4">
                        <InboxIcon className="w-12 h-12 text-gray-400" />
                        <p className="text-lg">{t('admin_tickets_no_tickets')}</p>
                    </div>
                )}
            </div>
        </div>
    );
    
    const renderRatings = () => (
        <div className="space-y-6">
            {/* Session Feedback Section */}
            <div>
                <h2 className="text-xl font-bold text-content-primary mb-4">{t('admin_ratings_session_feedback')}</h2>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 text-center rounded-lg shadow-md">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">{t('admin_ratings_overall_avg')}</h3>
                    <p className="text-4xl font-bold text-status-success-foreground">{ratingStats.overallAverage}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin_ratings_total_ratings', { count: ratingStats.totalRatings })}</p>
                </div>
            </div>
            {ratingStats.totalRatings > 0 ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ratingStats.botStats.map(stat => (
                            <div key={stat.id} onClick={() => setSelectedBotFilter(stat.id)} className={`p-4 bg-white dark:bg-gray-800/50 border-2 rounded-lg shadow-md transition-all duration-200 cursor-pointer hover:border-accent-primary ${selectedBotFilter === stat.id ? 'border-accent-primary' : 'border-gray-200 dark:border-gray-700/50'}`}>
                                <div className="flex items-center gap-4 mb-3">
                                    <img src={stat.avatar} alt={stat.name} className="w-12 h-12 rounded-full" />
                                    <div>
                                        <h4 className="font-bold text-lg text-gray-800 dark:text-gray-200">{stat.name}</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin_ratings_avg_rating')}: <span className="font-bold text-gray-700 dark:text-gray-300">{stat.average}</span> ({stat.count})</p>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {([5, 4, 3, 2, 1]).map(star => {
                                        const count = stat.distribution[String(star)];
                                        const percentage = stat.count > 0 ? (count / stat.count) * 100 : 0;
                                        return (
                                            <div key={star} className="flex items-center gap-2 text-xs">
                                                <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">{star} <StarIcon className="w-3 h-3 text-yellow-400"/></span>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 h-4 flex-1">
                                                    <div className="bg-status-success-foreground h-4 text-center text-black font-bold" style={{ width: `${percentage}%` }}>
                                                        {count > 0 ? count : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div>
                         <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">{selectedBotFilter ? t('admin_ratings_details_for', { name: ratingStats.botStats.find(b => b.id === selectedBotFilter)?.name || '' }) : t('admin_ratings_all_feedback')}</h3>
                            {selectedBotFilter && (
                                <button onClick={() => setSelectedBotFilter(null)} className="text-sm text-yellow-600 dark:text-yellow-400 hover:underline">{t('admin_ratings_clear_filter')}</button>
                            )}
                        </div>
                        <div className={`overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg shadow-md overflow-hidden ${filteredFeedback.length > 5 ? 'max-h-96 overflow-y-auto' : ''}`}>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 uppercase text-xs text-gray-500 dark:text-gray-400 sticky top-0">
                                    <tr>
                                        <th className="p-3 w-28">{t('admin_feedback_rating')}</th>
                                        <th className="p-3">{t('admin_feedback_comments')}</th>
                                        <th className="p-3 w-24">{t('admin_feedback_bot')}</th>
                                        <th className="p-3 w-48">{t('admin_feedback_user')}</th>
                                        <th className="p-3 w-44">{t('admin_feedback_submitted')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                    {filteredFeedback.map(item => <FeedbackTableRow key={item.id} item={item} />)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400 flex flex-col items-center gap-4">
                    <StarIcon className="w-12 h-12 text-gray-400" />
                    <p className="text-lg">{t('admin_ratings_no_ratings')}</p>
                </div>
            )}
            
            {/* Transcript Evaluation Ratings Section */}
            <div className="pt-8 border-t-2 border-gray-300 dark:border-gray-700">
                <TranscriptRatingsView />
            </div>
        </div>
    );
    
    const renderTestRunner = () => {
        const selectedScenario = testScenarios.find(s => s.id === selectedScenarioId);
        const isDpcOrDpflTest = selectedScenario?.id.startsWith('dpc_') || selectedScenario?.id.startsWith('dpfl_');
        
        // Determine expected profile type from scenario ID
        const getScenarioProfileType = (scenarioId: string): 'RIEMANN' | 'BIG5' | null => {
            if (scenarioId.includes('_riemann')) return 'RIEMANN';
            if (scenarioId.includes('_ocean')) return 'BIG5';
            return null; // Generic scenario
        };
        
        const scenarioProfileType = selectedScenario ? getScenarioProfileType(selectedScenario.id) : null;
        const hasMismatch = adminProfileType && scenarioProfileType && adminProfileType !== scenarioProfileType;
        
        const handleRunClick = () => {
            if (!selectedScenario) return;
            
            // Check for profile type mismatch
            if (hasMismatch) {
                setPendingScenario(selectedScenario);
                setShowMismatchWarning(true);
            } else {
                onRunTestSession(selectedScenario, lifeContext);
            }
        };
        
        const handleConfirmMismatch = () => {
            if (pendingScenario) {
                onRunTestSession(pendingScenario, lifeContext);
            }
            setShowMismatchWarning(false);
            setPendingScenario(null);
        };
        
        return (
            <div className="space-y-4">
                {/* New Dynamic Test Runner Section - MOVED TO TOP */}
                <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg text-purple-800 dark:text-purple-200 flex items-center gap-2">
                                🧪 {t('admin_dynamic_runner_title')}
                            </h3>
                            <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">
                                {t('admin_dynamic_runner_desc')}
                            </p>
                        </div>
                        <div className="flex justify-end shrink-0">
                            <button
                                onClick={() => setShowDynamicTestRunner(true)}
                                className="w-40 px-5 py-2.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-colors"
                            >
                                🚀 {t('admin_dynamic_runner_start')}
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Comfort Check Quick Test Section */}
                {onTestComfortCheck && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg shadow-md">
                        <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">
                                        {t('admin_comfort_test_title')}
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {t('admin_comfort_test_desc')}
                                    </p>
                                </div>
                                <div className="flex justify-end shrink-0">
                                    <button
                                        onClick={() => onTestComfortCheck(true)}
                                        className="w-40 px-5 py-2.5 text-sm font-semibold text-button-foreground-on-accent bg-accent-primary uppercase hover:bg-accent-primary-hover rounded-lg shadow-sm whitespace-nowrap"
                                    >
                                        Comfort Check
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                                {t('admin_comfort_test_note')}
                            </p>
                        </div>
                    </div>
                )}
                
                {/* Legacy Test Runner Section */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 space-y-4 rounded-lg shadow-md">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">{t('admin_runner_title')} {t('admin_runner_static')}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin_runner_desc')}</p>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                            <label htmlFor="scenario-select" className="sr-only">{t('admin_runner_select_scenario')}</label>
                            <select 
                                id="scenario-select" 
                                value={selectedScenarioId} 
                                onChange={e => setSelectedScenarioId(e.target.value)} 
                                className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-primary"
                            >
                                {testScenarios.map(scenario => (
                                    <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end shrink-0">
                            <button
                                onClick={handleRunClick}
                                className="w-40 px-5 py-2.5 text-sm font-semibold text-button-foreground-on-accent bg-accent-primary uppercase hover:bg-accent-primary-hover flex items-center justify-center rounded-lg shadow-sm"
                            >
                                {t('admin_runner_run')}
                            </button>
                        </div>
                    </div>
                    
                    {/* Info box for DPC/DPFL tests */}
                    {isDpcOrDpflTest && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
                            <p className="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                                🧪 {t('admin_runner_experimental_test')}
                            </p>
                            <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                                <p>{t('admin_runner_dpfl_info')}</p>
                            </div>
                        </div>
                    )}
                    
                    {/* Scenario description */}
                    {selectedScenario && (
                        <div className="p-3 bg-gray-100 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                <strong>{t('admin_runner_scenario_desc')}:</strong> {selectedScenario.description}
                            </p>
                        </div>
                    )}
                </div>
                
                {/* Profile Mismatch Warning Modal */}
                {showMismatchWarning && createPortal(
                    <div 
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4" 
                        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
                        onClick={() => setShowMismatchWarning(false)}
                        role="dialog"
                        aria-modal="true"
                    >
                        <div 
                            className="bg-white dark:bg-gray-900 w-full max-w-lg p-6 border border-status-warning-border dark:border-status-warning-border/50 shadow-xl rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0">
                                    <WarningIcon className="w-8 h-8 text-status-warning-foreground" />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-200">
                                        {t('admin_runner_mismatch_title')}
                                    </h2>
                                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                                        {t('admin_runner_mismatch_desc', {
                                            yourProfile: adminProfileType || 'Unknown',
                                            scenarioType: scenarioProfileType || 'Unknown'
                                        })}
                                    </p>
                                    <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg">
                                        <div className="flex items-start gap-3">
                                            <div className="text-2xl mt-0.5">⚠️</div>
                                            <p className="text-sm text-content-secondary">
                                                {t('admin_runner_mismatch_hint')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button 
                                    onClick={() => setShowMismatchWarning(false)} 
                                    className="px-6 py-2 text-base font-bold text-gray-600 dark:text-gray-400 bg-transparent border border-gray-400 dark:border-gray-700 uppercase hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg shadow-md"
                                >
                                    {t('deleteAccount_cancel')}
                                </button>
                                <button 
                                    onClick={handleConfirmMismatch} 
                                    className="px-6 py-2 text-base font-bold text-white bg-status-warning-foreground uppercase hover:opacity-80 rounded-lg shadow-md"
                                >
                                    {t('admin_runner_continue_anyway')}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
                
                {/* Dynamic Test Runner Modal */}
                {showDynamicTestRunner && (
                    <TestRunner 
                        onClose={() => setShowDynamicTestRunner(false)}
                        userProfile={adminPersonalityProfile}
                        encryptionKey={encryptionKey}
                    />
                )}
            </div>
        );
    };

    const renderContent = () => {
        if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;
        if (error) return <p className="text-red-500 p-4">{error}</p>;

        const views: Record<AdminTab, React.ReactNode> = {
            users: renderUsers(),
            codes: renderCodes(),
            tickets: renderTickets(),
            feedback: renderRatings(),
            runner: currentUser?.isDeveloper ? renderTestRunner() : <p className="text-content-secondary">{t('admin_developer_required') || 'Developer access required.'}</p>,
            'api-usage': <ApiUsageView />,
        };

        return <div className="p-4">{views[activeTab]}</div>;
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-6 sm:p-8 space-y-6 bg-white dark:bg-transparent border border-gray-300 dark:border-gray-700 mt-4 mb-10 animate-fadeIn rounded-lg shadow-lg">
             <div className="text-center pb-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-200 uppercase">{t('admin_title')}</h1>
            </div>
            {renderTabs()}
            {renderContent()}
            {resetSuccessData && (
                <ResetPasswordSuccessModal
                    data={resetSuccessData}
                    onClose={() => setResetSuccessData(null)}
                />
            )}
            {userToReset && (
                <ResetConfirmationModal
                    user={userToReset}
                    onConfirm={confirmAndResetPassword}
                    onCancel={() => setUserToReset(null)}
                />
            )}
        </div>
    );
};

export default AdminView;