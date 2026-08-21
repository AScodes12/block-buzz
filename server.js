const express = require('express');
const session = require('express-session');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const sanitizeHtml = require('sanitize-html');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Supabase Client using Environment Variables
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10kb' }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'super-secret-scratch-key',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 86400000 }
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many attempts.' } });
app.use(express.static(path.join(__dirname, 'public')));

const pendingVerifications = {};

function cleanInput(str) {
    if (typeof str !== 'string') return '';
    return sanitizeHtml(str.trim(), { allowedTags: [], allowedAttributes: {} });
}

function extractScratchId(input) {
    const clean = cleanInput(input);
    const match = clean.match(/\d+/);
    return match ? match[0] : null;
}

// Session Check
app.get('/api/auth/me', async (req, res) => {
    if (req.session && req.session.username) {
        const { data: user } = await supabase.from('users').select('*').eq('username', req.session.username).single();
        return res.json({ user: user || null });
    }
    res.json({ user: null });
});

// Register Request
app.post('/api/auth/register-request', authLimiter, (req, res) => {
    const username = cleanInput(req.body.username);
    const referralCode = cleanInput(req.body.referralCode);
    if (!username || username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Invalid username format.' });
    }

    const verificationCode = `BlockBuzz-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    pendingVerifications[username.toLowerCase()] = {
        code: verificationCode,
        referralCode: referralCode || null,
        expiresAt: Date.now() + 15 * 60 * 1000
    };

    res.json({ verificationCode });
});

// Verify & Save to Supabase
app.post('/api/auth/verify', authLimiter, async (req, res) => {
    const username = cleanInput(req.body.username);
    const key = username.toLowerCase();
    const pending = pendingVerifications[key];

    if (!pending || pending.expiresAt < Date.now()) {
        return res.status(400).json({ error: 'Verification session expired.' });
    }

    try {
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        const scratchRes = await fetch(`https://api.scratch.mit.edu/users/${encodeURIComponent(username)}`);
        if (!scratchRes.ok) return res.status(404).json({ error: 'Scratch profile not found.' });

        const scratchData = await scratchRes.json();
        const bioText = (scratchData.profile.bio + ' ' + scratchData.profile.status).toUpperCase();

        if (!bioText.includes(pending.code.toUpperCase())) {
            return res.status(400).json({ error: 'Verification code not found in bio/status.' });
        }

        // Check if user exists in Supabase
        let { data: existingUser } = await supabase.from('users').select('*').eq('username', scratchData.username).single();

        if (!existingUser) {
            let coins = 100;
            if (pending.referralCode) {
                const { data: referrer } = await supabase.from('users').select('*').eq('referral_code', pending.referralCode).single();
                if (referrer) {
                    await supabase.from('users').update({ coins: referrer.coins + 50 }).eq('username', referrer.username);
                    coins += 50;
                }
            }

            const newUser = {
                username: scratchData.username,
                pfp: scratchData.profile.images['90x90'],
                coins: coins,
                referral_code: `REF-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
                color: '#0f172a',
                badges: []
            };

            await supabase.from('users').insert([newUser]);
            existingUser = newUser;
        }

        delete pendingVerifications[key];
        req.session.username = scratchData.username;
        res.json({ success: true, user: existingUser });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Verification error.' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

app.get('/api/users/:username', async (req, res) => {
    const { data: user } = await supabase.from('users').select('*').ilike('username', req.params.username).single();
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
});

// Posts
app.get('/api/posts', async (req, res) => {
    const { data: posts } = await supabase.from('posts').select('*').order('id', { ascending: false });
    res.json(posts || []);
});

app.post('/api/posts', async (req, res) => {
    if (!req.session || !req.session.username) return res.status(401).json({ error: 'Unauthorized.' });

    const projectId = extractScratchId(req.body.scratchInput);
    const caption = cleanInput(req.body.caption);
    if (!projectId) return res.status(400).json({ error: 'Invalid Project ID/URL.' });

    const { data: user } = await supabase.from('users').select('*').eq('username', req.session.username).single();

    const newPost = {
        id: Date.now(),
        project_id: projectId,
        title: `Scratch Project #${projectId}`,
        caption,
        author: user.username,
        author_pfp: user.pfp,
        author_color: user.color,
        author_badges: user.badges,
        thumbnail: `https://uploads.scratch.mit.edu/projects/thumbnails/${projectId}.png`
    };

    await supabase.from('posts').insert([newPost]);
    res.json({ success: true, post: newPost });
});

// Store
app.post('/api/store/buy', async (req, res) => {
    if (!req.session || !req.session.username) return res.status(401).json({ error: 'Unauthorized.' });

    const { type, value, price } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('username', req.session.username).single();

    if (user.coins < price) return res.status(400).json({ error: 'Insufficient coins.' });

    let updatedCoins = user.coins - price;
    let updates = { coins: updatedCoins };

    if (type === 'color') {
        updates.color = cleanInput(value);
    } else if (type === 'badge') {
        const badge = cleanInput(value);
        let badges = user.badges || [];
        if (!badges.includes(badge)) badges.push(badge);
        updates.badges = badges;
    }

    await supabase.from('users').update(updates).eq('username', user.username);
    res.json({ success: true, coins: updatedCoins });
});

// Contests & Studios (Read/Write)
app.get('/api/contests', async (req, res) => {
    const { data } = await supabase.from('contests').select('*').order('id', { ascending: false });
    res.json(data || []);
});

app.post('/api/contests', async (req, res) => {
    if (!req.session || !req.session.username) return res.status(401).json({ error: 'Unauthorized.' });
    const contestId = extractScratchId(req.body.contestInput);
    const description = cleanInput(req.body.description);
    if (!contestId) return res.status(400).json({ error: 'Invalid Contest ID.' });

    await supabase.from('contests').insert([{ contest_id: contestId, description, advertiser: req.session.username }]);
    res.json({ success: true });
});

app.get('/api/studios', async (req, res) => {
    const { data } = await supabase.from('studios').select('*').order('id', { ascending: false });
    res.json(data || []);
});

app.post('/api/studios', async (req, res) => {
    if (!req.session || !req.session.username) return res.status(401).json({ error: 'Unauthorized.' });
    const studioId = extractScratchId(req.body.studioInput);
    const description = cleanInput(req.body.description);
    if (!studioId) return res.status(400).json({ error: 'Invalid Studio ID.' });

    await supabase.from('studios').insert([{
        studio_id: studioId,
        title: `Scratch Studio #${studioId}`,
        description,
        advertiser: req.session.username,
        image: `https://uploads.scratch.mit.edu/galleries/thumbnails/${studioId}.png`
    }]);
    res.json({ success: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Server running with Supabase on port ${PORT}`));
