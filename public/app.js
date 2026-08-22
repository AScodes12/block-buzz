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

    const section = document.getElementById(`${tabName}-section`);
    const navBtn = document.getElementById(`nav-${tabName}`);

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

// --- POSTS & FEED ---
function renderPostCard(post) {
    const postId = post.id;
    const views = post.views || 0;
    const likes = post.likes || 0;
    const comments = post.comments || [];

    return `
        <div class="card" id="post-${postId}">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div class="avatar-wrapper" style="cursor:pointer;" onclick="viewUserProfile('${escapeHTML(post.author)}')">
                    <img src="${post.author_pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png'}">
                </div>
                <span class="clickable-user" onclick="viewUserProfile('${escapeHTML(post.author)}')">${escapeHTML(post.author)}</span>
            </div>
            <a href="${escapeHTML(post.scratch_link)}" target="_blank" style="text-decoration:none; color:inherit;">
                <img class="project-thumb" src="${post.thumbnail || 'https://scratch.mit.edu/images/scratch-og.png'}">
                <h3 style="font-size: 16px; color:var(--text-primary); margin-top:8px;">${escapeHTML(post.title || 'Scratch Project')}</h3>
            </a>
            <p style="font-size:14px; color:var(--text-secondary); margin-top:4px;">${escapeHTML(post.caption || '')}</p>
            
            <div class="post-stats">
                <span style="font-size: 13px;">👁️ ${views} views</span>
                <button class="stat-btn" onclick="toggleLike('${postId}')">❤️ <span id="like-count-${postId}">${likes}</span> Likes</button>
                <button class="stat-btn" onclick="toggleComments('${postId}')">💬 ${comments.length} Comments</button>
            </div>

            <div class="comments-section" id="comments-${postId}">
                <div id="comments-list-${postId}">
                    ${comments.map(c => `<div class="comment-item"><b>${escapeHTML(c.author)}:</b> ${escapeHTML(c.text)}</div>`).join('')}
                    ${comments.length === 0 ? '<p style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;">No comments yet. Be the first!</p>' : ''}
                </div>
                <div class="comment-input-row">
                    <input type="text" id="comment-input-${postId}" placeholder="Add a comment..." style="padding: 6px 12px; font-size: 13px;">
                    <button class="btn" style="padding: 6px 16px; font-size: 13px;" onclick="addComment('${postId}')">Post</button>
                </div>
            </div>
        </div>
    `;
}

async function loadFeed() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    try {
        const res = await fetch('/api/posts');
        const posts = res.ok ? await res.json() : [];
        if (posts.length === 0) {
            feed.innerHTML = `<div class="card"><p style="text-align:center; color:var(--text-secondary);">No projects found in database. Share one above!</p></div>`;
            return;
        }
        feed.innerHTML = posts.map(post => renderPostCard(post)).join('');
    } catch (err) {
        feed.innerHTML = `<div class="card"><p style="text-align:center; color:#c5221f;">Error loading posts from database.</p></div>`;
    }
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
        const data = await res.json();
        if (res.ok && data.success !== false) {
            document.getElementById('scratch-input').value = '';
            document.getElementById('post-caption').value = '';
            showMsg(msg, 'Project posted to database!', 'success');
            loadFeed();
        } else {
            showMsg(msg, data.error || 'Failed to post project.', 'error');
        }
    } catch (err) {
        showMsg(msg, 'Network error while posting.', 'error');
    }
}

async function toggleLike(postId) {
    try {
        const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            const countSpan = document.getElementById(`like-count-${postId}`);
            if (countSpan) countSpan.textContent = data.likes;
        }
    } catch (err) {
        console.error('Error liking post');
    }
}

function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (section) section.classList.toggle('open');
}

async function addComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (!input || !input.value.trim()) return;

    try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input.value })
        });
        if (res.ok) {
            input.value = '';
            loadFeed();
            setTimeout(() => toggleComments(postId), 50); // Keep comments open after reload
        }
    } catch (err) {
        console.error('Error adding comment');
    }
}

