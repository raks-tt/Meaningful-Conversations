// TTS Service for Piper Text-to-Speech
// Handles communication with the Piper TTS container/process

const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { getPhoneticReplacements } = require('../utils/phoneticDictionary');

// Configuration
const TTS_SERVICE_URL = process.env.TTS_SERVICE_URL || 'http://tts:8082';
const USE_TTS_CONTAINER = process.env.TTS_SERVICE_URL ? true : false;

/**
 * Voice configuration mapping
 * Maps bot characteristics (gender, personality) to Piper voice models
 */
const VOICE_MODELS = {
    en: {
        female: 'en_US-amy-medium',
        male: 'en_US-ryan-medium',
    }
};

/**
 * Get the appropriate voice model for a bot and language
 * @param {string} botId - The bot ID
 * @param {string} lang - Language code ('de' or 'en')
 * @returns {object} - { model: string, gender: 'male'|'female' }
 */
function getVoiceForBot(botId, lang) {
    let gender = 'female';
    
    // Bot-specific gender assignment (matches ChatView.tsx logic)
    if (lang === 'en') {
        switch (botId) {
            case 'gloria-life-context':
            case 'ava-strategic':
            case 'chloe-cbt':
                gender = 'female';
                break;
            case 'max-ambitious':
            case 'rob':
            case 'kenji-stoic':
            case 'nexus-gps':
            case 'victor-bowen':
                gender = 'male';
                break;
            default:
                gender = 'male';
        }
    }
    
    const voiceModel = VOICE_MODELS[lang]?.[gender];
    
    // If no voice model available (e.g., German female), return null
    if (!voiceModel) {
        return { model: null, gender };
    }
    
    return { model: voiceModel, gender };
}

/**
 * Calculate speech rate adjustment
 * @param {string} botId - The bot ID
 * @param {boolean} isMeditation - Whether this is for meditation mode
 * @returns {number} - Speed factor (1.0 = normal)
 */
function getSpeechRate(botId, isMeditation) {
    // Meditation mode (Rob and Kenji) uses slower rate
    if (isMeditation && (botId === 'rob' || botId === 'kenji-stoic')) {
        return 0.9;
    }
    
    // Bot-specific rate adjustments (matches ChatView.tsx)
    switch (botId) {
        case 'max-ambitious':
        case 'rob':
            return 1.05;
        case 'nexus-gps':
            return 1.0; // Nobody: normal speed (was 1.1)
        default:
            return 1.0;
    }
}

/**
 * Get voice model from voiceId
 * @param {string} voiceId - The voice ID (e.g., 'en-amy', 'en-ryan')
 * @returns {string|null} - Voice model name or null if not found
 */
function getVoiceModelFromId(voiceId) {
    // If voiceId is already a full model name (contains underscores), return it directly
    if (voiceId && voiceId.includes('_')) {
        // Verify it's a valid model name
        const validModels = [
            'en_US-amy-medium',
            'en_US-ryan-medium',
        ];
        if (validModels.includes(voiceId)) {
            return voiceId;
        }
    }
    
    // Otherwise, map short IDs to full model names
    const voiceMap = {
        'en-amy': 'en_US-amy-medium',
        'en-ryan': 'en_US-ryan-medium',
    };
    return voiceMap[voiceId] || null;
}

/**
 * Synthesize speech using Piper TTS
 * @param {string} text - The text to synthesize
 * @param {string} botId - The bot ID for voice selection
 * @param {string} lang - Language code ('de' or 'en')
 * @param {boolean} isMeditation - Whether to use meditation mode (slower)
 * @param {string} voiceId - Optional: Specific voice ID to use (overrides bot default)
 * @param {boolean} stream - Not used (kept for backwards compatibility)
 * @returns {Promise<Buffer>} - Audio data as WAV buffer
 */
async function synthesizeSpeech(text, botId, lang, isMeditation = false, voiceId = null, stream = true) {
    if (!text || text.trim().length === 0) {
        throw new Error('Text is required for speech synthesis');
    }
    
    // Clean the text (remove markdown, apply phonetic replacements)
    let cleanText = cleanTextForSpeech(text, lang);
    
    // Get voice model - use voiceId if provided, otherwise auto-select
    let model;
    if (voiceId) {
        model = getVoiceModelFromId(voiceId);
        if (!model) {
            console.warn(`Unknown voiceId: ${voiceId}, falling back to bot default`);
            const voiceInfo = getVoiceForBot(botId, lang);
            model = voiceInfo.model;
        }
    } else {
        const voiceInfo = getVoiceForBot(botId, lang);
        model = voiceInfo.model;
        
        // If no server voice available (e.g., German female), return null to use local voice
        if (!model) {
            console.log(`No server voice available for botId=${botId}, lang=${lang}, gender=${voiceInfo.gender} - client will use local voice`);
            return null;
        }
    }
    
    
    // Get speech rate
    const rate = getSpeechRate(botId, isMeditation);
    // Server TTS voices are 5% slower (lengthScale 1.05x higher)
    const serverVoiceSlowdown = 1.05;
    const lengthScale = (1.0 / rate) * serverVoiceSlowdown; // Piper uses length_scale (inverse of rate)
    
    // Try TTS container first (if configured)
    if (USE_TTS_CONTAINER) {
        try {
            const requestPayload = {
                text: cleanText,
                model: model,
                lengthScale: lengthScale
            };
            
            console.log(`TTS request: model=${model}, lengthScale=${lengthScale}`);
            
            const response = await axios.post(
                `${TTS_SERVICE_URL}/synthesize`,
                requestPayload,
                {
                    timeout: 65000, // 65 seconds (Gunicorn timeout is 60s, Piper subprocess timeout is 45s)
                    responseType: 'arraybuffer'
                }
            );
            
            console.log(`TTS via container: ${response.headers['x-tts-duration-ms']}ms`);
            return Buffer.from(response.data);
            
        } catch (error) {
            console.warn('TTS container failed, falling back to local Piper:', error.message);
            // Fall through to local Piper
        }
    }
    
    // Fallback: Local Piper (if available)
    // Check if Piper is available first
    try {
        await execAsync('which piper');
    } catch {
        // Piper not available - return null so frontend can use Web Speech API
        console.log('Piper TTS not available, suggesting fallback to Web Speech API');
        throw new Error('Piper TTS not available: Local Piper not found on system');
    }
    
    const voiceDir = process.env.PIPER_VOICE_DIR || '/models';
    const modelPath = `${voiceDir}/${model}.onnx`;
    const piperCommand = process.env.PIPER_COMMAND || 'piper';
    
    // Build Piper command
    let command = `echo "${cleanText.replace(/"/g, '\\"')}" | ${piperCommand} --model ${modelPath} --length_scale ${lengthScale} --output-file -`;
    
    try {
        const { stdout, stderr } = await execAsync(command, {
            encoding: 'buffer',
            maxBuffer: 10 * 1024 * 1024, // 10MB max buffer for audio
        });
        
        if (stderr && stderr.length > 0) {
            console.warn('Piper stderr:', stderr.toString());
        }
        
        console.log('TTS via local Piper');
        return stdout;
    } catch (error) {
        console.error('Piper TTS error:', error);
        throw new Error(`Failed to synthesize speech: ${error.message}`);
    }
}

