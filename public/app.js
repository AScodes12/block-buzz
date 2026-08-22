let currentUser = null;
let currentDiscussionCategory = 'scratch';

function loadTheme() {
    const isLegacy = localStorage.getItem('blockbuzz_legacy_theme') === 'true';
    if (isLegacy) document.body.classList.add('legacy-theme');
    updateThemeButtonUI();
}

function toggleTheme() {
    const isLegacy = document.body.classList.contains('legacy-theme');
    if (isLegacy) {
        document.body.classList.remove('legacy-theme');
        localStorage.setItem('blockbuzz_legacy_theme', 'false');
    } else {
        document.body.classList.add('legacy-theme');
        localStorage.setItem('blockbuzz_legacy_theme', 'true');
    }
    updateThemeButtonUI();
}

function updateThemeButtonUI() {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.textContent = document.body.classList.contains('legacy-theme') ? 'Disable Legacy UI' : 'Enable Legacy UI';
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    const section = document.getElementById(tabName + '-section');
    const navBtn = document.getElementById('nav-' + tabName);

    if (section) section.style.display = 'block';
    if (navBtn) navBtn.classList.add('active');

    if (tabName === 'home') loadFeed();
    if (tabName === 'account') loadAccountProfile();
    if (tabName === 'discussions') loadDiscussions(currentDiscussionCategory);
    if (tabName === 'contests') loadContests();
    if (tabName === 'studios') loadStudios();
    if (tabName === 'notifications') loadNotifications();
    
    window.scrollTo(0, 0);
}

// --- POSTS & FEED (Optimized Async Comment Loader) ---
function renderPostCard(post) {
    const postId = post.id;
    const views = Array.isArray(post.views) ? post.views.length : (Number(post.views) || 0);
    const likes = Array.isArray(post.likes) ? post.likes.length : (Number(post.likes) || 0);

    const eyeIcon = '<svg class="icon" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>';
    const heartIcon = '<svg class="icon" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

    setTimeout(() => { loadCommentsForPost(postId); }, 10);

    return '<div class="card" id="post-' + postId + '">' +
        '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">' +
            '<div class="avatar-wrapper" style="cursor:pointer;" onclick="viewUserProfile(\'' + escapeHTML(post.author) + '\')">' +
                '<img src="' + (post.author_pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png') + '">' +
            '</div>' +
            '<span class="clickable-user" onclick="viewUserProfile(\'' + escapeHTML(post.author) + '\')">' + escapeHTML(post.author) + '</span>' +
        '</div>' +
        '<a href="' + escapeHTML(post.scratch_link) + '" target="_blank" style="text-decoration:none; color:inherit;">' +
            '<img class="project-thumb" src="' + (post.thumbnail || 'https://scratch.mit.edu/images/scratch-og.png') + '">' +
            '<h3 style="font-size: 16px; color:var(--text-primary); margin-top:8px;">' + escapeHTML(post.title || 'Scratch Project') + '</h3>' +
        '</a>' +
        '<p style="font-size:14px; color:var(--text-secondary); margin-top:4px;">' + escapeHTML(post.caption || '') + '</p>' +
        '<div class="post-stats">' +
            '<span class="stat-item">' + eyeIcon + ' ' + views + ' views</span>' +
            '<button class="stat-btn" onclick="toggleLike(\'' + postId + '\')">' + heartIcon + ' <span id="like-count-' + postId + '">' + likes + '</span> Likes</button>' +
        '</div>' +
        '<div class="comments-section">' +
            '<div id="comments-list-' + postId + '"><p style="font-size:13px; color:var(--text-secondary);">Loading comments...</p></div>' +
            '<div class="comment-input-row">' +
                '<input type="text" id="comment-input-' + postId + '" placeholder="Add a comment..." style="padding: 6px 12px; font-size: 13px;">' +
                '<button class="btn" style="padding: 6px 16px; font-size: 13px;" onclick="addComment(\'' + postId + '\')">Post</button>' +
            '</div>' +
        '</div>' +
    '</div>';
}

async function loadCommentsForPost(postId) {
    const listContainer = document.getElementById('comments-list-' + postId);
    if (!listContainer) return;
    try {
        const res = await fetch('/api/posts/' + postId + '/comments');
        const comments = res.ok ? await res.json() : [];
        if (comments.length === 0) {
            listContainer.innerHTML = '<p style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;">No comments yet.</p>';
            return;
        }
        let html = '';
        for (let i = 0; i < comments.length; i++) {
            let c = comments[i];
            html += '<div class="comment-item"><b class="clickable-user" onclick="viewUserProfile(\'' + escapeHTML(c.author) + '\')">' + escapeHTML(c.author) + ':</b> ' + escapeHTML(c.text) + '</div>';
        }
        listContainer.innerHTML = html;
    } catch (err) {
        listContainer.innerHTML = '<p style="font-size:13px; color:var(--text-secondary);">Failed to load comments.</p>';
    }
}

async function loadFeed() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    try {
        const res = await fetch('/api/posts');
        const posts = res.ok ? await res.json() : [];
        if (posts.length === 0) {
            feed.innerHTML = '<div class="card"><p style="text-align:center; color:var(--text-secondary);">No projects found.</p></div>';
            return;
        }
        let html = '';
        for (let i = 0; i < posts.length; i++) {
            html += renderPostCard(posts[i]);
        }
        feed.innerHTML = html;
    } catch (err) { feed.innerHTML = '<div class="card"><p>Error loading posts.</p></div>'; }
}

