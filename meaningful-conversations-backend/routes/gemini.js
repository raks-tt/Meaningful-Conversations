const express = require('express');
const router = express.Router();
const multer = require('multer');
const optionalAuthMiddleware = require('../middleware/optionalAuth.js');
const prisma = require('../prismaClient.js');
const { BOTS } = require('../constants.js');
const authMiddleware = require('../middleware/auth.js');
const { analysisPrompts, interviewFormattingPrompts, getInterviewTemplate, transcriptEvaluationPrompts } = require('../services/geminiPrompts.js');
const { trackApiUsage } = require('../services/apiUsageTracker.js');
const { getCacheStats } = require('../services/promptCache.js');
const aiProviderService = require('../services/aiProviderService.js');
const dynamicPromptController = require('../services/dynamicPromptController.js');
const behaviorLogger = require('../services/behaviorLogger.js');
const { audioTranscribeLimiter } = require('../middleware/rateLimiter.js');

const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/flac', 'audio/webm', 'audio/x-m4a', 'audio/mp3'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported audio format: ${file.mimetype}`));
        }
    }
});

// Google AI client kept for potential future use (explicit caching, etc.)
// Currently, implicit caching handles cost optimization automatically.
let googleAI;
import('@google/genai').then(({ GoogleGenAI }) => {
    googleAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
}).catch(err => {
    console.error("Failed to initialize Google AI:", err);
    googleAI = null;
});

// Timeout helper for async operations (prevents indefinite hangs)
const withTimeout = (promise, timeoutMs, label = 'Operation') => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
};

