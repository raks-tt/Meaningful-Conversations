import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalOpen } from '../utils/modalUtils';
import { XIcon } from './icons/XIcon';
import { PlayIcon } from './icons/PlayIcon';
import { Language } from '../types';
import { useLocalization } from '../context/LocalizationContext';
import { getVoiceGender, cleanVoiceName } from '../utils/voiceUtils';
import { InfoIcon } from './icons/InfoIcon';
import { SERVER_VOICES, type TtsMode, type ServerVoice } from '../services/ttsService';
import { getApiBaseUrl } from '../services/api';
import Button from './shared/Button';
import { isNativeiOS, nativeTtsService, type NativeVoice } from '../services/nativeTtsService';

type VoiceSelection = 
    | { type: 'auto' }
    | { type: 'local'; voiceURI: string }
    | { type: 'server'; voiceId: string }
    | { type: 'native'; voiceIdentifier: string };

interface VoiceSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    voices: SpeechSynthesisVoice[];
    currentVoiceURI: string | null;
    currentTtsMode: TtsMode;
    isAutoMode?: boolean;
    onSelectVoice: (selection: VoiceSelection) => void;
    onPreviewVoice: (voice: SpeechSynthesisVoice) => void;
    onPreviewServerVoice: (voiceId: string) => void;
    onPreviewNativeVoice?: (voiceIdentifier: string) => void;
    botLanguage: Language;
    botGender: 'male' | 'female';
    isGuest?: boolean;
}

// Export VoiceSelection type for use in ChatView
export type { VoiceSelection };

