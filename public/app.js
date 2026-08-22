let currentUser = null;
let currentDiscussionCategory = 'scratch';

// --- THEME MANAGEMENT ---
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

// --- NAVIGATION & TABS ---
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

// --- PUBLIC USER PROFILES ---
async function viewUserProfile(username) {
    switchTab('user-profile');
    const profileContainer = document.getElementById('user-profile-content');
    profileContainer.innerHTML = `<div class="card"><p style="text-align:center; color:var(--text-secondary);">Loading profile...</p></div>`;

    try {
        const resUser = await fetch(`/api/users/${username}`);
        const user = resUser.ok ? await resUser.json() : { username, pfp: 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png' };

        const resPosts = await fetch(`/api/posts?author=${username}`);
        let userPosts = [];
        if (resPosts.ok) userPosts = await resPosts.json();

        let postsHTML = `<p style="color:var(--text-secondary); text-align:center; padding: 20px;">No posts yet.</p>`;
        if (userPosts.length > 0) {
            postsHTML = userPosts.map(post => renderPostCard(post)).join('');
        }

        profileContainer.innerHTML = `
            <div class="card" style="display:flex; align-items:center; gap:16px;">
                <div class="avatar-wrapper" style="width:64px; height:64px;">
                    <img src="${user.pfp}">
                </div>
                <div>
                    <h2 style="font-size: 20px; color:var(--text-primary); margin-bottom:4px;">${escapeHTML(user.username)}</h2>
                    <p style="color:var(--text-secondary); font-size: 13px;">Scratcher</p>
                </div>
            </div>
            <h3 style="margin: 20px 0 12px 0; font-size: 16px;">Posts by ${escapeHTML(user.username)}</h3>
            <div id="public-user-posts">${postsHTML}</div>
        `;
    } catch (err) {
        profileContainer.innerHTML = `<div class="card"><p style="color:#c5221f;">Error loading profile.</p></div>`;
    }
}

// --- ACCOUNT / PROFILE (CURRENT USER) ---
async function loadAccountProfile() {
    const profileContainer = document.getElementById('account-profile-content');
    if (!profileContainer) return;

    if (!currentUser) {
        profileContainer.innerHTML = `
            <div class="card" style="text-align: center;">
                <h3 style="margin-bottom:8px;">Sign in required</h3>
                <p style="color:var(--text-secondary); margin-bottom: 16px;">Please sign in to view your profile.</p>
                <button class="btn" onclick="openAuthModal()">Sign in</button>
            </div>
        `;
        return;
    }
    viewUserProfile(currentUser.username);
}

// --- POSTS FEED & RENDERING ---
function renderPostCard(post) {
    const views = post.views || 0;
    const likes = post.likes || 0;
    const comments = post.comments || 0;

    return `
        <div class="card">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div class="avatar-wrapper" style="cursor:pointer;" onclick="viewUserProfile('${escapeHTML(post.author)}')"><img src="${post.author_pfp}"></div>
                <span class="clickable-user" onclick="viewUserProfile('${escapeHTML(post.author)}')">${escapeHTML(post.author)}</span>
            </div>
            <a href="${post.scratch_link}" target="_blank" style="text-decoration:none; color:inherit;">
                <img class="project-thumb" src="${post.thumbnail || 'https://scratch.mit.edu/images/scratch-og.png'}">
                <h3 style="font-size: 16px; color:var(--text-primary); margin-top:8px;">${escapeHTML(post.title || 'Scratch Project')}</h3>
            </a>
            <p style="font-size:14px; color:var(--text-secondary); margin-top:4px;">${escapeHTML(post.caption || '')}</p>
            
            <div class="post-stats">
                <div class="stat-item">Views: ${views}</div>
                <div class="stat-item">Likes: ${likes}</div>
                <div class="stat-item">Comments: ${comments}</div>
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
            feed.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">No projects found.</p></div>`;
            return;
        }
        feed.innerHTML = posts.map(post => renderPostCard(post)).join('');
    } catch (err) {
        feed.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">Feed could not be loaded.</p></div>`;
    }
}

async function submitPost() {
    const scratchInput = document.getElementById('scratch-input').value;
    const caption = document.getElementById('post-caption').value;
    const msg = document.getElementById('home-msg');
    if (!scratchInput) return showMsg(msg, 'Project URL is required.', 'error');

    try {
        const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scratchInput, caption }) });
        const data = await res.json();
        if (data.success) {
            document.getElementById('scratch-input').value = '';
            document.getElementById('post-caption').value = '';
            showMsg(msg, 'Project posted.', 'success');
            loadFeed();
        } else showMsg(msg, data.error, 'error');
    } catch (err) { showMsg(msg, 'Error posting project.', 'error'); }
}