async function submitPost() {
    const scratchInput = document.getElementById('scratch-input').value;
    const caption = document.getElementById('post-caption').value;
    const msg = document.getElementById('home-msg');
    if (!scratchInput) return showMsg(msg, 'Project URL is required.', 'error');

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scratchInput, caption })
        });
        if (res.ok) {
            document.getElementById('scratch-input').value = '';
            document.getElementById('post-caption').value = '';
            showMsg(msg, 'Project posted!', 'success');
            loadFeed();
        }
    } catch (err) { showMsg(msg, 'Network error.', 'error'); }
}

async function toggleLike(postId) {
    try {
        const res = await fetch('/api/posts/' + postId + '/like', { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            const countSpan = document.getElementById('like-count-' + postId);
            if (countSpan) countSpan.textContent = data.likes;
        }
    } catch (err) { console.error('Error liking'); }
}

async function addComment(postId) {
    const input = document.getElementById('comment-input-' + postId);
    if (!input || !input.value.trim()) return;
    try {
        const res = await fetch('/api/posts/' + postId + '/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input.value })
        });
        if (res.ok) { 
            input.value = ''; 
            loadCommentsForPost(postId); 
        }
    } catch (err) { console.error('Error commenting'); }
}

// --- DISCUSSIONS ---
function switchDiscussionCategory(category) {
    currentDiscussionCategory = category;
    document.querySelectorAll('.disc-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('disc-tab-' + category).classList.add('active');
    loadDiscussions(category);
}

async function loadDiscussions(category) {
    const feed = document.getElementById('discussions-feed');
    try {
        const res = await fetch('/api/discussions');
        const items = res.ok ? await res.json() : [];
        const filtered = items.filter(item => (item.category || 'scratch') === category);
        if (filtered.length === 0) {
            feed.innerHTML = '<div class="card"><p style="text-align:center; color:var(--text-secondary);">No discussions found.</p></div>';
            return;
        }
        let html = '';
        for (let i = 0; i < filtered.length; i++) {
            let item = filtered[i];
            html += '<div class="card">' +
                '<span class="clickable-user" onclick="viewUserProfile(\'' + escapeHTML(item.author) + '\')">' + escapeHTML(item.author) + '</span>' +
                '<h3 style="font-size:16px; margin:4px 0;">' + escapeHTML(item.title) + '</h3>' +
                '<p style="font-size:14px; color:var(--text-secondary);">' + escapeHTML(item.content) + '</p>' +
            '</div>';
        }
        feed.innerHTML = html;
    } catch (err) { feed.innerHTML = '<div class="card"><p>Error loading discussions.</p></div>'; }
}

async function submitDiscussion() {
    const title = document.getElementById('discussion-title').value;
    const content = document.getElementById('discussion-content').value;
    const category = document.getElementById('discussion-category').value;
    const msg = document.getElementById('discussion-msg');
    if (!title || !content) return showMsg(msg, 'Title and content required.', 'error');
    try {
        const res = await fetch('/api/discussions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, category })
        });
        if (res.ok) {
            document.getElementById('discussion-title').value = '';
            document.getElementById('discussion-content').value = '';
            showMsg(msg, 'Discussion posted.', 'success');
            loadDiscussions(category);
        }
    } catch (err) { showMsg(msg, 'Error posting.', 'error'); }
}

