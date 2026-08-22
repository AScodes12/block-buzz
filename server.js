const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- IN-MEMORY STORAGE ---
const users = new Map(); 
const pendingVerifications = new Map(); 
const posts = [];
const contests = [];
const studios = [];

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'scratch-community-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.use(express.static(path.join(__dirname, 'public')));

function generateReferralCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ================= AUTH & VERIFICATION =================

app.post('/api/auth/register-request', (req, res) => {
    const { username, referralCode } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required.' });

    const cleanUsername = username.trim();
    const verificationCode = 'SCRATCH-' + Math.floor(100000 + Math.random() * 900000);
    
    pendingVerifications.set(cleanUsername, {
        verificationCode,
        referralCode: referralCode ? referralCode.trim() : null,
        timestamp: Date.now()
    });

    return res.json({ success: true, verificationCode });
});

app.post('/api/auth/verify', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Username is required.' });

        const cleanUsername = username.trim();
        const pending = pendingVerifications.get(cleanUsername);
        
        if (!pending) {
            return res.status(400).json({ error: 'No pending verification found. Please request a code first.' });
        }

        const scratchRes = await fetch(`https://api.scratch.mit.edu/users/${cleanUsername}`);
        if (!scratchRes.ok) {
            return res.status(400).json({ error: 'Could not connect to Scratch API or user not found.' });
        }

        const scratchData = await scratchRes.json();
        
        // Extract bio safely from Scratch profile structure
        const bio = (scratchData.profile && scratchData.profile.bio) || scratchData.bio || '';
        const status = (scratchData.profile && scratchData.profile.status) || scratchData.status || '';
        const expectedCode = pending.verificationCode;

        if (bio.includes(expectedCode) || status.includes(expectedCode)) {
            const newUser = {
                username: cleanUsername,
                pfp: (scratchData.profile && scratchData.profile.images && scratchData.profile.images['90x90']) || '',
                coins: 50,
                referral_code: generateReferralCode(),
                badges: ['Verified'],
                is_admin: users.size === 0
            };

            users.set(cleanUsername, newUser);
            pendingVerifications.delete(cleanUsername);
            req.session.user = newUser;
            
            return res.json({ success: true, user: newUser });
        } else {
            return res.status(400).json({ 
                error: `Code "${expectedCode}" not found in your Scratch bio yet. Save it in your "About Me" and wait 30 seconds.` 
            });
        }
    } catch (err) {
        console.error('Verification error:', err);
        return res.status(500).json({ error: 'Server error communicating with Scratch.' });
    }
});

app.get('/api/auth/me', (req, res) => {
    if (req.session && req.session.user) {
        const currentUser = users.get(req.session.user.username) || req.session.user;
        return res.json({ user: currentUser });
    }
    return res.json({ user: null });
});

// ================= POSTS =================

app.get('/api/posts', (req, res) => {
    res.json(posts);
});

app.post('/api/posts', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized. Please login.' });
    }

    const { scratchInput, caption } = req.body;
    if (!scratchInput) return res.status(400).json({ error: 'Project input required.' });

    let projectId = scratchInput.trim();
    const match = projectId.match(/\/projects\/(\d+)/);
    if (match) projectId = match[1];

    try {
        const projRes = await fetch(`https://api.scratch.mit.edu/projects/${projectId}`);
        if (!projRes.ok) return res.status(400).json({ error: 'Could not fetch Scratch project. Make sure it is shared.' });
        
        const projData = await projRes.json();

        const newPost = {
            id: Date.now().toString(),
            scratchId: projectId,
            title: projData.title || 'Untitled Project',
            thumbnail: projData.image || '',
            caption: caption ? caption.trim() : '',
            author: req.session.user.username,
            author_pfp: req.session.user.pfp,
            author_color: req.session.user.color || '#000000',
            likes: [],
            views: [],
            createdAt: new Date()
        };

        posts.unshift(newPost);
        res.json({ success: true, post: newPost });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process project.' });
    }
});

// ================= STUDIOS & CONTESTS =================

app.get('/api/studios', (req, res) => res.json(studios));
app.post('/api/studios', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { title, description, scratchLink } = req.body;
    if (!title || !scratchLink) return res.status(400).json({ error: 'Fields required' });
    
    studios.unshift({
        id: Date.now().toString(),
        title: title.trim(),
        description: description ? description.trim() : '',
        scratch_link: scratchLink.trim(),
        author: req.session.user.username,
        author_pfp: req.session.user.pfp
    });
    res.json({ success: true });
});

app.get('/api/contests', (req, res) => res.json(contests));
app.post('/api/contests', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { title, description, prize, scratchLink } = req.body;
    if (!title || !scratchLink) return res.status(400).json({ error: 'Fields required' });
    
    contests.unshift({
        id: Date.now().toString(),
        title: title.trim(),
        description: description ? description.trim() : '',
        prize: prize ? prize.trim() : '',
        scratch_link: scratchLink.trim(),
        author: req.session.user.username,
        author_pfp: req.session.user.pfp
    });
    res.json({ success: true });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