// POST /api/gemini/chat/send-message
router.post('/chat/send-message', optionalAuthMiddleware, async (req, res) => {
    const {
        botId, context, history, lang, isNewSession, coachingMode, decryptedPersonalityProfile,
        // Test mode support
        testProfileOverride, includeTestTelemetry, userMessage: testUserMessage
    } = req.body;
    const userId = req.userId; // This will be undefined for guests
    const isTestMode = req.headers['x-test-mode'] === 'true';

    // Telemetry collection for test mode
    const testTelemetry = {
        dpcInjectionPresent: false,
        dpcInjectionLength: 0,
        dpcStrategiesUsed: [],
        dpflKeywordsDetected: [],
        stressKeywordsDetected: false, // Track stress keywords (not used for triggering comfort check)
    };

    const bot = BOTS.find(b => b.id === botId);
    if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    // Server-side access control
    // Guest bots: accessible to anyone
    // All other bots: require authentication
    let hasAccess = false;
    let userRegionPreference = 'optimal'; // Default for guests

    const isGuestBot = bot.id.includes('guest') || bot.id === 'gloria-life-context';

    if (isGuestBot) {
        hasAccess = true;
    } else if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
            // Store user's AI region preference for later use
            userRegionPreference = user.aiRegionPreference || 'optimal';
            // All authenticated users have access to all non-guest bots
            hasAccess = true;
        }
    }

    if (!hasAccess) {
        // Use 403 Forbidden for authorization errors, 401 is for authentication
        return res.status(403).json({ error: 'You do not have permission to access this coach.' });
    }

    let systemInstruction = bot.systemPrompt;

    // Get and format the current date in English
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const locale = 'en-US';
    const formattedDate = new Intl.DateTimeFormat(locale, options).format(today);

    // Replace the date placeholder in the system instruction.
    systemInstruction = systemInstruction.replace(/\[CURRENT_DATE\]/g, formattedDate);

    const isInitialMessage = history.length === 0;

    if (isInitialMessage && isNewSession) {
        systemInstruction += "\n\n## Special Instruction for this First Message:\nThis is the user's very first interaction in this session. You MUST ignore any 'Initial Interaction Priority' rules about checking 'Next Steps'. Your first message MUST be your standard, warm welcome, asking what is on their mind. Do not mention anything about 'welcome back' or previous steps.";
    } else if (isInitialMessage && !isNewSession) {
        // Returning user - enforce strict first-message rules for Next Steps check-in
        systemInstruction += `\n\n## ⚠️ STRICT RULES FOR THIS FIRST MESSAGE (OVERRIDES EVERYTHING ELSE):
If you're asking about "Next Steps" or previous intentions:
1. Brief greeting
2. You MAY mention the goals/intentions
3. Ask ONLY ONE simple question (e.g., "How did it go?")
4. STOP. Wait for the response.

STRICTLY FORBIDDEN in this first message:
- NO praising progress you haven't heard about yet
- NO multiple questions
- NO detailed follow-up questions about specific aspects
- NO offering alternatives ("if you'd rather...", "or is there something else...")
- NO "I'm curious to hear..." or "What can you tell me?"`;
    }

    let finalSystemInstruction = systemInstruction;

    // DPC/DPFL: Dynamic Personality Coaching - inject profile context into prompt
    // In test mode, use testProfileOverride if provided
    const profileToUse = (isTestMode && testProfileOverride) ? testProfileOverride : decryptedPersonalityProfile;

    if (coachingMode === 'dpc' || coachingMode === 'dpfl' || isTestMode) {
        if (profileToUse) {
            try {
                const dpcResult = await dynamicPromptController.generatePromptForUser(
                    userId || 'guest',
                    profileToUse,
                    lang, // Pass language to DPC
                    botId // Pass botId for bot-specific adaptations (e.g., AVA's enhanced challenge logic)
                );

                if (dpcResult?.prompt) {
                    finalSystemInstruction += dpcResult.prompt;

                    // Collect telemetry for test mode
                    if (isTestMode) {
                        testTelemetry.dpcInjectionPresent = true;
                        testTelemetry.dpcInjectionLength = dpcResult.prompt.length;
                        testTelemetry.dpcStrategiesUsed = dpcResult.strategiesUsed || [];
                        testTelemetry.dpcMergeMetadata = dpcResult.mergeMetadata || null;
                    }
                }
            } catch (error) {
                console.error('[DPC] Error generating adaptive prompt:', error);
                // Fail gracefully - continue with standard prompt
            }
        } else if (!isTestMode) {
            console.warn(`[DPC] Coaching mode ${coachingMode} active but no profile provided`);
        }
    }

    // Option A+: Conversation History Summary for AVA (pseudo-state tracking)
    if (botId === 'ava-strategic' && (coachingMode === 'dpc' || coachingMode === 'dpfl') && profileToUse) {
        const recentHistory = history.slice(-6); // Last 6 messages (3 turns)

        // Extract bot's challenge questions from history
        const botChallenges = recentHistory
            .filter(msg => msg.role === 'bot')
            .map(msg => {
                // Simple heuristic: Contains challenge keywords + question mark
                const text = msg.text.toLowerCase();
                const hasChallengeKeyword =
                    text.includes('blindspot') ||
                    text.includes('develop') ||
                    text.includes('one step further') ||
                    text.includes('experiment') ||
                    text.includes('challenge');
                const hasQuestion = text.includes('?');
                return hasChallengeKeyword && hasQuestion ? msg.text : null;
            })
            .filter(Boolean);

        // Extract resource exploration questions
        const resourceQuestions = recentHistory
            .filter(msg => msg.role === 'bot')
            .map(msg => {
                const text = msg.text.toLowerCase();
                const hasResourceKeyword =
                    text.includes('mastered') ||
                    text.includes('success') ||
                    text.includes('strength') ||
                    text.includes('support') ||
                    text.includes('resource');
                const hasQuestion = text.includes('?');
                return hasResourceKeyword && hasQuestion ? msg.text : null;
            })
            .filter(Boolean);

        // Build history summary for LLM
        let historySummary = '\n\n**CONVERSATION-STATE-KONTEXT (für deine State-Awareness):**\n\n';

        if (botChallenges.length > 0) {
            historySummary += `You have already posed ${botChallenges.length} blindspot challenge(s):\n`;
            botChallenges.slice(-2).forEach((q, idx) => {
                historySummary += `${idx + 1}. "${q.substring(0, 80)}..."\n`;
            });
            historySummary += '\n';
        } else {
            historySummary += 'You have NOT posed any blindspot challenges yet.\n\n';
        }

        if (resourceQuestions.length > 0) {
            historySummary += `You have already asked about RESOURCES (${resourceQuestions.length}× in recent messages):\n`;
            resourceQuestions.slice(-1).forEach(q => {
                historySummary += `"${q.substring(0, 80)}..."\n`;
            });
            historySummary += '→ You are likely in **PHASE 2** (Resources activated, ready for blindspot bridge)\n\n';
        } else {
            historySummary += 'You have NOT asked about resources yet.\n→ If user signals "stuck": Start with **PHASE 1** (Resource exploration)\n\n';
        }

        const userLastMessage = recentHistory.filter(msg => msg.role === 'user').slice(-1)[0]?.text || '';
        const userRespondedToChallenge = botChallenges.length > 0 && userLastMessage.length > 30;

        if (botChallenges.length > 0 && !userRespondedToChallenge) {
            historySummary += '⚠️ User did NOT respond to last challenge (Avoidance?) → Choose different blindspot or wait\n\n';
        }

        finalSystemInstruction += historySummary;
    }

    // Exclude context injection for bots that don't need it:
    // - gloria-life-context: creates the context, doesn't read one
    // - gloria-interview: conducts topic-based interviews independent of life context
    if (bot.id !== 'gloria-life-context' && bot.id !== 'gloria-interview') {
        finalSystemInstruction += `\n\n## User Context\nThe user has provided the following context for this session. You MUST use this to inform your responses.\n\n<context>\n${context || 'The user has not provided a life context.'}\n</context>`;
    }

    const modelHistory = history.map((msg) => ({
        role: msg.role === 'bot' ? 'model' : 'user',
        parts: [{ text: msg.text }],
    }));

    const startTime = Date.now();
    const modelName = 'gemini-2.5-flash';

    // Explicit prompt caching disabled — Google Gemini 2.5 Flash has automatic
    // implicit caching (since May 2025) which handles repeated system instructions
    // without needing explicit cache creation. The previous explicit caching via
    // ai.caches.create() failed because the API requires a `contents` array with
    // ≥1024 tokens, but we only passed `systemInstruction` (which doesn't count
    // toward total_token_count). Adding dummy contents would pollute chat history.
    // Implicit caching provides the same cost savings automatically.
    let cacheUsed = false;
    const activeProvider = await aiProviderService.getActiveProvider();

    try {
        const config = {
            temperature: 0.7,
            systemInstruction: finalSystemInstruction,
        };

        const response = await withTimeout(
            aiProviderService.generateContent({
                model: modelName,
                // For the initial message, we send an empty string to prompt the model's greeting.
                // For subsequent messages, we send the entire chat history.
                contents: isInitialMessage ? "" : modelHistory,
                config: config,
                context: 'chat', // Chat messages use chat context
                userRegionPreference: userRegionPreference // User's EU/US preference
            }),
            30000,
            'Chat AI response'
        );

        const durationMs = Date.now() - startTime;
        const text = response.text;

        // Track API usage with actual model and provider used
        const actualModel = response.model || modelName;
        const tokenUsage = response.usage || { inputTokens: 0, outputTokens: 0 };

        await trackApiUsage({
            userId: userId || null,
            isGuest: !userId,
            endpoint: 'chat',
            model: actualModel,
            botId: botId,
            inputTokens: tokenUsage.inputTokens,
            outputTokens: tokenUsage.outputTokens,
            durationMs,
            success: true,
            metadata: {
                provider: response.provider,
                cacheUsed: cacheUsed || undefined,
            },
        });

        // DPFL: Behavior logging
        // In test mode, we do this synchronously to collect telemetry
        // Otherwise, async (does not block response)
        const messageToAnalyze = testUserMessage || req.body.userMessage || '';

        if (isTestMode && messageToAnalyze) {
            try {
                // Phase 2a: Use enhanced analysis with adaptive weighting + sentiment
                const recentUserMessages = (req.body.chatHistory || [])
                    .filter(m => m.role === 'user')
                    .slice(-5)
                    .map(m => m.text || m.content || '');

                const enhancedResult = behaviorLogger.analyzeMessageEnhanced(
                    messageToAnalyze, lang, recentUserMessages
                );

                // Helper: extract keywords from framework analysis result
                const extractKeywords = (frameworkResult, prefix) => {
                    const keywords = [];
                    for (const [dimension, data] of Object.entries(frameworkResult)) {
                        if (data.foundKeywords) {
                            if (data.foundKeywords.high && data.foundKeywords.high.length > 0) {
                                keywords.push(...data.foundKeywords.high.map(k => `${prefix}:${dimension}:high:${k}`));
                            }
                            if (data.foundKeywords.low && data.foundKeywords.low.length > 0) {
                                keywords.push(...data.foundKeywords.low.map(k => `${prefix}:${dimension}:low:${k}`));
                            }
                        }
                    }
                    return keywords;
                };

                // Collect detected keywords for ALL frameworks
                const allDetectedKeywords = {
                    riemann: extractKeywords(enhancedResult.riemann, 'riemann'),
                    big5: extractKeywords(enhancedResult.big5, 'big5'),
                    spiralDynamics: extractKeywords(enhancedResult.spiralDynamics, 'sd')
                };

                // Legacy format (Riemann-only, without prefix) for backward compatibility
                const detectedKeywords = [];
                for (const [dimension, data] of Object.entries(enhancedResult.riemann)) {
                    if (data.foundKeywords) {
                        if (data.foundKeywords.high && data.foundKeywords.high.length > 0) {
                            detectedKeywords.push(...data.foundKeywords.high.map(k => `${dimension}:high:${k}`));
                        }
                        if (data.foundKeywords.low && data.foundKeywords.low.length > 0) {
                            detectedKeywords.push(...data.foundKeywords.low.map(k => `${dimension}:low:${k}`));
                        }
                    }
                }
                testTelemetry.dpflKeywordsDetected = detectedKeywords;
                testTelemetry.allFrameworkKeywords = allDetectedKeywords;

                // Phase 2a: Include adaptive weighting metadata in telemetry
                if (enhancedResult.adaptive) {
                    testTelemetry.adaptiveWeighting = {
                        context: enhancedResult.adaptive.context,
                        sentiment: enhancedResult.adaptive.sentiment,
                        adjustedKeywordCount: enhancedResult.adaptive.adjustedKeywordCount,
                        weightingDetails: enhancedResult.adaptive.weightingDetails
                    };
                }

                // Test-only: Track if message contains stress keywords for telemetry
                // Note: Comfort Check is shown after EVERY DPFL session, not just when keywords are found
                const stressKeywords = [
                    // English keywords (15)
                    'stress', 'overwhelmed', 'anxious', 'sad', 'hopeless', 'depressed',
                    'desperate', 'exhausted', 'burnt out', 'burnout', 'helpless',
                    'panic', 'lonely', 'discouraged', 'empty', 'lost'
                ];
                const lowerMessage = messageToAnalyze.toLowerCase();
                testTelemetry.stressKeywordsDetected = stressKeywords.some(k => lowerMessage.includes(k));
            } catch (error) {
                console.error('[DPFL] Test mode behavior logging error:', error);
            }
        } else if (coachingMode === 'dpfl' && userId) {
            // Run in background - don't await
            setImmediate(async () => {
                try {
                    // Analyze current user message
                    const frequencies = behaviorLogger.analyzeMessage(messageToAnalyze, lang);

                    // Note: Full conversation logging will be done at session end
                    // This is just real-time analysis for debugging/monitoring
                } catch (error) {
                    console.error('[DPFL] Behavior logging error:', error);
                    // Fail silently - don't impact user experience
                }
            });
        }

        // Build response
        const responseData = { text };

        // Add LLM metadata in test mode for comparison purposes
        if (isTestMode) {
            responseData.llmMetadata = {
                model: actualModel,
                provider: response.provider || 'unknown',
                tokenUsage: {
                    input: tokenUsage.inputTokens || 0,
                    output: tokenUsage.outputTokens || 0,
                    total: (tokenUsage.inputTokens || 0) + (tokenUsage.outputTokens || 0)
                },
                responseTimeMs: durationMs,
                cacheUsed: cacheUsed || false,
                timestamp: new Date().toISOString()
            };

            // Include telemetry in test mode
            if (includeTestTelemetry) {
                responseData.testTelemetry = testTelemetry;
            }
        }

        res.json(responseData);
    } catch (error) {
        console.error('AI API error in /chat/send-message:', error);

        const durationMs = Date.now() - startTime;
        const isTimeout = error.message && error.message.includes('timeout');

        // Track failed API call
        await trackApiUsage({
            userId: userId || null,
            isGuest: !userId,
            endpoint: 'chat',
            model: modelName,
            botId: botId,
            inputTokens: 0,
            outputTokens: 0,
            durationMs,
            success: false,
            errorMessage: error.message,
        });

        if (isTimeout) {
            res.status(504).json({ error: 'The AI model took too long to respond. Please try again.' });
        } else {
            res.status(500).json({ error: 'Failed to get response from AI model.' });
        }
    }
});

