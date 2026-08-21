const express = require('express');
const session = require('express-session');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const sanitizeHtml = require('sanitize-html');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware: Set HTTP Headers
app.use(helmet({
    contentSecurityPolicy: false // Disabled for inline style simplicity; configure strictly for production
}));

// Body Parser Middleware
app.use(express.json({ limit: '10kb' }));

// Express Session Management (In-Memory for simplicity; replace with Connect-Mongo or Redis for production)
app.use(session({
    secret: process.env.SESSION_SECRET || 'super-secret-scratch-buzz-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true, // Prevents XSS cookie theft
        secure: false,  // Set to true if using HTTPS
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 1 Day
    }
}));

// Rate Limiter for Authentication Requests
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Too many verification attempts. Please try again later.' }
});

// Serve Static Frontend Files from "public" Directory
app.use(express.static(path.join(__dirname, 'public')));

// Mock In-Memory Databases
const users = {}; // { username: { username, coins, referralCode, color, badges } }
const pendingVerifications = {}; // { username: { code, referralCode, expiresAt } }
const posts = [];
const contests = [];
const studios = [];

// Helper: Sanitize Strings
function cleanInput(str) {
    if (typeof str !== 'string') return '';
    return sanitizeHtml(str.trim(), { allowedTags: [], allowedAttributes: {} });
}

// Helper: Extract Scratch ID from Input
function extractScratchId(input) {
    const clean = cleanInput(input);
    const match = clean.match(/\d+/);
    return match ? match[0] : null;
}

// --- API ROUTES ---

// Session Check Endpoint
app.get('/api/auth/me', (req, res) => {
    if (req.session && req.session.username) {
        return res.json({ user: users[req.session.username] || { username: req.session.username } });
    }
    res.json({ user: null });
});

// Verification Code Request
app.post('/api/auth/register-request', authLimiter, (req, res) => {
    const username = cleanInput(req.body.username);
    const referralCode = cleanInput(req.body.referralCode);

    if (!username || username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Invalid Scratch username format.' });
    }

    const verificationCode = `BlockBuzz-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    pendingVerifications[username.toLowerCase()] = {
        code: verificationCode,
        referralCode: referralCode || null,
        expiresAt: Date.now() + 15 * 60 * 1000
    };

    res.json({ verificationCode });
});

// Verification Confirmation (Connects to Scratch API)
app.post('/api/auth/verify', authLimiter, async (req, res) => {
    const username = cleanInput(req.body.username);
    const key = username.toLowerCase();
    const pending = pendingVerifications[key];

    if (!pending || pending.expiresAt < Date.now()) {
        return res.status(400).json({ error: 'Verification session expired. Please request a new code.' });
    }

    try {
        // Dynamic import for fetch compatibility in Node.js
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        const scratchRes = await fetch(`https://api.scratch.mit.edu/users/${encodeURIComponent(username)}`);
        
        if (!scratchRes.ok) {
            return res.status(404).json({ error: 'Scratch profile not found.' });
        }

        const scratchData = await scratchRes.json();
        const bioText = (scratchData.profile.bio + ' ' + scratchData.profile.status).toUpperCase();

        if (!bioText.includes(pending.code.toUpperCase())) {
            return res.status(400).json({ error: 'Verification code not found in your Scratch bio/status.' });
        }

        // Initialize user if not existing
        if (!users[key]) {
            let coins = 100;
            // Handle Referral Code Reward
            if (pending.referralCode) {
                const referrerKey = Object.keys(users).find(u => users[u].referralCode === pending.referralCode);
                if (referrerKey) {
                    users[referrerKey].coins += 50; // Bonus to referrer
                    coins += 50; // Bonus to new user
                }
            }

            users[key] = {
                username: scratchData.username,
                pfp: scratchData.profile.images['90x90'],
                coins: coins,
                referralCode: `REF-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
                color: '#0f172a',
                badges: []
            };
        }

        delete pendingVerifications[key];
        req.session.username = key;
        res.json({ success: true, user: users[key] });

    } catch (err) {
        console.error('Scratch API Verification Error:', err);
        res.status(500).json({ error: 'Failed to communicate with Scratch servers.' });
    }
});

// Logout Endpoint
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

// Get User Profile
app.get('/api/users/:username', (req, res) => {
    const username = cleanInput(req.params.username).toLowerCase();
    const user = users[username];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
});

// Feed Posts
app.get('/api/posts', (req, res) => {
    res.json(posts);
});

app.post('/api/posts', (req, res) => {
    if (!req.session || !req.session.username) {
        return res.status(401).json({ error: 'Unauthorized. Log in first.' });
    }

    const projectId = extractScratchId(req.body.scratchInput);
    const caption = cleanInput(req.body.caption);
    const user = users[req.session.username];

    if (!projectId) return res.status(400).json({ error: 'Invalid Scratch Project Link or ID.' });

    const newPost = {
        id: Date.now(),
        projectId,
        title: `Scratch Project #${projectId}`,
        caption,
        author: user.username,
        authorPfp: user.pfp,
        authorColor: user.color,
        authorBadges: user.badges,
        thumbnail: `https://uploads.scratch.mit.edu/projects/thumbnails/${projectId}.png`
    };

    posts.unshift(newPost);
    res.json({ success: true, post: newPost });
});

// Store Operations
app.post('/api/store/buy', (req, res) => {
    if (!req.session || !req.session.username) {
        return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { type, value, price } = req.body;
    const user = users[req.session.username];

    if (user.coins < price) {
        return res.status(400).json({ error: 'Insufficient coins.' });
    }

    user.coins -= price;
    if (type === 'color') {
        user.color = cleanInput(value);
    } else if (type === 'badge') {
        const badge = cleanInput(value);
        if (!user.badges.includes(badge)) user.badges.push(badge);
    }

    res.json({ success: true, coins: user.coins });
});

// Contests
app.get('/api/contests', (req, res) => res.json(contests));
app.post('/api/contests', (req, res) => {
    if (!req.session || !req.session.username) return res.status(401).json({ error: 'Unauthorized.' });
    const contestId = extractScratchId(req.body.contestInput);
    const description = cleanInput(req.body.description);

    if (!contestId) return res.status(400).json({ error: 'Invalid Contest ID/URL.' });

    const contest = { contestId, description, advertiser: users[req.session.username].username };
    contests.unshift(contest);
    res.json({ success: true, contest });
});

// Studios
app.get('/api/studios', (req, res) => res.json(studios));
app.post('/api/studios', (req, res) => {
    if (!req.session || !req.session.username) return res.status(401).json({ error: 'Unauthorized.' });
    const studioId = extractScratchId(req.body.studioInput);
    const description = cleanInput(req.body.description);

    if (!studioId) return res.status(400).json({ error: 'Invalid Studio ID/URL.' });

    const studio = {
        studioId,
        title: `Scratch Studio #${studioId}`,
        description,
        advertiser: users[req.session.username].username,
        image: `https://uploads.scratch.mit.edu/galleries/thumbnails/${studioId}.png`
    };
    studios.unshift(studio);
    res.json({ success: true, studio });
});

// SPA Fallback: Routes unrecognized GET paths to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running securely on port ${PORT}`));
