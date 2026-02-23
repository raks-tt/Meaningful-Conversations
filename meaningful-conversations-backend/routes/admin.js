const express = require('express');
const prisma = require('../prismaClient.js');
const adminAuth = require('../middleware/adminAuth.js');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { marked } = require('marked');
const { sendNewsletterEmail } = require('../services/mailService.js');
const aiProviderService = require('../services/aiProviderService.js');

// Configure marked for email-safe HTML
marked.setOptions({
    breaks: true, // Convert \n to <br>
    gfm: true,    // GitHub Flavored Markdown
});

const router = express.Router();

// Apply admin authentication to all routes in this file
router.use(adminAuth);

// --- User Management ---

// GET /api/admin/users
router.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                createdAt: true,
                isAdmin: true,
                isDeveloper: true,
                isPremium: true,
                isClient: true,
                loginCount: true,
                lastLogin: true,
                gamificationState: true,
                status: true,
                personalityProfile: {
                    select: { completedLenses: true }
                },
            }
        });
        const mapped = users.map(u => ({
            ...u,
            completedLenses: u.personalityProfile
                ? JSON.parse(u.personalityProfile.completedLenses || '[]')
                : [],
            hasProfile: !!u.personalityProfile,
            personalityProfile: undefined,
        }));
        res.json(mapped);
    } catch (error) {
        console.error("Admin: Error fetching users:", error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

// PUT /api/admin/users/:id/activate
router.put('/users/:id/activate', async (req, res) => {
    const { id } = req.params;
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (user.status !== 'PENDING') {
            return res.status(400).json({ error: 'User is not pending activation.' });
        }

        await prisma.user.update({
            where: { id },
            data: {
                status: 'ACTIVE',
                activationToken: null,
                activationTokenExpires: null,
            },
        });
        res.status(204).send();
    } catch (error) {
        console.error("Admin: Error activating user:", error);
        res.status(500).json({ error: 'Operation failed.' });
    }
});

// PUT /api/admin/users/:id/toggle-admin
router.put('/users/:id/toggle-admin', async (req, res) => {
    const { id } = req.params;

    if (id === req.userId) {
        return res.status(403).json({ error: 'Cannot change your own admin status.' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return res.status(404).json({ error: 'User not found.' });

        await prisma.user.update({
            where: { id },
            data: { isAdmin: !user.isAdmin },
        });
        res.status(204).send();
    } catch (error) {
        console.error("Admin: Error toggling admin:", error);
        res.status(500).json({ error: 'Operation failed.' });
    }
});

// PUT /api/admin/users/:id/toggle-developer
router.put('/users/:id/toggle-developer', async (req, res) => {
    const { id } = req.params;

    try {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const newIsDeveloper = !user.isDeveloper;
        // Developers always need Admin access too (Admin Panel is prerequisite for Test Runner)
        const updateData = { isDeveloper: newIsDeveloper };
        if (newIsDeveloper && !user.isAdmin) {
            updateData.isAdmin = true;
        }

        await prisma.user.update({
            where: { id },
            data: updateData,
        });
        res.status(204).send();
    } catch (error) {
        console.error("Admin: Error toggling developer:", error);
        res.status(500).json({ error: 'Operation failed.' });
    }
});

// POST /api/admin/users/:id/reset-password
router.post('/users/:id/reset-password', async (req, res) => {
    const { id } = req.params;
    try {
        const newPassword = crypto.randomBytes(8).toString('hex');
        const passwordHash = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id },
            data: {
                passwordHash,
                lifeContext: '', // Data is lost on password reset
                passwordResetToken: null,
                passwordResetTokenExpires: null,
            },
        });

        res.json({ newPassword });
    } catch (error) {
        console.error("Admin: Error resetting password:", error);
        res.status(500).json({ error: 'Operation failed.' });
    }
});


// --- Ticket Management ---

// GET /api/admin/tickets
router.get('/tickets', async (req, res) => {
    try {
        const tickets = await prisma.ticket.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(tickets);
    } catch (error) {
        console.error("Admin: Error fetching tickets:", error);
        res.status(500).json({ error: 'Failed to fetch tickets.' });
    }
});

// PUT /api/admin/tickets/:id/resolve
router.put('/tickets/:id/resolve', async (req, res) => {
    const { id } = req.params;
    try {
        const ticket = await prisma.ticket.update({
            where: { id },
            data: { status: 'RESOLVED' },
        });
        res.json(ticket);
    } catch (error) {
        console.error("Admin: Error resolving ticket:", error);
        res.status(500).json({ error: 'Failed to resolve ticket.' });
    }
});

// DELETE /api/admin/tickets/:id
router.delete('/tickets/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.ticket.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        console.error("Admin: Error deleting ticket:", error);
        res.status(500).json({ error: 'Failed to delete ticket.' });
    }
});


// --- Feedback & Ratings Management ---

