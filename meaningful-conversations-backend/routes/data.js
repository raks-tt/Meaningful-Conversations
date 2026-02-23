const express = require('express');
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth.js');
const prisma = require('../prismaClient.js');
const bcrypt = require('bcryptjs');

const router = express.Router();
router.use(authMiddleware);

// GET /api/data/user - Get the current user's data
router.get('/user', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            context: user.lifeContext,
            gamificationState: user.gamificationState,
        });
    } catch (error) {
        console.error("Error fetching user data:", error);
        res.status(500).json({ error: 'Failed to fetch user data.' });
    }
});

// PUT /api/data/user - Update the current user's data
router.put('/user', async (req, res) => {
    const { context, gamificationState } = req.body;
    try {
        await prisma.user.update({
            where: { id: req.userId },
            data: {
                lifeContext: context,
                gamificationState,
                updatedAt: new Date(),
            },
        });
        res.status(200).json({ message: 'User data saved successfully.' });
    } catch (error) {
        console.error("Error saving user data:", error);
        res.status(500).json({ error: 'Failed to save user data.' });
    }
});

// PUT /api/data/user/profile - Update user profile (name, newsletter)
router.put('/user/profile', async (req, res) => {
    const { firstName, lastName, newsletterConsent } = req.body;
    const userId = req.userId;
    
    try {
        const updateData = {
            updatedAt: new Date(),
        };
        
        // Update name fields if provided
        if (firstName !== undefined) {
            updateData.firstName = firstName || null;
        }
        if (lastName !== undefined) {
            updateData.lastName = lastName || null;
        }
        
        // Update newsletter consent
        if (newsletterConsent !== undefined) {
            updateData.newsletterConsent = newsletterConsent;
            // Set consent date when user first opts in, or clear it when opting out
            if (newsletterConsent) {
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (!user.newsletterConsentDate) {
                    updateData.newsletterConsentDate = new Date();
                }
                // Generate unsubscribe token if not exists
                if (!user.unsubscribeToken) {
                    updateData.unsubscribeToken = crypto.randomBytes(32).toString('hex');
                }
            } else {
                updateData.newsletterConsentDate = null;
                updateData.unsubscribeToken = null;
            }
        }
        
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
        });
        
        // Return updated user without sensitive fields
        const { passwordHash, ...userResponse } = updatedUser;
        res.json({ message: 'Profile updated successfully', user: userResponse });
        
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

// PUT /api/data/user/coaching-mode - Update user coaching mode
router.put('/user/coaching-mode', async (req, res) => {
    const { coachingMode } = req.body;
    const userId = req.userId;
    
    // Validate coaching mode
    const validModes = ['off', 'dpc', 'dpfl'];
    if (!validModes.includes(coachingMode)) {
        return res.status(400).json({ error: 'Invalid coaching mode. Must be one of: off, dpc, dpfl' });
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                coachingMode,
                updatedAt: new Date(),
            },
        });
        
        // Return updated user without sensitive fields
        const { passwordHash, ...userResponse } = updatedUser;
        
        // Parse unlockedCoaches from JSON string
        if (userResponse.unlockedCoaches) {
            try {
                userResponse.unlockedCoaches = JSON.parse(userResponse.unlockedCoaches);
            } catch {
                userResponse.unlockedCoaches = [];
            }
        } else {
            userResponse.unlockedCoaches = [];
        }
        
        res.json({ message: 'Coaching mode updated successfully', user: userResponse });
        
    } catch (error) {
        console.error('Error updating coaching mode:', error);
        res.status(500).json({ error: 'Failed to update coaching mode.' });
    }
});

// PUT /api/data/user/ai-region - Update user AI region preference
router.put('/user/ai-region', async (req, res) => {
    const { aiRegionPreference } = req.body;
    const userId = req.userId;
    
    // Validate region preference
    const validRegions = ['optimal', 'eu', 'us'];
    if (!validRegions.includes(aiRegionPreference)) {
        return res.status(400).json({ error: 'Invalid AI region preference. Must be one of: optimal, eu, us' });
    }
    
    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                aiRegionPreference,
                updatedAt: new Date(),
            },
        });
        
        // Log region change for analytics
        console.log(`🌍 User ${userId} changed AI region preference to: ${aiRegionPreference}`);
        
        // Return updated user without sensitive fields
        const { passwordHash, ...userResponse } = updatedUser;
        
        // Parse unlockedCoaches from JSON string
        if (userResponse.unlockedCoaches) {
            try {
                userResponse.unlockedCoaches = JSON.parse(userResponse.unlockedCoaches);
            } catch {
                userResponse.unlockedCoaches = [];
            }
        } else {
            userResponse.unlockedCoaches = [];
        }
        
        res.json({ 
            message: 'AI region preference updated successfully', 
            user: userResponse,
            regionInfo: {
                eu: { provider: 'Mistral AI', location: 'Paris, France', gdprCompliant: true },
                us: { provider: 'Google Gemini', location: 'USA', gdprCompliant: false },
                optimal: { provider: 'Admin-configured default', location: 'Varies', gdprCompliant: 'depends' },
            }
        });
        
    } catch (error) {
        console.error('Error updating AI region preference:', error);
        res.status(500).json({ error: 'Failed to update AI region preference.' });
    }
});

