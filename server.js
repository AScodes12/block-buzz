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

app.set('trust proxy', 1);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10kb' }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'super-secret-scratch-key',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 86400000 }
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
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

// --- AUTHENTICATION & REFERRALS ---
app.get('/api/auth/me', async (req, res) => {
    if (req.session && req.session.username) {
        const { data: user } = await supabase.from('users').select('*').eq('username', req.session.username).single();
        return res.json({ user: user || null });
    }
    res.json({ user: null });
});

app.post('/api/auth/register-request', authLimiter, (req, res) => {
    const username = cleanInput(req.body.username);
    const referralCode = cleanInput(req.body.referralCode);
    if (!username || username.length < 3) return res.status(400).json({ error: 'Invalid username.' });

    const verificationCode = `BlockBuzz-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    pendingVerifications[username.toLowerCase()] = { code: verificationCode, referralCode, expiresAt: Date.now() + 15 * 60 * 1000 };
    res.json({ verificationCode });
});

app.post('/api/auth/verify', authLimiter, async (req, res) => {
    const username = cleanInput(req.body.username);
    const key = username.toLowerCase();
    const pending = pendingVerifications[key];

    if (!pending || pending.expiresAt < Date.now()) return res.status(400).json({ error: 'Session expired.' });

    try {
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        const scratchRes = await fetch(`https://api.scratch.mit.edu/users/${encodeURIComponent(username)}`);
        if (!scratchRes.ok) return res.status(404).json({ error: 'Scratch profile not found.' });

        const scratchData = await scratchRes.json();
        const bioText = (scratchData.profile.bio + ' ' + scratchData.profile.status).toUpperCase();

        if (!bioText.includes(pending.code.toUpperCase())) return res.status(400).json({ error: 'Code not found in bio.' });

        let { data: existingUser } = await supabase.from('users').select('*').eq('username', scratchData.username).single();

        if (!existingUser) {
            let coins = 0; 
            if (pending.referralCode) {
                const { data: referrer } = await supabase.from('users').select('*').eq('referral_code', pending.referralCode).single();
                if (referrer) {
                    await supabase.from('users').update({ coins: referrer.coins + 10 }).eq('username', referrer.username);
                    coins += 10; // Referral bonus = 10 coins
                }
            }

            const newUser = {
                username: scratchData.username,
                pfp: scratchData.profile.images['90x90'],
                coins: coins,
                referral_code: `REF-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
                color: '#0f172a',
                badges: [],
                is_admin: false
            };
            await supabase.from('users').insert([newUser]);
            existingUser = newUser;
        }

        delete pendingVerifications[key];
        req.session.username = scratchData.username;
        res.json({ success: true, user: existingUser });
    } catch (err) {
        res.status(500).json({ error: 'Verification error.' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

// --- POSTS, LIKES, & VIEWS ---
app.get('/api/posts', async (req, res) => {
    const { data: posts } = await supabase.from('posts').select('*').order('id', { ascending: false });
    res.json(posts || []);
});

app.post('/api/posts', async (req, res) => {
    if (!req.session.username) return res.status(401).json({ error: 'Unauthorized.' });

    const projectId = extractScratchId(req.body.scratchInput);
    const caption = cleanInput(req.body.caption);
    if (!projectId) return res.status(400).json({ error: 'Invalid Project.' });

    try {
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        const projectRes = await fetch(`https://api.scratch.mit.edu/projects/${projectId}`);
        const projectData = projectRes.ok ? await projectRes.json() : { title: `Scratch Project #${projectId}` };

        const { data: user } = await supabase.from('users').select('*').eq('username', req.session.username).single();

        const newPost = {
            id: Date.now(),
            project_id: projectId,
            title: projectData.title,
            caption,
            author: user.username,
            author_pfp: user.pfp,
            thumbnail: `https://uploads.scratch.mit.edu/projects/thumbnails/${projectId}.png`,
            likes: [],
            views: []
        };
        await supabase.from('posts').insert([newPost]);
        res.json({ success: true, post: newPost });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/posts/:id/like', async (req, res) => {
    if (!req.session.username) return res.status(401).json({ error: 'Unauthorized.' });
    const postId = req.params.id;
    
    const { data: post } = await supabase.from('posts').select('likes').eq('id', postId).single();
    if (!post) return res.status(404).json({ error: 'Post not found' });

    let likes = post.likes || [];
    if (likes.includes(req.session.username)) {
        likes = likes.filter(u => u !== req.session.username); // Unlike
    } else {
        likes.push(req.session.username); // Like
    }

    await supabase.from('posts').update({ likes }).eq('id', postId);
    res.json({ success: true, likes });
});

app.post('/api/posts/:id/view', async (req, res) => {
    if (!req.session.username) return res.status(401).json({ error: 'Unauthorized.' });
    const postId = req.params.id;
    
    const { data: post } = await supabase.from('posts').select('views').eq('id', postId).single();
    if (!post) return res.status(404).json({ error: 'Post not found' });

    let views = post.views || [];
    if (!views.includes(req.session.username)) {
        views.push(req.session.username);
        await supabase.from('posts').update({ views }).eq('id', postId);
    }
    res.json({ success: true, views });
});

// --- COMMENTS ---
app.get('/api/posts/:id/comments', async (req, res) => {
    const { data: comments } = await supabase.from('comments').select('*').eq('post_id', req.params.id).order('created_at', { ascending: true });
    res.json(comments || []);
});

app.post('/api/posts/:id/comments', async (req, res) => {
    if (!req.session.username) return res.status(401).json({ error: 'Unauthorized.' });
    const text = cleanInput(req.body.text);
    if (!text) return res.status(400).json({ error: 'Comment cannot be empty.' });

    const { data: user } = await supabase.from('users').select('*').eq('username', req.session.username).single();
    
    const newComment = { post_id: req.params.id, author: user.username, author_pfp: user.pfp, text };
    const { data } = await supabase.from('comments').insert([newComment]).select().single();
    res.json({ success: true, comment: data });
});

// --- STORE / SHOP ---
app.post('/api/store/buy', async (req, res) => {
    if (!req.session.username) return res.status(401).json({ error: 'Unauthorized.' });
    const { type, value, price } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('username', req.session.username).single();
    if (user.coins < price) return res.status(400).json({ error: 'Not enough coins.' });

    let updates = { coins: user.coins - price };
    if (type === 'color') updates.color = cleanInput(value);
    if (type === 'badge') {
        let badges = user.badges || [];
        if (!badges.includes(value)) badges.push(cleanInput(value));
        updates.badges = badges;
    }
    await supabase.from('users').update(updates).eq('username', user.username);
    res.json({ success: true, coins: updates.coins });
});

// --- MODERATION ---
app.delete('/api/moderation/posts/:id', async (req, res) => {
    if (!req.session.username) return res.status(401).json({ error: 'Unauthorized.' });
    
    const { data: user } = await supabase.from('users').select('is_admin').eq('username', req.session.username).single();
    if (!user || !user.is_admin) return res.status(403).json({ error: 'Admins only.' });

    await supabase.from('posts').delete().eq('id', req.params.id);
    res.json({ success: true, message: 'Post deleted by moderator.' });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Server running securely on port ${PORT}`));
