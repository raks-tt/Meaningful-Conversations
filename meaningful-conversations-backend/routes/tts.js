// TTS Routes - Text-to-Speech endpoints using Piper
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.js');
const { synthesizeSpeech, isPiperAvailable, getAvailableVoices, VOICE_MODELS } = require('../services/ttsService.js');
const { trackApiUsage } = require('../services/apiUsageTracker.js');

// Check if TTS is enabled
const TTS_ENABLED = process.env.TTS_ENABLED !== 'false';

// Middleware to check if TTS is available
const checkTtsAvailable = async (req, res, next) => {
    if (!TTS_ENABLED) {
        return res.status(503).json({ 
            error: 'TTS service is disabled',
            fallbackToWebSpeech: true 
        });
    }
    
    // We'll check Piper availability lazily on first request
    // to avoid blocking server startup
    next();
};

router.use(checkTtsAvailable);

/**
 * POST /api/tts/synthesize
 * Synthesize speech from text
 * 
 * Body:
 * - text: string (required) - Text to synthesize
 * - botId: string (required) - Bot ID for voice selection
 * - lang: string (required) - Language code ('de' or 'en')
 * - isMeditation: boolean (optional) - Use slower meditation voice
 * - voiceId: string (optional) - Specific voice ID (e.g., 'de-mls', 'en-ryan')
 */
router.post('/synthesize', authMiddleware, async (req, res) => {
    const { text, botId, lang, isMeditation = false, voiceId = null } = req.body;
    const userId = req.userId;
    const startTime = Date.now();
    
    // Validation
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'Text is required' });
    }
    
    if (!botId) {
        return res.status(400).json({ error: 'Bot ID is required' });
    }
    
    if (!lang || lang !== 'en') {
        return res.status(400).json({ error: 'Valid language code is required (en)' });
    }
    
    // Check text length (limit to prevent abuse)
    const MAX_TEXT_LENGTH = 5000; // ~5000 characters should be plenty for a chat message
    if (text.length > MAX_TEXT_LENGTH) {
        return res.status(400).json({ 
            error: `Text too long. Maximum ${MAX_TEXT_LENGTH} characters allowed.` 
        });
    }
    
    try {
        // Check if Piper is available
        const available = await isPiperAvailable();
        if (!available) {
            console.warn('Piper TTS not available, suggesting fallback to Web Speech API');
            return res.status(503).json({ 
                error: 'TTS service temporarily unavailable',
                fallbackToWebSpeech: true 
            });
        }
        
        // Synthesize speech
        const audioBuffer = await synthesizeSpeech(text, botId, lang, isMeditation, voiceId);
        
        // If no server voice available (returns null), fallback to local
        if (!audioBuffer) {
            return res.status(503).json({
                error: 'No server voice available for this combination',
                fallbackToWebSpeech: true
            });
        }
        
        const durationMs = Date.now() - startTime;
        const characterCount = text.length;
        
        // Track API usage
        await trackApiUsage({
            userId: userId || null,
            isGuest: !userId,
            endpoint: 'tts',
            model: 'piper-tts',
            botId: botId,
            inputTokens: characterCount, // Use character count as "tokens" for TTS
            outputTokens: 0,
            durationMs,
            success: true,
            metadata: {
                language: lang,
                textLength: characterCount,
                isMeditation,
                audioSize: audioBuffer.length,
            },
        });
        
        // Set appropriate headers for audio streaming
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', audioBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        
        // Send the audio buffer
        res.send(audioBuffer);
        
    } catch (error) {
        console.error('TTS synthesis error:', error);
        
        const durationMs = Date.now() - startTime;
        
        // Track failed API call
        await trackApiUsage({
            userId: userId || null,
            isGuest: !userId,
            endpoint: 'tts',
            model: 'piper-tts',
            botId: botId,
            inputTokens: text.length,
            outputTokens: 0,
            durationMs,
            success: false,
            errorMessage: error.message,
        });
        
        res.status(500).json({ 
            error: 'Failed to synthesize speech',
            fallbackToWebSpeech: true 
        });
    }
});

/**
 * GET /api/tts/voices
 * Get list of available voice models
 */
router.get('/voices', async (req, res) => {
    try {
        const availableVoices = await getAvailableVoices();
        res.json({
            available: availableVoices,
            configured: VOICE_MODELS,
        });
    } catch (error) {
        console.error('Error getting voices:', error);
        res.status(500).json({ error: 'Failed to get voice list' });
    }
});

/**
 * GET /api/tts/health
 * Check TTS service health
 */
router.get('/health', async (req, res) => {
    try {
        const available = await isPiperAvailable();
        const voices = await getAvailableVoices();
        
        res.json({
            status: available ? 'ok' : 'unavailable',
            piperAvailable: available,
            voiceCount: voices.length,
            voices: voices,
        });
    } catch (error) {
        res.status(503).json({
            status: 'error',
            error: error.message,
        });
    }
});

module.exports = router;

