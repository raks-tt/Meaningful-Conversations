import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { flushSync, createPortal } from 'react-dom';
import { useModalOpen } from '../utils/modalUtils';
import { Bot, Message, Language, User, CoachingMode } from '../types';
import * as geminiService from '../services/geminiService';
import * as userService from '../services/userService';
import * as guestService from '../services/guestService';
import Spinner from './shared/Spinner';
import { PaperPlaneIcon } from './icons/PaperPlaneIcon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { SpeakerOnIcon } from './icons/SpeakerOnIcon';
import { SpeakerOffIcon } from './icons/SpeakerOffIcon';
import { PauseIcon } from './icons/PauseIcon';
import { PlayIcon } from './icons/PlayIcon';
import { RepeatIcon } from './icons/RepeatIcon';
import { SoundWaveIcon } from './icons/SoundWaveIcon';
import { ChatBubbleIcon } from './icons/ChatBubbleIcon';
import { XIcon } from './icons/XIcon';
import { LogOutIcon } from './icons/LogOutIcon';
import { GearIcon } from './icons/GearIcon';
import VoiceSelectionModal, { type VoiceSelection } from './VoiceSelectionModal';
import { useLocalization } from '../context/LocalizationContext';
import { selectVoice } from '../utils/voiceUtils';
import { FlagIcon } from './icons/FlagIcon';
import FeedbackModal from './FeedbackModal';
import { synthesizeSpeech, getBotVoiceSettings, saveBotVoiceSettings, type TtsMode, type BotVoiceSettings } from '../services/ttsService';
import { getApiBaseUrl } from '../services/api';
import * as api from '../services/api';
import { decryptPersonalityProfile } from '../utils/personalityEncryption';
import { isNativeiOS, nativeTtsService } from '../services/nativeTtsService';
import { speechService, isNativeApp } from '../services/capacitorSpeechService';
import { isDesktopWeb } from '../utils/platformDetection';
import { useWakeLock } from '../hooks/useWakeLock';

// Extend Window for AudioContext vendor prefix (used by meditation gong fallback)
interface CustomWindow extends Window {
  AudioContext: typeof AudioContext;
  webkitAudioContext: typeof AudioContext;
}
declare let window: CustomWindow;

// Wake Lock API types
interface WakeLockSentinel extends EventTarget {
  readonly released: boolean;
  readonly type: 'screen';
  release(): Promise<void>;
}

interface Navigator {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinel>;
  };
}

interface CoachInfoModalProps {
  bot: Bot;
  isOpen: boolean;
  onClose: () => void;
  coachingMode: 'off' | 'dpc' | 'dpfl';
}