/**
 * Helper function to normalize text for comparison (remove punctuation, lowercase, trim)
 */
function normalizeForComparison(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/[.,!?;:()"\-–—]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ')            // Normalize whitespace
        .trim();
}

/**
 * Check if two strings are similar enough to be considered duplicates
 * Uses normalized comparison with optional deadline stripping
 */
function isSimilarText(text1, text2, threshold = 0.85) {
    // Strip deadline patterns like "(Deadline: 2026-01-11)" or "(bis: 2026-01-11)"
    const stripDeadline = (t) => t.replace(/\s*\((?:Deadline|bis):\s*\d{4}-\d{2}-\d{2}\)/gi, '');

    const norm1 = normalizeForComparison(stripDeadline(text1));
    const norm2 = normalizeForComparison(stripDeadline(text2));

    // Exact match after normalization
    if (norm1 === norm2) return true;

    // Check if one contains the other (for slight variations)
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

    // Simple similarity check: compare word overlap
    const words1 = new Set(norm1.split(' ').filter(w => w.length > 3));
    const words2 = new Set(norm2.split(' ').filter(w => w.length > 3));

    if (words1.size === 0 || words2.size === 0) return false;

    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;
    const jaccardSimilarity = intersection / union;

    return jaccardSimilarity >= threshold;
}

/**
 * Extract existing items from a markdown section
 */
function extractExistingItems(context, sectionPattern) {
    if (!context) return [];

    const regex = new RegExp(sectionPattern + '[\\s\\S]*?(?=##|$)', 'i');
    const match = context.match(regex);
    if (!match) return [];

    // Extract bullet points, but filter out description lines and metadata
    const items = [];
    const bulletRegex = /^\s*[*\-•]\s*(.+)$/gm;
    let bulletMatch;
    while ((bulletMatch = bulletRegex.exec(match[0])) !== null) {
        const item = bulletMatch[1].trim();

        // Skip description/metadata lines (italic text, short generic phrases)
        if (item.startsWith('*') && item.endsWith('*')) continue; // Italic markdown
        if (item.toLowerCase().includes('specific, actionable')) continue;
        if (item.toLowerCase().includes('tasks i have committed')) continue;
        if (item.toLowerCase().includes('aufgaben, zu denen ich mich')) continue;
        if (item.length < 20) continue; // Too short to be a real action item

        items.push(item);
    }
    return items;
}

/**
 * Deduplicate AI analysis response against existing context
 */
function deduplicateAnalysisResponse(jsonResponse, context) {
    console.log('🔍 Starting deduplication check...');

    if (!context || !jsonResponse) {
        console.log('⚠️ No context or response to deduplicate');
        return jsonResponse;
    }

    // Log raw nextSteps section from context for debugging
    const nextStepsMatch = context.match(/(?:✅\s*)?(?:Achievable Next Steps|Realisierbare nächste Schritte)[\s\S]*?(?=##|$)/i);
    if (nextStepsMatch) {
        console.log('📄 Raw Next Steps section from context:');
        console.log(nextStepsMatch[0].substring(0, 500));
    }

    // Extract existing next steps from context
    const existingNextSteps = extractExistingItems(
        context,
        '(?:✅\\s*)?(?:Achievable Next Steps|Realisierbare nächste Schritte)'
    );

    console.log(`📋 Found ${existingNextSteps.length} existing next steps in context`);
    if (existingNextSteps.length > 0) {
        console.log('   Existing steps (full):', JSON.stringify(existingNextSteps, null, 2));
    }

    // Deduplicate nextSteps
    if (jsonResponse.nextSteps && Array.isArray(jsonResponse.nextSteps)) {
        console.log(`📝 AI proposed ${jsonResponse.nextSteps.length} next steps:`);
        jsonResponse.nextSteps.forEach((step, i) => {
            console.log(`   ${i+1}. "${step.action}" (Deadline: ${step.deadline})`);
        });
        const originalCount = jsonResponse.nextSteps.length;

        // First: Remove internal duplicates (AI proposing same step twice)
        const seenActions = new Set();
        jsonResponse.nextSteps = jsonResponse.nextSteps.filter(step => {
            const normalized = normalizeForComparison(step.action);
            if (seenActions.has(normalized)) {
                console.log(`🔄 Filtered internal duplicate: "${step.action.substring(0, 50)}..."`);
                return false;
            }
            seenActions.add(normalized);
            return true;
        });

        // Second: Remove duplicates against existing context
        jsonResponse.nextSteps = jsonResponse.nextSteps.filter(step => {
            console.log(`   Checking: "${step.action.substring(0, 60)}..."`);
            const isDuplicate = existingNextSteps.some(existing => {
                const similar = isSimilarText(step.action, existing);
                if (similar) {
                    console.log(`   ↳ MATCH with existing: "${existing.substring(0, 60)}..."`);
                }
                return similar;
            });
            if (isDuplicate) {
                console.log(`🔄 Filtered context duplicate: "${step.action.substring(0, 50)}..."`);
            }
            return !isDuplicate;
        });

        if (originalCount !== jsonResponse.nextSteps.length) {
            console.log(`✓ Deduplicated nextSteps: ${originalCount} → ${jsonResponse.nextSteps.length}`);
        } else {
            console.log(`✓ No duplicates found in nextSteps`);
        }
    }

    // Deduplicate append updates
    if (jsonResponse.updates && Array.isArray(jsonResponse.updates)) {
        const originalCount = jsonResponse.updates.length;
        jsonResponse.updates = jsonResponse.updates.filter(update => {
            if (update.type !== 'append') return true;

            // Extract existing items from the target section
            const existingInSection = extractExistingItems(context, update.headline.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

            // Check if the new content is a duplicate
            const newContent = update.content.replace(/^\s*[*\-•]\s*/, '').trim();
            const isDuplicate = existingInSection.some(existing =>
                isSimilarText(newContent, existing)
            );

            if (isDuplicate) {
                console.log(`🔄 Filtered duplicate append to "${update.headline}": "${newContent.substring(0, 50)}..."`);
            }
            return !isDuplicate;
        });
        if (originalCount !== jsonResponse.updates.length) {
            console.log(`✓ Deduplicated updates: ${originalCount} → ${jsonResponse.updates.length}`);
        }
    }

    return jsonResponse;
}

// POST /api/gemini/session/analyze
router.post('/session/analyze', optionalAuthMiddleware, async (req, res) => {
    const { history, context, lang } = req.body;

    // Detect the language of the context file. Default to 'en'.
    const docLang = (context && context.match(/^#\s*(Mein\s)?Lebenskontext/im)) ? 'de' : 'en';

    const analysisPromptConfig = analysisPrompts.en;
    const conversation = history.map(msg => `${msg.role === 'user' ? 'User' : 'Coach'}: ${msg.text}`).join('\n\n');

    // Get current date in ISO format for deadline generation
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const fullPrompt = analysisPromptConfig.prompt({ conversation, context, docLang, currentDate });
    const startTime = Date.now();
    const modelName = 'gemini-2.5-pro'; // Using Gemini 2.5 Pro for improved reasoning
    const userId = req.userId;

    try {
        const response = await aiProviderService.generateContent({
            model: modelName, // Use a more powerful model for structured analysis
            contents: fullPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: analysisPrompts.schema,
                temperature: 0.2, // Lower temperature for more deterministic, structured output
            },
            context: 'analysis' // Session analysis uses analysis context
        });

        const durationMs = Date.now() - startTime;

        // Clean response text: Remove markdown code blocks (common with Mistral)
        let cleanedText = response.text.trim();

        // Remove ```json ... ``` or ``` ... ``` wrappers
        const codeBlockRegex = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
        const match = cleanedText.match(codeBlockRegex);
        if (match && match[1]) {
            cleanedText = match[1].trim();
        }

        // Parse JSON response with improved error handling
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(cleanedText);
        } catch (parseError) {
            // First parse attempt failed - try Mistral-specific sanitization
            // Mistral sometimes outputs malformed escape sequences like: "quote": \"text\"
            // instead of: "quote": "text"
            console.log('⚠️ First JSON parse failed, attempting Mistral sanitization...');

            try {
                // Fix malformed escaped quotes outside of strings
                // Pattern: ": \" at the start of a value should be ": "
                // Pattern: \" at end of value before comma/newline should be "
                let sanitizedText = cleanedText
                    // Fix ": \" (colon followed by escaped quote) -> ": "
                    .replace(/:\s*\\"/g, ': "')
                    // Fix \", (escaped quote before comma) -> ",
                    .replace(/\\",/g, '",')
                    // Fix \" at end of line before } or ] -> "
                    .replace(/\\"(\s*[}\]])/g, '"$1')
                    // Fix \"\n (escaped quote before newline) -> "\n
                    .replace(/\\"\s*\n/g, '"\n');

                jsonResponse = JSON.parse(sanitizedText);
                console.log('✓ Mistral sanitization successful');
            } catch (secondParseError) {
                // Both attempts failed - log and throw
                console.error('❌ Failed to parse AI response as JSON:', parseError.message);
                console.error('   Provider:', response.provider);
                console.error('   Raw response (first 500 chars):', response.text.substring(0, 500));
                console.error('   Cleaned text (first 500 chars):', cleanedText.substring(0, 500));

                // Track API usage with actual model and provider used
                const actualModel = response.model || modelName;
                const tokenUsage = response.usage || { inputTokens: 0, outputTokens: 0 };

                await trackApiUsage({
                    userId: userId || null,
                    isGuest: !userId,
                    endpoint: 'analyze',
                    model: actualModel,
                    botId: null,
                    inputTokens: tokenUsage.inputTokens,
                    outputTokens: tokenUsage.outputTokens,
                    durationMs,
                    success: false,
                    errorMessage: `JSON parse error: ${parseError.message}`,
                    metadata: {
                        provider: response.provider,
                        rawResponsePreview: response.text.substring(0, 200)
                    },
                });

                throw new Error(`AI returned invalid JSON format: ${parseError.message}`);
            }
        }

        // Track API usage with actual model and provider used
        const actualModel = response.model || modelName;
        const tokenUsage = response.usage || { inputTokens: 0, outputTokens: 0 };

        await trackApiUsage({
            userId: userId || null,
            isGuest: !userId,
            endpoint: 'analyze',
            model: actualModel,
            botId: null,
            inputTokens: tokenUsage.inputTokens,
            outputTokens: tokenUsage.outputTokens,
            durationMs,
            success: true,
            metadata: { provider: response.provider },
        });

        // Deduplicate response against existing context before sending
        const deduplicatedResponse = deduplicateAnalysisResponse(jsonResponse, context);

        // Strip solutionBlockages for users without Client or Admin access (PEP is client/admin/developer feature)
        if (deduplicatedResponse.solutionBlockages) {
            let hasPepAccess = false;
            if (userId) {
                const analysisUser = await prisma.user.findUnique({ where: { id: userId } });
                hasPepAccess = analysisUser?.isClient === true || analysisUser?.isAdmin === true;
            }
            if (!hasPepAccess) {
                deduplicatedResponse.solutionBlockages = [];
            }
        }

        res.json(deduplicatedResponse);
    } catch (error) {
        console.error('AI API error in /session/analyze:', error);

        const durationMs = Date.now() - startTime;

        // Track failed API call
        await trackApiUsage({
            userId: userId || null,
            isGuest: !userId,
            endpoint: 'analyze',
            model: modelName,
            botId: null,
            inputTokens: 0,
            outputTokens: 0,
            durationMs,
            success: false,
            errorMessage: error.message,
        });

        res.status(500).json({ error: 'Failed to analyze session.' });
    }
});

// POST /api/gemini/session/format-interview
router.post('/session/format-interview', optionalAuthMiddleware, async (req, res) => {
    const { history, lang } = req.body;

    const formattingPromptConfig = interviewFormattingPrompts.en;
    const conversation = history.map(msg => `${msg.role === 'user' ? 'User' : 'Guide'}: ${msg.text}`).join('\n\n');
    const template = getInterviewTemplate(lang);

    const fullPrompt = formattingPromptConfig.prompt({ conversation, template });
    const startTime = Date.now();
    const modelName = 'gemini-2.5-pro'; // Using Gemini 2.5 Pro for improved formatting
    const userId = req.userId;

    try {
        const response = await aiProviderService.generateContent({
            model: modelName,
            contents: fullPrompt,
            context: 'analysis' // Formatting uses analysis context
        });

        const durationMs = Date.now() - startTime;
        let markdown = response.text.trim();

        // Clean up potential markdown code block wrappers from the AI's response.
        // This regex handles ```markdown ... ``` or just ``` ... ```
        const codeBlockRegex = /^```(?:markdown)?\s*\n([\s\S]+?)\n```$/;
        const match = markdown.match(codeBlockRegex);
        if (match && match[1]) {
            markdown = match[1].trim();
        }

        // Track API usage with actual model and provider used
        const actualModel = response.model || modelName;
        const tokenUsage = response.usage || { inputTokens: 0, outputTokens: 0 };

        await trackApiUsage({
            userId: userId || null,
            isGuest: !userId,
            endpoint: 'format-interview',
            model: actualModel,
            botId: 'gloria-life-context',
            inputTokens: tokenUsage.inputTokens,
            outputTokens: tokenUsage.outputTokens,
            durationMs,
            success: true,
            metadata: { provider: response.provider },
        });

        res.json({ markdown });
    } catch (error) {
        console.error('AI API error in /session/format-interview:', error);

        const durationMs = Date.now() - startTime;

        // Track failed API call
        await trackApiUsage({
            userId: userId || null,
            isGuest: !userId,
            endpoint: 'format-interview',
            model: modelName,
            botId: 'gloria-life-context',
            inputTokens: 0,
            outputTokens: 0,
            durationMs,
            success: false,
            errorMessage: error.message,
        });

        res.status(500).json({ error: 'Failed to format interview.' });
    }
});

// POST /api/gemini/interview/transcript — Generate summary + corrected transcript for Gloria Interview
router.post('/interview/transcript', optionalAuthMiddleware, async (req, res) => {
    const { history, lang, userName } = req.body;
    if (!history || !Array.isArray(history) || history.length === 0) {
        return res.status(400).json({ error: 'history is required and must be a non-empty array' });
    }

    const userLabel = userName || 'Interviewee';
    const conversation = history.map(msg => `${msg.role === 'user' ? userLabel : 'Interviewer'}: ${msg.text}`).join('\n\n');

    const prompt = `You are an editor. You are given an interview transcript between an interviewer and ${userName ? userName : 'an interviewee'}.

The conversation consists of two phases: first a brief **setup** (topic, duration, perspective), then the actual **interview**. Separate these phases in your output.

Produce THREE sections, separated by the exact line "---SEPARATOR---":

**SECTION 1 — Summary:**
Write a concise summary of the interview (5-10 sentences). Capture the key topics, insights, and conclusions of the conversation. Focus only on the substantive interview content, not the setup.

**SECTION 2 — Interview Setup:**
Summarize the setup/clarification as a compact overview:
- Topic
- Agreed duration
- Chosen perspective/role of the interviewer
- Any special requests
Format this as a short, clear list (not dialogue).

**SECTION 3 — Smoothed Interview:**
Produce a clean, readable version of the actual interview (excluding the setup):
- Fix grammar, spelling, and punctuation
- Remove filler words and repetitions
- Preserve the content, meaning, and tone of what was said exactly
- Format as clear dialogue with "Interviewer:" and "${userLabel}:" labels
- Do NOT add anything that was not said

The interview transcript:

${conversation}`;

    const startTime = Date.now();
    const modelName = 'gemini-2.5-pro';
    const userId = req.userId;

    try {
        const response = await aiProviderService.generateContent({
            model: modelName,
            contents: prompt,
            context: 'analysis'
        });

        const durationMs = Date.now() - startTime;
        const text = response.text.trim();

        const separator = '---SEPARATOR---';
        const parts = text.split(separator);
        const summary = (parts[0] || '').trim();
        const setup = (parts[1] || '').trim();
        const transcript = (parts[2] || '').trim();

        const actualModel = response.model || modelName;
        const tokenUsage = response.usage || { inputTokens: 0, outputTokens: 0 };

        await trackApiUsage({
            userId: userId || null,
            isGuest: !userId,
            endpoint: 'interview-transcript',
            model: actualModel,
            botId: 'gloria-interview',
            inputTokens: tokenUsage.inputTokens,
            outputTokens: tokenUsage.outputTokens,
            durationMs,
            success: true,
            metadata: { provider: response.provider },
        });

        res.json({ summary, setup, transcript });
    } catch (error) {
        console.error('AI API error in /interview/transcript:', error);

        const durationMs = Date.now() - startTime;

        await trackApiUsage({
            userId: userId || null,
            isGuest: !userId,
            endpoint: 'interview-transcript',
            model: modelName,
            botId: 'gloria-interview',
            inputTokens: 0,
            outputTokens: 0,
            durationMs,
            success: false,
            errorMessage: error.message,
        });

        res.status(500).json({ error: 'Failed to generate interview transcript.' });
    }
});

// GET /api/gemini/cache/stats - Admin endpoint for cache statistics
router.get('/cache/stats', optionalAuthMiddleware, async (req, res) => {
    const userId = req.userId;

    // Only allow admins to view cache stats
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = getCacheStats();
    res.json(stats);
});

// POST /api/gemini/test/simulate-coachee - Generate realistic coachee responses for testing
// This endpoint is specifically designed for the TestRunner to simulate user responses
router.post('/test/simulate-coachee', optionalAuthMiddleware, async (req, res) => {
    const userId = req.userId;

    // Only allow developers to use this endpoint (Test Runner is developer-only)
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isDeveloper) {
        return res.status(403).json({ error: 'Developer access required' });
    }

    const {
        lastBotMessage,
        lastUserMessage,
        scenarioDescription,
        personalityContext,
        lang = 'en'
    } = req.body;

    if (!lastBotMessage) {
        return res.status(400).json({ error: 'lastBotMessage is required' });
    }

    const startTime = Date.now();

    try {
        // Build system prompt for coachee simulation
        const systemPrompt = `You are a coachee (client) in a coaching conversation. You have a problem and are seeking help.

IMPORTANT: You are NOT the coach! You are the client seeking support.

${personalityContext ? `YOUR PERSONALITY:\n${personalityContext}\n` : ''}
${scenarioDescription ? `YOUR TOPIC: ${scenarioDescription}\n` : ''}

RULES for your response:
1. Answer the coach's question directly and concretely
2. Share your feelings, worries, and thoughts authentically
3. Be vulnerable - you are someone seeking help
4. Respond in 1-3 short sentences
5. NO coaching phrases like "Let's...", "I understand...", "What do you think..."
6. NO questions back to the coach (except clarifying questions)
7. NO action descriptions with asterisks (like *sighs*, *nods*, *looks away*)
8. Respond like a real person with this problem would respond - in plain text without roleplay formatting`;

        const userPrompt = `The coach just said:
"${lastBotMessage}"

${lastUserMessage ? `You had previously said:\n"${lastUserMessage}"\n` : ''}
Your response as coachee (answer the coach's question directly):`;

        // Use Gemini directly for coachee simulation (no bot personality)
        const result = await aiProviderService.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt,
                maxOutputTokens: 1000, // Increased to ensure complete responses
                temperature: 0.8, // Slightly creative for natural responses
            },
            context: 'chat'
        });

        const generatedText = result.text || '';

        // Log for debugging truncation issues
        console.log(`[Coachee Simulation] Response length: ${generatedText.length} chars, finishReason: ${result.rawResponse?.candidates?.[0]?.finishReason || 'unknown'}`);
        const durationMs = Date.now() - startTime;

        // Track usage
        await trackApiUsage({
            userId,
            endpoint: '/api/gemini/test/simulate-coachee',
            botId: 'test-coachee-simulator',
            inputTokens: result.usage?.inputTokens || 0,
            outputTokens: result.usage?.outputTokens || 0,
            durationMs,
            success: true,
        });

        res.json({
            text: generatedText.trim(),
            durationMs
        });

    } catch (error) {
        console.error('Coachee simulation error:', error);
        const durationMs = Date.now() - startTime;

        await trackApiUsage({
            userId,
            endpoint: '/api/gemini/test/simulate-coachee',
            botId: 'test-coachee-simulator',
            inputTokens: 0,
            outputTokens: 0,
            durationMs,
            success: false,
            errorMessage: error.message,
        });

        res.status(500).json({ error: 'Failed to generate coachee response' });
    }
});

// POST /api/gemini/transcript/evaluate
// Requires authentication and Premium+ access
router.post('/transcript/evaluate', authMiddleware, async (req, res) => {
    const startTime = Date.now();
    const userId = req.userId;
    const { preAnswers, transcript, lang = 'en', decryptedPersonalityProfile } = req.body;

    try {
        // Validate required fields
        if (!preAnswers || !transcript) {
            return res.status(400).json({ error: 'preAnswers and transcript are required.' });
        }

        if (!preAnswers.situationName || !preAnswers.goal || !preAnswers.personalTarget || !preAnswers.assumptions || !preAnswers.satisfaction) {
            return res.status(400).json({ error: 'Pre-answers must include situationName, goal, personalTarget, assumptions, and satisfaction.' });
        }

        // Transcript length limit (50,000 chars)
        if (transcript.length > 50000) {
            return res.status(400).json({ error: 'Transcript exceeds maximum length of 50,000 characters.' });
        }

        // Access check: Premium+ only
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isPremium: true, isClient: true, isAdmin: true, isDeveloper: true, lifeContext: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (!user.isPremium && !user.isClient && !user.isAdmin && !user.isDeveloper) {
            return res.status(403).json({ error: 'Transcript evaluation requires Premium access or higher.' });
        }

        // Build personality profile summary for prompt (if provided)
        // #region agent log
        console.log('[TE DEBUG] Profile check:', {
            hasDecryptedProfile: !!decryptedPersonalityProfile,
            profileKeys: decryptedPersonalityProfile ? Object.keys(decryptedPersonalityProfile) : null,
            hasRiemann: !!decryptedPersonalityProfile?.riemann,
            hasBig5: !!decryptedPersonalityProfile?.big5,
            userId
        });
        // #endregion
        let personalityProfileSummary = null;
        if (decryptedPersonalityProfile) {
            const parts = [];
            if (decryptedPersonalityProfile.riemann?.selbst) {
                const s = decryptedPersonalityProfile.riemann.selbst;
                parts.push(`Riemann-Thomann (Selbst): Nähe=${s.naehe}, Distanz=${s.distanz}, Dauer=${s.dauer}, Wechsel=${s.wechsel}`);
            }
            if (decryptedPersonalityProfile.big5) {
                const b = decryptedPersonalityProfile.big5;
                parts.push(`Big5/OCEAN: O=${b.openness}, C=${b.conscientiousness}, E=${b.extraversion}, A=${b.agreeableness}, N=${b.neuroticism}`);
            }
            if (decryptedPersonalityProfile.spiralDynamics?.levels) {
                const levels = decryptedPersonalityProfile.spiralDynamics.levels;
                const top = Object.entries(levels).sort((a, b) => b[1] - a[1]).slice(0, 3);
                parts.push(`Spiral Dynamics (top 3): ${top.map(([k, v]) => `${k}=${v}`).join(', ')}`);
            }
            if (decryptedPersonalityProfile.narrativeProfile) {
                const np = decryptedPersonalityProfile.narrativeProfile;
                if (np.blindspots?.length > 0) {
                    parts.push(`Known Blindspots: ${np.blindspots.map(b => b.name).join(', ')}`);
                }
                if (np.superpowers?.length > 0) {
                    parts.push(`Superpowers: ${np.superpowers.map(s => s.name).join(', ')}`);
                }
            }
            personalityProfileSummary = parts.join('\n');
            // #region agent log
            console.log('[TE DEBUG] Profile summary built:', {
                summaryLength: personalityProfileSummary.length,
                partsCount: parts.length,
                preview: personalityProfileSummary.substring(0, 100)
            });
            // #endregion
        } else {
            // #region agent log
            console.log('[TE DEBUG] No profile provided - evaluation will proceed without personality insights');
            // #endregion
        }

        // Determine document language from context
        const context = user.lifeContext || null;
        const docLang = context && context.startsWith('# Mein Lebenskontext') ? 'de' : 'en';
        const currentDate = new Date().toISOString().split('T')[0];

        // Build evaluation prompt
        const promptFn = transcriptEvaluationPrompts[lang]?.prompt || transcriptEvaluationPrompts.en.prompt;
        const evaluationPrompt = promptFn({
            preAnswers,
            transcript,
            personalityProfile: personalityProfileSummary,
            context,
            docLang,
            currentDate
        });

        // AI call
        const modelName = 'gemini-2.5-pro';
        const result = await withTimeout(
            aiProviderService.generateContent({
                model: modelName,
                contents: evaluationPrompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: transcriptEvaluationPrompts.schema,
                    temperature: 0.2,
                },
                context: 'transcript-evaluation',
            }),
            120000,
            'Transcript evaluation'
        );

        const durationMs = Date.now() - startTime;
        const generatedText = result.text || '';
        const tokenUsage = result.usage || {};

        // Parse response
        let evaluationResult;
        try {
            const cleanedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            evaluationResult = JSON.parse(cleanedText);
        } catch (parseErr) {
            console.error('Failed to parse transcript evaluation response:', parseErr);
            return res.status(500).json({ error: 'Failed to parse evaluation response.' });
        }

        // Persist evaluation (transcript is NOT stored)
        const savedEvaluation = await prisma.transcriptEvaluation.create({
            data: {
                userId,
                preAnswers: JSON.stringify(preAnswers),
                evaluationData: JSON.stringify(evaluationResult),
                lang,
            }
        });

        // Track usage
        await trackApiUsage({
            userId,
            endpoint: 'transcript-evaluate',
            model: modelName,
            botId: null,
            inputTokens: tokenUsage.inputTokens || 0,
            outputTokens: tokenUsage.outputTokens || 0,
            durationMs,
            success: true,
        });

        res.json({
            id: savedEvaluation.id,
            evaluation: evaluationResult,
            durationMs,
        });

    } catch (error) {
        console.error('Transcript evaluation error:', error);
        const durationMs = Date.now() - startTime;

        await trackApiUsage({
            userId,
            endpoint: 'transcript-evaluate',
            model: 'gemini-2.5-pro',
            botId: null,
            inputTokens: 0,
            outputTokens: 0,
            durationMs,
            success: false,
            errorMessage: error.message,
        });

        res.status(500).json({ error: 'Transcript evaluation failed. Please try again.' });
    }
});

// GET /api/gemini/transcript/evaluations
// Returns list of past evaluations for the authenticated user
router.get('/transcript/evaluations', authMiddleware, async (req, res) => {
    const userId = req.userId;

    try {
        const evaluations = await prisma.transcriptEvaluation.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                preAnswers: true,
                evaluationData: true,
                lang: true,
                createdAt: true,
                userRating: true,
                userFeedback: true,
                contactOptIn: true,
            }
        });

        // Parse JSON fields and return summary for list view
        const result = evaluations.map(e => {
            let preAnswers, evaluationData;
            try {
                preAnswers = JSON.parse(e.preAnswers);
                evaluationData = JSON.parse(e.evaluationData);
            } catch {
                preAnswers = {};
                evaluationData = {};
            }
            return {
                id: e.id,
                createdAt: e.createdAt,
                lang: e.lang,
                goal: preAnswers.goal || '',
                summary: evaluationData.summary || '',
                overallScore: evaluationData.overallScore || 0,
                // Full data for detail view
                preAnswers,
                evaluationData,
                // Rating data
                userRating: e.userRating,
                userFeedback: e.userFeedback,
                contactOptIn: e.contactOptIn,
            };
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching transcript evaluations:', error);
        res.status(500).json({ error: 'Failed to fetch evaluations.' });
    }
});

// DELETE /api/gemini/transcript/evaluations/:id - Delete a transcript evaluation
router.delete('/transcript/evaluations/:id', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const { id } = req.params;

    try {
        // Verify ownership before deleting
        const evaluation = await prisma.transcriptEvaluation.findUnique({
            where: { id },
            select: { userId: true }
        });

        if (!evaluation) {
            return res.status(404).json({ error: 'Evaluation not found.' });
        }

        if (evaluation.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized to delete this evaluation.' });
        }

        // Delete the evaluation
        await prisma.transcriptEvaluation.delete({
            where: { id }
        });

        res.json({ success: true, message: 'Evaluation deleted successfully.' });
    } catch (error) {
        console.error('Error deleting transcript evaluation:', error);
        res.status(500).json({ error: 'Failed to delete evaluation.' });
    }
});

// POST /api/gemini/transcript/:id/rate - Rate a transcript evaluation
router.post('/transcript/:id/rate', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { rating, feedback, contactOptIn } = req.body;
    const userId = req.userId;

    try {
        // Validate rating (0-10 NPS scale)
        if (typeof rating !== 'number' || rating < 0 || rating > 10) {
            return res.status(400).json({ error: 'Rating must be a number between 0 and 10.' });
        }

        // Verify ownership
        const evaluation = await prisma.transcriptEvaluation.findUnique({
            where: { id },
            select: { userId: true }
        });

        if (!evaluation) {
            return res.status(404).json({ error: 'Evaluation not found.' });
        }

        if (evaluation.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized to rate this evaluation.' });
        }

        // Update rating
        await prisma.transcriptEvaluation.update({
            where: { id },
            data: {
                userRating: rating,
                userFeedback: feedback || null,
                contactOptIn: !!contactOptIn,
                ratedAt: new Date()
            }
        });

        res.json({ success: true, message: 'Rating submitted successfully.' });
    } catch (error) {
        console.error('Error rating transcript evaluation:', error);
        res.status(500).json({ error: 'Failed to submit rating.' });
    }
});

