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

app.set('trust proxy', 1);

const supabaseUrl = process.env.SUPABASE_URL;
// Use the Service Role Key to safely bypass Row Level Security (RLS) on the backend server.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("CRITICAL ERROR: Missing Supabase environment variables!");
}
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.static(__dirname));

app.use(session({
    secret: process.env.SESSION_SECRET || 'block-buzz-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/auth/', authLimiter);

// --- SECURITY MIDDLEWARE ---
// Ensures a user is logged in before allowing access to protected routes.
function ensureAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    // ERROR: 401 Unauthorized if the user's session cookie is missing or invalid.
    return res.status(401).json({ error: 'Unauthorized. Please log in first.' });
}

// --- AUTHENTICATION ROUTES ---
app.get('/api/auth/me', (req, res) => {
    res.json({ user: req.session.user || null });
});

app.post('/api/auth/register-request', async (req, res) => {
    try {
        const { username, password, referralCode } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required.' });
        }

        // Check if username already exists in database
        const { data: existing } = await supabase.from('users').select('*').eq('username', username).single();
        if (existing) {
            return res.status(400).json({ error: 'Username already registered.' });
        }

        // Fetch Scratch profile to get profile picture
        const timestamp = Date.now();
        const scratchRes = await fetch(`https://api.scratch.mit.edu/users/${username}?_=${timestamp}`, {
            headers: { 'User-Agent': 'BlockBuzz-Platform' }
        });
        if (!scratchRes.ok) {
            // ERROR: 404 if the Scratch username does not exist on Scratch's API.
            return res.status(404).json({ error: 'Scratch user not found.' });
        }
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
        // ERROR: Catches unexpected server or network failures during registration initialization.
        console.error("REGISTER REQUEST ERROR:", err);
        res.status(500).json({ error: 'Server error during registration request.' });
    }
});

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
        const combinedText = `${scratchData.profile?.biography || ''} ${scratchData.profile?.wiwo || ''} ${scratchData.profile?.status || ''}`;

        // ERROR: Fails if the user hasn't pasted their verification code into their Scratch profile.
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
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('users').insert([newUser]).select();
        if (error) {
            // ERROR: Database insertion failure (e.g. schema mismatch).
            console.error("SUPABASE USER INSERT ERROR:", error);
            return res.status(400).json({ error: `Database error: ${error.message}` });
        }

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
        console.error("VERIFICATION EXCEPTION:", err);
        res.status(500).json({ error: 'Verification failed.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

        const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();
        if (error || !user) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

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
        console.error("LOGIN ERROR:", err);
        res.status(500).json({ error: 'Login error.' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// --- POSTS ROUTES ---
app.get('/api/posts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .order('id', { ascending: false });
        
        if (error) {
            console.error("SUPABASE FETCH POSTS ERROR:", error);
            return res.json([]);
        }
        res.json(data || []);
    } catch (err) {
        console.error("SERVER FETCH POSTS EXCEPTION:", err);
        res.json([]);
    }
});

app.post('/api/posts', ensureAuthenticated, async (req, res) => {
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
            console.log("Non-fatal: Could not fetch Scratch API metadata:", apiErr.message);
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
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('posts').insert([newPost]).select();
        if (error) {
            // ERROR: Logs exact Supabase database schema errors if columns like 'likes' or 'views' mismatch.
            console.error("SUPABASE POST INSERT ERROR:", error);
            return res.status(400).json({ error: `Database error: ${error.message}` });
        }

        res.json({ success: true, post: data[0] });
    } catch (err) {
        // ERROR: Catches unexpected exceptions during post creation.
        console.error("SERVER POST EXCEPTION:", err);
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

app.delete('/api/posts/:id', ensureAuthenticated, async (req, res) => {
    try {
        const postId = req.params.id;
        const username = req.session.user.username;

        const { data: post, error } = await supabase.from('posts').select('*').eq('id', postId).single();
        if (error || !post) return res.status(404).json({ error: 'Post not found' });

        if (post.author !== username && !req.session.user.is_admin) {
            // ERROR: 403 Forbidden if user tries to delete a post they don't own.
            return res.status(403).json({ error: 'You can only delete your own posts' });
        }

        const { error: deleteError } = await supabase.from('posts').delete().eq('id', postId);
        if (deleteError) throw deleteError;

        await supabase.from('comments').delete().eq('post_id', postId);

        res.json({ success: true, message: 'Post deleted successfully' });
    } catch (err) {
        console.error("DELETE POST ERROR:", err);
        res.status(500).json({ error: 'Failed to delete post.' });
    }
});

// --- COMMENTS ROUTES (FOR POSTS) ---
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

app.post('/api/posts/:id/comments', ensureAuthenticated, async (req, res) => {
    try {
        const { text, parentId } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Comment cannot be empty.' });
        }

        const newComment = {
            post_id: req.params.id,
            author: req.session.user.username,
            author_pfp: req.session.user.pfp,
            text: text.trim(),
            parent_id: parentId || null,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('comments').insert([newComment]).select();
        
        if (error) {
            // ERROR: Explicitly catches Supabase database errors (e.g. missing column like 'author_pfp' or 'parent_id').
            console.error("SUPABASE POST COMMENT ERROR:", error);
            return res.status(400).json({ error: `Database error: ${error.message}` });
        }

        res.json({ success: true, comment: data[0] });
    } catch (err) {
        // ERROR: Catches any server-side crash during post comment creation.
        console.error("SERVER POST COMMENT EXCEPTION:", err);
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

// --- DISCUSSIONS ROUTES ---
app.get('/api/discussions', async (req, res) => {
    try {
        const category = req.query.category;
        let query = supabase.from('discussions').select('*').order('id', { ascending: false });

        if (category) {
            query = query.eq('category', category);
        }

        const { data, error } = await query;
        if (error) return res.json([]);
        res.json(data || []);
    } catch (err) {
        res.json([]);
    }
});

app.post('/api/discussions', ensureAuthenticated, async (req, res) => {
    try {
        const { title, content, category } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required.' });
        }

        const newDiscussion = {
            title,
            content,
            category: category || 'scratch',
            author: req.session.user.username,
            author_pfp: req.session.user.pfp,
            upvotes: [],
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('discussions').insert([newDiscussion]).select();
        if (error) {
            console.error("SUPABASE DISCUSSION ERROR:", error);
            return res.status(400).json({ error: error.message });
        }

        res.json({ success: true, discussion: data[0] });
    } catch (err) {
        console.error("SERVER DISCUSSION EXCEPTION:", err);
        res.status(500).json({ error: 'Failed to create discussion.' });
    }
});

// --- DISCUSSION COMMENTS / REPLIES ROUTES ---
app.get('/api/discussions/:id/comments', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('discussion_comments')
            .select('*')
            .eq('discussion_id', req.params.id)
            .order('created_at', { ascending: true });
        
        if (error) return res.json([]);
        res.json(data || []);
    } catch (err) {
        res.json([]);
    }
});

app.post('/api/discussions/:id/comments', ensureAuthenticated, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Response text cannot be empty.' });
        }

        const newComment = {
            discussion_id: req.params.id,
            author: req.session.user.username,
            author_pfp: req.session.user.pfp,
            text: text.trim(),
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('discussion_comments').insert([newComment]).select();
        
        if (error) {
            // ERROR: Explicitly logs Supabase table schema errors for discussion replies.
            console.error("SUPABASE DISCUSSION COMMENT ERROR:", error);
            return res.status(400).json({ error: `Database error: ${error.message}` });
        }

        res.json({ success: true, comment: data[0] });
    } catch (err) {
        // ERROR: Catches unexpected exceptions when adding discussion responses.
        console.error("SERVER DISCUSSION COMMENT EXCEPTION:", err);
        res.status(500).json({ error: 'Failed to add response.' });
    }
});

// --- CONTESTS & STUDIOS ROUTES ---
app.get('/api/contests', async (req, res) => {
    const { data } = await supabase.from('contests').select('*').order('created_at', { ascending: false });
    res.json(data || []);
});

app.post('/api/contests', ensureAuthenticated, async (req, res) => {
    try {
        const { title, description, prize, scratchLink } = req.body;
        const { data, error } = await supabase.from('contests').insert([{
            title, description, prize, scratch_link: scratchLink, author: req.session.user.username, created_at: new Date().toISOString()
        }]).select();
        if (error) {
            console.error("CONTEST INSERT ERROR:", error);
            return res.status(400).json({ error: error.message });
        }
        res.json({ success: true, contest: data[0] });
    } catch (err) {
        console.error("CONTEST EXCEPTION:", err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/studios', async (req, res) => {
    const { data } = await supabase.from('studios').select('*').order('created_at', { ascending: false });
    res.json(data || []);
});

app.post('/api/studios', ensureAuthenticated, async (req, res) => {
    try {
        const { title, description, scratchLink } = req.body;
        const { data, error } = await supabase.from('studios').insert([{
            title, description, scratch_link: scratchLink, author: req.session.user.username, created_at: new Date().toISOString()
        }]).select();
        if (error) {
            console.error("STUDIO INSERT ERROR:", error);
            return res.status(400).json({ error: error.message });
        }
        res.json({ success: true, studio: data[0] });
    } catch (err) {
        console.error("STUDIO EXCEPTION:", err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