/**
 * Clean text for speech synthesis
 * Removes markdown formatting and other non-spoken elements
 * Applies phonetic replacements from dictionary for better pronunciation
 * @param {string} text - Raw text with possible markdown
 * @param {string} lang - Language code for phonetic replacements (default: 'de')
 * @returns {string} - Cleaned text ready for TTS
 */
function cleanTextForSpeech(text, lang = 'en') {
    // Load phonetic replacements from dictionary
    // Dictionary is cached, so this has no I/O overhead
    const phoneticReplacements = getPhoneticReplacements(lang);
    
    // First, clean markdown and formatting
    let cleanedText = text
        // Remove headers
        .replace(/#{1,6}\s/g, '')
        // Remove emphasis markers (bold, italic)
        .replace(/(\*\*|__|\*|_|~~|`|```)/g, '')
        // Remove links but keep text
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        // Remove images
        .replace(/!\[[^\]]*\]\([^\)]*\)/g, '')
        // Remove horizontal rules
        .replace(/^-{3,}|^\*{3,}|^_{3,}/gm, '')
        // Remove blockquote markers
        .replace(/^>\s?/gm, '');
    
    // Apply phonetic replacements for better pronunciation
    // Use word boundaries to avoid partial replacements
    let replacementsApplied = 0;
    const replacementLog = [];
    for (const pattern of phoneticReplacements) {
        const { term, phonetic, caseSensitive } = pattern;
        
        // Escape special regex characters in the term
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Create regex with appropriate flags (case-sensitive or not)
        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(`\\b${escapedTerm}\\b`, flags);
        
        const matches = cleanedText.match(regex);
        if (matches) {
            cleanedText = cleanedText.replace(regex, phonetic);
            replacementsApplied++;
            replacementLog.push(`"${term}" → "${phonetic}" (${matches.length}x)${caseSensitive ? ' [case-sensitive]' : ''}`);
        }
    }
    
    if (replacementsApplied > 0) {
        console.log(`  ✓ Applied ${replacementsApplied} phonetic replacements:`, replacementLog.join(', '));
    }
    
    // Final cleanup
    return cleanedText
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Check if Piper TTS is available
 * @returns {Promise<boolean>} - True if Piper is accessible
 */
async function isPiperAvailable() {
    // Check TTS container first
    if (USE_TTS_CONTAINER) {
        try {
            const response = await axios.get(`${TTS_SERVICE_URL}/health`, { timeout: 5000 });
            return response.data.status === 'ok';
        } catch (error) {
            console.warn('TTS container not available:', error.message);
            // Fall through to check local Piper
        }
    }
    
    // Check local Piper
    try {
        const piperCommand = process.env.PIPER_COMMAND || 'piper';
        // Piper --help returns exit code 0, unlike --version which requires --model
        await execAsync(`${piperCommand} --help`, { timeout: 5000 });
        return true;
    } catch (error) {
        console.warn('Piper TTS not available:', error.message);
        return false;
    }
}

/**
 * Get list of available voice models
 * @returns {Promise<string[]>} - Array of available model names
 */
async function getAvailableVoices() {
    // If using TTS container, we don't check local files
    if (USE_TTS_CONTAINER) {
        // Return the configured voice models without checking filesystem
        const models = [];
        for (const lang of Object.keys(VOICE_MODELS)) {
            for (const gender of Object.keys(VOICE_MODELS[lang])) {
                models.push(VOICE_MODELS[lang][gender]);
            }
        }
        return models;
    }
    
    // Check local Piper installation
    const voiceDir = process.env.PIPER_VOICE_DIR || '/models';
    const { readdir } = require('fs').promises;
    
    try {
        const files = await readdir(voiceDir);
        const models = files
            .filter(f => f.endsWith('.onnx'))
            .map(f => f.replace('.onnx', ''));
        return models;
    } catch (error) {
        console.error('Error reading voice directory:', error);
        return [];
    }
}

module.exports = {
    synthesizeSpeech,
    getVoiceForBot,
    getVoiceModelFromId,
    cleanTextForSpeech,
    isPiperAvailable,
    getAvailableVoices,
    VOICE_MODELS,
};