// GET /api/admin/feedback
router.get('/feedback', async (req, res) => {
    try {
        const rawFeedback = await prisma.feedback.findMany({
            orderBy: { createdAt: 'desc' },
            include: { feedbackByUser: { select: { email: true } } },
        });
        
        // Transform the data to match the frontend's expectation of a 'user' field
        const feedback = rawFeedback.map(f => {
            const { feedbackByUser, ...rest } = f;
            return { ...rest, user: feedbackByUser };
        });

        res.json(feedback);
    } catch (error) {
        console.error("Admin: Error fetching feedback:", error);
        res.status(500).json({ error: 'Failed to fetch feedback.' });
    }
});

// DELETE /api/admin/feedback/:id (For deleting message reports)
router.delete('/feedback/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.feedback.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        console.error("Admin: Error deleting feedback/report:", error);
        res.status(500).json({ error: 'Failed to delete feedback/report.' });
    }
});


// --- Newsletter Management ---

// GET /api/admin/newsletter-subscribers
router.get('/newsletter-subscribers', async (req, res) => {
    try {
        const subscribers = await prisma.user.findMany({
            where: {
                newsletterConsent: true
                // No status filter - show all users who consented (PENDING, ACTIVE, etc.)
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                newsletterConsentDate: true,
                createdAt: true,
                status: true  // Include status so admin can see if user is pending
            },
            orderBy: { newsletterConsentDate: 'desc' }
        });
        
        res.json({ 
            subscribers,
            count: subscribers.length 
        });
    } catch (error) {
        console.error("Admin: Error fetching newsletter subscribers:", error);
        res.status(500).json({ error: 'Failed to fetch subscribers.' });
    }
});

// GET /api/admin/newsletter-history
router.get('/newsletter-history', async (req, res) => {
    try {
        const history = await prisma.newsletterLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50 // Limit to last 50 sends
        });
        
        res.json(history);
    } catch (error) {
        console.error("Admin: Error fetching newsletter history:", error);
        res.status(500).json({ error: 'Failed to fetch newsletter history.' });
    }
});

// POST /api/admin/send-newsletter
router.post('/send-newsletter', async (req, res) => {
    const { subject, textBody } = req.body;
    const adminId = req.userId;

    // Validation
    if (!subject || !textBody) {
        return res.status(400).json({ error: 'Subject and text body fields are required.' });
    }
    
    try {
        // Get admin user info for logging
        const adminUser = await prisma.user.findUnique({
            where: { id: adminId },
            select: { email: true }
        });
        
        // Convert Markdown to HTML for email
        const convertMarkdownToEmailHtml = (markdown) => {
            const rawHtml = marked.parse(markdown);
            // Wrap in email-friendly HTML with basic styling
            return `
                <div style="font-family: sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
                    <div style="padding: 20px; background: #f9fafb;">
                        ${rawHtml}
                    </div>
                    <div style="background: #1b7272; color: white; padding: 20px; text-align: center; font-size: 12px;">
                        <p style="margin: 0;">Meaningful Conversations&nbsp;|&nbsp;www.manualmode.at</p>
                    </div>
                </div>
            `;
        };
        
        // Generate HTML version from Markdown text body
        const generatedHtml = convertMarkdownToEmailHtml(textBody);

        // Fetch all newsletter subscribers with unsubscribe token
        const subscribers = await prisma.user.findMany({
            where: {
                newsletterConsent: true,
                status: 'ACTIVE'
            },
            select: {
                email: true,
                unsubscribeToken: true
            }
        });
        
        if (subscribers.length === 0) {
            return res.json({ 
                success: true, 
                message: 'No subscribers found.',
                sent: 0,
                failed: 0,
                total: 0
            });
        }
        
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };
        
        // Send emails (sequentially to respect rate limits)
        for (const subscriber of subscribers) {
            try {
                const content = {
                    textBody: textBody,
                    htmlBody: generatedHtml,
                    unsubscribeToken: subscriber.unsubscribeToken
                };

                await sendNewsletterEmail(subscriber.email, subject, content, 'en');
                results.success++;
                
                // Small delay between emails to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (emailError) {
                console.error(`Failed to send to ${subscriber.email}:`, emailError);
                results.failed++;
                results.errors.push({
                    email: subscriber.email,
                    error: emailError.message
                });
            }
        }
        
        // Log newsletter send to database
        await prisma.newsletterLog.create({
            data: {
                subjectDE: subject,
                subjectEN: subject,
                textBodyDE: textBody,
                textBodyEN: textBody,
                htmlBodyDE: generatedHtml,
                htmlBodyEN: generatedHtml,
                sentBy: adminId,
                sentByEmail: adminUser.email,
                recipientCount: subscribers.length,
                successCount: results.success,
                failedCount: results.failed,
                errors: results.errors.length > 0 ? results.errors : null
            }
        });
        
        res.json({
            success: true,
            message: `Newsletter sent to ${results.success} of ${subscribers.length} subscribers.`,
            sent: results.success,
            failed: results.failed,
            total: subscribers.length,
            errors: results.errors
        });
        
    } catch (error) {
        console.error("Admin: Error sending newsletter:", error);
        res.status(500).json({ error: 'Failed to send newsletter.' });
    }
});