// --- CONTESTS ---
async function loadContests() {
    const feed = document.getElementById('contests-feed');
    try {
        const res = await fetch('/api/contests');
        const contests = res.ok ? await res.json() : [];
        
        let html = '';
        if (contests.length === 0) {
            html = '<div class="card"><p style="text-align:center; color:var(--text-secondary);">No contests found.</p></div>';
        } else {
            for (let i = 0; i < contests.length; i++) {
                let c = contests[i];
                html += '<div class="card">' +
                    '<h3 style="font-size: 16px; color:var(--text-primary);">' + escapeHTML(c.title) + '</h3>' +
                    '<p style="font-size: 14px; color:var(--text-secondary); margin-top:4px;">' + escapeHTML(c.description) + '</p>' +
                '</div>';
            }
        }
        feed.innerHTML = html;
    } catch (err) { feed.innerHTML = '<div class="card"><p>Error loading contests.</p></div>'; }
}

async function submitContest() {
    const title = document.getElementById('contest-title').value;
    const description = document.getElementById('contest-desc').value;
    const msg = document.getElementById('contest-msg');
    if (!title) return showMsg(msg, 'Contest title is required.', 'error');
    try {
        const res = await fetch('/api/contests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });
        if (res.ok) {
            document.getElementById('contest-title').value = '';
            document.getElementById('contest-desc').value = '';
            showMsg(msg, 'Contest published!', 'success');
            loadContests();
        }
    } catch (err) { showMsg(msg, 'Error publishing contest.', 'error'); }
}

// --- STUDIOS & STUDIO DETAIL PAGE (Button Links) ---
async function loadStudios() {
    const feed = document.getElementById('studios-feed');
    try {
        const res = await fetch('/api/studios');
        const studios = res.ok ? await res.json() : [];
        
        let html = '';
        if (studios.length === 0) {
            html = '<div class="card"><p style="text-align:center; color:var(--text-secondary);">No studios found.</p></div>';
        } else {
            for (let i = 0; i < studios.length; i++) {
                let s = studios[i];
                html += '<div class="card">' +
                    '<h3 style="font-size: 16px; color:var(--text-primary); margin-bottom:4px;">' + escapeHTML(s.title) + '</h3>' +
                    '<p style="font-size: 14px; color:var(--text-secondary); margin-bottom:12px;">' + escapeHTML(s.description) + '</p>' +
                    '<button class="btn-outline" onclick="viewStudioDetails(\'' + (s.id || '') + '\', \'' + escapeHTML(s.title) + '\', \'' + escapeHTML(s.description) + '\')">View Studio</button>' +
                '</div>';
            }
        }
        feed.innerHTML = html;
    } catch (err) { feed.innerHTML = '<div class="card"><p>Error loading studios.</p></div>'; }
}

async function submitStudio() {
    const title = document.getElementById('studio-title').value;
    const description = document.getElementById('studio-desc').value;
    const msg = document.getElementById('studio-msg');
    if (!title) return showMsg(msg, 'Studio name is required.', 'error');
    try {
        const res = await fetch('/api/studios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });
        if (res.ok) {
            document.getElementById('studio-title').value = '';
            document.getElementById('studio-desc').value = '';
            showMsg(msg, 'Studio created successfully!', 'success');
            loadStudios();
        }
    } catch (err) { showMsg(msg, 'Error creating studio.', 'error'); }
}

function viewStudioDetails(id, title, description) {
    switchTab('studio-detail');
    const container = document.getElementById('studio-detail-content');
    container.innerHTML = '<button class="btn-outline" onclick="switchTab(\'studios\')" style="margin-bottom: 12px;">← Back to Studios</button>' +
        '<div class="card">' +
            '<h2 style="font-size: 20px; color:var(--text-primary); margin-bottom: 8px;">' + escapeHTML(title) + '</h2>' +
            '<p style="font-size: 14px; color:var(--text-secondary);">' + escapeHTML(description) + '</p>' +
        '</div>';
}

async function loadNotifications() {
    const section = document.getElementById('notifications-section');
    section.innerHTML = '<div class="card"><p style="text-align:center; color:var(--text-secondary);">No notifications.</p></div>';
}

// --- PROFILES & AUTHENTICATION MODALS ---
async function viewUserProfile(username) {
    switchTab('user-profile');
    const container = document.getElementById('user-profile-content');
    container.innerHTML = '<div class="card"><p style="text-align:center;">Loading profile...</p></div>';
    try {
        const res = await fetch('/api/users/' + username);
        const user = res.ok ? await res.json() : { username: username };
        container.innerHTML = '<button class="btn-outline" onclick="switchTab(\'home\')" style="margin-bottom: 12px;">← Back</button>' +
            '<div class="card" style="display:flex; align-items:center; gap:16px;">' +
            '<div class="avatar-wrapper" style="width:64px; height:64px;"><img src="' + (user.pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png') + '"></div>' +
            '<div><h2 style="font-size: 20px;">' + escapeHTML(user.username) + '</h2><p style="color:var(--text-secondary); font-size: 13px;">Scratcher</p></div>' +
        '</div>';
    } catch (err) { container.innerHTML = '<div class="card"><p>Error loading profile.</p></div>'; }
}

async function loadAccountProfile() {
    if (!currentUser) {
        document.getElementById('account-profile-content').innerHTML = '<div class="card" style="text-align: center;"><h3 style="margin-bottom:8px;">Sign in required</h3><button class="btn" onclick="openAuthModal(\'login\')">Sign in</button></div>';
        return;
    }
    viewUserProfile(currentUser.username);
}

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        currentUser = data.user || null;
        renderAuthUI();
    } catch (err) { console.error('Auth check failed'); }
}

function renderAuthUI() {
    const container = document.getElementById('auth-container');
    if (!container) return;
    if (currentUser) {
        container.innerHTML = '<div class="avatar-wrapper" style="width:32px; height:32px; cursor:pointer;" onclick="switchTab(\'account\')"><img src="' + (currentUser.pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png') + '"></div><button class="btn-outline" style="padding: 6px 16px; font-size: 13px;" onclick="logout()">Sign out</button>';
    } else {
        container.innerHTML = '<button class="btn" style="padding: 8px 16px;" onclick="openAuthModal(\'login\')">Sign in</button>';
    }
}

function openAuthModal(mode = 'login') {
    const overlay = document.getElementById('auth-modal');
    const body = document.getElementById('auth-modal-body');
    overlay.style.display = 'flex';

    if (mode === 'login') {
        body.innerHTML = '<h3 style="margin-bottom: 20px; font-size: 18px;">Sign in to BlockBuzz</h3>' +
            '<div class="input-group">' +
                '<input type="text" id="auth-username" placeholder="Username">' +
                '<input type="password" id="auth-password" placeholder="Password">' +
                '<button class="btn" onclick="submitAuthLogin()" style="width: 100%; margin-top: 8px;">Sign In</button>' +
                '<div class="auth-switch">Need an account? <span onclick="openAuthModal(\'signup\')">Sign up</span></div>' +
                '<div class="auth-switch" style="margin-top: 4px;"><span onclick="openAuthModal(\'reset\')">Forgot password?</span></div>' +
            '</div>';
    } else if (mode === 'signup') {
        body.innerHTML = '<h3 style="margin-bottom: 20px; font-size: 18px;">Create an Account</h3>' +
            '<div class="input-group">' +
                '<input type="text" id="auth-username" placeholder="Choose Username">' +
                '<input type="password" id="auth-password" placeholder="Choose Password">' +
                '<button class="btn" onclick="submitAuthSignup()" style="width: 100%; margin-top: 8px;">Sign Up</button>' +
                '<div class="auth-switch">Already have an account? <span onclick="openAuthModal(\'login\')">Sign in</span></div>' +
            '</div>';
    } else if (mode === 'reset') {
        body.innerHTML = '<h3 style="margin-bottom: 20px; font-size: 18px;">Reset Password</h3>' +
            '<div class="input-group">' +
                '<input type="text" id="auth-username" placeholder="Enter Username">' +
                '<input type="password" id="auth-password" placeholder="New Password">' +
                '<button class="btn" onclick="submitAuthReset()" style="width: 100%; margin-top: 8px;">Update Password</button>' +
                '<div class="auth-switch"><span onclick="openAuthModal(\'login\')">Back to Sign in</span></div>' +
            '</div>';
    }
}

function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }

async function submitAuthLogin() {
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (res.ok) {
        const data = await res.json();
        currentUser = data.user;
        renderAuthUI();
        closeAuthModal();
    }
}

async function submitAuthSignup() {
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (res.ok) {
        const data = await res.json();
        currentUser = data.user;
        renderAuthUI();
        closeAuthModal();
    }
}

async function submitAuthReset() {
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (res.ok) {
        alert('Password updated successfully!');
        openAuthModal('login');
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    renderAuthUI();
    switchTab('home');
}

// --- UTILS ---
function showMsg(element, text, type) { 
    if (!element) return; 
    element.textContent = text; 
    element.className = 'inline-msg ' + type; 
    element.style.display = 'block'; 
    setTimeout(function() { element.style.display = 'none'; }, 4000); 
}

function escapeHTML(str) { 
    return str ? String(str).replace(/[&<>'"]/g, function(tag) { 
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag; 
    }) : ''; 
}

document.addEventListener('DOMContentLoaded', function() { 
    loadTheme(); 
    checkAuth(); 
    loadFeed(); 
});
