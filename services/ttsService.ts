import { apiFetch, getApiBaseUrl, getAuthHeaders } from './api';

export type TtsMode = 'local' | 'server';

export interface ServerVoice {
    id: string;
    name: string;
    language: 'en';
    gender: 'male' | 'female';
    model: string;
}

/**
 * Available server voices from Piper TTS
 */
export const SERVER_VOICES: ServerVoice[] = [
    {
        id: 'en-amy',
        name: 'Amy (English, Female)',
        language: 'en',
        gender: 'female',
        model: 'en_US-amy-medium',
    },
    {
        id: 'en-ryan',
        name: 'Ryan (English, Male)',
        language: 'en',
        gender: 'male',
        model: 'en_US-ryan-medium',
    },
];

/**
 * Convert voice ID to model name
 */
const getModelFromVoiceId = (voiceId: string): string | null => {
    const voice = SERVER_VOICES.find(v => v.id === voiceId);
    return voice ? voice.model : null;
};

/**
 * Synthesize speech using the server TTS
 */
export const synthesizeSpeech = async (
    text: string,
    botId: string,
    lang: 'en',
    isMeditation: boolean = false,
    voiceId?: string | null
): Promise<Blob> => {
    const requestBody: any = { text, botId, lang, isMeditation };
    if (voiceId) {
        const modelName = getModelFromVoiceId(voiceId);
        if (modelName) {
            requestBody.voiceId = modelName;
        } else {
            // voiceId is not a valid server voice - this means the caller passed a local voice name
            // by mistake (likely due to inconsistent state). Log warning but continue without custom voice.
            console.warn('[TTS Service] No model found for voiceId:', voiceId, '- using default voice. This may indicate corrupted voice settings.');
            // Don't add voiceId to request - backend will use default voice for language/gender
        }
    }

    const apiBaseUrl = getApiBaseUrl();
    const apiUrl = apiBaseUrl ? `${apiBaseUrl}/api/tts/synthesize` : '/api/tts/synthesize';

    const rawResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody),
    });

    if (!rawResponse.ok) {
        const error = await rawResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[TTS Service] TTS synthesis failed:', {
            status: rawResponse.status,
            statusText: rawResponse.statusText,
            error: error,
        });
        throw new Error(error.error || `Failed to synthesize speech (${rawResponse.status})`);
    }

    return await rawResponse.blob();
};

/**
 * Check if server TTS is available
 */
export const checkTtsHealth = async (): Promise<boolean> => {
    try {
        const response = await apiFetch('/tts/health', { method: 'GET' });
        return response.status === 'ok';
    } catch (error) {
        console.warn('Server TTS not available:', error);
        return false;
    }
};

// ============================================================================
// NEW: Bot-specific voice settings
// ============================================================================

export interface LanguageVoiceSettings {
    mode: TtsMode;
    voiceId: string | null;
    isAuto: boolean;
}

// Simplified to English-only, maintaining backward compatibility
export type BotVoiceSettings = LanguageVoiceSettings;

/**
 * Get voice settings for a specific bot
 */
export const getBotVoiceSettings = (botId: string): LanguageVoiceSettings => {
    const defaultSettings: LanguageVoiceSettings = {
        mode: 'local',
        voiceId: null,
        isAuto: true
    };

    if (typeof localStorage === 'undefined') {
        return defaultSettings;
    }

    try {
        // Try to load from new bot-specific format
        const settingsStr = localStorage.getItem('botVoiceSettings');
        if (settingsStr) {
            const allSettings = JSON.parse(settingsStr);
            if (allSettings[botId]) {
                const settings = allSettings[botId];

                // Check if old format with de/en keys - migrate to English only
                if (settings.en) {
                    const migratedSettings = settings.en;
                    saveBotVoiceSettings(botId, migratedSettings);
                    return migratedSettings;
                }

                // Already in new English-only format
                if (settings.mode !== undefined) {
                    return settings;
                }
            }
        }

        // Fallback: Try to migrate from legacy format
        const migrated = migrateLegacySettings(botId);
        if (migrated) {
            return migrated;
        }

        // Default: Auto mode
        return defaultSettings;
    } catch (error) {
        console.error('[TTS] Failed to load bot voice settings:', error);
        return defaultSettings;
    }
};

/**
 * Save voice settings for a specific bot
 */
