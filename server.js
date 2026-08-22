const express = require('express');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase Configuration (Make sure these environment variables are set in your hosting platform or .env file)
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_KEY || 'YOUR_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'blockbuzz_secure_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS in production
}));

// Serve static frontend files from a 'public' folder (change if your layout differs)
app.use(express.static('public'));

// --- AUTHENTICATION API ---

app.get('/api/auth/me', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.json({ user: null });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        req.session.user = user;
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/register-request', async (req, res) => {
    const { username, password, referralCode } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        // Check if user already exists
        const { data: existing } = await supabase
            .from('users')
            .select('username')
            .eq('username', username)
            .single();

        if (existing) {
            return res.status(400).json({ error: 'Username already registered.' });
        }

        const verificationCode = 'BB-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Store temporary registration state in session
        req.session.pendingUser = { username, password, verificationCode, referralCode };

        res.json({
            success: true,
            verificationCode,
            profileUrl: `https://scratch.mit.edu/users/${username}/`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/verify', async (req, res) => {
    const { username } = req.body;
    const pending = req.session.pendingUser;

    if (!pending || pending.username !== username) {
        return res.status(400).json({ error: 'No pending registration found for this user.' });
    }

    try {
        // Fetch Scratch profile data to check bio/about me for verification code
        const scratchRes = await fetch(`https://api.scratch.mit.edu/users/${username}`);
        if (!scratchRes.ok) {
            return res.status(400).json({ error: 'Could not reach Scratch API to verify profile.' });
        }
        const scratchData = await scratchRes.json();
        const bio = (scratchData.profile.bio || '') + ' ' + (scratchData.profile.status || '');

        if (!bio.includes(pending.verificationCode)) {
            return res.status(400).json({ error: 'Verification code not found on your Scratch profile bio yet.' });
        }

        const pfp = scratchData.profile.images['90x90'] || '';
        const referral_code = 'REF-' + Math.random().toString(36).substring(2, 8).toUpperCase();

        // Create user in Supabase
        const { data: newUser, error } = await supabase.from('users').insert([{
            username,
            password: pending.password,
            pfp,
            coins: 50, // Signup bonus
            referral_code,
            created_at: new Date()
        }]).select().single();

        if (error) throw error;

        delete req.session.pendingUser;
        req.session.user = newUser;

        res.json({ success: true, user: newUser });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// --- POSTS API ---

app.get('/api/posts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/posts', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Sign in required' });
    }

    const { scratchInput, caption } = req.body;
    if (!scratchInput) {
        return res.status(400).json({ error: 'Project URL is required.' });
    }

    // Extract project ID from Scratch URL
    const match = scratchInput.match(/\/projects\/(\d+)/);
    const projectId = match ? match[1] : scratchInput.trim();

    try {
        // Fetch project info from Scratch API
        const projectRes = await fetch(`https://api.scratch.mit.edu/projects/${projectId}`);
        if (!projectRes.ok) {
            return res.status(400).json({ error: 'Invalid Scratch project ID or URL.' });
        }
        const projectData = await projectRes.json();

        const { data, error } = await supabase.from('posts').insert([{
            scratch_link: `https://scratch.mit.edu/projects/${projectId}/`,
            title: projectData.title,
            thumbnail: projectData.image,
            caption: caption || '',
            author: req.session.user.username,
            author_pfp: req.session.user.pfp,
            likes: [],
            views: [],
            created_at: new Date()
        }]).select();

        if (error) throw error;
        res.json({ success: true, post: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/posts/:id/like', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Sign in required' });
    const postId = req.params.id;
    const username = req.session.user.username;

    try {
        const { data: post, error: fetchErr } = await supabase.from('posts').select('likes').eq('id', postId).single();
        if (fetchErr) throw fetchErr;

        let likes = Array.isArray(post.likes) ? post.likes : [];
        if (likes.includes(username)) {
            likes = likes.filter(u => u !== username);
        } else {
            likes.push(username);
        }

        const { data: updated, error: updateErr } = await supabase.from('posts').update({ likes }).eq('id', postId).select().single();
        if (updateErr) throw updateErr;

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/posts/:id/view', async (req, res) => {
    const postId = req.params.id;
    const viewerId = req.session.user ? req.session.user.username : req.ip;

    try {
        const { data: post, error: fetchErr } = await supabase.from('posts').select('views').eq('id', postId).single();
        if (fetchErr) throw fetchErr;

        let views = Array.isArray(post.views) ? post.views : [];
        if (!views.includes(viewerId)) {
            views.push(viewerId);
            await supabase.from('posts').update({ views }).eq('id', postId);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- COMMENTS API ---

app.get('/api/posts/:id/comments', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('post_id', req.params.id)
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/posts/:id/comments', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Sign in required' });
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text required.' });

    try {
        const { data, error } = await supabase.from('comments').insert([{
            post_id: req.params.id,
            author: req.session.user.username,
            text: text.trim(),
            created_at: new Date()
        }]).select();

        if (error) throw error;
        res.json({ success: true, comment: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- DISCUSSIONS API ---

app.get('/api/discussions', async (req, res) => {
    const category = req.query.category || 'scratch';
    try {
        const { data, error } = await supabase
            .from('discussions')
            .select('*')
            .eq('category', category)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/discussions', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Sign in required' });
    }

    const { title, content, category } = req.body;
    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required.' });
    }

    try {
        const { data, error } = await supabase.from('discussions').insert([{
            title,
            content,
            category: category || 'scratch',
            author: req.session.user.username,
            author_pfp: req.session.user.pfp,
            upvotes: []
        }]).select();

        if (error) throw error;
        res.json({ success: true, discussion: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/discussions/:id/upvote', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Sign in required' });
    }

    const discussionId = req.params.id;
    const username = req.session.user.username;

    try {
        const { data: disc, error: fetchErr } = await supabase
            .from('discussions')
            .select('upvotes')
            .eq('id', discussionId)
            .single();

        if (fetchErr) throw fetchErr;

        let upvotes = Array.isArray(disc.upvotes) ? disc.upvotes : [];
        if (upvotes.includes(username)) {
            upvotes = upvotes.filter(u => u !== username);
        } else {
            upvotes.push(username);
        }

        const { data: updated, error: updateErr } = await supabase
            .from('discussions')
            .update({ upvotes })
            .eq('id', discussionId)
            .select()
            .single();

        if (updateErr) throw updateErr;
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CONTESTS API ---

app.get('/api/contests', async (req, res) => {
    try {
        const { data, error } = await supabase.from('contests').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/contests', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Sign in required' });
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required.' });

    try {
        const { data, error } = await supabase.from('contests').insert([{
            title,
            description: description || '',
            author: req.session.user.username,
            created_at: new Date()
        }]).select();

        if (error) throw error;
        res.json({ success: true, contest: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- STUDIOS API ---

app.get('/api/studios', async (req, res) => {
    try {
        const { data, error } = await supabase.from('studios').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/studios/:id', async (req, res) => {
    try {
        const { data, error } = await supabase.from('studios').select('*').eq('id', req.params.id).single();
        if (error || !data) return res.status(404).json({ error: 'Studio not found.' });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/studios', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Sign in required' });
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required.' });

    try {
        const { data, error } = await supabase.from('studios').insert([{
            title,
            description: description || '',
            author: req.session.user.username,
            created_at: new Date()
        }]).select();

        if (error) throw error;
        res.json({ success: true, studio: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- USER PROFILE API ---

app.get('/api/users/:username', async (req, res) => {
    const username = req.params.username;
    try {
        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('username, pfp, coins, created_at, referral_code')
            .eq('username', username)
            .single();

        if (userErr || !user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const { data: posts, error: postsErr } = await supabase
            .from('posts')
            .select('*')
            .eq('author', username)
            .order('created_at', { ascending: false });

        if (postsErr) throw postsErr;

        res.json({ user, posts: posts || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`BlockBuzz server running on port ${PORT}`);
});
