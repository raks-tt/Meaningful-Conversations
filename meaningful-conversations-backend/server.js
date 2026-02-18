// meaningful-conversations-backend/server.js

const { execSync } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables from .env file FIRST.
dotenv.config();

// CRITICAL: Construct DATABASE_URL for Cloud Run environments before any other modules are imported.
// This ensures that Prisma Client (imported below) and any CLI commands have access to the correct database URL from the very beginning.
if (process.env.INSTANCE_UNIX_SOCKET && !process.env.DATABASE_URL) {
  const dbUrl = `mysql://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASSWORD)}@localhost/${process.env.DB_NAME}?socket=${process.env.INSTANCE_UNIX_SOCKET}`;
  process.env.DATABASE_URL = dbUrl;
}

// Now that the environment is configured, we can import the rest of our modules.
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const prisma = require('./prismaClient.js');
const { initCleanup: initGuestLimitCleanup } = require('./services/guestLimitTracker');
const { initDataRetentionCleanup } = require('./services/dataRetention');
const { ensureDefaultConfig } = require('./services/initService');

const app = express();
const PORT = process.env.PORT || 3001;

// --- UTILITY FUNCTIONS ---

/**
 * Executes a shell command synchronously.
 * It now relies on the DATABASE_URL being set on the process environment.
 * @param {string} command The command to execute.
 */
function runCommand(command) {
    console.log(`Executing: ${command}`);
    try {
        // The DATABASE_URL is now expected to be set on process.env, so we can execute directly.
        // We pass the current process environment to the child process.
        execSync(command, { stdio: 'inherit', env: process.env });
    } catch (error) {
        console.error(`Failed to execute command: ${command}`, error);
        // In a deployed environment, a failed migration should be a fatal error.
        if (process.env.ENVIRONMENT_TYPE !== 'development') {
            process.exit(1);
        }
    }
}


// --- DATABASE INITIALIZATION & SEEDING ---

/**
 * Handles database migrations and initial data seeding based on the environment.
 */
async function runMigrationsAndSeed() {
    console.log('--- Starting Database Initialization ---');

    const isProduction = process.env.ENVIRONMENT_TYPE === 'production';
    const isStaging = process.env.ENVIRONMENT_TYPE === 'staging';

    // Handle one-off task: Mark the baseline migration as applied.
    if (process.env.MIGRATE_RESOLVE_APPLIED) {
        console.log(`Running one-off task: Resolving applied migration '${process.env.MIGRATE_RESOLVE_APPLIED}'...`);
        runCommand(`npx prisma migrate resolve --applied "${process.env.MIGRATE_RESOLVE_APPLIED}"`);
        console.log('One-off task completed. Exiting to allow for normal restart.');
        process.exit(0); // Exit gracefully. Cloud Run will restart the service.
    }
    
    // Handle one-off task: Force reset the staging/dev database if requested.
    if (process.env.FORCE_DB_RESET === 'true' && !isProduction) {
        console.warn('FORCE_DB_RESET is true. Resetting database...');
        runCommand(`npx prisma migrate reset --force`);
        console.log('Database reset complete. Exiting.');
        process.exit(0);
    }

    // Standard migration flow
    if (isProduction || isStaging) {
        console.log('Production/Staging environment detected. Applying migrations...');
        runCommand('npx prisma migrate deploy');
        
        // Verify migrations consistency
        await verifyMigrationsConsistency();
    } else {
        console.log('Development environment detected. Applying migrations...');
        runCommand('npx prisma migrate deploy');
    }

    // Seed the initial admin user if configured
    await seedAdminUser();
    
    console.log('--- Database Initialization Complete ---');
}

/**
 * Verifies that all migrations are properly applied and consistent
 */
async function verifyMigrationsConsistency() {
    try {
        const migrations = await prisma.$queryRaw`
            SELECT migration_name, finished_at, applied_steps_count, logs
            FROM _prisma_migrations
            WHERE applied_steps_count = 0 OR finished_at IS NULL
            ORDER BY started_at DESC
            LIMIT 5
        `;
        
        if (migrations && migrations.length > 0) {
            console.warn('⚠️  Warning: Found potentially failed migrations:');
            migrations.forEach(m => {
                console.warn(`  - ${m.migration_name}: steps=${m.applied_steps_count}, finished=${m.finished_at}`);
            });
            
            // In production, this is just a warning - don't fail startup
            console.warn('⚠️  Continuing startup, but migrations should be reviewed!');
        } else {
            console.log('✓ All migrations verified successfully');
        }
    } catch (error) {
        console.warn('Could not verify migrations consistency:', error.message);
    }
}

/**
 * Checks for and creates an initial admin user based on environment variables.
 */
