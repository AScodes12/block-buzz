const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'block-buzz-secure-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// In-Memory Databases (Replace with a real DB like MongoDB/PostgreSQL for production)
const usersDB = new Map(); // username -> user object
const pendingRegistrations = new Map(); // username -> { code, passwordHash, referralCode }
const postsDB = [];
const contestsDB = [];
const studiosDB = [];

// Helper functions
function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateReferralCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// --- AUTH ROUTES ---

// Step 1: Request registration code
app.post('/api/auth/register-request', async (req, res) => {
    try {
        const { username, password, referralCode } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        if (usersDB.has(username)) {
            return res.status(400).json({ error: 'Username is already registered.' });
        }

        const verificationCode = `BB-${generateCode()}`;
        const passwordHash = await bcrypt.hash(password, 10);

        pendingRegistrations.set(username, {
            code: verificationCode,
            passwordHash,
            referralCode: referralCode || null
        });

        res.json({ success: true, verificationCode });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Step 2: Verify via backend fetching Scratch (Bypasses CORS and Render IP block issues)
app.post('/api/auth/verify', async (req, res) => {
    try {
        const { username } = req.body;
        const pending = pendingRegistrations.get(username);

        if (!pending) {
            return res.status(400).json({ error: 'No pending registration found. Please restart.' });
        }

        // Fetch Scratch profile server-side
        const scratchRes = await fetch(`https://api.scratch.mit.edu/users/${username}`);
        if (!scratchRes.ok) {
            return res.status(400).json({ error: 'Could not reach Scratch API. Check username spelling.' });
        }

        const scratchData = await scratchRes.json();
        const bio = scratchData.profile?.bio || '';
        const status = scratchData.profile?.status || '';

        // Check if verification code exists in bio or status
        if (bio.includes(pending.code) || status.includes(pending.code)) {
            const newUser = {
                username,
                passwordHash: pending.passwordHash,
                pfp: scratchData.profile?.images?.['90x90'] || '',
                coins: 100,
                badges: ['Verified'],
                referral_code: generateReferralCode(),
                is_admin: usersDB.size === 0 // First user becomes admin
            };

            usersDB.set(username, newUser);
            pendingRegistrations.delete(username);

            // Set session
            req.session.user = {
                username: newUser.username,
                pfp: newUser.pfp,
                coins: newUser.coins,
                badges: newUser.badges,
                referral_code: newUser.referral_code,
                is_admin: newUser.is_admin
            };

            return res.json({ success: true, user: req.session.user });
        } else {
            return res.status(400).json({ error: 'Verification code not found in your Scratch bio or status!' });
        }
    } catch (err) {
        console.error('Verification error:', err);
        res.status(500).json({ error: 'Server error during verification.' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = usersDB.get(username);

        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

        req.session.user = {
            username: user.username,
            pfp: user.pfp,
            coins: user.coins,
            badges: user.badges,
            referral_code: user.referral_code,
            is_admin: user.is_admin
        };

        res.json({ success: true, user: req.session.user });
    } catch (err) {
        res.status(500).json({ error: 'Login failed.' });
    }
});

// Check Session
app.get('/api/auth/me', (req, res) => {
    res.json({ user: req.session.user || null });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// --- POSTS ROUTES ---
app.get('/api/posts', (req, res) => {
    res.json(postsDB);
});

app.post('/api/posts', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { scratchInput, caption } = req.body;

    // Simple ID extractor from Scratch URL
    const match = scratchInput.match(/\d+/);
    const projectId = match ? match[0] : scratchInput.trim();

    if (!projectId) return res.status(400).json({ error: 'Invalid Scratch Project ID/URL.' });

    const newPost = {
        id: Date.now().toString(),
        author: req.session.user.username,
        author_pfp: req.session.user.pfp,
        title: `Project #${projectId}`,
        caption: caption || '',
        thumbnail: `https://uploads.scratch.mit.edu/get_image/project/${projectId}_480x360.png`,
        scratch_link: `https://scratch.mit.edu/projects/${projectId}`,
        likes: [],
        views: [],
        comments: [],
        createdAt: new Date()
    };

    postsDB.unshift(newPost);
    res.json({ success: true, post: newPost });
});

app.post('/api/posts/:id/like', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const post = postsDB.find(p => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const username = req.session.user.username;
    const index = post.likes.indexOf(username);
    if (index > -1) {
        post.likes.splice(index, 1);
    } else {
        post.likes.push(username);
    }
    res.json({ success: true, likes: post.likes.length });
});

app.get('/api/posts/:id/comments', (req, res) => {
    const post = postsDB.find(p => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post.comments);
});

app.post('/api/posts/:id/comments', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const post = postsDB.find(p => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Comment cannot be empty' });

    const comment = {
        id: Date.now().toString(),
        author: req.session.user.username,
        text,
        createdAt: new Date()
    };

    post.comments.push(comment);
    res.json({ success: true, comment });
});

app.post('/api/posts/:id/view', (req, res) => {
    if (!req.session.user) return res.sendStatus(401);
    const post = postsDB.find(p => p.id === req.params.id);
    if (!post) return res.sendStatus(404);

    const username = req.session.user.username;
    if (!post.views.includes(username)) {
        post.views.push(username);
    }
    res.sendStatus(200);
});

// --- CONTESTS & STUDIOS ---
app.get('/api/contests', (req, res) => res.json(contestsDB));
app.post('/api/contests', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { title, description, prize, scratchLink } = req.body;
    contestsDB.unshift({ id: Date.now().toString(), author: req.session.user.username, author_pfp: req.session.user.pfp, title, description, prize, scratch_link: scratchLink });
    res.json({ success: true });
});

app.get('/api/studios', (req, res) => res.json(studiosDB));
app.post('/api/studios', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { title, description, scratchLink } = req.body;
    studiosDB.unshift({ id: Date.now().toString(), author: req.session.user.username, author_pfp: req.session.user.pfp, title, description, scratch_link: scratchLink });
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