// --- DISCUSSIONS ---
function switchDiscussionCategory(category) {
    currentDiscussionCategory = category;
    document.querySelectorAll('.disc-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`disc-tab-${category}`).classList.add('active');
    loadDiscussions(category);
}

async function loadDiscussions(category) {
    const feed = document.getElementById('discussions-feed');
    try {
        const res = await fetch(`/api/discussions?category=${category}`);
        const discussions = res.ok ? await res.json() : [];
        if (discussions.length === 0) return feed.innerHTML = `<div class="card"><p style="text-align:center;">No discussions yet.</p></div>`;
        
        feed.innerHTML = discussions.map(item => `
            <div class="card">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <span class="clickable-user" onclick="viewUserProfile('${escapeHTML(item.author)}')">${escapeHTML(item.author)}</span>
                </div>
                <h3 style="font-size:16px; margin-bottom:4px;">${escapeHTML(item.title)}</h3>
                <p style="font-size:14px; color:var(--text-secondary);">${escapeHTML(item.content)}</p>
            </div>
        `).join('');
    } catch (err) { feed.innerHTML = `<div class="card"><p>Error loading discussions.</p></div>`; }
}

async function submitDiscussion() {
    const title = document.getElementById('discussion-title').value;
    const content = document.getElementById('discussion-content').value;
    const category = document.getElementById('discussion-category').value;
    const msg = document.getElementById('discussion-msg');
    
    if (!title || !content) return showMsg(msg, 'Title and content required.', 'error');
    try {
        const res = await fetch('/api/discussions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, category }) });
        if ((await res.json()).success) {
            document.getElementById('discussion-title').value = '';
            document.getElementById('discussion-content').value = '';
            showMsg(msg, 'Discussion posted.', 'success');
            loadDiscussions(category);
        }
    } catch (err) { showMsg(msg, 'Error posting discussion.', 'error'); }
}

// --- CONTESTS & STUDIOS ---
async function loadContests() {
    const feed = document.getElementById('contests-feed');
    try {
        const res = await fetch('/api/contests');
        const contests = res.ok ? await res.json() : [];
        if (contests.length === 0) return feed.innerHTML = `<div class="card"><p style="text-align:center;">No contests found.</p></div>`;
        feed.innerHTML = contests.map(c => `<div class="card"><h3 style="font-size:16px;">${escapeHTML(c.title || 'Contest')}</h3><p style="font-size:14px; color:var(--text-secondary); margin-top:4px;">${escapeHTML(c.description)}</p></div>`).join('');
    } catch (err) { feed.innerHTML = `<div class="card"><p>Error loading contests.</p></div>`; }
}

async function loadStudios() {
    const feed = document.getElementById('studios-feed');
    try {
        const res = await fetch('/api/studios');
        const studios = res.ok ? await res.json() : [];
        if (studios.length === 0) return feed.innerHTML = `<div class="card"><p style="text-align:center;">No studios found.</p></div>`;
        feed.innerHTML = studios.map(s => `<div class="card"><h3 style="font-size:16px;">${escapeHTML(s.title)}</h3><p style="font-size:14px; color:var(--text-secondary); margin-top:4px;">${escapeHTML(s.description)}</p></div>`).join('');
    } catch (err) { feed.innerHTML = `<div class="card"><p>Error loading studios.</p></div>`; }
}

async function submitContest() { /* Mock submission logic */ showMsg(document.getElementById('contest-msg'), 'Contest posted.', 'success'); }
async function submitStudio() { /* Mock submission logic */ showMsg(document.getElementById('studio-msg'), 'Studio posted.', 'success'); }

// --- NOTIFICATIONS ---
async function loadNotifications() {
    const section = document.getElementById('notifications-section');
    try {
        const res = await fetch('/api/notifications');
        const notifs = res.ok ? await res.json() : [];
        if (notifs.length === 0) return section.innerHTML = `<div class="card"><p style="text-align:center; color:var(--text-secondary);">No notifications.</p></div>`;
        section.innerHTML = notifs.map(n => `<div class="card" style="padding:16px;"><p style="font-size:14px;">${escapeHTML(n.message)}</p></div>`).join('');
    } catch (err) { section.innerHTML = `<div class="card"><p>Error loading notifications.</p></div>`; }
}

// --- AUTH ---
function openAuthModal() { document.getElementById('auth-modal').style.display = 'flex'; }
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        currentUser = data.user;
        renderAuthUI();
    } catch (err) { console.error('Auth check error'); }
}

function renderAuthUI() {
    const container = document.getElementById('auth-container');
    if (!container) return;
    if (currentUser) {
        container.innerHTML = `
            <button class="nav-link" onclick="switchTab('notifications')" style="padding: 6px 12px;">Alerts</button>
            <div class="avatar-wrapper" style="width:32px; height:32px; cursor:pointer;" onclick="switchTab('account')">
                <img src="${currentUser.pfp}">
            </div>
            <button class="btn-outline" style="padding: 6px 16px; font-size: 13px;" onclick="logout()">Sign out</button>
        `;
    } else {
        container.innerHTML = `<button class="btn" style="padding: 8px 16px;" onclick="openAuthModal()">Sign in</button>`;
    }
}

async function submitLogin() { /* Mock login for UI completion */ currentUser = { username: 'Guest', pfp: 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png' }; renderAuthUI(); closeAuthModal(); }
async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); currentUser = null; renderAuthUI(); switchTab('home'); }

// --- UTILS ---
function showMsg(element, text, type) { if (!element) return; element.textContent = text; element.className = `inline-msg ${type}`; element.style.display = 'block'; setTimeout(() => { element.style.display = 'none'; }, 4000); }
function escapeHTML(str) { return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : ''; }

document.addEventListener('DOMContentLoaded', () => { loadTheme(); checkAuth(); loadFeed(); });