export const saveBotVoiceSettings = (botId: string, settings: LanguageVoiceSettings): void => {
    if (typeof localStorage === 'undefined') return;

    try {
        const settingsStr = localStorage.getItem('botVoiceSettings');
        const allSettings = settingsStr ? JSON.parse(settingsStr) : {};

        allSettings[botId] = settings;

        localStorage.setItem('botVoiceSettings', JSON.stringify(allSettings));
    } catch (error) {
        console.error('[TTS] Failed to save bot voice settings:', error);
    }
};

/**
 * Migrate legacy settings to new bot-specific, English-only format
 * Returns migrated settings or null if no legacy settings found
 */
const migrateLegacySettings = (botId: string): LanguageVoiceSettings | null => {
    if (typeof localStorage === 'undefined') return null;

    try {
        // Check for legacy coachVoicePreferences
        const legacyPrefsStr = localStorage.getItem('coachVoicePreferences');
        const legacyPrefs = legacyPrefsStr ? JSON.parse(legacyPrefsStr) : null;

        // Check for legacy global settings
        const legacyMode = localStorage.getItem('ttsMode') as TtsMode | null;
        const legacyAutoModeSetting = localStorage.getItem('ttsAutoMode');
        const legacyAutoMode = legacyAutoModeSetting === null ? true : legacyAutoModeSetting === 'true';
        const legacyServerVoice = localStorage.getItem('selectedServerVoice');
        const legacyLocalVoice = localStorage.getItem('selectedLocalVoiceURI');

        // If we have bot-specific legacy preference
        if (legacyPrefs && legacyPrefs[botId]) {
            const voiceId = legacyPrefs[botId];
            const mode: TtsMode = legacyMode || 'local';

            const settings: LanguageVoiceSettings = {
                mode,
                voiceId,
                isAuto: legacyAutoMode
            };

            // Save to new format
            saveBotVoiceSettings(botId, settings);
            return settings;
        }

        // If we have global legacy settings, use them as default
        if (legacyMode || legacyServerVoice || legacyLocalVoice) {
            const mode: TtsMode = legacyMode || 'local';
            const voiceId = mode === 'server' ? legacyServerVoice : legacyLocalVoice;

            const settings: LanguageVoiceSettings = {
                mode,
                voiceId,
                isAuto: legacyAutoMode
            };

            // Save to new format
            saveBotVoiceSettings(botId, settings);
            return settings;
        }

        return null;
    } catch (error) {
        console.error('[TTS] Failed to migrate legacy settings:', error);
        return null;
    }
};

// ============================================================================
// LEGACY: Keep for backwards compatibility (will be deprecated)
// ============================================================================

/**
 * Get TTS preferences from localStorage
 * @deprecated Use getBotVoiceSettings instead
 */
export const getTtsPreferences = (): {
    mode: TtsMode;
    selectedVoiceURI: string | null;
} => {
    if (typeof localStorage === 'undefined') {
        return { mode: 'local', selectedVoiceURI: null };
    }

    try {
        const modeStr = localStorage.getItem('ttsMode');
        const mode = (modeStr === 'server' ? 'server' : 'local') as TtsMode;

        // Get the appropriate voice URI based on mode
        let voiceURI: string | null = null;
        if (mode === 'server') {
            voiceURI = localStorage.getItem('selectedServerVoice');
        } else {
            voiceURI = localStorage.getItem('selectedLocalVoiceURI');
        }

        return { mode, selectedVoiceURI: voiceURI };
    } catch (error) {
        console.error('Failed to load TTS preferences:', error);
        return { mode: 'local', selectedVoiceURI: null };
    }
};

/**
 * Save TTS preferences to localStorage
 * @deprecated Use saveBotVoiceSettings instead
 */
export const saveTtsPreferences = (mode: TtsMode, selectedVoiceURI: string | null): void => {
    if (typeof localStorage === 'undefined') return;

    try {
        localStorage.setItem('ttsMode', mode);

        // Save voice to mode-specific key
        if (mode === 'server') {
            if (selectedVoiceURI !== null) {
                localStorage.setItem('selectedServerVoice', selectedVoiceURI);
            } else {
                localStorage.removeItem('selectedServerVoice');
            }
        } else {
            if (selectedVoiceURI !== null) {
                localStorage.setItem('selectedLocalVoiceURI', selectedVoiceURI);
            } else {
                localStorage.removeItem('selectedLocalVoiceURI');
            }
        }
    } catch (error) {
        console.error('Failed to save TTS preferences:', error);
    }
};
