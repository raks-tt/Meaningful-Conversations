import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useLocalization } from '../context/LocalizationContext';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { transcribeAudio } from '../services/geminiService';
import { downloadTextFile } from '../utils/fileDownload';
import { Language } from '../types';

interface TranscriptInputProps {
    onSubmit: (transcript: string) => void;
    onBack: () => void;
    isLoading: boolean;
    showAudioTab?: boolean;
    language?: Language;
}

const MAX_CHARS = 50000;
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25 MB

const parseSRT = (text: string): string => {
    return text
        .replace(/^\d+\s*$/gm, '')
        .replace(/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const TranscriptInput: React.FC<TranscriptInputProps> = ({ onSubmit, onBack, isLoading, showAudioTab = false, language = 'de' }) => {
    const { t } = useLocalization();
    const [activeTab, setActiveTab] = useState<'paste' | 'file' | 'audio'>('paste');
    const [text, setText] = useState('');
    const [fileName, setFileName] = useState<string | null>(null);
    const [hasConsent, setHasConsent] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Audio state
    const recorder = useAudioRecorder();
    const audioFileInputRef = useRef<HTMLInputElement>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [speakerHint, setSpeakerHint] = useState<number | 0>(0); // 0 = auto
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcribeError, setTranscribeError] = useState<string | null>(null);
    const [hasAudioConsent, setHasAudioConsent] = useState(false);
    const [audioMode, setAudioMode] = useState<'record' | 'upload' | null>(null);

    // Speaker mapping state
    const [showSpeakerMapping, setShowSpeakerMapping] = useState(false);
    const [rawTranscript, setRawTranscript] = useState('');
    const [speakerMap, setSpeakerMap] = useState<Record<string, string>>({});
    const [detectedSpeakers, setDetectedSpeakers] = useState<{ label: string; description: string }[]>([]);

    // Tracks whether the current text in the paste tab originated from audio transcription
    const [transcriptFromAudio, setTranscriptFromAudio] = useState(false);

    const charCount = text.length;
    const isOverLimit = charCount > MAX_CHARS;
    const isValid = text.trim().length > 10 && !isOverLimit;

    // Determine the audio source (recording blob or uploaded file)
    const audioSource = useMemo(() => {
        if (recorder.audioBlob) {
            const ext = recorder.audioBlob.type.includes('webm') ? 'webm' : 'mp4';
            return new File([recorder.audioBlob], `recording.${ext}`, { type: recorder.audioBlob.type });
        }
        return audioFile;
    }, [recorder.audioBlob, audioFile]);

    const handleFileRead = useCallback((file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!ext || !['txt', 'md', 'srt'].includes(ext)) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            let content = e.target?.result as string;
            if (ext === 'srt') content = parseSRT(content);
            setText(content);
            setFileName(file.name);
            setActiveTab('paste');
        };
        reader.readAsText(file);
    }, []);

    const handleFileDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFileRead(file);
    }, [handleFileRead]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileRead(file);
    }, [handleFileRead]);

    const handleAudioFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_AUDIO_SIZE) {
            setTranscribeError(t('te_input_audio_too_large'));
            return;
        }
        setAudioFile(file);
        setTranscribeError(null);
        recorder.resetRecording();
    }, [t, recorder]);

    const handleAudioDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file) return;
        if (file.size > MAX_AUDIO_SIZE) {
            setTranscribeError(t('te_input_audio_too_large'));
            return;
        }
        const allowedExts = ['wav', 'mp3', 'm4a', 'ogg', 'flac', 'webm'];
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!ext || !allowedExts.includes(ext)) return;
        setAudioFile(file);
        setTranscribeError(null);
        recorder.resetRecording();
    }, [t, recorder]);

    // Parse speakers from transcript for the mapping UI
    const parseSpeakersFromTranscript = useCallback((transcript: string) => {
        const speakerSectionMatch = transcript.match(/---SPEAKERS---/);
        const speakers: { label: string; description: string }[] = [];

        if (speakerSectionMatch) {
            const sectionEnd = transcript.indexOf('---SPEAKERS---', speakerSectionMatch.index! + 10);
            if (sectionEnd > -1) {
                const section = transcript.substring(speakerSectionMatch.index! + speakerSectionMatch[0].length, sectionEnd);
                const lines = section.trim().split('\n');
                for (const line of lines) {
                    const match = line.match(/^\s*Speaker\s+(\d+)\s*:\s*(.+)/i);
                    if (match) {
                        const label = `[Speaker ${match[1]}]`;
                        speakers.push({ label, description: match[2].trim() });
                    }
                }
            }
        }

        // Fallback: parse from transcript body
        if (speakers.length === 0) {
            const pattern = /\[Speaker (\d+)\]/g;
            const found = new Set<string>();
            let m;
            while ((m = pattern.exec(transcript)) !== null) {
                const num = m[1];
                if (!found.has(num)) {
                    found.add(num);
                    const label = `[Speaker ${num}]`;
                    speakers.push({ label, description: '' });
                }
            }
        }

        return speakers;
    }, []);

    const handleTranscribe = useCallback(async () => {
        if (!audioSource) return;

        // Frontend guard: reject files that are too small / recordings too short
        const MIN_AUDIO_BYTES = 10000; // ~10 KB — matches backend threshold
        const MIN_RECORD_SECONDS = 3;
        if (audioSource.size < MIN_AUDIO_BYTES) {
            setTranscribeError(t('te_input_audio_too_short'));
            return;
        }
        if (recorder.audioBlob && recorder.duration < MIN_RECORD_SECONDS) {
            setTranscribeError(t('te_input_audio_too_short'));
            return;
        }

        setIsTranscribing(true);
        setTranscribeError(null);

        try {
            const result = await transcribeAudio(audioSource, language, speakerHint || undefined);

            // Parse speakers and show mapping UI
            const speakers = parseSpeakersFromTranscript(result.transcript);
            if (speakers.length > 0) {
                setRawTranscript(result.transcript);
                setDetectedSpeakers(speakers);
                const initialMap: Record<string, string> = {};
                speakers.forEach(s => { initialMap[s.label] = ''; });
                setSpeakerMap(initialMap);
                setShowSpeakerMapping(true);
            } else {
                setText(result.transcript);
                setTranscriptFromAudio(true);
                setActiveTab('paste');
            }
        } catch (err: any) {
            setTranscribeError(err.message || t('te_input_audio_error'));
        } finally {
            setIsTranscribing(false);
        }
    }, [audioSource, language, speakerHint, parseSpeakersFromTranscript, t, recorder.audioBlob, recorder.duration]);

    const applySpeakerNames = useCallback(() => {
        let transcript = rawTranscript;
        for (const [label, name] of Object.entries(speakerMap)) {
            if (name.trim()) {
                transcript = transcript.replaceAll(label, `[${name.trim()}]`);
            }
        }
        setText(transcript);
        setTranscriptFromAudio(true);
        setShowSpeakerMapping(false);
        setActiveTab('paste');
    }, [rawTranscript, speakerMap]);

    const skipSpeakerMapping = useCallback(() => {
        setText(rawTranscript);
        setTranscriptFromAudio(true);
        setShowSpeakerMapping(false);
        setActiveTab('paste');
    }, [rawTranscript]);

    const handleDownloadTranscript = useCallback(async () => {
        if (!text.trim()) return;
        const dateStr = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
        try {
            await downloadTextFile(text, `transcript_${dateStr}.txt`);
        } catch (err) {
            console.error('Transcript download failed:', err);
        }
    }, [text]);

    // Tab button helper
    const tabButton = (id: 'paste' | 'file' | 'audio', label: string, mobileIcon?: string) => (
        <button
            onClick={() => setActiveTab(id)}
            title={label}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                    ? 'bg-accent-primary text-white'
                    : 'bg-background-primary text-content-secondary border border-gray-300 dark:border-gray-600 hover:border-accent-primary/50'
            }`}
        >
            {mobileIcon ? (
                <>
                    <span className="sm:hidden">{mobileIcon}</span>
                    <span className="hidden sm:inline">{label}</span>
                </>
            ) : label}
        </button>
    );

    // --- Speaker Mapping Modal ---
    if (showSpeakerMapping) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-6">
                <h2 className="text-2xl font-bold text-content-primary mb-2">{t('te_input_audio_speaker_map_title')}</h2>
                <p className="text-sm text-content-secondary mb-4">{t('te_input_audio_speaker_map_hint')}</p>

                <div className="space-y-4 mb-6">
                    {detectedSpeakers.map((speaker) => (
                        <div key={speaker.label} className="flex items-center gap-4 p-3 rounded-lg bg-background-secondary">
                            <div className="flex-shrink-0">
                                <span className="font-mono text-sm font-semibold text-accent-primary">{speaker.label}</span>
                                {speaker.description && (
                                    <span className="text-xs text-content-secondary ml-2">— {speaker.description}</span>
                                )}
                            </div>
                            <input
                                type="text"
                                value={speakerMap[speaker.label] || ''}
                                onChange={(e) => setSpeakerMap(prev => ({ ...prev, [speaker.label]: e.target.value }))}
                                placeholder={t('te_input_audio_speaker_map_name')}
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-background-primary text-content-primary text-sm focus:ring-2 focus:ring-accent-primary focus:border-transparent"
                            />
                        </div>
                    ))}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={applySpeakerNames}
                        className="flex-1 py-3 rounded-lg font-semibold text-white bg-accent-primary hover:bg-accent-primary/90 shadow-md transition-all"
                    >
                        {t('te_input_audio_speaker_map_apply')}
                    </button>
                    <button
                        onClick={skipSpeakerMapping}
                        className="flex-1 py-3 rounded-lg font-semibold text-content-secondary bg-background-secondary hover:bg-background-tertiary border border-gray-300 dark:border-gray-600 transition-all"
                    >
                        {t('te_input_audio_speaker_map_skip')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-6">
            <button
                onClick={onBack}
                disabled={isLoading || isTranscribing}
                className="mb-4 text-sm text-content-secondary hover:text-content-primary transition-colors disabled:opacity-50"
            >
                ← {t('te_input_back')}
            </button>

            <h2 className="text-2xl font-bold text-content-primary mb-2">{t('te_input_title')}</h2>
            <p className="text-content-secondary mb-6">{t('te_input_subtitle')}</p>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
                {tabButton('paste', t('te_input_paste_tab'))}
                {tabButton('file', t('te_input_file_tab'))}
                {showAudioTab && tabButton('audio', t('te_input_audio_tab'), '🎙️')}
            </div>

            {/* Content */}
            {activeTab === 'paste' && (
                <div>
                    <textarea
                        value={text}
                        onChange={(e) => { setText(e.target.value); setFileName(null); }}
                        placeholder={t('te_input_paste_placeholder')}
                        disabled={isLoading}
                        className="w-full p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-background-primary text-content-primary placeholder-content-secondary/50 resize-y focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all font-mono text-sm disabled:opacity-50"
                        rows={15}
                    />
                    {fileName && (
                        <p className="mt-1 text-xs text-content-secondary">
                            Loaded from: {fileName}
                        </p>
                    )}
                    <div className="flex justify-between items-center mt-2 text-xs">
                        <span className={isOverLimit ? 'text-red-500 font-semibold' : 'text-content-secondary'}>
                            {charCount.toLocaleString()} {t('te_input_char_count')}
                            {isOverLimit && ` — ${t('te_input_char_limit')}`}
                        </span>
                        {transcriptFromAudio && text.trim() && (
                            <button
                                onClick={handleDownloadTranscript}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-background-tertiary hover:bg-accent-primary/10 text-content-secondary hover:text-accent-primary transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                {t('te_input_audio_download_transcript')}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'file' && (
                <div
                    onDrop={handleFileDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center cursor-pointer hover:border-accent-primary/50 transition-colors"
                >
                    <div className="text-4xl mb-3">📄</div>
                    <p className="text-content-primary font-medium mb-1">{t('te_input_file_prompt')}</p>
                    <p className="text-content-secondary text-sm">{t('te_input_file_formats')}</p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.md,.srt"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>
            )}

            {activeTab === 'audio' && showAudioTab && (
                <div className="space-y-6">
                    {/* GDPR Consent for Audio */}
                    {!hasAudioConsent && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-600 rounded-lg">
                            <div className="flex items-start gap-3">
                                <div className="text-2xl mt-0.5">🔒</div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-content-primary mb-2">
                                        {t('te_input_audio_gdpr_title')}
                                    </h3>
                                    <p className="text-sm text-content-secondary mb-3">
                                        {t('te_input_audio_gdpr_warning')}
                                    </p>
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={hasAudioConsent}
                                            onChange={(e) => setHasAudioConsent(e.target.checked)}
                                            className="mt-1 w-5 h-5 text-accent-primary border-gray-300 rounded focus:ring-2 focus:ring-accent-primary"
                                        />
                                        <span className="text-sm text-content-primary group-hover:text-accent-primary transition-colors">
                                            {t('te_input_audio_gdpr_consent')}
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {hasAudioConsent && (
                        <>
                            {/* "Transkript erstellen" section with mode buttons */}
                            <div className="p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-background-secondary">
                                <h3 className="font-semibold text-content-primary mb-4">{t('te_input_audio_create_title')}</h3>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { setAudioMode('record'); setAudioFile(null); }}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                                            audioMode === 'record'
                                                ? 'bg-accent-primary text-white shadow-md'
                                                : 'bg-background-primary text-content-secondary border border-gray-300 dark:border-gray-600 hover:border-accent-primary/50'
                                        }`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                        {t('te_input_audio_btn_record')}
                                    </button>
                                    <button
                                        onClick={() => { setAudioMode('upload'); recorder.resetRecording(); }}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                                            audioMode === 'upload'
                                                ? 'bg-accent-primary text-white shadow-md'
                                                : 'bg-background-primary text-content-secondary border border-gray-300 dark:border-gray-600 hover:border-accent-primary/50'
                                        }`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        {t('te_input_audio_btn_upload')}
                                    </button>
                                </div>
                            </div>

                            {/* Recording Section */}
                            {audioMode === 'record' && (
                                <div className="p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-background-secondary">
                                    <h3 className="font-semibold text-content-primary mb-3">{t('te_input_audio_record_title')}</h3>

                                    {!recorder.isSupported ? (
                                        <p className="text-sm text-content-secondary">{t('te_input_audio_not_supported')}</p>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            {/* Timer */}
                                            <div className="text-3xl font-mono text-content-primary tabular-nums">
                                                {formatDuration(recorder.duration)}
                                            </div>

                                            {/* Status */}
                                            {recorder.isRecording && !recorder.isPaused && (
                                                <div className="flex items-center gap-2 text-red-500">
                                                    <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                                                    <span className="text-sm font-medium">{t('te_input_audio_recording')}</span>
                                                </div>
                                            )}
                                            {recorder.isPaused && (
                                                <div className="text-sm font-medium text-yellow-600 dark:text-yellow-400">{t('te_input_audio_paused')}</div>
                                            )}
                                            {recorder.audioBlob && !recorder.isRecording && (
                                                <div className="text-sm font-medium text-green-600 dark:text-green-400">
                                                    {t('te_input_audio_ready')} ({formatFileSize(recorder.audioBlob.size)})
                                                </div>
                                            )}

                                            {/* Wake Lock Warning */}
                                            {recorder.isRecording && !recorder.isWakeLockSupported && (
                                                <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center">
                                                    {t('te_input_audio_wakelock_warning')}
                                                </p>
                                            )}

                                            {/* Controls */}
                                            <div className="flex gap-3">
                                                {!recorder.isRecording && !recorder.audioBlob && (
                                                    <button
                                                        onClick={() => { recorder.startRecording(); setAudioFile(null); }}
                                                        disabled={isTranscribing}
                                                        className="px-6 py-3 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold shadow-md transition-all disabled:opacity-50"
                                                    >
                                                        {t('te_input_audio_record_start')}
                                                    </button>
                                                )}
                                                {recorder.isRecording && !recorder.isPaused && (
                                                    <>
                                                        <button
                                                            onClick={recorder.pauseRecording}
                                                            className="px-5 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-medium transition-all"
                                                        >
                                                            {t('te_input_audio_record_pause')}
                                                        </button>
                                                        <button
                                                            onClick={recorder.stopRecording}
                                                            className="px-5 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-medium transition-all"
                                                        >
                                                            {t('te_input_audio_record_stop')}
                                                        </button>
                                                    </>
                                                )}
                                                {recorder.isPaused && (
                                                    <>
                                                        <button
                                                            onClick={recorder.resumeRecording}
                                                            className="px-5 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-all"
                                                        >
                                                            {t('te_input_audio_record_resume')}
                                                        </button>
                                                        <button
                                                            onClick={recorder.stopRecording}
                                                            className="px-5 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-medium transition-all"
                                                        >
                                                            {t('te_input_audio_record_stop')}
                                                        </button>
                                                    </>
                                                )}
                                                {recorder.audioBlob && !recorder.isRecording && (
                                                    <button
                                                        onClick={() => { recorder.resetRecording(); }}
                                                        disabled={isTranscribing}
                                                        className="px-5 py-2 rounded-lg text-content-secondary border border-gray-300 dark:border-gray-600 hover:bg-background-tertiary font-medium transition-all disabled:opacity-50"
                                                    >
                                                        {t('te_input_audio_reset')}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Recorder errors */}
                                            {recorder.error && (
                                                <p className="text-sm text-red-500">
                                                    {recorder.error === 'microphone_denied' ? t('te_input_audio_no_mic')
                                                        : recorder.error === 'no_microphone' ? t('te_input_audio_no_mic')
                                                        : recorder.error}
                                                </p>
                                            )}

                                            <p className="text-xs text-content-secondary text-center">{t('te_input_audio_record_hint')}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Upload Section */}
                            {audioMode === 'upload' && (
                                <div
                                    onDrop={handleAudioDrop}
                                    onDragOver={(e) => e.preventDefault()}
                                    onClick={() => audioFileInputRef.current?.click()}
                                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-accent-primary/50 transition-colors"
                                >
                                    <div className="text-3xl mb-2">🎙️</div>
                                    <p className="text-content-primary font-medium mb-1">{t('te_input_audio_upload_title')}</p>
                                    <p className="text-content-secondary text-sm">{t('te_input_audio_formats')}</p>
                                    {audioFile && !recorder.audioBlob && (
                                        <p className="mt-2 text-sm text-accent-primary font-medium">
                                            {audioFile.name} ({formatFileSize(audioFile.size)})
                                        </p>
                                    )}
                                    <input
                                        ref={audioFileInputRef}
                                        type="file"
                                        accept=".wav,.mp3,.m4a,.ogg,.flac,.webm,audio/*"
                                        onChange={handleAudioFileSelect}
                                        className="hidden"
                                    />
                                </div>
                            )}

                            {/* Speaker Hint + Transcribe */}
                            {audioSource && !recorder.isRecording && audioMode !== null && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <label className="text-sm font-medium text-content-primary whitespace-nowrap">
                                            {t('te_input_audio_speakers')}
                                        </label>
                                        <select
                                            value={speakerHint}
                                            onChange={(e) => setSpeakerHint(parseInt(e.target.value, 10))}
                                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-background-primary text-content-primary text-sm focus:ring-2 focus:ring-accent-primary"
                                        >
                                            <option value={0}>{t('te_input_audio_speakers_auto')}</option>
                                            <option value={2}>2</option>
                                            <option value={3}>3</option>
                                            <option value={4}>4</option>
                                        </select>
                                    </div>

                                    <button
                                        onClick={handleTranscribe}
                                        disabled={isTranscribing || (!!recorder.audioBlob && recorder.duration < 3) || (!!audioSource && audioSource.size < 10000)}
                                        className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
                                            isTranscribing || (!!recorder.audioBlob && recorder.duration < 3) || (!!audioSource && audioSource.size < 10000)
                                                ? 'bg-gray-400 cursor-not-allowed' : 'bg-accent-primary hover:bg-accent-primary/90 shadow-md hover:shadow-lg'
                                        }`}
                                    >
                                        {isTranscribing ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                <span>{t('te_input_audio_transcribing')}</span>
                                            </div>
                                        ) : (
                                            t('te_input_audio_transcribe')
                                        )}
                                    </button>
                                </div>
                            )}

                            {transcribeError && (
                                <p className="text-sm text-red-500 text-center">{transcribeError}</p>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Consent Warning (for paste/file tabs) */}
            {activeTab !== 'audio' && (
                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg">
                    <div className="flex items-start gap-3">
                        <div className="text-2xl mt-0.5">⚠️</div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-content-primary mb-2">
                                {t('te_consent_title')}
                            </h3>
                            <p className="text-sm text-content-secondary mb-3">
                                {t('te_consent_warning')}
                            </p>
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={hasConsent}
                                    onChange={(e) => setHasConsent(e.target.checked)}
                                    disabled={isLoading}
                                    className="mt-1 w-5 h-5 text-accent-primary border-gray-300 rounded focus:ring-2 focus:ring-accent-primary disabled:opacity-50"
                                />
                                <span className="text-sm text-content-primary group-hover:text-accent-primary transition-colors">
                                    {t('te_consent_checkbox')}
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Submit (only for paste/file) */}
            {activeTab !== 'audio' && (
                <div className="mt-6">
                    <button
                        onClick={() => onSubmit(text)}
                        disabled={!isValid || !hasConsent || isLoading}
                        className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
                            isValid && hasConsent && !isLoading
                                ? 'bg-accent-primary hover:bg-accent-primary/90 shadow-md hover:shadow-lg'
                                : 'bg-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span>{t('te_input_evaluating')}</span>
                            </div>
                        ) : (
                            t('te_input_evaluate')
                        )}
                    </button>
                    {isLoading && (
                        <p className="text-center text-sm text-content-secondary mt-2">
                            {t('te_input_evaluating_hint')}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default TranscriptInput;
