require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Render's proxy for accurate rate-limiting & headers
app.set('trust proxy', 1);

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables!");
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serves frontend files from public folder

app.use(session({
    secret: process.env.SESSION_SECRET || 'block-buzz-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Rate limiter for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/auth/', authLimiter);

// --- AUTHENTICATION ROUTES ---

// Check current session
app.get('/api/auth/me', (req, res) => {
    res.json({ user: req.session.user || null });
});

// Register Step 1: Generate verification code and profile instructions
app.post('/api/auth/register-request', async (req, res) => {
    try {
        const { username, password, referralCode } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

        const { data: existing } = await supabase.from('users').select('*').eq('username', username).single();
        if (existing) return res.status(400).json({ error: 'Username already registered.' });

        const timestamp = Date.now();
        const scratchRes = await fetch(`https://api.scratch.mit.edu/users/${username}?_=${timestamp}`, {
            headers: { 'User-Agent': 'BlockBuzz-Platform' }
        });
        if (!scratchRes.ok) return res.status(404).json({ error: 'Scratch user not found.' });
        const scratchData = await scratchRes.json();
        const pfp = scratchData.profile?.images?.['90x90'] || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png';

        const verificationCode = 'BB-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const hashedPassword = await bcrypt.hash(password, 10);

        req.session.pendingUser = { username, hashedPassword, pfp, referralCode, verificationCode };

        res.json({ 
            success: true, 
            verificationCode, 
            profileUrl: `https://scratch.mit.edu/users/${username}/`
        });
    } catch (err) {
        console.error("Register request error:", err);
        res.status(500).json({ error: 'Server error during registration request.' });
    }
});

// Register Step 2: Check Scratch Profile Bio, Wiwo, & Status for the code with Cache-Busting
app.post('/api/auth/verify', async (req, res) => {
    try {
        const { username } = req.body;
        const pending = req.session.pendingUser;

        if (!pending || pending.username !== username) {
            return res.status(400).json({ error: 'Verification session expired. Please restart registration.' });
        }

        const timestamp = Date.now();
        const scratchRes = await fetch(`https://api.scratch.mit.edu/users/${username}?_=${timestamp}`, {
            headers: { 'User-Agent': 'BlockBuzz-Platform' }
        });
        
        if (!scratchRes.ok) {
            return res.status(400).json({ error: 'Could not fetch Scratch profile.' });
        }
        
        const scratchData = await scratchRes.json();

        const aboutMe = scratchData.profile?.biography || '';
        const wiwo = scratchData.profile?.wiwo || ''; 
        const status = scratchData.profile?.status || '';
        const combinedText = `${aboutMe} ${wiwo} ${status}`;

        if (!combinedText.includes(pending.verificationCode)) {
            return res.status(400).json({ error: `Verification code "${pending.verificationCode}" not found on your profile yet!` });
        }

        let coins = 50;
        let badges = ['Verified'];

        if (pending.referralCode) {
            const { data: referrer } = await supabase.from('users').select('*').eq('referral_code', pending.referralCode).single();
            if (referrer) {
                coins += 25;
                await supabase.from('users').update({ coins: (referrer.coins || 0) + 25 }).eq('username', referrer.username);
            }
        }

        const newReferralCode = 'REF-' + Math.random().toString(36).substring(2, 8).toUpperCase();

        const newUser = {
            username: pending.username,
            password: pending.hashedPassword,
            pfp: pending.pfp,
            coins: coins,
            badges: badges,
            referral_code: newReferralCode,
            is_admin: false,
            created_at: new Date()
        };

        const { data, error } = await supabase.from('users').insert([newUser]).select();
        if (error) throw error;

        const userSessionData = {
            username: data[0].username,
            pfp: data[0].pfp,
            coins: data[0].coins,
            badges: data[0].badges,
            referral_code: data[0].referral_code,
            is_admin: data[0].is_admin
        };

        req.session.user = userSessionData;
        delete req.session.pendingUser;

        res.json({ success: true, user: userSessionData });
    } catch (err) {
        console.error("Verification error:", err);
        res.status(500).json({ error: 'Verification failed.' });
    }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

        const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();
        if (error || !user) return res.status(400).json({ error: 'Invalid username or password.' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ error: 'Invalid username or password.' });

        const userSessionData = {
            username: user.username,
            pfp: user.pfp,
            coins: user.coins,
            badges: user.badges,
            referral_code: user.referral_code,
            is_admin: user.is_admin
        };

        req.session.user = userSessionData;
        res.json({ success: true, user: userSessionData });
    } catch (err) {
        res.status(500).json({ error: 'Login error.' });
    }
});

// Logout Route
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// --- USER PROFILE ROUTE ---
app.get('/api/users/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const { data: user, error } = await supabase
            .from('users')
            .select('username, pfp, coins, badges, referral_code, created_at, is_admin')
            .eq('username', username)
            .single();

        if (error || !user) return res.status(404).json({ error: 'User not found.' });

        const { data: posts } = await supabase
            .from('posts')
            .select('*')
            .eq('author', username)
            .order('created_at', { ascending: false });

        res.json({ user, posts: posts || [] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch user profile.' });
    }
});

// --- POSTS ROUTES ---
app.get('/api/posts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false }); // Newest posts first
        
        if (error) return res.json([]);
        res.json(data || []);
    } catch (err) {
        res.json([]);
    }
});