// --- DISCUSSIONS, CONTESTS, STUDIOS, NOTIFICATIONS ---
async function switchDiscussionCategory(category) {
    currentDiscussionCategory = category;
    document.querySelectorAll('.disc-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`disc-tab-${category}`).classList.add('active');
    loadDiscussions(category);
}

async function loadDiscussions(category) {
    const feed = document.getElementById('discussions-feed');
    try {
        const res = await fetch(`/api/discussions?category=${category}`);
        const items = res.ok ? await res.json() : [];
        if (items.length === 0) {
            feed.innerHTML = `<div class="card"><p style="text-align:center; color:var(--text-secondary);">No discussions found.</p></div>`;
            return;
        }
        feed.innerHTML = items.map(item => `
            <div class="card">
                <span class="clickable-user" onclick="viewUserProfile('${escapeHTML(item.author)}')">${escapeHTML(item.author)}</span>
                <h3 style="font-size:16px; margin:4px 0;">${escapeHTML(item.title)}</h3>
                <p style="font-size:14px; color:var(--text-secondary);">${escapeHTML(item.content)}</p>
            </div>
        `).join('');
    } catch (err) {
        feed.innerHTML = `<div class="card"><p>Error loading discussions.</p></div>`;
    }
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
    } catch (err) { showMsg(msg, 'Error posting discussion.', 'error'); }
}

async function loadContests() {
    const feed = document.getElementById('contests-feed');
    try {
        const res = await fetch('/api/contests');
        const contests = res.ok ? await res.json() : [];
        feed.innerHTML = contests.length ? contests.map(c => `<div class="card"><h3>${escapeHTML(c.title)}</h3><p>${escapeHTML(c.description)}</p></div>`).join('') : `<div class="card"><p style="text-align:center; color:var(--text-secondary);">No contests found.</p></div>`;
    } catch (err) { feed.innerHTML = `<div class="card"><p>Error loading contests.</p></div>`; }
}

async function loadStudios() {
    const feed = document.getElementById('studios-feed');
    try {
        const res = await fetch('/api/studios');
        const studios = res.ok ? await res.json() : [];
        feed.innerHTML = studios.length ? studios.map(s => `<div class="card"><h3>${escapeHTML(s.title)}</h3><p>${escapeHTML(s.description)}</p></div>`).join('') : `<div class="card"><p style="text-align:center; color:var(--text-secondary);">No studios found.</p></div>`;
    } catch (err) { feed.innerHTML = `<div class="card"><p>Error loading studios.</p></div>`; }
}

async function loadNotifications() {
    const section = document.getElementById('notifications-section');
    try {
        const res = await fetch('/api/notifications');
        const notifs = res.ok ? await res.json() : [];
        section.innerHTML = notifs.length ? notifs.map(n => `<div class="card"><p>${escapeHTML(n.message)}</p></div>`).join('') : `<div class="card"><p style="text-align:center; color:var(--text-secondary);">No notifications.</p></div>`;
    } catch (err) { section.innerHTML = `<div class="card"><p>Error loading notifications.</p></div>`; }
}

// --- PROFILES & AUTH ---
async function viewUserProfile(username) {
    switchTab('user-profile');
    const container = document.getElementById('user-profile-content');
    container.innerHTML = `<div class="card"><p style="text-align:center;">Loading profile...</p></div>`;
    try {
        const res = await fetch(`/api/users/${username}`);
        const user = res.ok ? await res.json() : { username };
        container.innerHTML = `
            <div class="card" style="display:flex; align-items:center; gap:16px;">
                <div class="avatar-wrapper" style="width:64px; height:64px;"><img src="${user.pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png'}"></div>
                <div>
                    <h2 style="font-size: 20px;">${escapeHTML(user.username)}</h2>
                    <p style="color:var(--text-secondary); font-size: 13px;">Scratcher</p>
                </div>
            </div>
        `;
    } catch (err) { container.innerHTML = `<div class="card"><p>Error loading profile.</p></div>`; }
}

async function loadAccountProfile() {
    if (!currentUser) {
        document.getElementById('account-profile-content').innerHTML = `
            <div class="card" style="text-align: center;">
                <h3 style="margin-bottom:8px;">Sign in required</h3>
                <button class="btn" onclick="openAuthModal()">Sign in</button>
            </div>
        `;
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
        container.innerHTML = `
            <div class="avatar-wrapper" style="width:32px; height:32px; cursor:pointer;" onclick="switchTab('account')">
                <img src="${currentUser.pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png'}">
            </div>
            <button class="btn-outline" style="padding: 6px 16px; font-size: 13px;" onclick="logout()">Sign out</button>
        `;
    } else {
        container.innerHTML = `<button class="btn" style="padding: 8px 16px;" onclick="openAuthModal()">Sign in</button>`;
    }
}

async function submitLogin() {
    const usernameInput = document.getElementById('login-username').value;
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput })
        });
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            renderAuthUI();
            closeAuthModal();
        }
    } catch (err) { console.error('Login error'); }
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
    element.className = `inline-msg ${type}`; 
    element.style.display = 'block'; 
    setTimeout(() => { element.style.display = 'none'; }, 4000); 
}

function escapeHTML(str) { 
    return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : ''; 
}

document.addEventListener('DOMContentLoaded', () => { loadTheme(); checkAuth(); loadFeed(); });