async function seedAdminUser() {
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

    if (adminEmail && adminPassword) {
        console.log('Checking for admin user...');
        try {
            const existingAdmin = await prisma.user.findUnique({
                where: { email: adminEmail.toLowerCase() },
            });

            if (!existingAdmin) {
                const passwordHash = await bcrypt.hash(adminPassword, 10);
                const encryptionSalt = require('crypto').randomBytes(16).toString('hex');

                await prisma.user.create({
                    data: {
                        email: adminEmail.toLowerCase(),
                        passwordHash,
                        encryptionSalt,
                        isAdmin: true,
                        isPremium: true,
                        status: 'ACTIVE',
                        unlockedCoaches: '[]',
                    },
                });
                console.log(`Admin user '${adminEmail}' created.`);
            } else {
                if (!existingAdmin.isAdmin) {
                    await prisma.user.update({
                        where: { id: existingAdmin.id },
                        data: { isAdmin: true },
                    });
                    console.log(`Admin privileges granted to existing user '${adminEmail}'.`);
                } else {
                    console.log('Admin user is already configured.');
                }
            }
        } catch (error) {
            console.error('Error during admin user seeding:', error);
            if (process.env.ENVIRONMENT_TYPE !== 'development') {
                process.exit(1);
            }
        }
    }
}


// --- SERVER STARTUP ---

async function startServer() {
    try {
        // In PM2 cluster mode, only the primary worker (id 0) runs migrations and seeding.
        // Other workers wait briefly for the primary to finish.
        const isPrimaryWorker = !process.env.pm_id || process.env.pm_id === '0';
        
        if (isPrimaryWorker) {
            await runMigrationsAndSeed();
            await ensureDefaultConfig();
        } else {
            console.log(`Worker ${process.env.pm_id}: Skipping migrations (handled by worker 0). Waiting 3s...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            // Ensure configuration data is still accessible
            await ensureDefaultConfig();
        }

        // --- Express App Configuration ---
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'http://localhost:3000',
            'http://localhost:5173',
            'capacitor://localhost',  // iOS Capacitor apps
            'http://localhost',       // Android Capacitor apps
        ];
        
        const corsOptions = {
            origin: function (origin, callback) {
                if (!origin) return callback(null, true);
                // Allow localhost with any port in non-production
                if (process.env.ENVIRONMENT_TYPE !== 'production' && /http:\/\/localhost:\d+/.test(origin)) {
                    return callback(null, true);
                }
                // Allow Capacitor origins (iOS uses capacitor://, Android uses http://localhost)
                if (origin === 'capacitor://localhost' || origin === 'http://localhost') {
                    return callback(null, true);
                }
                if (allowedOrigins.indexOf(origin) !== -1) {
                    return callback(null, true);
                }
                return callback(new Error('Not allowed by CORS'));
            },
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Test-Mode'],
        };
        app.use(cors(corsOptions));
        
        // Trust the first proxy (nginx) for correct IP detection in rate limiting
        app.set('trust proxy', 1);
        
        app.use(express.json());

        // --- API Routes ---
        app.use('/api/auth', require('./routes/auth.js'));
        app.use('/api/data', require('./routes/data.js'));
        const { geminiLimiter } = require('./middleware/rateLimiter.js');
        const optionalAuthForRateLimit = require('./middleware/optionalAuth.js');
        app.use('/api/gemini', optionalAuthForRateLimit, geminiLimiter, require('./routes/gemini.js'));
        app.use('/api/bots', require('./routes/bots.js'));
        app.use('/api/feedback', require('./routes/feedback.js'));
        app.use('/api/admin', require('./routes/admin.js'));
        app.use('/api/api-usage', require('./routes/apiUsage.js'));
        app.use('/api/ai-model-mapping', require('./routes/aiModelMapping.js'));
        app.use('/api/analytics', require('./routes/analytics.js'));
        app.use('/api/guest', require('./routes/guest.js'));
        app.use('/api/newsletter', require('./routes/newsletter.js'));
        app.use('/api/tts', require('./routes/tts.js'));
        app.use('/api/personality', require('./routes/personality.js'));
        app.use('/api/debug', require('./routes/debug.js'));

        // --- Health Check Endpoint ---
        app.get('/api/health', async (req, res) => {
            try {
                await prisma.$queryRaw`SELECT 1`;
                res.status(200).json({ status: 'ok', database: 'connected' });
            } catch (error) {
                console.error('Health check failed:', error);
                res.status(503).json({ status: 'error', database: 'disconnected' });
            }
        });

        // Initialize guest limit cleanup (runs every 24 hours)
        initGuestLimitCleanup();

        // Initialize GDPR data retention cleanup (runs every 24 hours)
        initDataRetentionCleanup();

        const server = app.listen(PORT, () => {
            console.log(`Backend server is running on port ${PORT}`);
        });

        // Graceful shutdown handler
        const gracefulShutdown = async (signal) => {
            console.log(`\n${signal} received. Starting graceful shutdown...`);
            
            // Stop accepting new connections
            server.close(async () => {
                console.log('HTTP server closed');
                
                try {
                    // Disconnect Prisma
                    await prisma.$disconnect();
                    console.log('Database connections closed');
                    
                    console.log('Graceful shutdown completed');
                    process.exit(0);
                } catch (error) {
                    console.error('Error during shutdown:', error);
                    process.exit(1);
                }
            });

            // Force shutdown after 25 seconds (before podman's 30s timeout)
            setTimeout(() => {
                console.error('Forced shutdown after timeout');
                process.exit(1);
            }, 25000);
        };

        // Register shutdown handlers
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
