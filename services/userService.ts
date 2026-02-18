


import { apiFetch, setSession, getSession, clearSession } from './api';
import { User, Ticket, Feedback, Bot, Language } from '../types';
import { encryptData, decryptData } from '../utils/encryption';


interface EncryptedUserData {
    context: string; // This will be the encrypted string from the server
    gamificationState: string;
}

interface DecryptedUserData {
    context: string; // This will be the decrypted, plaintext context
    gamificationState: string;
}

export const loadUserData = async (key: CryptoKey): Promise<DecryptedUserData> => {
    const data: EncryptedUserData = await apiFetch('/data/user');
    
    let decryptedContext = '';
    // If there's context to decrypt, wrap it in a try...catch
    if (data.context) {
        try {
            decryptedContext = await decryptData(key, data.context);
        } catch (error) {
            console.error("Fatal: Failed to decrypt life context. This likely means the password was incorrect or data is corrupt.", error);
            // Re-throw to prevent the user from continuing with a blank context.
            // This will be caught by the UI and trigger a logout/error message.
            throw error;
        }
    }

    return {
        context: decryptedContext,
        gamificationState: data.gamificationState,
    };
};

export const saveUserData = async (context: string, gamificationState: string, key: CryptoKey): Promise<void> => {
    const encryptedContext = await encryptData(key, context);
    await apiFetch('/data/user', {
        method: 'PUT',
        body: JSON.stringify({ context: encryptedContext, gamificationState }),
    });
};

export const login = async (email: string, password: string): Promise<{ user: User, token: string, accessExpired?: boolean }> => {
    const session = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    setSession(session);
    return session;
};

export const updateProfile = async (firstName?: string, lastName?: string, newsletterConsent?: boolean): Promise<{ message: string, user: User }> => {
    return await apiFetch('/data/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ firstName, lastName, newsletterConsent }),
    });
};

export const updateCoachingMode = async (coachingMode: 'off' | 'dpc' | 'dpfl'): Promise<{ message: string, user: User }> => {
    return await apiFetch('/data/user/coaching-mode', {
        method: 'PUT',
        body: JSON.stringify({ coachingMode }),
    });
};

export type AIRegionPreference = 'optimal' | 'eu' | 'us';

export const updateAIRegionPreference = async (aiRegionPreference: AIRegionPreference): Promise<{ message: string, user: User }> => {
    return await apiFetch('/data/user/ai-region', {
        method: 'PUT',
        body: JSON.stringify({ aiRegionPreference }),
    });
};


export const deleteAccount = async (): Promise<void> => {
    await apiFetch('/data/user', {
        method: 'DELETE',
    });
    clearSession();
};

export const changePassword = async (oldPassword: string, newPassword: string, newEncryptedLifeContext: string): Promise<void> => {
    await apiFetch('/data/user/password', {
        method: 'PUT',
        body: JSON.stringify({ oldPassword, newPassword, newEncryptedLifeContext }),
    });
};

export const submitFeedback = async (feedbackData: {
    rating?: number | null;
    comments: string;
    botId: string;
    lastUserMessage?: string | null;
    botResponse?: string | null;
    isAnonymous: boolean;
    email?: string;
}): Promise<void> => {
    await apiFetch('/feedback', {
        method: 'POST',
        body: JSON.stringify(feedbackData),
    });
};

export const getBots = async (): Promise<Bot[]> => {
    return await apiFetch('/bots');
};


// --- Admin Functions ---

export const getAdminUsers = async (): Promise<User[]> => {
    return await apiFetch('/admin/users');
};

export const toggleUserAdmin = async (userId: string): Promise<void> => {
     await apiFetch(`/admin/users/${userId}/toggle-admin`, { method: 'PUT' });
};

export const toggleUserDeveloper = async (userId: string): Promise<void> => {
     await apiFetch(`/admin/users/${userId}/toggle-developer`, { method: 'PUT' });
};