// Helper function to generate HTML export
function generateHtmlExport(exportData, language = 'en') {
    const formatDate = (dateStr) => {
        if (!dateStr) return 'Not available';
        const date = new Date(dateStr);
        return date.toLocaleString(language, { dateStyle: 'long', timeStyle: 'short' });
    };

    const formatBoolean = (value) => {
        if (value === null || value === undefined) return '-';
        return value ? 'Yes' : 'No';
    };

    const html = `<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Export - Meaningful Conversations</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #22C55E 0%, #4ADE80 100%);
            padding: 20px;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #22C55E 0%, #4ADE80 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .header .brand { font-size: 0.85em; opacity: 0.8; margin-bottom: 8px; font-weight: 300; }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; font-weight: 700; }
        .header p { opacity: 0.9; font-size: 1.1em; }
        .content { padding: 40px 30px; }
        .section {
            margin-bottom: 40px;
            padding: 25px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #4ADE80;
        }
        .section h2 {
            color: #16A34A;
            margin-bottom: 20px;
            font-size: 1.8em;
            padding-bottom: 10px;
            border-bottom: 2px solid #e9ecef;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-bottom: 15px;
        }
        .info-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }
        .info-label {
            font-weight: 600;
            color: #16A34A;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        .info-value {
            color: #333;
            font-size: 1.1em;
        }
        .feedback-item, .api-item, .code-item {
            background: white;
            padding: 20px;
            margin-bottom: 15px;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
        }
        .badge-success { background: #d4edda; color: #155724; }
        .badge-info { background: #d1ecf1; color: #0c5460; }
        .badge-warning { background: #fff3cd; color: #856404; }
        .note {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .stats {
            display: flex;
            justify-content: space-around;
            flex-wrap: wrap;
            margin: 20px 0;
        }
        .stat-box {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            min-width: 150px;
            margin: 10px;
            border: 2px solid #4ADE80;
        }
        .stat-number {
            font-size: 2.5em;
            font-weight: bold;
            color: #16A34A;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
            margin-top: 5px;
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            background: white;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
        }
        th {
            background: #16A34A;
            color: white;
            font-weight: 600;
        }
        tr:hover { background: #f8f9fa; }
        .encrypted {
            font-family: monospace;
            background: #f1f3f5;
            padding: 10px;
            border-radius: 4px;
            word-break: break-all;
            font-size: 0.85em;
            max-height: 200px;
            overflow-y: auto;
        }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="brand">manualmode.at presents</div>
            <h1>📊 Your Data Export</h1>
            <p>Created on: ${formatDate(exportData.exportDate)}</p>
            <p style="margin-top: 10px; font-size: 0.9em;">
                According to Art. 15 & 20 GDPR
            </p>
        </div>

        <div class="content">
            <!-- Account Information -->
            <div class="section">
                <h2>👤 Account Information</h2>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Email Address</div>
                        <div class="info-value">${exportData.user.email}</div>
                    </div>
                    ${exportData.user.firstName ? `
                    <div class="info-item">
                        <div class="info-label">First Name</div>
                        <div class="info-value">${exportData.user.firstName}</div>
                    </div>` : ''}
                    ${exportData.user.lastName ? `
                    <div class="info-item">
                        <div class="info-label">Last Name</div>
                        <div class="info-value">${exportData.user.lastName}</div>
                    </div>` : ''}
                    <div class="info-item">
                        <div class="info-label">Registered Since</div>
                        <div class="info-value">${formatDate(exportData.user.createdAt)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Last Login</div>
                        <div class="info-value">${formatDate(exportData.user.lastLogin)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Login Count</div>
                        <div class="info-value">${exportData.user.loginCount}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Account Status</div>
                        <div class="info-value">
                            <span class="badge ${exportData.user.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}">
                                ${exportData.user.status}
                            </span>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Newsletter Consent</div>
                        <div class="info-value">${formatBoolean(exportData.user.newsletterConsent)}</div>
                    </div>
                    ${exportData.user.accessExpiresAt ? `
                    <div class="info-item">
                        <div class="info-label">Access Valid Until</div>
                        <div class="info-value">${formatDate(exportData.user.accessExpiresAt)}</div>
                    </div>` : ''}
                </div>
            </div>

            <!-- Gamification Data -->
            ${exportData.gamificationData ? `
            <div class="section">
                <h2>🎮 Gamification & Progress</h2>
                <div class="stats">
                    <div class="stat-box">
                        <div class="stat-number">${exportData.gamificationData.level || 1}</div>
                        <div class="stat-label">Level</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${exportData.gamificationData.xp || 0}</div>
                        <div class="stat-label">Experience Points</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${exportData.gamificationData.currentStreak || 0}</div>
                        <div class="stat-label">Current Streak</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${exportData.gamificationData.longestStreak || 0}</div>
                        <div class="stat-label">Longest Streak</div>
                    </div>
                </div>
                ${exportData.gamificationData.unlockedAchievements && exportData.gamificationData.unlockedAchievements.length > 0 ? `
                <div style="margin-top: 20px;">
                    <h3 style="color: #16A34A; margin-bottom: 10px;">🏆 Achievements</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                        ${exportData.gamificationData.unlockedAchievements.map(a => `
                            <span class="badge badge-info">${a}</span>
                        `).join('')}
                    </div>
                </div>` : ''}
            </div>` : ''}

            <!-- Life Context -->
            <div class="section">
                <h2>📝 Life Context</h2>
                
                ${exportData.lifeContext.decryptedData ? `
                <!-- Decrypted Life Context (GDPR Compliant) -->
                <div class="note" style="background: #d4edda; border-left-color: #28a745;">
                    <strong>✅ GDPR-compliant decrypted:</strong>
                    Your Life Context has been decrypted for this export and is readable.
                </div>
                <div style="background: white; padding: 20px; margin-top: 15px; border-radius: 6px; border: 1px solid #e9ecef;">
                    <pre style="white-space: pre-wrap; word-wrap: break-word; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0;">${exportData.lifeContext.decryptedData}</pre>
                </div>
                <p style="margin-top: 15px; font-size: 0.9em; color: #666;">
                    Size: ${(exportData.lifeContext.decryptedData.length / 1024).toFixed(2)} KB
                </p>
                ` : ''}
                
                ${!exportData.lifeContext.decryptedData && exportData.lifeContext.encryptedData ? `
                <!-- Only Encrypted Version Available -->
                <div class="note" style="background: #fff3cd; border-left-color: #ffc107;">
                    <strong>⚠️ Note:</strong> ${exportData.lifeContext.note}
                </div>
                <div>
                    <p style="margin: 15px 0 10px 0;"><strong>Encrypted Data:</strong></p>
                    <div class="encrypted">${exportData.lifeContext.encryptedData.substring(0, 500)}${exportData.lifeContext.encryptedData.length > 500 ? '...' : ''}</div>
                    <p style="margin-top: 10px; font-size: 0.9em; color: #666;">
                        Size: ${(exportData.lifeContext.encryptedData.length / 1024).toFixed(2)} KB
                    </p>
                    <p style="margin-top: 15px; padding: 15px; background: #e3f2fd; border-radius: 6px; border-left: 4px solid #2196f3;">
                        <strong>💡 Tip:</strong>
                        You can also download your Life Context directly in the app as a .md file (unencrypted). Go to the app and select "Download Life Context".
                    </p>
                </div>` : ''}
                
                ${!exportData.lifeContext.decryptedData && !exportData.lifeContext.encryptedData ? `
                <p>No life context data available.</p>
                ` : ''}
            </div>

            <!-- Feedback -->
            ${exportData.feedback && exportData.feedback.length > 0 ? `
            <div class="section">
                <h2>💬 Feedback (${exportData.feedback.length})</h2>
                ${exportData.feedback.map(f => `
                    <div class="feedback-item">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div>
                                ${f.rating ? `<span class="badge badge-info">Rating: ${f.rating}/5</span>` : ''}
                                <span class="badge badge-info">${f.botId}</span>
                            </div>
                            <div style="font-size: 0.9em; color: #666;">${formatDate(f.createdAt)}</div>
                        </div>
                        ${f.comments ? `<p><strong>Comment:</strong> ${f.comments}</p>` : ''}
                        ${f.lastUserMessage ? `<p style="margin-top: 10px;"><strong>Last Message:</strong> ${f.lastUserMessage}</p>` : ''}
                    </div>
                `).join('')}
            </div>` : ''}

            <!-- Upgrade Codes -->
            ${exportData.upgradeCodes && exportData.upgradeCodes.length > 0 ? `
            <div class="section">
                <h2>🎫 Upgrade Codes (${exportData.upgradeCodes.length})</h2>
                ${exportData.upgradeCodes.map(c => `
                    <div class="code-item">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${c.code}</strong>
                                <span class="badge badge-info" style="margin-left: 10px;">${c.botId}</span>
                                ${c.isUsed ? `<span class="badge badge-success" style="margin-left: 5px;">Redeemed</span>` : ''}
                            </div>
                            <div style="font-size: 0.9em; color: #666;">${formatDate(c.createdAt)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>` : ''}

            <!-- API Usage -->
            ${exportData.apiUsage && exportData.apiUsage.length > 0 ? `
            <div class="section">
                <h2>📊 API Usage Statistics</h2>
                <p style="margin-bottom: 15px;">Last 12 months - Total: ${exportData.apiUsage.length} requests</p>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Endpoint</th>
                            <th>Model</th>
                            <th>Tokens In</th>
                            <th>Tokens Out</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${exportData.apiUsage.slice(0, 50).map(api => `
                            <tr>
                                <td>${formatDate(api.createdAt)}</td>
                                <td>${api.endpoint}</td>
                                <td><span class="badge badge-info">${api.model}</span></td>
                                <td>${api.inputTokens?.toLocaleString() || 0}</td>
                                <td>${api.outputTokens?.toLocaleString() || 0}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${exportData.apiUsage.length > 50 ? `
                    <p style="margin-top: 15px; color: #666; font-style: italic;">
                        ... and ${exportData.apiUsage.length - 50} more entries
                    </p>
                ` : ''}
            </div>` : ''}

            <!-- Personality Profile -->
            ${exportData.personalityProfile ? `
            <div class="section">
                <h2>🧠 Personality Profile</h2>
                <div class="info-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                    <div>
                        <div class="info-label">Test Type</div>
                        <div class="info-value">${exportData.personalityProfile.testType}</div>
                    </div>
                    <div>
                        <div class="info-label">Completed Lenses</div>
                        <div class="info-value">${exportData.personalityProfile.completedLenses}</div>
                    </div>
                    <div>
                        <div class="info-label">Adaptation Mode</div>
                        <div class="info-value">${exportData.personalityProfile.adaptationMode}</div>
                    </div>
                    <div>
                        <div class="info-label">Session Count</div>
                        <div class="info-value">${exportData.personalityProfile.sessionCount}</div>
                    </div>
                    <div>
                        <div class="info-label">Created</div>
                        <div class="info-value">${formatDate(exportData.personalityProfile.createdAt)}</div>
                    </div>
                    <div>
                        <div class="info-label">Updated</div>
                        <div class="info-value">${formatDate(exportData.personalityProfile.updatedAt)}</div>
                    </div>
                </div>
                <div class="encrypted" style="padding: 15px; border-radius: 8px; margin-top: 10px;">
                    <strong>🔐 Encrypted Profile Data:</strong><br>
                    <small>${exportData.personalityProfile.note}</small><br><br>
                    <code style="word-break: break-all; font-size: 0.8em;">${exportData.personalityProfile.encryptedData ? exportData.personalityProfile.encryptedData.substring(0, 500) + (exportData.personalityProfile.encryptedData.length > 500 ? '...' : '') : 'N/A'}</code>
                </div>
            </div>` : ''}

            <!-- Session Behavior Logs -->
            ${exportData.sessionBehaviorLogs && exportData.sessionBehaviorLogs.length > 0 ? `
            <div class="section">
                <h2>📈 Session Behavior Logs (${exportData.sessionBehaviorLogs.length})</h2>
                <p style="margin-bottom: 15px;">Anonymized frequency counters from coaching sessions (no transcripts stored).</p>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Riemann (D/W/N/Di)</th>
                            <th>Big5 (O/C/E/A/N)</th>
                            <th>Comfort</th>
                            <th>Opt-Out</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${exportData.sessionBehaviorLogs.slice(0, 50).map(log => `
                            <tr>
                                <td>${formatDate(log.createdAt)}</td>
                                <td>${log.dauerFrequency}/${log.wechselFrequency}/${log.naeheFrequency}/${log.distanzFrequency}</td>
                                <td>${log.opennessFrequency}/${log.conscientiousnessFrequency}/${log.extraversionFrequency}/${log.agreeablenessFrequency}/${log.neuroticismFrequency}</td>
                                <td>${log.comfortScore != null ? log.comfortScore : '-'}</td>
                                <td>${log.optedOut ? '✓' : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${exportData.sessionBehaviorLogs.length > 50 ? `
                    <p style="margin-top: 15px; color: #666; font-style: italic;">
                        ... and ${exportData.sessionBehaviorLogs.length - 50} more entries
                    </p>
                ` : ''}
            </div>` : ''}

            <!-- User Events -->
            ${exportData.userEvents && exportData.userEvents.length > 0 ? `
            <div class="section">
                <h2>📋 User Events (${exportData.userEvents.length})</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Event Type</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${exportData.userEvents.slice(0, 100).map(evt => `
                            <tr>
                                <td>${formatDate(evt.createdAt)}</td>
                                <td>${evt.eventType}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${exportData.userEvents.length > 100 ? `
                    <p style="margin-top: 15px; color: #666; font-style: italic;">
                        ... and ${exportData.userEvents.length - 100} more entries
                    </p>
                ` : ''}
            </div>` : ''}
        </div>

        <div class="footer">
            <p style="font-size: 1.2em; font-weight: 600; margin-bottom: 5px;">Meaningful Conversations</p>
            <p style="font-size: 0.9em; color: #16A34A; margin-bottom: 20px;">by manualmode.at</p>
            <p style="margin-bottom: 15px;">This data export complies with your rights under Art. 15 (Right of Access) and Art. 20 (Right to Data Portability) of the GDPR.</p>
            <p>
                <a href="https://manualmode.at" style="color: #16A34A; text-decoration: none; font-weight: 500;">www.manualmode.at</a>
            </p>
            <p style="font-size: 0.85em; opacity: 0.7; margin-top: 15px;">© ${new Date().getFullYear()} manualmode.at</p>
        </div>
    </div>
</body>
</html>`;
    
    return html;
}

// GET/POST /api/data/export - Export all user data (DSGVO Art. 20 - Datenübertragbarkeit)
// Supports both GET (backward compatibility) and POST (with decrypted life context)
const handleExport = async (req, res) => {
    try {
        const userId = req.userId;
        const format = req.query.format || 'json'; // Default to JSON
        const language = req.query.lang || 'en'; // Default to English
        const decryptedLifeContext = req.body?.decryptedLifeContext || null; // From POST request

        // Fetch all user-related data
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                feedbacksByUser: {
                    select: {
                        id: true,
                        rating: true,
                        comments: true,
                        botId: true,
                        lastUserMessage: true,
                        botResponse: true,
                        createdAt: true,
                    },
                },
                upgradeCodesUsedByUser: {
                    select: {
                        code: true,
                        botId: true,
                        createdAt: true,
                        isUsed: true,
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Fetch API usage data
        const apiUsage = await prisma.apiUsage.findMany({
            where: { userId },
            select: {
                id: true,
                endpoint: true,
                model: true,
                botId: true,
                inputTokens: true,
                outputTokens: true,
                durationMs: true,
                createdAt: true,
            },
        });

        // Fetch personality profile (GDPR Art. 20 - complete data export)
        const personalityProfile = await prisma.personalityProfile.findUnique({
            where: { userId },
            select: {
                testType: true,
                completedLenses: true,
                adaptationMode: true,
                sessionCount: true,
                encryptedData: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        // Fetch session behavior logs
        const sessionBehaviorLogs = await prisma.sessionBehaviorLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                sessionId: true,
                dauerFrequency: true,
                wechselFrequency: true,
                naeheFrequency: true,
                distanzFrequency: true,
                opennessFrequency: true,
                conscientiousnessFrequency: true,
                extraversionFrequency: true,
                agreeablenessFrequency: true,
                neuroticismFrequency: true,
                beigeFrequency: true,
                purpleFrequency: true,
                redFrequency: true,
                blueFrequency: true,
                orangeFrequency: true,
                greenFrequency: true,
                yellowFrequency: true,
                turquoiseFrequency: true,
                comfortScore: true,
                optedOut: true,
                createdAt: true,
            },
        });

        // Fetch user events
        const userEvents = await prisma.userEvent.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                eventType: true,
                metadata: true,
                createdAt: true,
            },
        });

        // Prepare export data
        const exportData = {
            exportDate: new Date().toISOString(),
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName || null,
                lastName: user.lastName || null,
                newsletterConsent: user.newsletterConsent,
                newsletterConsentDate: user.newsletterConsentDate,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                lastLogin: user.lastLogin,
                loginCount: user.loginCount,
                status: user.status,
                isPremium: user.isPremium,
                isAdmin: user.isAdmin,
                isDeveloper: user.isDeveloper,
                accessExpiresAt: user.accessExpiresAt,
                unlockedCoaches: user.unlockedCoaches ? JSON.parse(user.unlockedCoaches) : [],
            },
            gamificationData: user.gamificationState ? JSON.parse(user.gamificationState) : null,
            lifeContext: {
                note: "Your Life Context is end-to-end encrypted. Only you can decrypt it with your password.",
                encryptedData: user.lifeContext || null,
                decryptedData: decryptedLifeContext || null, // Include decrypted version if provided (GDPR compliance)
            },
            feedback: user.feedbacksByUser.map(f => ({
                id: f.id,
                rating: f.rating,
                comments: f.comments,
                botId: f.botId,
                lastUserMessage: f.lastUserMessage,
                botResponse: f.botResponse,
                createdAt: f.createdAt,
            })),
            upgradeCodes: user.upgradeCodesUsedByUser.map(c => ({
                code: c.code,
                botId: c.botId,
                createdAt: c.createdAt,
                isUsed: c.isUsed,
            })),
            apiUsage: apiUsage,
            personalityProfile: personalityProfile ? {
                testType: personalityProfile.testType,
                completedLenses: personalityProfile.completedLenses,
                adaptationMode: personalityProfile.adaptationMode,
                sessionCount: personalityProfile.sessionCount,
                encryptedData: personalityProfile.encryptedData,
                note: "Your personality profile is end-to-end encrypted. Only you can decrypt it with your password.",
                createdAt: personalityProfile.createdAt,
                updatedAt: personalityProfile.updatedAt,
            } : null,
            sessionBehaviorLogs: sessionBehaviorLogs,
            userEvents: userEvents,
        };

        // Return data in requested format
        if (format === 'html') {
            const html = generateHtmlExport(exportData, language);
            const filename = `meaningful-conversations-data-export-${user.email}-${new Date().toISOString().split('T')[0]}.html`;
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } else {
            // Default: JSON format
            const filename = `meaningful-conversations-data-export-${user.email}-${new Date().toISOString().split('T')[0]}.json`;
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', 'application/json');
            res.json(exportData);
        }
    } catch (error) {
        console.error("Error exporting user data:", error);
        res.status(500).json({ error: 'Failed to export user data.' });
    }
};

// Register both GET and POST routes for backward compatibility
router.get('/export', handleExport);
router.post('/export', handleExport);

// PUT /api/data/user/password - Change user password
router.put('/user/password', async (req, res) => {
    const { oldPassword, newPassword, newEncryptedLifeContext } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect current password.' });
        }

        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);
        
        await prisma.user.update({
            where: { id: req.userId },
            data: {
                passwordHash: newPasswordHash,
                lifeContext: newEncryptedLifeContext,
                updatedAt: new Date(),
            },
        });
        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ error: 'Failed to change password.' });
    }
});

// DELETE /api/data/user - Delete user account (GDPR Art. 17 - Recht auf Löschung)
router.delete('/user', async (req, res) => {
    try {
        // Delete non-cascaded user data first (no FK constraints on these tables)
        await prisma.apiUsage.deleteMany({ where: { userId: req.userId } });
        await prisma.userEvent.deleteMany({ where: { userId: req.userId } });
        // Nullify UpgradeCode references (codes remain but are unlinked from deleted user)
        await prisma.upgradeCode.updateMany({
            where: { usedById: req.userId },
            data: { usedById: null },
        });
        // Cascade deletes: Feedback, PersonalityProfile, SessionBehaviorLog
        await prisma.user.delete({ where: { id: req.userId } });
        res.status(204).send();
    } catch (error) {
        console.error("Error deleting user account:", error);
        res.status(500).json({ error: 'Failed to delete user account.' });
    }
});

module.exports = router;