const VoiceSelectionModal: React.FC<VoiceSelectionModalProps> = ({
    isOpen,
    onClose,
    voices,
    currentVoiceURI,
    currentTtsMode,
    isAutoMode = false,
    onSelectVoice,
    onPreviewVoice,
    onPreviewServerVoice,
    onPreviewNativeVoice,
    botLanguage,
    botGender,
    isGuest = false,
}) => {
    const { t } = useLocalization();
    useModalOpen(isOpen);
    
    // iOS detection - server TTS doesn't work reliably on iOS (browser) due to autoplay restrictions
    // Native iOS apps use AVSpeechSynthesizer which works perfectly
    const isIOSBrowser = useMemo(() => {
        if (isNativeiOS) return false; // Native app doesn't have browser restrictions
        if (typeof navigator === 'undefined') return false;
        return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }, []);
    
    // State for native iOS voices
    const [nativeVoices, setNativeVoices] = useState<NativeVoice[]>([]);
    
    // Load native voices when in native iOS app
    useEffect(() => {
        console.log('[VoiceModal] Native iOS check:', { isNativeiOS, isOpen });
        if (isNativeiOS && isOpen) {
            console.log('[VoiceModal] Loading native voices...');
            nativeTtsService.getVoices().then(voices => {
                console.log('[VoiceModal] Native voices loaded:', voices.length);
                setNativeVoices(voices);
            }).catch(err => {
                console.error('[VoiceModal] Failed to load native voices:', err);
            });
        }
    }, [isOpen]);
    
    // Local selection state for user interactions within the modal
    const [selection, setSelection] = useState<VoiceSelection>({ type: 'auto' });
    
    const [serverTtsAvailable, setServerTtsAvailable] = useState<boolean>(true);

    // Check TTS server availability (skip on native iOS - server voices not offered there)
    useEffect(() => {
        if (isOpen && !isNativeiOS) {
            const apiBaseUrl = getApiBaseUrl();
            fetch(`${apiBaseUrl}/api/tts/health`)
                .then(res => res.json())
                .then(data => {
                    setServerTtsAvailable(data.status === 'ok' && data.piperAvailable);
                })
                .catch(() => {
                    setServerTtsAvailable(false);
                });
        }
    }, [isOpen]);

    // Sync state if the modal is reopened with a different external state
    useEffect(() => {
        if (isOpen) {
            console.log('[VoiceModal SYNC] Props:', { currentVoiceURI, currentTtsMode, isAutoMode, isIOSBrowser });
            
            // On iOS, server voices are not available - switch to auto if server voice was selected
            if (isIOSBrowser && currentTtsMode === 'server') {
                console.log('[VoiceModal SYNC] -> iOS browser, forcing auto');
                setSelection({ type: 'auto' });
                return;
            }
            
            // Sync modal state with parent props
            if (isAutoMode) {
                // Auto mode is enabled - always show the Auto radio button as selected
                console.log('[VoiceModal SYNC] -> Auto mode (showing auto selected)');
                setSelection({ type: 'auto' });
            } else if (currentTtsMode === 'server' && currentVoiceURI) {
                console.log('[VoiceModal SYNC] -> Server voice:', currentVoiceURI);
                setSelection({ type: 'server', voiceId: currentVoiceURI });
            } else if (currentVoiceURI) {
                // Check if it's a native iOS voice (com.apple.voice identifier)
                // IMPORTANT: Only treat as 'native' on actual iOS Native app!
                // Safari Desktop also uses com.apple.voice.* URIs but should be 'local'
                if (currentVoiceURI.startsWith('com.apple.voice') && isNativeiOS) {
                    console.log('[VoiceModal SYNC] -> Native iOS voice:', currentVoiceURI);
                    setSelection({ type: 'native', voiceIdentifier: currentVoiceURI });
                } else {
                    console.log('[VoiceModal SYNC] -> Local voice:', currentVoiceURI);
                    setSelection({ type: 'local', voiceURI: currentVoiceURI });
                }
            } else {
                console.log('[VoiceModal SYNC] -> Default auto (no voiceURI)');
                setSelection({ type: 'auto' });
            }
        }
    }, [isOpen, currentVoiceURI, currentTtsMode, isAutoMode, isIOSBrowser]);


    const localVoices = useMemo(() => {
        if (!voices || voices.length === 0) {
            console.log('[VoiceModal] No voices available, voices.length =', voices?.length || 0);
            return [];
        }
        
        // Debug: Log what we received
        console.log('[VoiceModal] Processing', voices.length, 'voices for', botLanguage, botGender);
        
        // --- Whitelist First Pass ---
        // Extended whitelist to include more iOS voice names
        const allowedNames: string[] = botGender === 'female'
            ? ['samantha', 'susan', 'serena', 'karen', 'moira', 'tessa', 'siri', 'nicky', 'allison', 'ava']
            : ['daniel', 'jamie', 'alex', 'tom', 'aaron', 'arthur', 'fred'];
        
        const whitelistedVoices = voices.filter(v => {
            // On iOS, enhanced/premium voices may have localService: false
            // because they're downloaded from Apple servers, so skip this check on iOS
            if (!isIOSBrowser && !v.localService) return false;
            if (!v.lang.toLowerCase().startsWith(botLanguage)) return false;
            const name = v.name.toLowerCase();
            return allowedNames.some(allowedName => name.includes(allowedName));
        });

        console.log('[VoiceModal] Whitelist filter found', whitelistedVoices.length, 'voices:', 
            whitelistedVoices.map(v => v.name));

        if (whitelistedVoices.length > 0) {
            return whitelistedVoices.sort((a, b) => cleanVoiceName(a.name).localeCompare(cleanVoiceName(b.name)));
        }
        
        // Debug: If no whitelisted voices, show all voices for the language
        const allLangVoices = voices.filter(v => v.lang.toLowerCase().startsWith(botLanguage));
        console.log('[VoiceModal] No whitelisted voices found. All', botLanguage, 'voices:', 
            allLangVoices.map(v => ({ name: v.name, localService: v.localService })));

        // --- Fallback to Broader Search if Whitelist Fails ---
        // First try: voices that match the gender
        let genderFilteredVoices = voices.filter(v => {
            // On iOS, skip localService check (see above)
            if (!isIOSBrowser && !v.localService) return false;
            if (!v.lang.toLowerCase().startsWith(botLanguage)) return false;
            const voiceGender = getVoiceGender(v);
            return voiceGender === botGender;
        });
        
        console.log('[VoiceModal] Gender-matched voices:', genderFilteredVoices.length);

        // Second try: voices that are not the opposite gender (include 'unknown')
        if (genderFilteredVoices.length === 0) {
            const oppositeGender = botGender === 'male' ? 'female' : 'male';
            genderFilteredVoices = voices.filter(v => {
                // On iOS, skip localService check (see above)
                if (!isIOSBrowser && !v.localService) return false;
                if (!v.lang.toLowerCase().startsWith(botLanguage)) return false;
                const voiceGender = getVoiceGender(v);
                return voiceGender !== oppositeGender;
            });
            console.log('[VoiceModal] Non-opposite-gender voices:', genderFilteredVoices.length);
        }
        
        // Last resort: ANY voice for the language (iOS might have voices with unknown names)
        if (genderFilteredVoices.length === 0) {
            genderFilteredVoices = voices.filter(v => {
                if (!isIOSBrowser && !v.localService) return false;
                return v.lang.toLowerCase().startsWith(botLanguage);
            });
            console.log('[VoiceModal] All', botLanguage, 'voices (last resort):', genderFilteredVoices.length);
        }
        
        // iOS special case: if STILL no voices, show ALL local voices regardless of language
        // Better to have some voice than none at all
        if (genderFilteredVoices.length === 0 && isIOSBrowser) {
            genderFilteredVoices = voices.filter(v => v.localService);
            console.log('[VoiceModal] iOS fallback - all local voices:', genderFilteredVoices.length);
        }

        // De-duplicate and sort the broader list
        const uniqueVoicesMap = new Map<string, SpeechSynthesisVoice>();
        genderFilteredVoices.forEach(voice => {
            const baseName = voice.name.replace(/\s*\([^)]*\)$/, '').trim();
            const existing = uniqueVoicesMap.get(baseName);
            if (!existing || (!/enhanced|premium|erweitert/i.test(existing.name) && /enhanced|premium|erweitert/i.test(voice.name))) {
                uniqueVoicesMap.set(baseName, voice);
            }
        });

        const result = Array.from(uniqueVoicesMap.values())
            .sort((a, b) => cleanVoiceName(a.name).localeCompare(cleanVoiceName(b.name)));
        
        console.log('[VoiceModal] FINAL localVoices result:', result.length, result.map(v => v.name));
        return result;

    }, [voices, botLanguage, botGender]);

    const serverVoices = useMemo(() => {
        return SERVER_VOICES.filter(v => 
            v.language === botLanguage && v.gender === botGender
        );
    }, [botLanguage, botGender]);

    // Filter native voices by language and gender
    const filteredNativeVoices = useMemo(() => {
        if (!isNativeiOS || nativeVoices.length === 0) return [];
        
        // Map gender keywords for voice name detection
        const femaleKeywords = ['anna', 'helena', 'petra', 'katja', 'marlene', 'vicki', 'marie', 'samantha', 'karen', 'moira', 'tessa', 'siri', 'allison', 'ava', 'susan', 'serena', 'nicky'];
        const maleKeywords = ['markus', 'viktor', 'martin', 'hans', 'yannick', 'conrad', 'daniel', 'jamie', 'alex', 'tom', 'aaron', 'arthur', 'fred'];
        
        // Filter by language
        let filtered = nativeVoices.filter(v => 
            v.language.toLowerCase().startsWith(botLanguage.toLowerCase())
        );
        
        // Filter by gender based on name
        const targetKeywords = botGender === 'female' ? femaleKeywords : maleKeywords;
        const oppositeKeywords = botGender === 'female' ? maleKeywords : femaleKeywords;
        
        // First try: exact gender match
        let genderFiltered = filtered.filter(v => {
            const nameLower = v.name.toLowerCase();
            return targetKeywords.some(kw => nameLower.includes(kw));
        });
        
        // Second try: not opposite gender
        if (genderFiltered.length === 0) {
            genderFiltered = filtered.filter(v => {
                const nameLower = v.name.toLowerCase();
                return !oppositeKeywords.some(kw => nameLower.includes(kw));
            });
        }
        
        // Fallback: all voices for the language
        if (genderFiltered.length === 0) {
            genderFiltered = filtered;
        }
        
        // Sort by quality (premium > enhanced > default), then by name
        return genderFiltered.sort((a, b) => {
            const qualityOrder = { premium: 0, enhanced: 1, default: 2 };
            const qualityDiff = (qualityOrder[a.quality] || 2) - (qualityOrder[b.quality] || 2);
            if (qualityDiff !== 0) return qualityDiff;
            return a.name.localeCompare(b.name);
        });
    }, [nativeVoices, botLanguage, botGender]);

    // Helper function to check if a server voice is enabled
    // Server voices are disabled on iOS browser due to autoplay restrictions
    // but work fine in native iOS apps (though we prefer native voices there)
    const isVoiceEnabled = (voice: ServerVoice) => {
        return serverTtsAvailable && voice.model !== '' && !isIOSBrowser;
    };

    const handleSave = () => {
        onSelectVoice(selection);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4" 
            style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
            aria-modal="true" 
            role="dialog"
            onClick={onClose}
        >
            <div 
                className="bg-background-secondary dark:bg-background-secondary w-full max-w-lg max-h-[80dvh] flex flex-col p-6 border border-border-secondary dark:border-border-primary shadow-xl rounded-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 id="voice-modal-title" className="text-2xl font-bold text-content-primary uppercase">{t('voiceModal_title')}</h2>
                    <button onClick={onClose} className="p-2 text-content-secondary hover:text-content-primary" aria-label="Close">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                    <div className={`p-3 border ${selection.type === 'auto' ? 'border-accent-primary border-2 bg-accent-primary/10' : 'border-border-primary bg-background-tertiary'}`}>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                name="voice-selection"
                                checked={selection.type === 'auto'}
                                onChange={() => setSelection({ type: 'auto' })}
                                className="h-5 w-5 bg-background-secondary dark:bg-background-tertiary border-border-secondary text-accent-primary focus:ring-accent-primary [color-scheme:light] dark:[color-scheme:dark]"
                            />
                            <span className="ml-3">
                                <span className="font-semibold text-content-primary">{t('voiceModal_auto')}</span>
                                <span className="block text-sm text-content-secondary">{t('voiceModal_auto_desc')}</span>
                            </span>
                        </label>
                    </div>

                    {/* Server Voices Section (hidden for guests, native iOS, and iOS browser) */}
                    {serverVoices.length > 0 && !isGuest && !isNativeiOS && !isIOSBrowser && (
                        <>
                            <div className="mt-4 mb-2">
                                <h3 className="text-sm font-bold text-content-secondary uppercase">
                                    {t('voiceModal_server_voices') || 'Server Voices'}
                                    {!serverTtsAvailable && <span className="ml-2 text-xs normal-case text-status-warning-foreground">({t('voiceModal_unavailable') || 'Unavailable'})</span>}
                                </h3>
                                <p className="text-xs text-content-tertiary mt-0.5">
                                    {t('voiceModal_server_voices_desc') || 'Generated by our server • May have longer loading times'}
                                </p>
                            </div>
                            {serverVoices.map(voice => {
                                const isServerVoiceChecked = selection.type === 'server' && (selection as {type: 'server', voiceId: string}).voiceId === voice.id;
                                return (
                                <div key={voice.id} className={`p-3 border ${isServerVoiceChecked ? 'border-accent-primary border-2 bg-accent-primary/10' : 'border-border-primary'} ${isVoiceEnabled(voice) ? 'bg-background-tertiary' : 'bg-background-primary opacity-60'}`}>
                                    <label className={`flex items-center ${isVoiceEnabled(voice) ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                                        <input
                                            type="radio"
                                            name="voice-selection"
                                            checked={isServerVoiceChecked}
                                            onChange={() => isVoiceEnabled(voice) && setSelection({ type: 'server', voiceId: voice.id })}
                                            disabled={!isVoiceEnabled(voice)}
                                            className="h-5 w-5 bg-background-secondary dark:bg-background-tertiary border-border-secondary text-accent-primary focus:ring-accent-primary [color-scheme:light] dark:[color-scheme:dark] disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                        <span className="ml-3 flex-1">
                                            <span className={`font-semibold ${isVoiceEnabled(voice) ? 'text-content-primary' : 'text-content-secondary'}`}>{voice.name} {isServerVoiceChecked && <span className="text-accent-primary">✓</span>}</span>
                                            <span className="block text-sm text-content-secondary">
                                                English
                                            </span>
                                        </span>
                                        <button
                                            onClick={(e) => { e.preventDefault(); isVoiceEnabled(voice) && onPreviewServerVoice(voice.id); }}
                                            disabled={!isVoiceEnabled(voice)}
                                            className="p-2 text-content-secondary hover:text-accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                            aria-label={`Preview voice ${voice.name}`}
                                        >
                                            <PlayIcon className="w-5 h-5" />
                                        </button>
                                    </label>
                                </div>
                            );
                            })}
                        </>
                    )}

                    {/* Native iOS Voices Section (only in native app) */}
                    {isNativeiOS && filteredNativeVoices.length > 0 && (
                        <>
                            <div className="mt-4 mb-2">
                                <h3 className="text-sm font-bold text-content-secondary uppercase">
                                    {t('voiceModal_native_voices') || 'Device Voices'}
                                </h3>
                                <p className="text-xs text-content-tertiary mt-0.5">
                                    {t('voiceModal_native_voices_desc') || 'Installed on your device • Instantly available'}
                                </p>
                            </div>
                            {filteredNativeVoices.map(voice => (
                                <div key={voice.identifier} className="p-3 border border-border-primary bg-background-tertiary">
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            name="voice-selection"
                                            checked={selection.type === 'native' && (selection as {type: 'native', voiceIdentifier: string}).voiceIdentifier === voice.identifier}
                                            onChange={() => setSelection({ type: 'native', voiceIdentifier: voice.identifier })}
                                            className="h-5 w-5 bg-background-secondary dark:bg-background-tertiary border-border-secondary text-accent-primary focus:ring-accent-primary [color-scheme:light] dark:[color-scheme:dark]"
                                        />
                                        <span className="ml-3 flex-1">
                                            <span className="font-semibold text-content-primary">
                                                {voice.name}
                                                {voice.quality !== 'default' && (
                                                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-content-tertiary/20 text-content-secondary">
                                                        {voice.quality}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="block text-sm text-content-secondary">
                                                {voice.language.startsWith('de') ? 'Deutsch' : voice.language.startsWith('en') ? 'English' : voice.language}
                                            </span>
                                        </span>
                                        <button
                                            onClick={(e) => { e.preventDefault(); onPreviewNativeVoice?.(voice.identifier); }}
                                            className="p-2 text-content-secondary hover:text-accent-primary"
                                            aria-label={`Preview voice ${voice.name}`}
                                        >
                                            <PlayIcon className="w-5 h-5" />
                                        </button>
                                    </label>
                                </div>
                            ))}
                        </>
                    )}

                    {/* Local Voices Section (hidden in native iOS app if native voices available) */}
                    {localVoices.length > 0 && !(isNativeiOS && filteredNativeVoices.length > 0) && (
                        <>
                            <div className="mt-4 mb-2">
                                <h3 className="text-sm font-bold text-content-secondary uppercase">
                                    {t('voiceModal_local_voices') || 'Device Voices'}
                                </h3>
                                <p className="text-xs text-content-tertiary mt-0.5">
                                    {t('voiceModal_local_voices_desc') || 'Installed on your device • Instantly available'}
                                </p>
                            </div>
                            {localVoices.map(voice => {
                                const selectionVoiceURI = selection.type === 'local' ? (selection as { type: 'local'; voiceURI: string }).voiceURI : null;
                                const isChecked = selection.type === 'local' && selectionVoiceURI === voice.voiceURI;
                                return (
                                <div key={voice.voiceURI} className={`p-3 border ${isChecked ? 'border-accent-primary border-2 bg-accent-primary/10' : 'border-border-primary bg-background-tertiary'}`}>
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            name="voice-selection"
                                            checked={isChecked}
                                            onChange={() => setSelection({ type: 'local', voiceURI: voice.voiceURI })}
                                            className="h-5 w-5 bg-background-secondary dark:bg-background-tertiary border-border-secondary text-accent-primary focus:ring-accent-primary [color-scheme:light] dark:[color-scheme:dark]"
                                        />
                                        <span className="ml-3 flex-1">
                                            <span className="font-semibold text-content-primary">{cleanVoiceName(voice.name)} {isChecked && <span className="text-accent-primary">✓</span>}</span>
                                            <span className="block text-sm text-content-secondary">
                                                {voice.lang.startsWith('de') ? 'Deutsch' : voice.lang.startsWith('en') ? 'English' : voice.lang}
                                            </span>
                                        </span>
                                        <button
                                            onClick={(e) => { e.preventDefault(); onPreviewVoice(voice); }}
                                            className="p-2 text-content-secondary hover:text-accent-primary"
                                            aria-label={`Preview voice ${voice.name}`}
                                        >
                                            <PlayIcon className="w-5 h-5" />
                                        </button>
                                    </label>
                                </div>
                            );
                            })}
                        </>
                    )}

                    {/* Warning if no local voices available */}
                    {localVoices.length === 0 && serverVoices.length > 0 && (
                        <div className="text-left text-content-secondary p-4 bg-status-info-background border border-status-info-border rounded-lg">
                            <div className="flex items-start gap-3">
                                <InfoIcon className="w-6 h-6 text-status-info-foreground flex-shrink-0 mt-1" />
                                <div>
                                    <p className="font-semibold text-status-info-foreground">
                                      {t('voiceModal_no_local_voices_title') || 'No device voices available'}
                                    </p>
                                    <p className="text-sm mt-1 text-status-info-foreground">
                                        {t('voiceModal_no_local_voices_desc') || 'Your device does not have suitable local voices. You can use server voices instead.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error if no voices at all */}
                    {localVoices.length === 0 && serverVoices.length === 0 && (
                        <div className="text-left text-content-secondary p-4 bg-status-warning-background border border-status-warning-border rounded-lg">
                            <div className="flex items-start gap-3">
                                <InfoIcon className="w-6 h-6 text-status-warning-foreground flex-shrink-0 mt-1" />
                                <div>
                                    <p className="font-semibold text-status-warning-foreground">
                                      {t('voiceModal_no_voices_title')}
                                    </p>
                                    <p className="text-sm mt-1 text-status-warning-foreground">
                                        {t('voiceModal_no_voices_desc')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Subtle footnote on iOS: server voices available in browser version */}
                    {(isIOSBrowser || isNativeiOS) && (
                        <p className="text-xs text-content-subtle mt-4 text-center">
                            {t('voiceModal_server_voices_web_hint')}
                        </p>
                    )}
                </div>

                <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-border-primary">
                    <Button onClick={onClose} variant="secondary">
                        {t('deleteAccount_cancel')}
                    </Button>
                    <Button onClick={handleSave}>
                        {t('voiceModal_save')}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default VoiceSelectionModal;