export const resetUserPassword = async (userId: string): Promise<{ newPassword: string }> => {
    return await apiFetch(`/admin/users/${userId}/reset-password`, { method: 'POST' });
};

export const activateUser = async (userId: string): Promise<void> => {
    await apiFetch(`/admin/users/${userId}/activate`, { method: 'PUT' });
};

export const getAdminTickets = async (): Promise<Ticket[]> => {
    return await apiFetch('/admin/tickets');
};

export const resolveTicket = async (ticketId: string): Promise<Ticket> => {
    return await apiFetch(`/admin/tickets/${ticketId}/resolve`, { method: 'PUT' });
};

export const deleteTicket = async (ticketId: string): Promise<void> => {
    await apiFetch(`/admin/tickets/${ticketId}`, { method: 'DELETE' });
};

export const getAdminFeedback = async (): Promise<Feedback[]> => {
    return await apiFetch('/admin/feedback');
};

export const deleteMessageReport = async (feedbackId: string): Promise<void> => {
    await apiFetch(`/admin/feedback/${feedbackId}`, { method: 'DELETE' });
};

// --- Newsletter Functions ---

export interface NewsletterSubscriber {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    newsletterConsentDate?: string | null;
    createdAt?: string;
}

export interface NewsletterContent {
    subjectDE: string;
    subjectEN: string;
    textBodyDE: string;
    textBodyEN: string;
    htmlBodyDE?: string;
    htmlBodyEN?: string;
}

export interface NewsletterHistoryEntry {
    id: string;
    subjectDE: string;
    subjectEN: string;
    textBodyDE: string;
    textBodyEN: string;
    htmlBodyDE?: string | null;
    htmlBodyEN?: string | null;
    sentBy: string;
    sentByEmail: string;
    recipientCount: number;
    successCount: number;
    failedCount: number;
    errors?: any;
    createdAt: string;
}

export const getNewsletterSubscribers = async (): Promise<{ subscribers: NewsletterSubscriber[], count: number }> => {
    return await apiFetch('/admin/newsletter-subscribers');
};

export const getNewsletterHistory = async (): Promise<NewsletterHistoryEntry[]> => {
    return await apiFetch('/admin/newsletter-history');
};

export const sendNewsletter = async (content: NewsletterContent): Promise<{ success: boolean, sent: number, failed: number, total: number, message: string }> => {
    return await apiFetch('/admin/send-newsletter', {
        method: 'POST',
        body: JSON.stringify(content),
    });
};

// --- AI Provider Management ---

export interface AIProviderConfig {
    activeProvider: 'google' | 'mistral';
    lastUpdated: string;
    lastUpdatedBy: string | null;
    providerHealth: {
        google: { available: boolean; error: string | null };
        mistral: { available: boolean; error: string | null };
    };
    usageToday: {
        google: number;
        mistral: number;
    };
}

export const getAIProviderConfig = async (): Promise<AIProviderConfig> => {
    return await apiFetch('/admin/ai-provider');
};

export const setAIProvider = async (provider: 'google' | 'mistral'): Promise<{ success: boolean; provider: string; message: string }> => {
    return await apiFetch('/admin/ai-provider', {
        method: 'PUT',
        body: JSON.stringify({ provider }),
    });
};

export const getAIProviderHealth = async (): Promise<AIProviderConfig['providerHealth']> => {
    return await apiFetch('/admin/ai-provider/health');
};

// --- Transcript Evaluation Ratings ---

export interface TranscriptRating {
    id: string;
    userEmail: string;
    isClient: boolean;
    isPremium: boolean;
    rating: number;
    feedback: string | null;
    contactOptIn: boolean;
    ratedAt: string;
    createdAt: string;
    lang: string;
}

export interface TranscriptRatingStats {
    total: number;
    promoters: number;
    passives: number;
    detractors: number;
    avgRating: number;
    nps: number;
}

export const getTranscriptRatings = async (): Promise<{ ratings: TranscriptRating[]; stats: TranscriptRatingStats }> => {
    return await apiFetch('/admin/transcript-ratings');
};