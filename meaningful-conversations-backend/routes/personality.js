const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient.js');
const authMiddleware = require('../middleware/auth.js');
const profileRefinement = require('../services/profileRefinement.js');
const aiProvider = require('../services/aiProviderService.js');

/**
 * POST /api/personality/save
 * Speichert verschluesseltes Persoenlichkeitsprofil
 */
router.post('/save', authMiddleware, async (req, res) => {
  try {
    const { testType, completedLenses, filterWorry, filterControl, encryptedData, adaptationMode } = req.body;
    const userId = req.userId;
    
    // Validation
    if (!testType || !encryptedData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate adaptationMode - default to 'stable' (DPC); 'adaptive' (DPFL) requires premium
    const validMode = adaptationMode === 'adaptive' ? 'adaptive' : 'stable';
    
    // Validate and serialize completedLenses
    const validLenses = ['sd', 'riemann', 'ocean'];
    const premiumOnlyLenses = ['sd', 'riemann'];
    let lensesJson = '[]';
    if (Array.isArray(completedLenses)) {
      const filtered = completedLenses.filter(l => validLenses.includes(l));
      lensesJson = JSON.stringify(filtered);
    }
    
    // Premium enforcement: Riemann & SD require premium (isPremium), client (isClient), or admin access
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && !user.isPremium && !user.isClient && !user.isAdmin) {
      const requestedPremiumLenses = (Array.isArray(completedLenses) ? completedLenses : [])
        .filter(l => premiumOnlyLenses.includes(l));
      
      // Check if any premium-only lenses are NEW (not already in existing profile)
      const existingProfileForCheck = await prisma.personalityProfile.findUnique({ where: { userId } });
      const existingLensesForCheck = existingProfileForCheck?.completedLenses 
        ? JSON.parse(existingProfileForCheck.completedLenses) : [];
      
      const newPremiumLenses = requestedPremiumLenses.filter(l => !existingLensesForCheck.includes(l));
      if (newPremiumLenses.length > 0) {
        return res.status(403).json({ 
          error: `Riemann-Thomann and Spiral Dynamics profiles require Premium access.` 
        });
      }
    }
    
    // Check if profile exists to determine if we should merge lenses
    const existingProfile = await prisma.personalityProfile.findUnique({
      where: { userId }
    });
    
    // If profile exists and we're adding a lens, merge the completedLenses
    if (existingProfile && existingProfile.completedLenses) {
      try {
        const existingLenses = JSON.parse(existingProfile.completedLenses);
        const newLenses = Array.isArray(completedLenses) ? completedLenses : [];
        const mergedLenses = [...new Set([...existingLenses, ...newLenses])].filter(l => validLenses.includes(l));
        lensesJson = JSON.stringify(mergedLenses);
      } catch (e) {
        // If parsing fails, just use the new lenses
        console.warn('Failed to parse existing completedLenses, using new value');
      }
    }
    
    // Upsert (create or update)
    const profile = await prisma.personalityProfile.upsert({
      where: { userId },
      create: {
        userId,
        testType,
        completedLenses: lensesJson,
        filterWorry: filterWorry || null,
        filterControl: filterControl || null,
        adaptationMode: validMode,
        encryptedData
      },
      update: {
        testType,
        completedLenses: lensesJson,
        filterWorry: filterWorry || null,
        filterControl: filterControl || null,
        adaptationMode: validMode,
        encryptedData,
        // Don't reset session count when adding a lens
        // sessionCount: 0
      }
    });
    
    res.json({ success: true, profileId: profile.id, completedLenses: JSON.parse(lensesJson) });
  } catch (error) {
    console.error('Error saving personality profile:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

/**
 * GET /api/personality/profile
 * Holt verschluesseltes Profil (Client muss entschluesseln)
 */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const profile = await prisma.personalityProfile.findUnique({
      where: { userId: req.userId }
    });
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * DELETE /api/personality/profile
 * Löscht das Persönlichkeitsprofil eines Benutzers vollständig
 */
router.delete('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    
    // Check if profile exists
    const existingProfile = await prisma.personalityProfile.findUnique({
      where: { userId }
    });
    
    if (!existingProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Delete associated session behavior logs first (foreign key constraint)
    await prisma.sessionBehaviorLog.deleteMany({
      where: { userId }
    });
    
    // Delete the personality profile
    await prisma.personalityProfile.delete({
      where: { userId }
    });
    
    // Reset user's coaching mode to 'off'
    await prisma.user.update({
      where: { id: userId },
      data: { coachingMode: 'off' }
    });
    
    console.log(`[Personality] Profile deleted for user ${userId}`);
    
    res.json({ success: true, message: 'Profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting personality profile:', error);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

/**
 * POST /api/personality/session-log
 * Loggt Session-Verhalten (nur Keyword-Frequenzen, kein Transcript)
 * Speichert Frequenzen für alle drei Profile-Typen: Riemann, Big5, SD
 * GDPR-konform: Transcript wird nicht gespeichert
 */
router.post('/session-log', authMiddleware, async (req, res) => {
  try {
    const { sessionId, frequencies } = req.body;
    
    if (!sessionId || !frequencies) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Extract frequencies for all profile types
    const riemann = frequencies?.riemann || {};
    const big5 = frequencies?.big5 || {};
    const sd = frequencies?.sd || {};
    
    const log = await prisma.sessionBehaviorLog.create({
      data: {
        userId: req.userId,
        sessionId,
        // Riemann-Thomann (delta values: high - low)
        dauerFrequency: riemann.dauer || frequencies?.dauer || 0,
        wechselFrequency: riemann.wechsel || frequencies?.wechsel || 0,
        naeheFrequency: riemann.naehe || frequencies?.naehe || 0,
        distanzFrequency: riemann.distanz || frequencies?.distanz || 0,
        // Big5/OCEAN (delta values)
        opennessFrequency: big5.openness || 0,
        conscientiousnessFrequency: big5.conscientiousness || 0,
        extraversionFrequency: big5.extraversion || 0,
        agreeablenessFrequency: big5.agreeableness || 0,
        neuroticismFrequency: big5.neuroticism || 0,
        // Spiral Dynamics (delta values)
        beigeFrequency: sd.beige || 0,
        purpleFrequency: sd.purple || 0,
        redFrequency: sd.red || 0,
        blueFrequency: sd.blue || 0,
        orangeFrequency: sd.orange || 0,
        greenFrequency: sd.green || 0,
        yellowFrequency: sd.yellow || 0,
        turquoiseFrequency: sd.turquoise || 0
        // Note: encryptedTranscript field removed for GDPR compliance
        // Users can download transcript immediately after session
      }
    });
    
    console.log(`[DPFL] Session logged for user ${req.userId}, session ${sessionId}`);
    
    res.json({ success: true, logId: log.id });
  } catch (error) {
    console.error('Error logging session:', error);
    res.status(500).json({ error: 'Failed to log session' });
  }
});

/**
 * POST /api/personality/comfort-check
 * Speichert Comfort Score fuer eine Session
 */
router.post('/comfort-check', authMiddleware, async (req, res) => {
  try {
    const { sessionId, score, optOut } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }
    
    const updated = await prisma.sessionBehaviorLog.updateMany({
      where: {
        userId: req.userId,
        sessionId
      },
      data: {
        comfortScore: score,
        optedOut: optOut || false
      }
    });
    
    // Only increment session count for ADAPTIVE profiles and authentic sessions
    if (!optOut && score && score >= 3) {
      // Check if user has adaptive profile
      const profile = await prisma.personalityProfile.findUnique({
        where: { userId: req.userId },
        select: { adaptationMode: true }
      });
      
      if (profile && profile.adaptationMode === 'adaptive') {
        await prisma.personalityProfile.updateMany({
          where: { userId: req.userId },
          data: {
            sessionCount: { increment: 1 }
          }
        });
      } else {
      }
    }
    
    res.json({ success: true, updated: updated.count });
  } catch (error) {
    console.error('Error saving comfort check:', error);
    res.status(500).json({ error: 'Failed to save comfort check' });
  }
});

/**
 * GET /api/personality/adaptation-suggestions
 * Berechnet Profil-Update-Vorschlaege basierend auf Session-Logs
 * Nur fuer adaptive Profile
 */
router.get('/adaptation-suggestions', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    
    // Hole aktuelles Profil und pruefe adaptationMode
    const profile = await prisma.personalityProfile.findUnique({
      where: { userId }
    });
    
    if (!profile) {
      return res.json({ hasSuggestions: false, reason: 'No profile found' });
    }
    
    // Check adaptation mode - stable profiles don't get suggestions
    if (profile.adaptationMode === 'stable') {
      return res.json({ 
        hasSuggestions: false, 
        reason: 'Profile is set to stable mode',
        adaptationMode: 'stable'
      });
    }
    
    // Hole die letzten 5 Sessions (nicht opted-out)
    const recentLogs = await prisma.sessionBehaviorLog.findMany({
      where: {
        userId,
        optedOut: false,
        comfortScore: { gte: 3 } // Nur authentische Sessions
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    if (recentLogs.length < 2) {
      return res.json({ 
        hasSuggestions: false, 
        message: 'Not enough data yet (minimum 2 sessions)',
        adaptationMode: 'adaptive'
      });
    }
    
    // Note: Profile data is encrypted
    // Return raw session logs so client can decrypt profile and calculate suggestions
    // We can't calculate deltas server-side because we can't decrypt the profile
    
    // Parse completedLenses to determine which profile types are relevant
    let completedLenses = [];
    try {
      completedLenses = JSON.parse(profile.completedLenses || '[]');
    } catch (e) {
      completedLenses = [];
    }
    
    res.json({
      hasSuggestions: true,
      sessionLogs: recentLogs.map(log => ({
        // Riemann-Thomann frequencies
        riemann: {
          dauer: log.dauerFrequency,
          wechsel: log.wechselFrequency,
          naehe: log.naeheFrequency,
          distanz: log.distanzFrequency
        },
        // Big5/OCEAN frequencies
        big5: {
          openness: log.opennessFrequency,
          conscientiousness: log.conscientiousnessFrequency,
          extraversion: log.extraversionFrequency,
          agreeableness: log.agreeablenessFrequency,
          neuroticism: log.neuroticismFrequency
        },
        // Spiral Dynamics frequencies
        sd: {
          beige: log.beigeFrequency,
          purple: log.purpleFrequency,
          red: log.redFrequency,
          blue: log.blueFrequency,
          orange: log.orangeFrequency,
          green: log.greenFrequency,
          yellow: log.yellowFrequency,
          turquoise: log.turquoiseFrequency
        },
        comfortScore: log.comfortScore
      })),
      sessionCount: recentLogs.length,
      profileType: profile.testType,
      completedLenses,
      adaptationMode: 'adaptive',
      message: 'Client must decrypt profile and use profileRefinement service'
    });
    
  } catch (error) {
    console.error('Error calculating adaptation suggestions:', error);
    res.status(500).json({ error: 'Failed to calculate suggestions' });
  }
});

/**
 * POST /api/personality/generate-narrative
 * Generates a narrative personality profile using AI
 */
router.post('/generate-narrative', authMiddleware, async (req, res) => {
  try {
    const { quantitativeData, narratives, language } = req.body;
    
    // Validation
    if (!quantitativeData || !narratives || !narratives.flowStory || !narratives.frictionStory) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const lang = 'en';
    
    // Build the synthesis prompt
    const synthesisPrompt = NARRATIVE_SYNTHESIS_PROMPTS[lang]
      .replace('{{quantitativeData}}', JSON.stringify(quantitativeData, null, 2))
      .replace('{{flowStory}}', narratives.flowStory)
      .replace('{{frictionStory}}', narratives.frictionStory);
    
    
    // Call AI provider
    const result = await aiProvider.generateContent({
      model: 'gemini-2.5-flash',
      contents: synthesisPrompt,
      config: {
        temperature: 0.8,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        systemInstruction: 'Respond only with valid JSON matching the requested schema. No explanations outside the JSON.'
      }
    });
    
    // Parse the response - strip markdown code fences if present
    let narrativeProfile;
    try {
      let jsonText = result.text.trim();
      // Remove markdown code fences if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7); // Remove ```json
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3); // Remove ```
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3); // Remove trailing ```
      }
      jsonText = jsonText.trim();
      
      narrativeProfile = JSON.parse(jsonText);
      narrativeProfile.generatedAt = new Date().toISOString();
      narrativeProfile.generatedLanguage = lang;
    } catch (parseError) {
      console.error('[Narrative] Failed to parse AI response:', result.text);
      return res.status(500).json({ error: 'Failed to parse narrative profile' });
    }
    
    
    res.json({ 
      success: true, 
      narrativeProfile,
      model: result.model,
      provider: result.provider
    });
    
  } catch (error) {
    console.error('Error generating narrative profile:', error);
    res.status(500).json({ error: 'Failed to generate narrative profile' });
  }
});

/**
 * POST /api/personality/preview-refinement
 * Preview profile refinement based on chat history (dry-run, no save)
 * Used by admin tests to see how a session would affect the profile
 * ALWAYS runs regardless of user's coachingMode setting (test override)
 */
router.post('/preview-refinement', authMiddleware, async (req, res) => {
  try {
    const { chatHistory, decryptedProfile, profileType, lang } = req.body;
    
    // Validation
    if (!chatHistory || !Array.isArray(chatHistory)) {
      return res.status(400).json({ error: 'chatHistory is required and must be an array' });
    }
    
    if (!decryptedProfile || !profileType) {
      return res.status(400).json({ error: 'decryptedProfile and profileType are required' });
    }
    
    // Import behavior logger
    const behaviorLogger = require('../services/behaviorLogger.js');
    const language = 'en';
    
    // Analyze conversation using appropriate keyword set based on profile type
    // New bidirectional format: each dimension has high/low counts and delta
    let analysis, mockSessionLogs, refinementResult;
    
    if (profileType === 'RIEMANN') {
      // Use Riemann-Thomann keywords (bidirectional)
      analysis = behaviorLogger.analyzeConversation(chatHistory, language);
      
      // Convert bidirectional analysis to session log format
      mockSessionLogs = [{
        // High/Low counts and deltas for each dimension
        naeheHigh: analysis.naehe?.high || 0,
        naeheLow: analysis.naehe?.low || 0,
        naeheDelta: analysis.naehe?.delta || 0,
        naeheFoundHigh: analysis.naehe?.foundKeywords?.high || [],
        naeheFoundLow: analysis.naehe?.foundKeywords?.low || [],
        
        distanzHigh: analysis.distanz?.high || 0,
        distanzLow: analysis.distanz?.low || 0,
        distanzDelta: analysis.distanz?.delta || 0,
        distanzFoundHigh: analysis.distanz?.foundKeywords?.high || [],
        distanzFoundLow: analysis.distanz?.foundKeywords?.low || [],
        
        dauerHigh: analysis.dauer?.high || 0,
        dauerLow: analysis.dauer?.low || 0,
        dauerDelta: analysis.dauer?.delta || 0,
        dauerFoundHigh: analysis.dauer?.foundKeywords?.high || [],
        dauerFoundLow: analysis.dauer?.foundKeywords?.low || [],
        
        wechselHigh: analysis.wechsel?.high || 0,
        wechselLow: analysis.wechsel?.low || 0,
        wechselDelta: analysis.wechsel?.delta || 0,
        wechselFoundHigh: analysis.wechsel?.foundKeywords?.high || [],
        wechselFoundLow: analysis.wechsel?.foundKeywords?.low || [],
        
        comfortScore: 5, // Assume authentic for preview
        optedOut: false
      }];
      
      refinementResult = profileRefinement.calculateRiemannRefinement(
        decryptedProfile.riemann || decryptedProfile,
        mockSessionLogs,
        0.3 // Standard weight
      );
    } else if (profileType === 'BIG5') {
      // Use Big5/OCEAN keywords (bidirectional)
      analysis = behaviorLogger.analyzeBig5Conversation(chatHistory, language);
      
      // Convert bidirectional analysis to session log format
      mockSessionLogs = [{
        opennessHigh: analysis.openness?.high || 0,
        opennessLow: analysis.openness?.low || 0,
        opennessDelta: analysis.openness?.delta || 0,
        opennessFoundHigh: analysis.openness?.foundKeywords?.high || [],
        opennessFoundLow: analysis.openness?.foundKeywords?.low || [],
        
        conscientiousnessHigh: analysis.conscientiousness?.high || 0,
        conscientiousnessLow: analysis.conscientiousness?.low || 0,
        conscientiousnessDelta: analysis.conscientiousness?.delta || 0,
        conscientiousnessFoundHigh: analysis.conscientiousness?.foundKeywords?.high || [],
        conscientiousnessFoundLow: analysis.conscientiousness?.foundKeywords?.low || [],
        
        extraversionHigh: analysis.extraversion?.high || 0,
        extraversionLow: analysis.extraversion?.low || 0,
        extraversionDelta: analysis.extraversion?.delta || 0,
        extraversionFoundHigh: analysis.extraversion?.foundKeywords?.high || [],
        extraversionFoundLow: analysis.extraversion?.foundKeywords?.low || [],
        
        agreeablenessHigh: analysis.agreeableness?.high || 0,
        agreeablenessLow: analysis.agreeableness?.low || 0,
        agreeablenessDelta: analysis.agreeableness?.delta || 0,
        agreeablenessFoundHigh: analysis.agreeableness?.foundKeywords?.high || [],
        agreeablenessFoundLow: analysis.agreeableness?.foundKeywords?.low || [],
        
        neuroticismHigh: analysis.neuroticism?.high || 0,
        neuroticismLow: analysis.neuroticism?.low || 0,
        neuroticismDelta: analysis.neuroticism?.delta || 0,
        neuroticismFoundHigh: analysis.neuroticism?.foundKeywords?.high || [],
        neuroticismFoundLow: analysis.neuroticism?.foundKeywords?.low || [],
        
        comfortScore: 5, // Assume authentic for preview
        optedOut: false
      }];
      
      refinementResult = profileRefinement.calculateBig5Refinement(
        decryptedProfile.big5 || decryptedProfile,
        mockSessionLogs,
        0.3
      );
    } else {
      return res.status(400).json({ error: 'Unknown profileType. Use RIEMANN or BIG5.' });
    }
    
    res.json({
      success: true,
      isPreviewOnly: true,
      bidirectionalAnalysis: analysis,
      refinementResult,
      profileType,
      message: 'This is a preview. No changes were saved.'
    });
    
  } catch (error) {
    console.error('Error previewing refinement:', error);
    res.status(500).json({ error: 'Failed to preview refinement' });
  }
});

// Narrative Synthesis Prompts
const NARRATIVE_SYNTHESIS_PROMPTS = {
  en: `You are a psychological profiler with the linguistic elegance of a novelist.
Your goal: A deep personality profile that weaves quantitative data with qualitative narratives.

RULES:
1. Synthesize Paradoxes: If data shows contradictory traits (e.g., desire for freedom AND desire for structure), call it an "operating system". Explain how both poles work together (e.g., "You need structure to be wild").
2. No Psychobabble: No technical jargon. Use friendly terms: neuroticism→Emotional Stability. Invent metaphorical titles for talents (e.g., "Prototype Alchemy" instead of "High Openness").
3. Use the User-Story as PATTERN: Describe the underlying pattern (e.g., "creative autonomy"), NOT the specific event (e.g., "app development"). No project names, person names, or specific situations.
4. Tone: Empathetic, direct, slightly poetic, but grounded ("You contain multitudes").
5. Write in English. Use "You" as the form of address.
6. Timelessness: The profile should still be relevant in 2 years. Avoid references to current events.
7. No Markdown: Do NOT use any Markdown formatting like *italic*, **bold** or other special characters. Plain text only.

QUANTITATIVE DATA (Test Results):
{{quantitativeData}}

FLOW EXPERIENCE (What energizes this person):
{{flowStory}}

CONFLICT EXPERIENCE (What drains energy):
{{frictionStory}}

Create a JSON with exactly this structure:
{
  "operatingSystem": "1 compelling opening sentence + 1 paragraph about the dynamics of contradictions. Maximum 100 words. No specific project or person references.",
  "superpowers": [
    { "name": "Creative metaphorical title", "description": "Description of the PATTERN shown in the flow story" },
    { "name": "Second title", "description": "Second strength" },
    { "name": "Third title", "description": "Third strength" }
  ],
  "blindspots": [
    { "name": "Metaphorical name", "description": "Framed as imbalance of talents or wrong environment, NOT as weakness. Describe the pattern from the conflict story." },
    { "name": "Second blindspot", "description": "Second risk" }
  ],
  "growthOpportunities": [
    { "title": "Concrete exercise with creative name", "recommendation": "Practical recommendation directly derived from the blindspots" },
    { "title": "Second exercise", "recommendation": "Second recommendation" }
  ]
}`
};

/**
 * POST /api/personality/test-refinement-mock
 * Test endpoint for profile refinement with mock session data
 * Allows testing refinement UI without running 2+ real sessions
 * ADMIN/TEST ONLY - requires test profile override
 */
router.post('/test-refinement-mock', authMiddleware, async (req, res) => {
  try {
    const { profileType, decryptedProfile, mockSessions } = req.body;
    
    if (!profileType || !decryptedProfile || !mockSessions || mockSessions.length < 2) {
      return res.status(400).json({ 
        error: 'Missing required fields: profileType, decryptedProfile, mockSessions (min 2)' 
      });
    }
    
    // Use profileRefinement service to calculate suggestions
    const profileRefinementService = require('../services/profileRefinement');
    
    const result = profileRefinementService.calculateProfileRefinement(
      decryptedProfile,
      profileType,
      mockSessions
    );
    
    res.json({
      success: true,
      isPreviewOnly: true,
      isMockTest: true,
      refinementResult: result,
      profileType,
      message: result.hasSuggestions 
        ? 'Mock refinement suggestions calculated' 
        : (result.reason || 'No significant changes detected')
    });
    
  } catch (error) {
    console.error('Error in test-refinement-mock:', error);
    res.status(500).json({ error: 'Failed to calculate mock refinement' });
  }
});

module.exports = router;

