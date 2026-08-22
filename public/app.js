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
    if (!username) return res.status(400).json({ error: 'Username is required.' });

    const key = username.toLowerCase();
    const pending = pendingVerifications[key];

    if (!pending || pending.expiresAt < Date.now()) {
        return res.status(400).json({ error: 'Session expired. Please request a new code.' });
    }

    try {
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        const scratchRes = await fetch(`https://api.scratch.mit.edu/users/${encodeURIComponent(username)}`);
        
        if (!scratchRes.ok) {
            return res.status(404).json({ error: 'Scratch profile not found.' });
        }

        const scratchData = await scratchRes.json();
        
        // Safety check if profile data exists
        if (!scratchData.profile) {
            return res.status(400).json({ error: 'Could not read Scratch profile data.' });
        }

        const bio = scratchData.profile.bio || '';
        const status = scratchData.profile.status || '';
        const bioText = (bio + ' ' + status).toUpperCase();

        if (!bioText.includes(pending.code.toUpperCase())) {
            return res.status(400).json({ error: 'Code not found in your Scratch bio or status yet.' });
        }

        let { data: existingUser } = await supabase.from('users').select('*').eq('username', scratchData.username).single();

        if (!existingUser) {
            let coins = 0; 
            if (pending.referralCode) {
                const { data: referrer } = await supabase.from('users').select('*').eq('referral_code', pending.referralCode).single();
                if (referrer) {
                    await supabase.from('users').update({ coins: referrer.coins + 100 }).eq('username', referrer.username);
                    coins += 100; // REFERRAL BONUS
                }
            }

            const newUser = {
                username: scratchData.username,
                pfp: scratchData.profile.images ? scratchData.profile.images['90x90'] : '',
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
        console.error('Verification error details:', err);
        res.status(500).json({ error: 'Server verification error. Try again later.' });
    }
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
            author_color: user.color,
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
    
    const newComment = { 
        post_id: req.params.id, 
        author: user.username, 
        author_pfp: user.pfp, 
        author_color: user.color,
        text 
    };
    const { data } = await supabase.from('comments').insert([newComment]).select().single();
    res.json({ success: true, comment: data });
});

// --- MODERATION ---
app.delete('/api/moderation/posts/:id', async (req, res) => {
    if (!req.session.username) return res.status(401).json({ error: 'Unauthorized.' });
    
    const { data: user } = await supabase.from('users').select('is_admin, username').eq('username', req.session.username).single();
    const { data: post } = await supabase.from('posts').select('author').eq('id', req.params.id).single();

    if (!user || (!user.is_admin && post?.author !== user.username)) {
        return res.status(403).json({ error: 'Unauthorized action.' });
    }

    await supabase.from('posts').delete().eq('id', req.params.id);
    res.json({ success: true, message: 'Post deleted successfully.' });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Server running securely on port ${PORT}`));