// POST /api/gemini/transcript/transcribe-audio
// Transcribes audio with speaker diarization via Gemini (Google-only, no Mistral fallback)
// Requires authentication and Client+ access
router.post('/transcript/transcribe-audio', authMiddleware, audioTranscribeLimiter, audioUpload.single('audio'), async (req, res) => {
    const startTime = Date.now();
    const userId = req.userId;

    try {
        // Validate file presence
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided.' });
        }

        const { lang = 'en', speakerHint } = req.body;

        // Reject extremely small files — they contain no meaningful audio and
        // cause Gemini to hallucinate entire transcripts from nothing.
        const MIN_AUDIO_BYTES = 10000; // ~10 KB
        if (req.file.size < MIN_AUDIO_BYTES) {
            return res.status(400).json({
                error: 'The audio file is too short or empty. Please record at least a few seconds of audio.'
            });
        }

        // Access check: Client+ only (Client, Admin, Developer)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isClient: true, isAdmin: true, isDeveloper: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (!user.isClient && !user.isAdmin && !user.isDeveloper) {
            return res.status(403).json({ error: 'Audio transcription requires Client access or higher.' });
        }

        // Build diarization prompt
        const speakerHintNum = speakerHint ? parseInt(speakerHint, 10) : null;
        const speakerInstruction = speakerHintNum && speakerHintNum >= 2 && speakerHintNum <= 4
            ? `There are exactly ${speakerHintNum} speakers in this conversation.`
            : '';

        const diarizationPrompt = `Transcribe the following audio file completely and verbatim.

SPEAKER IDENTIFICATION:
- Identify the different speakers based on their voices.
- Use labels [Speaker 1], [Speaker 2], [Speaker 3] etc.
${speakerInstruction}

FORMAT:
- Start with a brief speaker identification section in this format:
  ---SPEAKERS---
  Speaker 1: [brief voice description, e.g. "male voice, deep tone"]
  Speaker 2: [brief voice description]
  ---SPEAKERS---
- Then provide the complete transcript.
- Each speaker change starts on a new line with the speaker label.
- Format: [Speaker N]: Speaker's text
- Add paragraph breaks at topical shifts.
- Keep filler words and natural speech patterns, but lightly correct obvious grammar errors.

IMPORTANT: Output ONLY the speaker identification and transcript, no additional comments or summaries.`;

        // Send to Gemini with audio inline data (Google-only, no Mistral fallback)
        const client = await aiProviderService.getGoogleClient();
        const audioBase64 = req.file.buffer.toString('base64');

        const response = await withTimeout(
            client.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: req.file.mimetype, data: audioBase64 } },
                        { text: diarizationPrompt }
                    ]
                }],
                config: { temperature: 0.1, maxOutputTokens: 65536 }
            }),
            120000,
            'Audio transcription'
        );

        const transcript = response.text || '';
        const tokenUsage = response.usageMetadata || {};

        // Hallucination guard: if the audio contributed very few tokens but Gemini
        // produced a long transcript, the output is almost certainly fabricated.
        // Typical audio encodes at ~25 tokens/second, so < 50 prompt tokens means
        // less than ~2 seconds of real audio — yet the prompt text itself accounts
        // for ~200-300 tokens. We flag when the output is suspiciously long relative
        // to the audio input.
        const promptTokens = tokenUsage.promptTokenCount || 0;
        const outputTokens = tokenUsage.candidatesTokenCount || 0;
        const PROMPT_TEXT_OVERHEAD = 350; // approximate tokens used by the diarization prompt itself
        const audioTokens = Math.max(0, promptTokens - PROMPT_TEXT_OVERHEAD);

        if (audioTokens < 50 && outputTokens > 100) {
            console.warn(`[Audio Transcription] Hallucination suspected: audioTokens=${audioTokens}, outputTokens=${outputTokens}`);
            return res.status(400).json({
                error: 'The audio file does not contain recognizable speech. Please make sure the recording contains conversation content.'
            });
        }

        // Count speakers from the transcript
        const speakerPattern = /\[Speaker (\d+)\]/g;
        const speakerNumbers = new Set();
        let match;
        while ((match = speakerPattern.exec(transcript)) !== null) {
            speakerNumbers.add(parseInt(match[1], 10));
        }
        const speakerCount = speakerNumbers.size;

        const durationMs = Date.now() - startTime;

        await trackApiUsage({
            userId,
            endpoint: '/api/gemini/transcript/transcribe-audio',
            botId: 'audio-transcription',
            inputTokens: promptTokens,
            outputTokens: outputTokens,
            durationMs,
            success: true,
        });

        res.json({ transcript, speakerCount });

    } catch (error) {
        console.error('Audio transcription error:', error);
        const durationMs = Date.now() - startTime;

        await trackApiUsage({
            userId,
            endpoint: '/api/gemini/transcript/transcribe-audio',
            botId: 'audio-transcription',
            inputTokens: 0,
            outputTokens: 0,
            durationMs,
            success: false,
            errorMessage: error.message,
        });

        if (error.message?.includes('Unsupported audio format')) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to transcribe audio.' });
    }
});

module.exports = router;
