const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient.js');
const {
    loginLimiter
} = require('../middleware/rateLimiter.js');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    const lowerCaseEmail = email.toLowerCase();
    
    try {
        const user = await prisma.user.findUnique({ where: { email: lowerCaseEmail } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.status !== 'ACTIVE') {
             if (user.status === 'PENDING') {
                return res.status(403).json({ error: 'Your account is pending verification. Please check your email for the activation link.' });
             }
             return res.status(403).json({ error: 'Your account is currently inactive.' });
        }

        // Update login stats
        await prisma.user.update({
            where: { id: user.id },
            data: {
                loginCount: { increment: 1 },
                lastLogin: new Date(),
            },
        });

        const { passwordHash, ...userPayload } = user;
        const token = jwt.sign({
            userId: user.id
        }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ token, user: userPayload });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: 'An internal server error occurred during login.' });
    }
});

module.exports = router;