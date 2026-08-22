let currentUser = null;

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
    window.scrollTo(0, 0);
}

// --- PUBLIC USER PROFILES ---
async function viewUserProfile(username) {
    switchTab('user-profile');
    const profileContainer = document.getElementById('user-profile-content');
    profileContainer.innerHTML = `<div class="card"><p style="text-align:center; color:var(--text-secondary);">Loading profile for ${escapeHTML(username)}...</p></div>`;

    try {
        // Fetch User Info
        const resUser = await fetch(`/api/users/${username}`);
        if (!resUser.ok) throw new Error('User not found');
        const user = await resUser.json();

        // Fetch User's Specific Posts
        const resPosts = await fetch(`/api/posts?author=${username}`);
        let userPosts = [];
        if (resPosts.ok) userPosts = await resPosts.json();

        let postsHTML = `<p style="color:var(--text-secondary); text-align:center;">This user hasn't posted anything yet.</p>`;
        
        if (userPosts.length > 0) {
            postsHTML = userPosts.map(post => renderPostCard(post)).join('');
        }

        profileContainer.innerHTML = `
            <div class="card" style="display:flex; align-items:center; gap:20px;">
                <div class="avatar-wrapper" style="width:80px; height:80px;">
                    <img src="${user.pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png'}">
                </div>
                <div>
                    <h2 style="font-size: 1.5rem; color:${user.color || 'var(--text-primary)'}">${escapeHTML(user.username)}</h2>
                    <p style="color:var(--text-secondary); font-size: 14px; margin-top:4px;">Scratcher</p>
                </div>
            </div>
            <h3 style="margin: 24px 0 16px 4px; font-size: 1.1rem;">Posts by ${escapeHTML(user.username)}</h3>
            <div id="public-user-posts">${postsHTML}</div>
        `;
    } catch (err) {
        profileContainer.innerHTML = `
            <div class="card">
                <h3 style="color:#991b1b; text-align:center;">Could not load profile for ${escapeHTML(username)}</h3>
                <div style="text-align:center; margin-top:16px;">
                    <button class="btn-outline" onclick="switchTab('home')">Return Home</button>
                </div>
            </div>
        `;
    }
}

// --- ACCOUNT / PROFILE (CURRENT USER) ---
async function loadAccountProfile() {
    const profileContainer = document.getElementById('account-profile-content');
    if (!profileContainer) return;

    if (!currentUser) {
        profileContainer.innerHTML = `
            <div class="card" style="text-align: center;">
                <h3 style="margin-bottom:12px;">You are not logged in</h3>
                <p style="color:var(--text-secondary); margin-bottom: 24px;">Log in to view your profile.</p>
                <button class="btn" onclick="openAuthModal()">Log In</button>
            </div>
        `;
        return;
    }

    // Reuse the exact same profile loading structure as public profiles
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
                <img class="project-thumb" src="${post.thumbnail}">
                <h3 style="font-size:1.1rem; color:var(--text-primary); margin-top:8px;">${escapeHTML(post.title)}</h3>
            </a>
            <p style="font-size:15px; color:var(--text-secondary); margin-top:8px;">${escapeHTML(post.caption || '')}</p>
            
            <div class="post-stats">
                <div class="stat-item">Views: ${views}</div>
                <div class="stat-item" style="margin-left: 12px;">Likes: ${likes}</div>
                <div class="stat-item" style="margin-left: 12px;">Comments: ${comments}</div>
            </div>
        </div>
    `;
}

async function loadFeed() {
    const feed = document.getElementById('feed');
    if (!feed) return;

    feed.innerHTML = `<p style="text-align:center; color:var(--text-secondary); margin-top: 24px;">Loading feed...</p>`;

    try {
        const res = await fetch('/api/posts');
        if (!res.ok) throw new Error('API Error');
        const posts = await res.json();

        if (!posts || posts.length === 0) {
            feed.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">No projects shared yet.</p></div>`;
            return;
        }

        feed.innerHTML = posts.map(post => renderPostCard(post)).join('');
    } catch (err) {
        feed.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">Feed could not be loaded at this time.</p></div>`;
    }
}

async function submitPost() {
    const scratchInput = document.getElementById('scratch-input').value;
    const caption = document.getElementById('post-caption').value;
    const msg = document.getElementById('home-msg');

    if (!scratchInput) {
        showMsg(msg, 'Scratch URL or ID is required.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scratchInput, caption })
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('scratch-input').value = '';
            document.getElementById('post-caption').value = '';
            showMsg(msg, 'Project posted!', 'success');
            loadFeed();
        } else {
            showMsg(msg, data.error || 'Failed to post.', 'error');
        }
    } catch (err) {
        showMsg(msg, 'Server error posting project.', 'error');
    }
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
    } catch (err) { console.error('Auth check error:', err); }
}

function renderAuthUI() {
    const container = document.getElementById('auth-container');
    if (!container) return;

    if (currentUser) {
        container.innerHTML = `
            <div class="avatar-wrapper" style="width:36px; height:36px; cursor:pointer;" onclick="switchTab('account')">
                <img src="${currentUser.pfp}">
            </div>
            <button class="btn-outline" style="padding: 6px 12px; font-size: 13px;" onclick="logout()">Logout</button>
        `;
    } else {
        container.innerHTML = `<button class="btn" onclick="openAuthModal()">Log In</button>`;
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
    element.className = `inline-msg ${type}`;
    element.style.display = 'block';
    setTimeout(() => { element.style.display = 'none'; }, 4000);
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    checkAuth();
    loadFeed();
});