// --- AI Provider Management ---

// GET /api/admin/ai-provider
router.get('/ai-provider', async (req, res) => {
    try {
        const stats = await aiProviderService.getProviderStats();
        const health = await aiProviderService.checkProvidersHealth();
        
        // Get recent usage by provider (today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const usageToday = await prisma.apiUsage.groupBy({
            by: ['model'],
            where: {
                createdAt: {
                    gte: today,
                },
            },
            _count: {
                id: true,
            },
        });
        
        // Categorize by provider
        const providerUsage = {
            google: 0,
            mistral: 0,
        };
        
        usageToday.forEach(record => {
            if (record.model.startsWith('gemini')) {
                providerUsage.google += record._count.id;
            } else if (record.model.startsWith('mistral') || record.model.startsWith('open-mistral') || record.model.startsWith('open-mixtral')) {
                providerUsage.mistral += record._count.id;
            }
        });
        
        res.json({
            activeProvider: stats.activeProvider,
            lastUpdated: stats.lastUpdated,
            lastUpdatedBy: stats.lastUpdatedBy,
            providerHealth: health,
            usageToday: providerUsage,
        });
    } catch (error) {
        console.error("Admin: Error fetching AI provider config:", error);
        res.status(500).json({ error: 'Failed to fetch AI provider configuration.' });
    }
});

// PUT /api/admin/ai-provider
router.put('/ai-provider', async (req, res) => {
    const { provider } = req.body;
    const adminId = req.userId;
    
    if (!['google', 'mistral'].includes(provider)) {
        return res.status(400).json({ 
            error: 'Invalid provider. Must be "google" or "mistral".' 
        });
    }
    
    try {
        // Get admin email
        const admin = await prisma.user.findUnique({
            where: { id: adminId },
            select: { email: true }
        });
        
        if (!admin) {
            return res.status(404).json({ error: 'Admin user not found.' });
        }
        
        // Set the active provider
        await aiProviderService.setActiveProvider(provider, admin.email);
        
        res.json({
            success: true,
            provider,
            message: `AI provider switched to ${provider}`,
        });
    } catch (error) {
        console.error("Admin: Error setting AI provider:", error);
        res.status(500).json({ error: 'Failed to set AI provider.' });
    }
});

// GET /api/admin/ai-provider/health
router.get('/ai-provider/health', async (req, res) => {
    try {
        const health = await aiProviderService.checkProvidersHealth();
        res.json(health);
    } catch (error) {
        console.error("Admin: Error checking AI provider health:", error);
        res.status(500).json({ error: 'Failed to check provider health.' });
    }
});

// GET /api/admin/transcript-ratings - Get all transcript evaluation ratings with stats
router.get('/transcript-ratings', async (req, res) => {
    try {
        const ratings = await prisma.transcriptEvaluation.findMany({
            where: {
                userRating: { not: null }
            },
            select: {
                id: true,
                userId: true,
                userRating: true,
                userFeedback: true,
                contactOptIn: true,
                ratedAt: true,
                createdAt: true,
                lang: true,
                // GDPR: preAnswers and evaluationData are NOT exposed to admin
                user: {
                    select: {
                        email: true,
                        isClient: true,
                        isPremium: true
                    }
                }
            },
            orderBy: { ratedAt: 'desc' }
        });

        // GDPR: Only expose rating metadata and voluntary feedback — no preAnswers or evaluationData
        const processed = ratings.map(r => ({
            id: r.id,
            userEmail: r.user.email,
            isClient: r.user.isClient,
            isPremium: r.user.isPremium,
            rating: r.userRating,
            feedback: r.userFeedback,
            contactOptIn: r.contactOptIn,
            ratedAt: r.ratedAt,
            createdAt: r.createdAt,
            lang: r.lang
        }));

        // Calculate NPS statistics
        const total = processed.length;
        const promoters = processed.filter(r => r.rating >= 9).length;
        const passives = processed.filter(r => r.rating >= 7 && r.rating <= 8).length;
        const detractors = processed.filter(r => r.rating <= 6).length;
        const avgRating = total > 0 ? processed.reduce((sum, r) => sum + r.rating, 0) / total : 0;
        const nps = total > 0 ? ((promoters - detractors) / total * 100) : 0;

        const stats = {
            total,
            promoters,
            passives,
            detractors,
            avgRating: Math.round(avgRating * 10) / 10,
            nps: Math.round(nps * 10) / 10
        };

        res.json({ ratings: processed, stats });
    } catch (error) {
        console.error("Admin: Error fetching transcript ratings:", error);
        res.status(500).json({ error: 'Failed to fetch transcript ratings.' });
    }
});

module.exports = router;