const CoachInfoModal: React.FC<CoachInfoModalProps> = ({ bot, isOpen, onClose, coachingMode }) => {
    const { t } = useLocalization();
    useModalOpen(isOpen);
    if (!isOpen) return null;

    const botDescription = bot.description;
    const botStyle = bot.style;

  return createPortal(
    <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4" 
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-info-title"
    >
      <div 
        className="bg-background-secondary dark:bg-background-tertiary w-full max-w-md p-6 border border-border-secondary dark:border-border-primary shadow-xl text-center animate-fadeIn rounded-lg" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end -mt-2 -mr-2">
            <button onClick={onClose} className="p-2 text-content-secondary hover:text-content-primary" aria-label="Close">
                <XIcon className="w-6 h-6" />
            </button>
        </div>
        <img src={bot.avatar} alt={bot.name} className="w-24 h-24 rounded-full mx-auto -mt-6 mb-4 border-4 border-background-secondary dark:border-background-tertiary" />
        <h2 id="coach-info-title" className="text-2xl font-bold text-content-primary">{bot.name}</h2>
        <div className="flex flex-wrap justify-center gap-2 my-3">
          {botStyle.split(', ').map(tag => (
            <span key={tag} className="px-2.5 py-1 text-xs font-bold tracking-wide uppercase bg-background-tertiary text-content-secondary dark:bg-background-tertiary dark:text-content-secondary rounded-full">
              {tag}
            </span>
          ))}
        </div>
        <p className="mt-2 text-content-secondary leading-relaxed">{botDescription}</p>
        
        {/* Coaching Mode Info */}
        {coachingMode !== 'off' && (
          <div className="mt-4 p-3 bg-background-tertiary dark:bg-background-primary border border-border-primary rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-lg font-bold text-content-primary">
                {coachingMode === 'dpc' ? 'DPC Modus' : 'DPFL Modus'}
              </span>
            </div>
            <p className="text-xs text-content-secondary leading-relaxed">
              {coachingMode === 'dpc' 
                ? t('profile_coaching_mode_dpc_desc')
                : t('profile_coaching_mode_dpfl_desc')
              }
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};


interface ChatViewProps {
  bot: Bot;
  lifeContext: string;
  chatHistory: Message[];
  setChatHistory: React.Dispatch<React.SetStateAction<Message[]>>;
  onEndSession: () => void;
  onMessageSent: () => void;
  currentUser: User | null;
  isNewSession: boolean;
  encryptionKey?: CryptoKey | null;
  isTestMode?: boolean;
}


const ChatView: React.FC<ChatViewProps> = ({ bot, lifeContext, chatHistory, setChatHistory, onEndSession, onMessageSent, currentUser, isNewSession, encryptionKey, isTestMode }) => {
  const { t, language } = useLocalization();
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [decryptedProfile, setDecryptedProfile] = useState<any>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const baseTranscriptRef = useRef<string>('');
  const initialFetchInitiated = useRef<boolean>(false);

  // Handler to stop audio and end session
  const handleEndSession = useCallback(() => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    // Stop meditation gong audio if playing
    if (gongAudioRef.current) {
      gongAudioRef.current.pause();
      gongAudioRef.current.currentTime = 0;
    }
    
    // Stop Web Speech API TTS if active
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    // Stop speech status polling
    if (speechPollingRef.current) {
      clearInterval(speechPollingRef.current);
      speechPollingRef.current = null;
    }
    
    // Stop speech recognition if active (unified for all platforms)
    speechService.stop().catch(() => {});
    
    // Reset voice-related states
    setIsListening(false);
    setIsVoiceMode(false);
    
    // Reset TTS status
    setTtsStatus('idle');
    
    // Call the original onEndSession handler
    onEndSession();
  }, [onEndSession]);

  const [isListening, setIsListening] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(false); // Default to off
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // For native speech recognition (iOS), we use the capacitorSpeechService
  // which manages audio session properly. For web, we use Web Speech API.
  const usingNativeSpeech = isNativeApp;

  const [ttsStatus, setTtsStatus] = useState<'idle' | 'speaking' | 'paused'>('idle');
  const lastSpokenTextRef = useRef<string>('');
  
  // TTS Mode: 'local' uses Web Speech API, 'server' uses Piper TTS
  // Load bot-specific settings (guests are restricted to local voices only)
  const [ttsMode, setTtsMode] = useState<TtsMode>(() => {
    if (!currentUser) return 'local'; // Guests: no server TTS
    const settings = getBotVoiceSettings(bot.id);
    return settings.mode;
  });

  // Track if user selected "auto" mode
  const [isAutoMode, setIsAutoMode] = useState<boolean>(() => {
    const settings = getBotVoiceSettings(bot.id);
    return settings.isAuto;
  });
  
  // Audio element for server TTS playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  
  // Polling interval for reliable Web Speech API status detection
  // The onstart/onend events are unreliable in some browsers (especially Chrome)
  const speechPollingRef = useRef<number | null>(null);
  
  // Lock to prevent concurrent speak() calls (prevents overlapping TTS)
  const isSpeakingRef = useRef<boolean>(false);
  
  // Flag to track intentional audio stops (to avoid error events when clearing src)
  const isStoppingAudioRef = useRef<boolean>(false);
  
  // Web Audio API context for iOS audio session management
  // Once resumed during user interaction, allows audio playback without further interaction
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // iOS/iPadOS detection (for Bluetooth profile switching delay)
  const isIOS = useMemo(() => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);
  
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(() => {
    const settings = getBotVoiceSettings(bot.id);
    return settings.voiceId;
  });
  const [isCoachInfoOpen, setIsCoachInfoOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackMessages, setFeedbackMessages] = useState<{ user: Message | null; bot: Message | null }>({ user: null, bot: null });
  
  // Meditation state
  const [meditationState, setMeditationState] = useState<{
    isActive: boolean;
    duration: number;
    remaining: number;
    introText: string;
    closingText: string;
    originalMode: 'text' | 'voice';
  } | null>(null);
  const gongAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Guest limit state
  const [guestLimitRemaining, setGuestLimitRemaining] = useState<number | null>(null);
  const [guestFingerprint, setGuestFingerprint] = useState<string | null>(null);
  const isGuest = !currentUser;


  const botGender = useMemo((): 'male' | 'female' => {
      switch (bot.id) {
          case 'gloria-life-context':
          case 'gloria-interview':
          case 'ava-strategic':
          case 'chloe-cbt':
              return 'female';
          case 'max-ambitious':
          case 'rob':
          case 'kenji-stoic':
          case 'nexus-gps':
          default:
              return 'male';
      }
  }, [bot.id]);

  // Helper function to save voice settings
  const saveLanguageVoiceSettings = useCallback((mode: TtsMode, voiceId: string | null, isAuto: boolean) => {
    console.log('[TTS Save] Saving voice settings:', { bot: bot.id, mode, voiceId, isAuto });
    const settings = { mode, voiceId, isAuto };
    saveBotVoiceSettings(bot.id, settings);
    console.log('[TTS Save] Settings after save:', settings);
  }, [bot.id]);

  // Reset voice settings when language changes
  // Derive coaching mode from user profile
  const coachingMode = currentUser?.coachingMode || 'off';
  
  // Nobody (nexus-gps) doesn't support DPFL - downgrade to DPC
  // DPFL requires full coaching sessions which Nobody doesn't conduct
  const effectiveCoachingMode = (bot.id === 'nexus-gps' && coachingMode === 'dpfl') ? 'dpc' : coachingMode;
  
  // Load and decrypt personality profile when coaching mode is active
  useEffect(() => {
    const loadProfile = async () => {
      if (coachingMode && coachingMode !== 'off' && currentUser && encryptionKey) {
        try {
          const profileData = await api.loadPersonalityProfile();
          if (profileData && profileData.encryptedData) {
            // Decrypt client-side before sending to backend
            const decrypted = await decryptPersonalityProfile(profileData.encryptedData, encryptionKey);
            setDecryptedProfile(decrypted);
          }
        } catch (error) {
          console.error('Failed to load personality profile:', error);
          setDecryptedProfile(null);
        }
      } else {
        setDecryptedProfile(null);
      }
    };
    loadProfile();
  }, [coachingMode, currentUser, encryptionKey]);

  useEffect(() => {
    const settings = getBotVoiceSettings(bot.id);

    setSelectedVoiceURI(settings.voiceId);
    setTtsMode(settings.mode);
    setIsAutoMode(settings.isAuto);
  }, [language, bot.id]);

  // Initialize gong audio with fallback to programmatic sound
  useEffect(() => {
    const audio = new Audio('/sounds/meditation-gong.ogg');
    audio.addEventListener('error', () => {
      // Fallback to programmatic gong if file not found
    });
    gongAudioRef.current = audio;
  }, []);


  // Check if saved voice is available, fallback to auto if not
  useEffect(() => {
    const checkVoiceAvailability = async () => {
      // Guests are restricted to local TTS only - skip all server voice checks
      if (!currentUser) {
        console.log('[TTS Init] Guest user - forcing local TTS only');
        setTtsMode('local');
        return;
      }

      // IMPORTANT: Read directly from localStorage to avoid stale closure issues
      // The previous useEffect sets state from localStorage, but state updates are batched
      // so we'd see old values here if we used state directly.
      const settings = getBotVoiceSettings(bot.id);
      const savedMode = settings.mode;
      const savedVoiceId = settings.voiceId;
      const savedIsAuto = settings.isAuto;
      
      console.log('[TTS Init] Checking voice availability:', { savedMode, savedVoiceId, savedIsAuto, isNativeiOS });
      
      // Helper function to get best server voice for bot
      const getBestServerVoice = (botId: string, lang: string): string | null => {
        // All bots use English voices
        const maleBots = ['max-ambitious', 'rob', 'kenji-stoic', 'nexus-gps'];
        const gender = maleBots.includes(botId) ? 'male' : 'female';

        // Map to voice IDs (English only)
        return gender === 'female' ? 'en-amy' : 'en-ryan';
      };
      
      try {
        const apiBaseUrl = getApiBaseUrl();
        const healthResponse = await fetch(`${apiBaseUrl}/api/tts/health`, { 
          signal: AbortSignal.timeout(3000) 
        });
        const healthData = await healthResponse.json();
        const serverAvailable = healthData.status === 'ok' && healthData.piperAvailable;
        
        // Check if current saved selection is available
        if (savedMode === 'server' && savedVoiceId) {
          // User has a server voice selected
          if (!serverAvailable) {
            // Server not available - temporarily use local fallback
            console.warn('[TTS Init] Server unavailable, temporarily using local (keeping saved preference)');
            
            // Temporarily use local fallback for this session
            setTtsMode('local');
            // DO NOT clear selectedVoiceURI or overwrite localStorage
            // The user's server voice preference stays saved and will be retried next time
          } else {
            // Server available, keep selection
            console.log('[TTS Init] Server voice available, keeping:', savedVoiceId);
          }
        } else if (savedMode === 'local' && savedVoiceId) {
          // User has a local voice selected - check if it exists
          const isNativeVoiceId = savedVoiceId.startsWith('com.apple.voice');
          
          if (isNativeVoiceId && isNativeiOS) {
            // Native iOS voice - it's valid, keep it
            console.log('[TTS Init] Native iOS voice valid, keeping:', savedVoiceId);
          } else if (isNativeVoiceId && !isNativeiOS) {
            // Native voice but not on native iOS - reset to auto
            console.warn('[TTS Init] Native voice saved but not on native iOS, resetting to auto mode');
            setIsAutoMode(true);
            setSelectedVoiceURI(null);
            saveLanguageVoiceSettings('local', null, true);
          } else {
            // Web Speech API voice - check if it exists
            const voiceExists = window.speechSynthesis.getVoices().some(v => v.voiceURI === savedVoiceId);
            if (!voiceExists) {
              // Local voice not available anymore (browser update, different device, etc.)
              // Clear it permanently since local voices are device-specific
              console.warn('[TTS Init] Saved local voice no longer exists, resetting to auto mode');
              setIsAutoMode(true);
              setSelectedVoiceURI(null);
              saveLanguageVoiceSettings('local', null, true);
            } else {
              console.log('[TTS Init] Local voice valid, keeping:', savedVoiceId);
            }
          }
        } else if (savedIsAuto || (!savedVoiceId && savedMode === 'local')) {
          // Auto mode or no selection - choose best available
          console.log('[TTS Init] Auto mode - selecting best voice for bot gender:', botGender);
          
          // On native iOS, prefer native TTS with premium/enhanced voices matching bot gender
          if (isNativeiOS) {
            try {
              const nativeVoices = await nativeTtsService.getVoicesForLanguage(language);
              if (nativeVoices.length > 0) {
                // Filter voices by bot gender
                const femaleNames = ['anna', 'helena', 'petra', 'katja', 'marlene', 'vicki', 'marie', 
                                     'samantha', 'karen', 'moira', 'tessa', 'siri', 'allison', 'ava', 'susan', 'serena', 'nicky'];
                const maleNames = ['markus', 'viktor', 'yannick', 'martin', 'hans', 'daniel', 'tom', 'alex', 'aaron', 'fred'];
                
                const genderFilteredVoices = nativeVoices.filter(v => {
                  const nameLower = v.name.toLowerCase();
                  if (botGender === 'male') {
                    return maleNames.some(n => nameLower.includes(n)) || !femaleNames.some(n => nameLower.includes(n));
                  } else {
                    return femaleNames.some(n => nameLower.includes(n)) || !maleNames.some(n => nameLower.includes(n));
                  }
                });
                
                const candidateVoices = genderFilteredVoices.length > 0 ? genderFilteredVoices : nativeVoices;
                
                // Pick best quality voice (premium > enhanced > default)
                const bestVoice = candidateVoices.find(v => v.quality === 'premium') 
                               || candidateVoices.find(v => v.quality === 'enhanced')
                               || candidateVoices[0];
                console.log('[TTS Init] Auto mode on native iOS - selected:', bestVoice.name, bestVoice.quality);
                setSelectedVoiceURI(bestVoice.identifier);
                setTtsMode('local');
                saveLanguageVoiceSettings('local', bestVoice.identifier, true);
                return; // Skip server voice check
              }
            } catch (error) {
              console.warn('[TTS Init] Could not get native voices:', error);
            }
          }
          
          if (serverAvailable) {
            const bestVoice = getBestServerVoice(bot.id, language);
            if (bestVoice) {
              // Server voice available for this bot
              console.log('[TTS Init] Auto mode - selected server voice:', bestVoice);
              setSelectedVoiceURI(bestVoice);
              setTtsMode('server');
              saveLanguageVoiceSettings('server', bestVoice, true);
            } else {
              // No server voice for this bot/language - use local
              setSelectedVoiceURI(null);
              setTtsMode('local');
              saveLanguageVoiceSettings('local', null, true);
            }
          } else {
            // Server not available, use local auto-selection (handled by speak function)
            setSelectedVoiceURI(null);
            setTtsMode('local');
            saveLanguageVoiceSettings('local', null, true);
          }
        }
      } catch (error) {
        console.warn('[TTS Init] Could not check voice availability:', error);
        // On error, if user had a server voice selected, temporarily fall back to local
        // BUT: Keep the saved preference in localStorage for next time!
        if (savedMode === 'server') {
          console.warn('[TTS Init] Temporarily switching to local mode (keeping saved preference)');
          // Temporarily use local mode for this session
          setTtsMode('local');
          // DO NOT clear selectedVoiceURI or overwrite localStorage
          // The user's preference stays saved and will be retried next session
        }
      }
    };
    
    checkVoiceAvailability();
  }, [bot.id, language, currentUser]); // Re-run when bot, language or user changes

  // Auto-scroll to bottom when switching to text mode
  useEffect(() => {
    if (!isVoiceMode && chatContainerRef.current) {
      setTimeout(() => {
        chatContainerRef.current?.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [isVoiceMode]);
  
  // Initialize guest limit checking
  useEffect(() => {
    if (isGuest) {
      const fingerprint = guestService.getOrCreateFingerprint();
      setGuestFingerprint(fingerprint);
      
      // Check guest limit
      guestService.checkGuestLimit(fingerprint).then(result => {
        setGuestLimitRemaining(result.remaining);
      }).catch(error => {
        console.error('Failed to check guest limit:', error);
        // On error, allow (fail open)
        setGuestLimitRemaining(50);
      });
    }
  }, [isGuest]);

  useEffect(() => {
    if (!window.speechSynthesis) {
      console.log('[Voices] speechSynthesis API not available');
      return;
    }

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      // Debug: Log all available voices
      console.log('[Voices] getVoices() returned', availableVoices.length, 'voices');
      if (availableVoices.length > 0) {
        // Log German voices specifically
        const germanVoices = availableVoices.filter(v => v.lang.toLowerCase().startsWith('de'));
        console.log('[Voices] German voices:', germanVoices.map(v => ({
          name: v.name,
          lang: v.lang,
          localService: v.localService,
          voiceURI: v.voiceURI
        })));
        setVoices(availableVoices);
      }
    };

    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    loadVoices();

    // iOS workaround: try loading again after a delay
    const iosRetry = setTimeout(() => {
      if (voices.length === 0) {
        console.log('[Voices] Retrying voice load (iOS workaround)');
        loadVoices();
      }
    }, 1000);

    return () => {
      clearTimeout(iosRetry);
      if (window.speechSynthesis) {
        window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
        // Do NOT call cancel() - it interferes with ongoing TTS during StrictMode re-mounts
      }
    };
  }, []);

  // Wake Lock: Keep screen active in voice mode to prevent the OS from
  // locking the screen and killing the microphone mid-sentence.
  const wakeLock = useWakeLock();
  useEffect(() => {
    if (isVoiceMode) {
      wakeLock.request();
    } else {
      wakeLock.release();
    }
  }, [isVoiceMode, wakeLock.request, wakeLock.release]);

  // iOS Bluetooth Audio Fix: Use MediaSession API to signal this is an audio app
  // This helps iOS maintain a stable Bluetooth audio route
  useEffect(() => {
    // Check both mediaSession and MediaMetadata availability
    if (!isVoiceMode || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    
    console.log('[iOS Audio Fix] Activating MediaSession to signal audio app');
    
    // Set metadata to signal this is a media/audio session
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Meaningful Conversations',
      artist: bot.name || 'Coach',
      album: 'Voice Chat'
    });
    
    // Don't bind action handlers - we don't want EarPods buttons to control anything
    // Just the presence of MediaSession helps iOS prioritize audio routing
    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    
    // Cleanup: Clear MediaSession when leaving voice mode
    return () => {
      console.log('[iOS Audio Fix] Deactivating MediaSession');
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
    };
  }, [isVoiceMode, bot.name]);

  // Track current audio blob URL for cleanup
  const currentAudioUrlRef = useRef<string | null>(null);
  
  // Audio cache for instant replay - stores the last generated audio
  const cachedAudioRef = useRef<{ text: string; url: string; blob: Blob } | null>(null);
  
  // iOS Audio Session Unlock: Resume AudioContext during user interaction
  // This allows audio.play() to work later without requiring another user interaction
  const unlockAudioSession = useCallback(() => {
    // Create AudioContext if it doesn't exist
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const ctx = audioContextRef.current;
    // Resume if suspended (required for iOS)
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    
    // Also play a silent audio to warm up the HTML5 Audio element
    const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
    silentAudio.volume = 0.01;
    silentAudio.play().then(() => {
      silentAudio.pause();
    }).catch(() => {});
  }, []);

  // iOS Audio Session Reset: After speech recognition, iOS may be stuck in "playAndRecord" mode
  // which causes TTS to sound "tinny/telephony". This function resets the audio session by:
  // 1. Closing the existing AudioContext (releases the recording session)
  // 2. Creating a fresh AudioContext configured for playback only
  // 3. Playing a short tone to force iOS to switch to normal playback mode
  const resetAudioSessionAfterRecording = useCallback(async () => {
    if (!isIOS) return;
    
    // Close existing context to release recording session
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch (e) {
        // Ignore close errors
      }
      audioContextRef.current = null;
    }
    
    // Create fresh AudioContext - this should use standard playback mode
    try {
      const freshCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = freshCtx;
      
      // Play a very short tone to force iOS to initialize the new audio session
      // Using 44100 Hz sample rate (CD quality) to signal we want high-quality output
      const oscillator = freshCtx.createOscillator();
      const gainNode = freshCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(freshCtx.destination);
      
      // Very quiet, very short tone (nearly inaudible)
      gainNode.gain.setValueAtTime(0.01, freshCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, freshCtx.currentTime + 0.1);
      
      oscillator.frequency.setValueAtTime(440, freshCtx.currentTime); // A4 note
      oscillator.start(freshCtx.currentTime);
      oscillator.stop(freshCtx.currentTime + 0.1);
    } catch (e) {
      // Ignore errors
    }
  }, [isIOS]);
  
  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  const speak = useCallback(async (text: string, isMeditation: boolean = false, isRetry: boolean = false, forceLocalTts: boolean = false) => {
    if (!isTtsEnabled || !text.trim()) {
      return;
    }
    
    // Prevent concurrent speak() calls (unless it's a retry from the same call)
    // This prevents overlapping TTS when user sends messages quickly
    if (isSpeakingRef.current && !isRetry) {
      console.log('[TTS] Skipping speak() - already speaking');
      // Cancel current speech and start new one
      window.speechSynthesis?.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    }
    isSpeakingRef.current = true;
    
    // Set loading state IMMEDIATELY and force React to render before continuing
    // Use flushSync to force immediate render - React 18 batches state updates across async boundaries
    flushSync(() => {
      setIsLoadingAudio(true);
    });
     
     const cleanText = text
        .replace(/#{1,6}\s/g, '')
        .replace(/(\*\*|__|\*|_|~~|`|```)/g, '')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/!\[[^\]]*\]\([^\)]*\)/g, '')
        .replace(/^-{3,}|^\*{3,}|^_{3,}/gm, '')
        .replace(/^>\s?/gm, '')
        // Remove emojis from TTS output (they're spoken as descriptions like "grinning face")
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '');

    lastSpokenTextRef.current = cleanText;

    // iOS Safari has strict autoplay policies that prevent audio.play() outside of
    // direct user interaction. Server TTS requires async API calls which break this.
    // Solution: Force local TTS on iOS Safari. EXCEPTION: Native iOS apps (Capacitor) 
    // don't have this restriction, so allow server TTS there.
    // Also validate that selectedVoiceURI is a valid server voice ID if ttsMode is 'server'
    // to prevent corrupted settings from causing errors.
    const isValidServerVoice = selectedVoiceURI && ['de-thorsten', 'de-eva', 'en-amy', 'en-ryan'].includes(selectedVoiceURI);
    const isNativeVoice = selectedVoiceURI?.startsWith('com.apple.voice');
    
    // On native iOS: always use native TTS (device voices), never server TTS
    // On iOS Safari: force local (Web Speech API) due to autoplay restrictions
    // forceLocalTts is used when server TTS fails and we need to fallback immediately
    // (React state updates are async, so we can't rely on ttsMode being updated yet)
    const iosSafariForcesLocal = isIOS && !isNativeiOS;
    const nativeiOSForcesLocal = isNativeiOS && ttsMode === 'server'; // Legacy settings guard: native iOS never uses server TTS
    const guestForcesLocal = !currentUser; // Guests cannot use server TTS
    const effectiveTtsMode = forceLocalTts ? 'local' : (guestForcesLocal ? 'local' : (iosSafariForcesLocal ? 'local' : (nativeiOSForcesLocal ? 'local' : (ttsMode === 'server' && !isValidServerVoice && selectedVoiceURI ? 'local' : ttsMode))));

    // Log and fix corrupted state: ttsMode='server' but selectedVoiceURI is a local voice name
    if (ttsMode === 'server' && selectedVoiceURI && !isValidServerVoice) {
      console.warn('[TTS] Corrupted settings detected: ttsMode=server but selectedVoiceURI is not a valid server voice:', selectedVoiceURI, '- using local TTS');
    }

    // Native iOS with native voice selected - use AVSpeechSynthesizer for premium quality
    if (isNativeiOS && isNativeVoice) {
      console.log('[TTS] Using native iOS TTS with voice:', selectedVoiceURI);
      const loadingStartTime = Date.now();
      
      try {
        // Stop any existing speech
        await nativeTtsService.stop();
        
        // Set up speech end listener
        await nativeTtsService.addListener('speechEnd', () => {
          setTtsStatus('idle');
          setIsLoadingAudio(false);
          isSpeakingRef.current = false;
        });
        
        await nativeTtsService.addListener('speechStart', () => {
          const elapsed = Date.now() - loadingStartTime;
          const remainingTime = Math.max(0, 300 - elapsed);
          setTimeout(() => {
            setTtsStatus('speaking');
            setIsLoadingAudio(false);
          }, remainingTime);
        });
        
        // Speak with native TTS
        const result = await nativeTtsService.speak({
          text: cleanText,
          voiceIdentifier: selectedVoiceURI || undefined,
          rate: 0.5,
          pitch: 1.0,
          volume: 1.0
        });
        
        if (!result.completed && !result.cancelled) {
          console.warn('[TTS] Native TTS did not complete successfully');
        }
      } catch (error) {
        console.error('[TTS] Native iOS TTS error:', error);
        setTtsStatus('idle');
        setIsLoadingAudio(false);
        isSpeakingRef.current = false;
      }
      return;
    }

    // Server TTS mode (disabled on iOS Safari due to autoplay restrictions, but works on native iOS)
    if (effectiveTtsMode === 'server') {
      try {
        const loadingStartTime = Date.now();
        
        // Stop and cleanup any existing audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
          audioRef.current = null;
        }
        
        let audioUrl: string;
        let audioBlob: Blob;
        
        // Check if we have cached audio for this exact text (instant replay)
        if (cachedAudioRef.current && cachedAudioRef.current.text === cleanText) {
          console.log('[TTS] Using cached audio for instant replay');
          audioUrl = cachedAudioRef.current.url;
          audioBlob = cachedAudioRef.current.blob;
          // Skip loading spinner for cached audio - it's instant
          setIsLoadingAudio(false);
        } else {
          // Revoke previous blob URL to prevent memory leaks (only if not reusing cache)
          if (currentAudioUrlRef.current && currentAudioUrlRef.current !== cachedAudioRef.current?.url) {
            URL.revokeObjectURL(currentAudioUrlRef.current);
            currentAudioUrlRef.current = null;
          }
          
          // Clear old cache before generating new audio
          if (cachedAudioRef.current && cachedAudioRef.current.url !== currentAudioUrlRef.current) {
            URL.revokeObjectURL(cachedAudioRef.current.url);
          }
          
          const voiceIdToUse = (ttsMode === 'server' && selectedVoiceURI) ? selectedVoiceURI : null;
          audioBlob = await synthesizeSpeech(cleanText, bot.id, language, isMeditation, voiceIdToUse);
          
          // Ensure loading spinner is visible for at least 300ms
          const elapsed = Date.now() - loadingStartTime;
          if (elapsed < 300) {
            await new Promise(resolve => setTimeout(resolve, 300 - elapsed));
          }
          
          audioUrl = URL.createObjectURL(audioBlob);
          
          // Cache the audio for instant replay
          cachedAudioRef.current = { text: cleanText, url: audioUrl, blob: audioBlob };
        }
        
        currentAudioUrlRef.current = audioUrl;
        
        // Create a FRESH audio element for each playback
        // This resets iOS audio session and ensures consistent quality
        const audio = new Audio();
        audioRef.current = audio;
        
        // Set up event handlers
        audio.addEventListener('play', () => {
          setTtsStatus('speaking');
          setIsLoadingAudio(false); // Hide spinner when audio actually starts playing
        });
        audio.addEventListener('pause', () => {
          // Only set paused if not ended (ended also triggers pause)
          if (!audio.ended) setTtsStatus('paused');
        });
        audio.addEventListener('ended', () => {
          setTtsStatus('idle');
          isSpeakingRef.current = false; // Release lock when audio ends
          // Don't revoke the URL here - keep it cached for instant replay
          // The cache will be cleared when new audio is generated
          // Don't null audioRef here - it's still needed for pause/resume
        });
        audio.addEventListener('error', (e) => {
          const audioError = audio.error;
          const errorCode = audioError?.code;
          const errorMessage = audioError?.message || 'Unknown error';
          // Ignore errors from intentionally stopping audio (e.g., when opening voice settings)
          if (isStoppingAudioRef.current) {
            console.log('[TTS] Audio stopped intentionally, ignoring error event');
            return;
          }
          
          // Ignore errors from stale (replaced) audio objects — when a new speak() call
          // cancels the previous audio, the old Audio element fires an error event
          // asynchronously. This must not clear the loading state of the NEW request.
          if (audioRef.current !== audio) {
            console.log('[TTS] Ignoring error from stale audio object (replaced by new speak call)');
            return;
          }
          
          // Ignore "Empty src" errors - these are benign race conditions that occur when:
          // 1. Audio is stopped/cleared (src='') while playing
          // 2. Browser queues error event
          // 3. By the time handler runs, src may have changed
          // These don't affect functionality - the next audio will play normally
          if (errorCode === 4 && errorMessage.includes('Empty src')) {
            console.log('[TTS] Ignoring "Empty src" error (benign race condition)');
            return;
          }
          
          const errorCodes: Record<number, string> = {1:'MEDIA_ERR_ABORTED',2:'MEDIA_ERR_NETWORK',3:'MEDIA_ERR_DECODE',4:'MEDIA_ERR_SRC_NOT_SUPPORTED'};
          console.error('[TTS] Audio playback error:', {
            code: errorCode,
            codeName: errorCode ? errorCodes[errorCode] : 'NO_CODE',
            message: errorMessage,
            src: audio.src ? 'blob URL present' : 'no src',
            readyState: audio.readyState,
            networkState: audio.networkState,
            event: e
          });
          setTtsStatus('idle');
          setIsLoadingAudio(false);
          isSpeakingRef.current = false; // Release lock on error
        });
        
        audio.src = audioUrl;
        await audio.play();
      } catch (error) {
        console.error('[TTS] Server TTS error:', error);
        // DON'T set isLoadingAudio to false here - keep spinner visible during fallback
        setTtsStatus('idle');
        
        // Fallback to local mode but don't save preference
        // This allows retry on next session if server comes back
        setTtsMode('local');
        // Pass isRetry=true to bypass the speaking lock AND forceLocalTts=true to skip
        // server TTS check (React state updates are async, so ttsMode might not be 'local' yet)
        setTimeout(() => speak(text, isMeditation, true, true), 100);
      }
      return;
    }

    // Local TTS mode (Web Speech API) - fallback when not using server or native TTS
    if (!window.speechSynthesis) {
      setIsLoadingAudio(false);
      isSpeakingRef.current = false;
      return;
    }
    
    const loadingStartTime = Date.now();
    
    // Stop any existing polling
    if (speechPollingRef.current) {
      clearInterval(speechPollingRef.current);
      speechPollingRef.current = null;
    }
    
    window.speechSynthesis.cancel();
    
    // Wait for cancel to complete (browser bug workaround)
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Start polling to reliably detect speech status
    // Web Speech API events (onstart/onend) are unreliable in Chrome and other browsers
    let hasStartedSpeaking = false;
    speechPollingRef.current = window.setInterval(() => {
      const synth = window.speechSynthesis;
      
      if (synth.speaking && !synth.paused && !hasStartedSpeaking) {
        // Speech has started - ensure minimum loading time then show speaking status
        hasStartedSpeaking = true;
        const elapsed = Date.now() - loadingStartTime;
        const remainingTime = Math.max(0, 300 - elapsed);
        setTimeout(() => {
          setTtsStatus('speaking');
          setIsLoadingAudio(false);
        }, remainingTime);
      } else if (!synth.speaking && !synth.pending && hasStartedSpeaking) {
        // Speech has ended
        setTtsStatus('idle');
        isSpeakingRef.current = false; // Release lock when speech ends
        if (speechPollingRef.current) {
          clearInterval(speechPollingRef.current);
          speechPollingRef.current = null;
        }
      }
    }, 50);

    // Keep event handlers as backup (some browsers may fire them reliably)
    utterance.onstart = () => {
      if (!hasStartedSpeaking) {
        hasStartedSpeaking = true;
        const elapsed = Date.now() - loadingStartTime;
        const remainingTime = Math.max(0, 300 - elapsed);
        setTimeout(() => {
          setTtsStatus('speaking');
          setIsLoadingAudio(false);
        }, remainingTime);
      }
    };
    utterance.onend = () => {
      setTtsStatus('idle');
      isSpeakingRef.current = false; // Release lock when speech ends
      if (speechPollingRef.current) {
        clearInterval(speechPollingRef.current);
        speechPollingRef.current = null;
      }
    };
    utterance.onerror = () => {
      setTtsStatus('idle');
      setIsLoadingAudio(false);
      isSpeakingRef.current = false; // Release lock on error
      if (speechPollingRef.current) {
        clearInterval(speechPollingRef.current);
        speechPollingRef.current = null;
      }
    };
    
    let finalVoice: SpeechSynthesisVoice | null = null;
    
    if (selectedVoiceURI) {
        finalVoice = voices.find(v => v.voiceURI === selectedVoiceURI) || null;
    }

    if (!finalVoice) {
        // Use bot's native gender for all languages
        const gender = botGender;

        finalVoice = selectVoice(voices, language, gender);
    }

    if (isMeditation && (bot.id === 'rob' || bot.id === 'kenji-stoic')) {
        utterance.rate = 0.9;
    }

    if (finalVoice) {
        utterance.voice = finalVoice;
    }

    window.speechSynthesis.speak(utterance);
    
    // Safari bug workaround: sometimes speak() silently fails (speaking stays false)
    // In this case, we need to resume and/or retry
    if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
      // First try: resume in case it's paused internally
      window.speechSynthesis.resume();
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // If still not speaking, cancel and retry
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Create fresh utterance for retry
        const retryUtterance = new SpeechSynthesisUtterance(cleanText);
        retryUtterance.onstart = utterance.onstart;
        retryUtterance.onend = utterance.onend;
        retryUtterance.onerror = utterance.onerror;
        if (finalVoice) retryUtterance.voice = finalVoice;
        
        window.speechSynthesis.speak(retryUtterance);
      }
    }
    
    // Browser bug workaround: force TTS to start if paused
    setTimeout(() => {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 10);
  }, [isTtsEnabled, voices, bot.id, selectedVoiceURI, language, botGender, ttsMode]);

  const handlePreviewVoice = useCallback(async (voice: SpeechSynthesisVoice) => {
    if (!voice || !window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const sampleText = t('voiceModal_preview_text');
    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.voice = voice;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onerror = (e) => console.error('[TTS Preview] Error:', e);
    
    window.speechSynthesis.speak(utterance);
  }, [t]);

  const handlePreviewServerVoice = useCallback(async (voiceId: string) => {
    const sampleText = t('voiceModal_preview_text');
    try {
      const audioBlob = await synthesizeSpeech(sampleText, bot.id, language, false, voiceId);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      audio.play().catch(console.error);
    } catch (error) {
      console.error('Failed to preview server voice:', error);
      // Show user-friendly error message
      alert(t('tts_server_unavailable') || 'Server TTS is not available. This feature requires a running backend with Piper TTS installed. You can still use local device voices.');
    }
  }, [t, bot.id, language]);

  const handlePreviewNativeVoice = useCallback(async (voiceIdentifier: string) => {
    if (!isNativeiOS) return;
    
    const sampleText = t('voiceModal_preview_text');
    try {
      // Stop any current speech first
      await nativeTtsService.stop();
      
      // Speak with the selected native voice
      await nativeTtsService.speak({
        text: sampleText,
        voiceIdentifier: voiceIdentifier,
        rate: 0.5,
        pitch: 1.0,
        volume: 1.0
      });
    } catch (error) {
      console.error('Failed to preview native voice:', error);
    }
  }, [t]);

  const handleSelectVoice = useCallback(async (selection: VoiceSelection) => {
    console.log('[TTS Select] handleSelectVoice called with:', selection.type);
    
    if (selection.type === 'auto') {
      // Save auto mode for this bot
      setIsAutoMode(true);
      
      // In native iOS app, auto mode uses native TTS with best voice matching bot gender
      if (isNativeiOS) {
        console.log('[TTS Select] Auto mode - fetching native voices for language:', language, 'botGender:', botGender);
        const voices = await nativeTtsService.getVoicesForLanguage(language);
        
        if (voices.length > 0) {
          // Filter voices by bot gender
          // Female voice names (common German/English)
          const femaleNames = ['anna', 'helena', 'petra', 'katja', 'marlene', 'vicki', 'marie', 
                               'samantha', 'karen', 'moira', 'tessa', 'siri', 'allison', 'ava', 'susan', 'serena', 'nicky'];
          const maleNames = ['markus', 'viktor', 'yannick', 'martin', 'hans', 'daniel', 'tom', 'alex', 'aaron', 'fred'];
          
          const genderFilteredVoices = voices.filter(v => {
            const nameLower = v.name.toLowerCase();
            if (botGender === 'male') {
              // For male bot, prefer male voices, exclude known female names
              return maleNames.some(n => nameLower.includes(n)) || !femaleNames.some(n => nameLower.includes(n));
            } else {
              // For female bot, prefer female voices, exclude known male names
              return femaleNames.some(n => nameLower.includes(n)) || !maleNames.some(n => nameLower.includes(n));
            }
          });
          
          // If no gender-matched voices, fall back to all voices
          const candidateVoices = genderFilteredVoices.length > 0 ? genderFilteredVoices : voices;
          
          // Pick best quality voice (premium > enhanced > default)
          const bestVoice = candidateVoices.find(v => v.quality === 'premium') 
                         || candidateVoices.find(v => v.quality === 'enhanced')
                         || candidateVoices[0];
          
          console.log('[TTS Select] Auto mode - selected:', bestVoice.name, bestVoice.quality, 'from', candidateVoices.length, 'candidates');
          setSelectedVoiceURI(bestVoice.identifier);
          setTtsMode('local'); // Use 'local' mode but with native identifier
          saveLanguageVoiceSettings('local', bestVoice.identifier, true);
          setIsVoiceModalOpen(false);
          return;
        }
        // Native iOS but no native voices found (unlikely) — fall back to local Web Speech API
        console.log('[TTS Select] Auto mode - native iOS but no native voices found, using local');
        setSelectedVoiceURI(null);
        setTtsMode('local');
        saveLanguageVoiceSettings('local', null, true);
        setIsVoiceModalOpen(false);
        return;
      }
      
      // Non-iOS platforms: Try to use best available server voice, fallback to local
      try {
        const apiBaseUrl = getApiBaseUrl();
        const healthResponse = await fetch(`${apiBaseUrl}/api/tts/health`, { 
          signal: AbortSignal.timeout(3000) 
        });
        const healthData = await healthResponse.json();
        
        if (healthData.status === 'ok' && healthData.piperAvailable) {
          // Server TTS available - select best voice for bot
          const getBestServerVoice = (botId: string, lang: string): string | null => {
            // All bots use English voices
            const maleBots = ['max-ambitious', 'rob', 'kenji-stoic', 'nexus-gps', 'victor-bowen'];
            const gender = maleBots.includes(botId) ? 'male' : 'female';

            // Map to voice IDs (English only)
            return gender === 'female' ? 'en-amy' : 'en-ryan';
          };
          
          const bestVoice = getBestServerVoice(bot.id, language);
          if (bestVoice) {
            setSelectedVoiceURI(bestVoice);
            setTtsMode('server');
            saveLanguageVoiceSettings('server', bestVoice, true);
          } else {
            // No server voice available (e.g., female German) - use local
            setSelectedVoiceURI(null);
            setTtsMode('local');
            saveLanguageVoiceSettings('local', null, true);
          }
        } else {
          // Server TTS not available - use local
          setSelectedVoiceURI(null);
          setTtsMode('local');
          saveLanguageVoiceSettings('local', null, true);
        }
      } catch (error) {
        // Error checking server - fallback to local
        console.warn('[TTS Select] Auto mode - failed to check server, using local:', error);
        setSelectedVoiceURI(null);
        setTtsMode('local');
        saveLanguageVoiceSettings('local', null, true);
      }
    } else if (selection.type === 'local') {
      setIsAutoMode(false);
      setSelectedVoiceURI(selection.voiceURI);
      setTtsMode('local');
      saveLanguageVoiceSettings('local', selection.voiceURI, false);
    } else if (selection.type === 'server') {
      setIsAutoMode(false);
      setSelectedVoiceURI(selection.voiceId);
      setTtsMode('server');
      saveLanguageVoiceSettings('server', selection.voiceId, false);
    } else if (selection.type === 'native') {
      // Native iOS voice selected
      console.log('[TTS Select] Native voice selected:', selection.voiceIdentifier);
      setIsAutoMode(false);
      setSelectedVoiceURI(selection.voiceIdentifier);
      setTtsMode('local'); // Use 'local' mode internally, but the identifier triggers native TTS
      saveLanguageVoiceSettings('local', selection.voiceIdentifier, false);
    }
    setIsVoiceModalOpen(false);
  }, [bot.id, language, saveLanguageVoiceSettings]);
  
  const handleOpenVoiceModal = () => {
    if (!window.speechSynthesis) return;
    console.log('[VoiceModal OPEN] State before:', { ttsMode, selectedVoiceURI, isAutoMode, isTtsEnabled, isLoadingAudio });

    // Stop any current audio playback when opening voice settings
    isStoppingAudioRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    setTtsStatus('idle');
    setIsLoadingAudio(false);
    // Reset flag after a short delay to allow error events to be filtered
    setTimeout(() => {
      isStoppingAudioRef.current = false;
    }, 100);

    // If voices are already loaded, just open the modal.
    const availableVoices = window.speechSynthesis.getVoices();
    if (availableVoices.length > 0) {
        setVoices(availableVoices);
        setIsVoiceModalOpen(true);
        return;
    }

    // If no voices are loaded (common on iOS on first load),
    // we need to trigger the browser to populate them.
    const primeAndOpen = () => {
        const newVoices = window.speechSynthesis.getVoices();
        setVoices(newVoices);
        setIsVoiceModalOpen(true);
        // Clean up the one-time listener to avoid conflicts.
        window.speechSynthesis.removeEventListener('voiceschanged', primeAndOpen);
    };

    // Set up a one-time listener that will open the modal AFTER voices are loaded.
    window.speechSynthesis.addEventListener('voiceschanged', primeAndOpen);

    // Speak a silent utterance to trigger the `voiceschanged` event.
    const primingUtterance = new SpeechSynthesisUtterance('');
    primingUtterance.volume = 0;
    window.speechSynthesis.speak(primingUtterance);
};

    const handleToggleTts = () => {
        if (isTtsEnabled) {
            // Check if using native iOS TTS
            const isNativeVoiceSelected = isNativeiOS && selectedVoiceURI?.startsWith('com.apple.voice');
            
            if (isNativeVoiceSelected) {
                nativeTtsService.stop();
            } else if (ttsMode === 'server' && audioRef.current) {
                audioRef.current.pause();
            } else if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
            // Stop speech status polling
            if (speechPollingRef.current) {
                clearInterval(speechPollingRef.current);
                speechPollingRef.current = null;
            }
            setTtsStatus('idle');
        } else {
            // ENABLING TTS: Prime speechSynthesis with user gesture (Safari iOS requirement)
            // Safari requires speak() to be called directly in a user gesture handler
            // to "unlock" audio. This priming utterance is silent but unlocks the API.
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
                const primingUtterance = new SpeechSynthesisUtterance('');
                primingUtterance.volume = 0;
                window.speechSynthesis.speak(primingUtterance);
            }
        }
        setIsTtsEnabled(p => !p);
    };


  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  useEffect(() => {
    if (textareaRef.current) {
        // We need to reset the height to 'auto' to allow it to shrink when text is deleted.
        textareaRef.current.style.height = 'auto';
        // Then set it to the scrollHeight to make it grow to fit the content.
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]); // This effect runs every time the input value changes.

  // Speech recognition is now fully managed by the unified speechService
  // (WebSpeechService for browsers, NativeSpeechService for iOS)
  // No per-language setup needed - language is passed at start() time

  useEffect(() => {
    // This effect handles two cases on mount:
    // 1. Normal start (empty history) → fetch the bot's initial greeting.
    // 2. Pre-seeded user message (e.g., from transcript evaluation "Start session")
    //    → skip greeting, auto-send the user message to get the bot's response.
    // The ref guard prevents this from running more than once (e.g., due to StrictMode).
    if (initialFetchInitiated.current) {
        return;
    }

    // Case 1: Empty history → fetch greeting
    if (chatHistory.length === 0) {
        initialFetchInitiated.current = true;

        const fetchInitialMessage = async () => {
            setIsLoading(true);
            try {
                const response = await geminiService.sendMessage(
                    bot.id, 
                    lifeContext, 
                    [], 
                    language, 
                    isNewSession,
                    effectiveCoachingMode,
                    decryptedProfile
                );
                const initialBotMessage: Message = {
                    id: `bot-${Date.now()}`,
                    text: response.text,
                    role: 'bot',
                    timestamp: new Date().toISOString(),
                };
                setChatHistory([initialBotMessage]);
            } catch (err) {
                console.error('Error fetching initial message:', err);
                const errorMessage: Message = {
                    id: `error-${Date.now()}`,
                    text: t('chat_error'),
                    role: 'bot',
                    timestamp: new Date().toISOString(),
                };
                setChatHistory([errorMessage]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialMessage();
        return;
    }

    // Case 2: Pre-seeded with a user message → auto-send to get bot response
    if (chatHistory.length === 1 && chatHistory[0].role === 'user') {
        initialFetchInitiated.current = true;

        const autoSendPreSeeded = async () => {
            setIsLoading(true);
            try {
                const response = await geminiService.sendMessage(
                    bot.id,
                    lifeContext,
                    chatHistory,
                    language,
                    true, // isNewSession — skip "Next Steps" check-in
                    effectiveCoachingMode,
                    decryptedProfile
                );
                const botMessage: Message = {
                    id: `bot-${Date.now()}`,
                    text: response.text,
                    role: 'bot',
                    timestamp: new Date().toISOString(),
                };
                setChatHistory(prev => [...prev, botMessage]);
            } catch (err) {
                console.error('Error auto-sending pre-seeded message:', err);
                const errorMessage: Message = {
                    id: `error-${Date.now()}`,
                    text: t('chat_error'),
                    role: 'bot',
                    timestamp: new Date().toISOString(),
                };
                setChatHistory(prev => [...prev, errorMessage]);
            } finally {
                setIsLoading(false);
            }
        };

        autoSendPreSeeded();
        return;
    }
  }, [bot.id, lifeContext, language, setChatHistory, t, isNewSession, chatHistory.length]);

  // Track if we've already spoken the first message
  const hasSpokenFirstMessageRef = useRef(false);
  
  // Reset ref when bot or session changes
  useEffect(() => {
    hasSpokenFirstMessageRef.current = false;
  }, [bot.id, isNewSession]);
  
  useEffect(() => {
      if (chatHistory.length === 1 && 
          chatHistory[0].role === 'bot' && 
          voices.length > 0 && 
          isTtsEnabled && 
          !hasSpokenFirstMessageRef.current) {
        hasSpokenFirstMessageRef.current = true;
        speak(chatHistory[0].text);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHistory, voices, isTtsEnabled]);
  
  // Parse meditation markers from bot response
  const parseMeditationMarkers = (text: string): { 
    hasMeditation: boolean; 
    duration: number; 
    introText: string; 
    closingText: string;
    displayText: string;
  } => {
    const meditationRegex = /\[MEDITATION:(\d+)\]([\s\S]*?)\[MEDITATION_END\]([\s\S]*)/;
    const match = text.match(meditationRegex);
    
    if (match) {
      const duration = parseInt(match[1], 10);
      const intro = match[2].trim();
      const closing = match[3].trim();
      // Display text is intro + closing (without markers)
      const displayText = intro + (closing ? '\n\n' + closing : '');
      
      return {
        hasMeditation: true,
        duration,
        introText: intro,
        closingText: closing,
        displayText
      };
    }
    
    return {
      hasMeditation: false,
      duration: 0,
      introText: '',
      closingText: '',
      displayText: text
    };
  };
  
  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;
    
    // Check guest limit before sending
    if (isGuest && guestFingerprint) {
      const limitCheck = await guestService.checkGuestLimit(guestFingerprint);
      if (!limitCheck.allowed) {
        alert(t('guest_limit_exceeded_message'));
        return;
      }
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    // Stop speech status polling
    if (speechPollingRef.current) {
      clearInterval(speechPollingRef.current);
      speechPollingRef.current = null;
    }
    setTtsStatus('idle');

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: messageText,
      role: 'user',
      timestamp: new Date().toISOString(),
    };
    
    onMessageSent();
    const historyWithUserMessage = [...chatHistory, userMessage];
    setChatHistory(historyWithUserMessage);
    setIsLoading(true);
    baseTranscriptRef.current = '';

    try {
        const response = await geminiService.sendMessage(
            bot.id, 
            lifeContext, 
            historyWithUserMessage, 
            language, 
            false,
            effectiveCoachingMode,
            decryptedProfile
        );
        
        // Parse for meditation markers
        const meditationData = parseMeditationMarkers(response.text);
        
        const botMessage: Message = {
            id: `bot-${Date.now()}`,
            text: meditationData.displayText, // Use text without markers
            role: 'bot',
            timestamp: new Date().toISOString(),
        };
        setChatHistory(prev => [...prev, botMessage]);
        
        // If meditation detected, handle it
        if (meditationData.hasMeditation) {
          // Speak only the intro text with meditation mode for slower speech
          speak(meditationData.introText, true);
          
          // Auto-switch to voice mode if not already
          const wasInTextMode = !isVoiceMode;
          if (wasInTextMode) {
            setIsVoiceMode(true);
          }
          
          // Start meditation timer after a brief delay (to let intro start speaking)
          setTimeout(() => {
            setMeditationState({
              isActive: true,
              duration: meditationData.duration,
              remaining: meditationData.duration,
              introText: meditationData.introText,
              closingText: meditationData.closingText,
              originalMode: wasInTextMode ? 'text' : 'voice'
            });
          }, 1000);
        } else {
          // Normal message, speak all of it
          speak(botMessage.text);
        }
        
        // Increment guest usage after successful message
        if (isGuest && guestFingerprint) {
          guestService.incrementGuestUsage(guestFingerprint).then(result => {
            setGuestLimitRemaining(result.remaining);
          }).catch(error => {
            console.error('Failed to increment guest usage:', error);
          });
        }

    } catch (err) {
      console.error('Error sending message:', err);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: t('chat_error'),
        role: 'bot',
        timestamp: new Date().toISOString(),
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // If the user submits the form while recognition is active, stop it first.
    if (isListening) {
      await speechService.stop();
      setIsListening(false);
    }
    await sendMessage(input);
    setInput('');
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // On mobile/tablet (< 768px or native app) Enter adds a newline;
    // only the paper-plane button sends. On desktop, Enter sends.
    if (e.key === 'Enter' && !e.shiftKey && isDesktopWeb()) {
        e.preventDefault();
        const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
        await handleFormSubmit(syntheticEvent);
    }
  };
  
  const handleVoiceInteraction = async () => {
      if (isLoading) return;

      if (isListening) {
          // === STOP LISTENING & SEND ===
          console.log('[Speech] Stopping speech recognition');
          
          try {
              await speechService.stop();
              setIsListening(false);
          } catch (e) {
              console.error('[Speech] Error stopping recognition:', e);
          }
          
          // Capture input before async operations
          const currentInput = input;
          
          // iOS Safari/PWA with Web Speech API needs time for audio session cleanup
          // (Native iOS uses NativeSTTPlugin which handles this properly)
          if (isIOS && !usingNativeSpeech) {
              await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          // Send message
          if (currentInput.trim()) {
              setIsLoading(true);
              console.log('[Speech] Sending message after STT stop');
              await sendMessage(currentInput);
              setInput('');
          }
      } else {
          // === START LISTENING ===
          // Stop any ongoing TTS playback
          window.speechSynthesis?.cancel();
          if (audioRef.current) {
            audioRef.current.pause();
          }
          if (isNativeiOS) {
            nativeTtsService.stop();
          }
          // Stop speech status polling
          if (speechPollingRef.current) {
            clearInterval(speechPollingRef.current);
            speechPollingRef.current = null;
          }
          setTtsStatus('idle');
          baseTranscriptRef.current = input.trim() ? input.trim() + ' ' : '';
          
          try {
            console.log('[Speech] Starting speech recognition');
            await speechService.start(
              {
                language: 'en-US',
                interimResults: true,
                debugLogBaseUrl: getApiBaseUrl()
              },
              // onResult - transcript is already adaptive-processed for Android
              (result) => {
                setInput(baseTranscriptRef.current + result.transcript);
              },
              // onError - show user-facing alert for permission/hardware errors
              (error) => {
                setIsListening(false);
                if (error.message === 'microphone_permission_denied') {
                  alert(t('microphone_permission_denied') || 'Microphone access denied. Please grant permissions in your browser settings.');
                } else if (error.message === 'microphone_error') {
                  alert(t('microphone_error') || 'Microphone error. Please check if your microphone is available.');
                }
              },
              // onStart
              () => {
                console.log('[Speech] 🎙️ Recognition started');
                setIsListening(true);
              },
              // onEnd
              () => {
                console.log('[Speech] 🎙️ Recognition ended');
                setIsListening(false);
              }
            );
          } catch (error) {
            console.error('[Speech] Failed to start recognition:', error);
            alert(t('microphone_start_error') || 'Failed to start microphone. Please try again.');
          }
      }
  };


  const handlePauseTTS = () => {
    // Check if using native iOS TTS
    const isNativeVoiceSelected = isNativeiOS && selectedVoiceURI?.startsWith('com.apple.voice');
    
    if (isNativeVoiceSelected) {
      nativeTtsService.pause();
    } else if (ttsMode === 'server' && audioRef.current) {
      audioRef.current.pause();
    } else if (window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
    setTtsStatus('paused');
  };

  const handleResumeTTS = () => {
    // Check if using native iOS TTS
    const isNativeVoiceSelected = isNativeiOS && selectedVoiceURI?.startsWith('com.apple.voice');
    
    if (isNativeVoiceSelected) {
      nativeTtsService.resume();
    } else if (ttsMode === 'server' && audioRef.current) {
      audioRef.current.play().catch(err => {
        console.error('Failed to resume audio:', err);
        setTtsStatus('idle');
      });
    } else if (window.speechSynthesis) {
      window.speechSynthesis.resume();
    }
    setTtsStatus('speaking');
  };
  
  // Meditation timer countdown
  useEffect(() => {
    if (!meditationState?.isActive) return;
    
    if (meditationState.remaining <= 0) {
      handleMeditationComplete();
      return;
    }
    
    const timer = setInterval(() => {
      setMeditationState(prev => prev ? {
        ...prev,
        remaining: prev.remaining - 1
      } : null);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [meditationState?.remaining, meditationState?.isActive]);
  
  // Play gong sound (with Web Audio API fallback if MP3 not available)
  const playGongSound = async () => {
    if (gongAudioRef.current) {
      try {
        await gongAudioRef.current.play();
        await new Promise(resolve => setTimeout(resolve, 3000));
        return;
      } catch (error) {
        // MP3 gong failed, using Web Audio API fallback
      }
    }
    
    // Fallback: Generate gong sound with Web Audio API
    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Gong-like sound: low frequency with decay
      oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 3);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error('Error playing fallback gong:', error);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Short delay if all fails
    }
  };
  
  // Meditation complete handler
  const handleMeditationComplete = async () => {
    if (!meditationState) return;
    
    // Play gong
    await playGongSound();
    
    // Speak closing text
    if (meditationState.closingText) {
      speak(meditationState.closingText);
    }
    
    // Return to original mode
    if (meditationState.originalMode === 'text') {
      setIsVoiceMode(false);
    }
    
    // Reset meditation state
    setMeditationState(null);
  };
  
  // Early stop meditation handler
  const handleStopMeditation = async () => {
    if (!meditationState) return;
    
    // Play gong immediately
    await playGongSound();
    
    // Speak closing text
    if (meditationState.closingText) {
      speak(meditationState.closingText);
    }
    
    // Return to original mode
    if (meditationState.originalMode === 'text') {
      setIsVoiceMode(false);
    }
    
    setMeditationState(null);
  };

  const handleRepeatTTS = () => {
    if (lastSpokenTextRef.current) {
        speak(lastSpokenTextRef.current);
    }
  };

  const handleOpenFeedbackModal = (botMessage: Message) => {
    const botMessageIndex = chatHistory.findIndex(msg => msg.id === botMessage.id);
    let lastUserMessage: Message | null = null;
    if (botMessageIndex > 0) {
        for (let i = botMessageIndex - 1; i >= 0; i--) {
            if (chatHistory[i].role === 'user') {
                lastUserMessage = chatHistory[i];
                break;
            }
        }
    }
    setFeedbackMessages({ user: lastUserMessage, bot: botMessage });
    setIsFeedbackModalOpen(true);
};

const handleFeedbackSubmit = async (feedback: { comments: string; isAnonymous: boolean; email?: string }) => {
    if (!feedbackMessages.bot) return;

    await userService.submitFeedback({
        // rating is omitted for message reports, which don't have a star rating.
        comments: feedback.comments,
        botId: bot.id,
        lastUserMessage: feedbackMessages.user?.text,
        botResponse: feedbackMessages.bot.text,
        isAnonymous: feedback.isAnonymous,
        email: feedback.email,
    });
};
  
  const relevantVoices = voices.filter(v => v.lang.toLowerCase().startsWith(language));

  return (
    <div className="flex flex-col h-[82.5vh] max-w-3xl mx-auto bg-background-secondary dark:bg-transparent border border-border-primary dark:border-border-primary shadow-lg rounded-lg overflow-hidden">
      <header className="flex items-center justify-between p-4 border-b border-border-primary dark:border-border-primary gap-2">
        {/* Left: Coach Info (responsive) */}
        <div className="flex-1 min-w-0">
             <button 
                onClick={() => setIsCoachInfoOpen(true)} 
                className="flex items-center text-left focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-background-primary focus:ring-accent-primary rounded-lg p-1 -ml-1 transition-colors hover:bg-background-tertiary dark:hover:bg-background-tertiary/50"
                aria-label={`${t('chat_viewInfo')} for ${bot.name}`}
            >
                <img src={bot.avatar} alt={bot.name} className="w-10 h-10 md:w-12 md:h-12 rounded-full mr-3 shrink-0" />
                <div className="min-w-0 flex items-center gap-2">
                    <h1 className="text-lg md:text-xl font-bold text-content-primary truncate">{bot.name}</h1>
                </div>
            </button>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center justify-end gap-x-1 sm:gap-x-2 md:gap-x-4 max-w-[50%] sm:max-w-none">
            <button 
                onClick={() => {
                    // iOS Audio Session Unlock: When entering voice mode, unlock audio session
                    // so that the first greeting can be spoken (useEffect calls speak() asynchronously)
                    if (!isVoiceMode) {
                        if (ttsMode === 'server') {
                            unlockAudioSession();
                        }
                        // Prime speechSynthesis for local TTS (Safari iOS requires user gesture)
                        if (window.speechSynthesis) {
                            window.speechSynthesis.cancel();
                            const primingUtterance = new SpeechSynthesisUtterance('');
                            primingUtterance.volume = 0;
                            window.speechSynthesis.speak(primingUtterance);
                        }
                    }
                    
                    setIsVoiceMode(p => {
                        const newIsVoiceMode = !p;
                        if (newIsVoiceMode) {
                            setIsTtsEnabled(true);
                        }
                        return newIsVoiceMode;
                    });
                }} 
                className="p-2 text-content-secondary hover:text-content-primary" 
                aria-label={isVoiceMode ? t('chat_text_mode') : t('chat_voice_mode')}
            >
                {isVoiceMode ? <ChatBubbleIcon className="w-5 h-5 sm:w-6 sm:h-6"/> : <SoundWaveIcon className="w-5 h-5 sm:w-6 sm:h-6"/>}
            </button>

            {!isVoiceMode && (
                <div className="flex items-center justify-end gap-2 border-l border-border-primary pl-2 sm:pl-2 md:pl-4">
                    {/* DEBUG: Show states */}
                    {/* <span className="text-[8px] text-red-500">{isLoadingAudio ? 'L' : '-'}{isTtsEnabled ? 'T' : '-'}</span> */}
                    {isTtsEnabled && (
                        <>
                            {isLoadingAudio && (
                                <div className="flex items-center gap-2 p-1 text-accent-primary animate-pulse" aria-label={t('chat_loading_audio')}>
                                    <svg className="animate-spin w-5 h-5 sm:w-6 sm:h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span className="text-xs hidden sm:inline">Audio...</span>
                                </div>
                            )}
                            {!isLoadingAudio && ttsStatus === 'idle' && (
                                <button type="button" onClick={handleRepeatTTS} disabled={!lastSpokenTextRef.current} className="p-1 text-content-secondary hover:text-content-primary disabled:text-gray-300 dark:disabled:text-gray-700" aria-label={t('chat_repeat_tts')}>
                                    <RepeatIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                                </button>
                            )}
                            {!isLoadingAudio && ttsStatus === 'speaking' && <button type="button" onClick={handlePauseTTS} className="p-1 text-content-secondary hover:text-content-primary" aria-label={t('chat_pause_tts')}><PauseIcon className="w-5 h-5 sm:w-6 sm:h-6" /></button>}
                            {!isLoadingAudio && ttsStatus === 'paused' && <button type="button" onClick={handleResumeTTS} className="p-1 text-content-secondary hover:text-content-primary" aria-label={t('chat_resume_tts')}><PlayIcon className="w-5 h-5 sm:w-6 sm:h-6" /></button>}
                        </>
                    )}
                    <button type="button" onClick={handleToggleTts} className="p-1 text-content-secondary hover:text-content-primary" aria-label={isTtsEnabled ? t('chat_disable_tts') : t('chat_enable_tts')}>
                        {isTtsEnabled ? <SpeakerOnIcon className="w-5 h-5 sm:w-6 sm:h-6" /> : <SpeakerOffIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
                    </button>
                    {isTtsEnabled && (
                        <button
                            type="button"
                            onClick={handleOpenVoiceModal}
                            className="p-1 text-content-secondary hover:text-content-primary"
                            aria-label={t('chat_voice_settings')}
                        >
                            <GearIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                    )}
                </div>
            )}

            {/* Separator */}
            <div className="h-6 w-px bg-border-primary mx-1"></div>

            {/* End Session Button/Icon */}
            <button
                onClick={handleEndSession}
                className="hidden md:flex items-center px-4 py-2 text-sm font-bold text-red-600 dark:text-accent-primary bg-transparent border border-red-600 dark:border-accent-primary uppercase hover:bg-red-600 dark:hover:bg-accent-primary hover:text-white dark:hover:text-black rounded-lg shadow-md"
            >
                {t('chat_end_session')}
            </button>
            <button
                onClick={handleEndSession}
                className="md:hidden p-2 text-red-600 dark:text-accent-primary rounded-full hover:bg-red-50 dark:hover:bg-accent-primary/10"
                aria-label={t('chat_end_session')}
            >
                <LogOutIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
        </div>
      </header>
      
      {/* Guest Limit Indicator */}
      {isGuest && guestLimitRemaining !== null && (
        <div className="px-4 py-2 bg-status-info-background dark:bg-status-info-background border-b border-status-info-border dark:border-status-info-border/30">
          <p className="text-sm text-status-info-foreground dark:text-status-info-foreground text-center">
            {t('guest_limit_remaining', { remaining: guestLimitRemaining })}
          </p>
        </div>
      )}
      
      {/* Test Mode Banner */}
      {isTestMode && chatHistory.length > 0 && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700/50">
          <p className="text-sm text-amber-700 dark:text-amber-300 text-center font-medium">
            🧪 {t('test_mode_banner')}
          </p>
        </div>
      )}
      
    {isVoiceMode ? (
        <main className="flex-1 flex flex-col items-center gap-4 p-6 text-center bg-background-primary dark:bg-background-primary/50 overflow-y-auto">
            {/* Top third: Bot Avatar & Name */}
            <div className="flex-1 flex flex-col items-center justify-center py-4 min-h-[12rem]">
                <div className="animate-fadeIn">
                    <img src={bot.avatar} alt={bot.name} className="w-32 h-32 rounded-full mx-auto mb-4 shadow-lg border-4 border-background-secondary dark:border-border-primary" />
                    <h1 className="text-3xl font-bold text-content-primary">{bot.name}</h1>
                </div>
            </div>

            {/* Middle third: Microphone/Meditation Timer */}
            <div className="flex-1 flex flex-col items-center justify-center py-4 w-full min-h-[12rem]">
                {meditationState?.isActive ? (
                    <div className="flex flex-col items-center">
                        <div className="relative w-40 h-40">
                            {/* Circular progress ring */}
                            <svg className="transform -rotate-90 w-40 h-40">
                                <circle 
                                    cx="80" 
                                    cy="80" 
                                    r="70" 
                                    stroke="currentColor" 
                                    strokeWidth="8" 
                                    fill="none" 
                                    className="text-gray-300 dark:text-gray-700" 
                                />
                                <circle 
                                    cx="80" 
                                    cy="80" 
                                    r="70" 
                                    stroke="currentColor" 
                                    strokeWidth="8" 
                                    fill="none" 
                                    className="text-accent-primary"
                                    strokeDasharray={`${2 * Math.PI * 70}`}
                                    strokeDashoffset={`${2 * Math.PI * 70 * (1 - meditationState.remaining / meditationState.duration)}`}
                                    style={{ transition: 'stroke-dashoffset 1s linear' }} 
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-3xl font-bold text-content-primary">
                                    {Math.floor(meditationState.remaining / 60)}:{String(meditationState.remaining % 60).padStart(2, '0')}
                                </span>
                            </div>
                        </div>
                        <button 
                            onClick={handleStopMeditation}
                            className="mt-6 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-bold uppercase shadow-md"
                        >
                            {t('meditation_early_stop')}
                        </button>
                    </div>
                ) : (
                    <>
                        <button
                            onClick={handleVoiceInteraction}
                            disabled={isLoading}
                            className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 shadow-xl focus:outline-none focus:ring-4 ${
                                isListening ? 'bg-red-500 hover:bg-red-600 focus:ring-red-300 animate-pulse' : 'bg-accent-primary hover:bg-accent-primary-hover focus:ring-accent-primary/50'
                            } ${isLoading ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                            aria-label={isListening ? 'Stop and send' : 'Start recording'}
                        >
                            {isListening ? <PaperPlaneIcon className="w-12 h-12 text-white" /> : <MicrophoneIcon className="w-12 h-12 text-white" />}
                        </button>
                        <div className="mt-4 text-lg text-content-secondary flex flex-col items-center justify-center px-4 w-full max-w-md">
                            <p className="h-14 flex items-center">{input || (isListening ? 'Listening...' : t('chat_tapToSpeak'))}</p>
                            {isListening && !wakeLock.isSupported && (
                                <p className="text-xs text-status-warning-foreground mt-1">{t('chat_keep_screen_on')}</p>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Bottom third: Control Buttons - Doppelter Abstand nach oben */}
            <div className="flex-1 flex flex-col items-center justify-center pt-8 pb-4 min-h-[8rem]">
                {(isLoading || isLoadingAudio) ? (
                    <div className="flex flex-col items-center gap-3">
                        <div className="p-4 rounded-full bg-background-secondary dark:bg-background-tertiary shadow">
                            <Spinner />
                        </div>
                        <p className="text-sm text-content-secondary">
                            {isLoading 
                                ? (t('chat_generating_response') || 'Antwort wird generiert...') 
                                : (t('chat_loading_audio') || 'Audio wird geladen...')}
                        </p>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-6">
                        <button onClick={ttsStatus === 'speaking' ? handlePauseTTS : handleResumeTTS} disabled={ttsStatus === 'idle'} className="p-4 rounded-full bg-background-secondary dark:bg-background-tertiary disabled:opacity-50 hover:bg-background-tertiary dark:hover:bg-border-primary shadow" aria-label={ttsStatus === 'speaking' ? 'Pause Speech' : 'Resume Speech'}>
                            {ttsStatus === 'speaking' ? <PauseIcon className="w-8 h-8 text-content-primary"/> : <PlayIcon className="w-8 h-8 text-content-primary"/>}
                        </button>
                        <button onClick={handleRepeatTTS} disabled={!lastSpokenTextRef.current || ttsStatus !== 'idle'} className="p-4 rounded-full bg-background-secondary dark:bg-background-tertiary disabled:opacity-50 hover:bg-background-tertiary dark:hover:bg-border-primary shadow" aria-label={'Repeat'}>
                            <RepeatIcon className="w-8 h-8 text-content-primary"/>
                        </button>
                    </div>
                )}
            </div>
        </main>
    ) : (
      <>
        <main ref={chatContainerRef} className="flex-1 p-6 overflow-y-auto space-y-6">
          {chatHistory.map((message, index) => (
            <div key={message.id} className={`group flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'bot' && <img src={bot.avatar} alt={bot.name} className="w-8 h-8 rounded-full self-start" />}
              <div className={`max-w-md p-3 ${message.role === 'user' ? 'bg-accent-tertiary text-accent-tertiary-foreground rounded-l-lg rounded-br-lg' : 'prose dark:prose-invert bg-background-tertiary text-content-primary dark:bg-background-tertiary dark:text-content-primary rounded-r-lg rounded-bl-lg'}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
              </div>
               {message.role === 'bot' && index > 0 && !isLoading && (
                    <button
                        onClick={() => handleOpenFeedbackModal(message)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-content-subtle hover:text-content-secondary self-center"
                        aria-label={t('chat_report_message')}
                        title={t('chat_report_message')}
                    >
                        <FlagIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
          ))}
          {isLoading && (
              <div className="flex gap-3 justify-start animate-fadeIn">
                  <img src={bot.avatar} alt={bot.name} className="w-8 h-8 rounded-full self-start" />
                  <div className="max-w-md p-3 bg-background-tertiary dark:bg-background-tertiary rounded-r-lg rounded-bl-lg">
                      <Spinner />
                  </div>
              </div>
          )}
        </main>
        
        <footer ref={footerRef} className="p-4 border-t border-border-primary">
          {isTestMode ? (
            <div className="text-center py-2 text-content-secondary">
              <p className="text-sm">{t('test_mode_input_disabled')}</p>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat_placeholder')}
                disabled={isLoading}
                rows={1}
                className="flex-1 p-3 bg-background-tertiary text-content-primary border border-border-secondary focus:outline-none focus:ring-1 focus:ring-accent-primary resize-none overflow-y-auto max-h-40"
              />
              <button type="button" onClick={handleVoiceInteraction} disabled={isLoading} className="p-2 text-content-secondary hover:text-content-primary disabled:text-gray-300 dark:disabled:text-gray-700" aria-label={isListening ? t('chat_send_message') : t('chat_voice_mode')}>
                  <MicrophoneIcon className={`w-6 h-6 ${isListening ? 'text-red-500 animate-pulse' : ''}`} />
              </button>
              <button type="submit" disabled={isLoading || !input.trim()} className="p-3 bg-accent-primary text-content-inverted hover:bg-accent-primary-hover disabled:bg-gray-300 dark:disabled:bg-gray-700 rounded-lg">
                <PaperPlaneIcon className="w-6 h-6" />
              </button>
            </form>
          )}
        </footer>
      </>
    )}
    <VoiceSelectionModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        voices={relevantVoices}
        currentVoiceURI={selectedVoiceURI}
        currentTtsMode={ttsMode}
        isAutoMode={isAutoMode}
        onSelectVoice={handleSelectVoice}
        onPreviewVoice={handlePreviewVoice}
        onPreviewServerVoice={handlePreviewServerVoice}
        onPreviewNativeVoice={handlePreviewNativeVoice}
        botLanguage={language}
        botGender={botGender}
        isGuest={isGuest}
    />
     <CoachInfoModal
        bot={bot}
        isOpen={isCoachInfoOpen}
        onClose={() => setIsCoachInfoOpen(false)}
        coachingMode={effectiveCoachingMode}
    />
     <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        onSubmit={handleFeedbackSubmit}
        lastUserMessage={feedbackMessages.user}
        botMessage={feedbackMessages.bot}
        currentUser={currentUser}
    />
    </div>
  );
};

export default ChatView;