app.post('/api/posts', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { scratchInput, caption } = req.body;
        if (!scratchInput) return res.status(400).json({ error: 'Project link or ID required.' });

        let projectId = scratchInput.trim();
        if (projectId.includes('scratch.mit.edu')) {
            const match = projectId.match(/\/projects\/(\d+)/);
            if (match) projectId = match[1];
        }

        const scratchLink = `https://scratch.mit.edu/projects/${projectId}/`;
        let projectTitle = `Project #${projectId}`;
        let projectThumbnail = `https://cdn2.scratch.mit.edu/get_image/project/${projectId}_480x360.png`;

        try {
            const scratchProjRes = await fetch(`https://api.scratch.mit.edu/projects/${projectId}`);
            if (scratchProjRes.ok) {
                const scratchProjData = await scratchProjRes.json();
                if (scratchProjData.title) projectTitle = scratchProjData.title;
                if (scratchProjData.image) projectThumbnail = scratchProjData.image;
            }
        } catch (apiErr) {
            console.log("Could not fetch Scratch API metadata:", apiErr.message);
        }

        const newPost = {
            author: req.session.user.username,
            author_pfp: req.session.user.pfp,
            scratch_link: scratchLink,
            title: projectTitle,
            thumbnail: projectThumbnail,
            caption: caption || '',
            likes: [],
            views: [],
            created_at: new Date()
        };

        const { data, error } = await supabase.from('posts').insert([newPost]).select();
        if (error) return res.status(400).json({ error: `Database error: ${error.message}` });

        res.json({ success: true, post: data[0] });
    } catch (err) {
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

app.post('/api/posts/:id/like', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const postId = req.params.id;
        const username = req.session.user.username;

        const { data: post, error } = await supabase.from('posts').select('*').eq('id', postId).single();
        if (error || !post) return res.status(404).json({ error: 'Post not found' });

        let likes = post.likes || [];
        if (likes.includes(username)) {
            likes = likes.filter(u => u !== username);
        } else {
            likes.push(username);
        }

        await supabase.from('posts').update({ likes }).eq('id', postId);
        res.json({ success: true, likes });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update like.' });
    }
});

app.post('/api/posts/:id/view', async (req, res) => {
    if (!req.session.user) return res.sendStatus(401);
    try {
        const postId = req.params.id;
        const username = req.session.user.username;

        const { data: post } = await supabase.from('posts').select('*').eq('id', postId).single();
        if (!post) return res.sendStatus(404);

        let views = post.views || [];
        if (!views.includes(username)) {
            views.push(username);
            await supabase.from('posts').update({ views }).eq('id', postId);
        }
        res.json({ success: true });
    } catch (err) {
        res.sendStatus(500);
    }
});

// --- COMMENTS ROUTES ---
app.get('/api/posts/:id/comments', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('post_id', req.params.id)
            .order('created_at', { ascending: true });
        if (error) return res.json([]);
        res.json(data || []);
    } catch (err) {
        res.json([]);
    }
});

app.post('/api/posts/:id/comments', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Comment cannot be empty.' });

        const newComment = {
            post_id: req.params.id,
            author: req.session.user.username,
            text: text,
            created_at: new Date()
        };

        const { data, error } = await supabase.from('comments').insert([newComment]).select();
        if (error) throw error;

        res.json({ success: true, comment: data[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add comment.' });
    }
});

// --- CONTESTS & STUDIOS ROUTES ---
app.get('/api/contests', async (req, res) => {
    const { data } = await supabase.from('contests').select('*').order('created_at', { ascending: false });
    res.json(data || []);
});

app.post('/api/contests', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { title, description, prize, scratchLink } = req.body;
    const { data, error } = await supabase.from('contests').insert([{
        title, description, prize, scratch_link: scratchLink, author: req.session.user.username, created_at: new Date()
    }]).select();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, contest: data[0] });
});

app.get('/api/studios', async (req, res) => {
    const { data } = await supabase.from('studios').select('*').order('created_at', { ascending: false });
    res.json(data || []);
});

app.post('/api/studios', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { title, description, scratchLink } = req.body;
    const { data, error } = await supabase.from('studios').insert([{
        title, description, scratch_link: scratchLink, author: req.session.user.username, created_at: new Date()
    }]).select();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, studio: data[0] });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
