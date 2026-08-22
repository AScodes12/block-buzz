let currentUser = null;
let currentDiscussionId = null;
let currentStudioId = null;
let currentDiscussionCategory = 'scratch';

// Initialize application on DOM load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadFeed();
    loadThemePreference();
});

// ==================== THEME MANAGEMENT ====================
function toggleTheme() {
    const body = document.body;
    body.classList.toggle('legacy-theme');
    const isLegacy = body.classList.contains('legacy-theme');
    localStorage.setItem('legacy_theme', isLegacy);
    
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.textContent = isLegacy ? 'Disable Legacy UI' : 'Enable Legacy UI';
    }
}

function loadThemePreference() {
    const isLegacy = localStorage.getItem('legacy_theme') === 'true';
    if (isLegacy) {
        document.body.classList.add('legacy-theme');
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) btn.textContent = 'Disable Legacy UI';
    }
}

// ==================== TAB SWITCHING ====================
function switchTab(tabName) {
    // Hide all tab sections
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    // Show target section and activate nav button if applicable
    if (tabName === 'home') {
        document.getElementById('home-section').style.display = 'block';
        const nav = document.getElementById('nav-home');
        if (nav) nav.classList.add('active');
        loadFeed();
    } else if (tabName === 'discussions') {
        document.getElementById('discussions-section').style.display = 'block';
        const nav = document.getElementById('nav-discussions');
        if (nav) nav.classList.add('active');
        loadDiscussions(currentDiscussionCategory);
    } else if (tabName === 'discussion-detail') {
        document.getElementById('discussion-detail-section').style.display = 'block';
    } else if (tabName === 'store') {
        document.getElementById('store-section').style.display = 'block';
        const nav = document.getElementById('nav-store');
        if (nav) nav.classList.add('active');
    } else if (tabName === 'contests') {
        document.getElementById('contests-section').style.display = 'block';
        const nav = document.getElementById('nav-contests');
        if (nav) nav.classList.add('active');
        loadContests();
    } else if (tabName === 'studios') {
        document.getElementById('studios-section').style.display = 'block';
        const nav = document.getElementById('nav-studios');
        if (nav) nav.classList.add('active');
        loadStudios();
    } else if (tabName === 'studio-detail') {
        document.getElementById('studio-detail-section').style.display = 'block';
    } else if (tabName === 'settings') {
        document.getElementById('settings-section').style.display = 'block';
        const nav = document.getElementById('nav-settings');
        if (nav) nav.classList.add('active');
    }
}

// ==================== AUTHENTICATION ====================
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        currentUser = data.user || null;
        renderAuthNav();
    } catch (err) {
        console.error("Auth check failed:", err);
        currentUser = null;
        renderAuthNav();
    }
}

function renderAuthNav() {
    const container = document.getElementById('auth-container');
    if (!container) return;

    if (currentUser) {
        container.innerHTML = `
            <span class="clickable-user" onclick="viewAccountProfile()">${currentUser.username}</span>
            <button class="btn-outline" onclick="logout()" style="padding: 6px 14px; font-size: 13px;">Logout</button>
        `;
    } else {
        container.innerHTML = `
            <button class="btn-outline" onclick="openAuthModal('login')" style="padding: 6px 14px; font-size: 13px;">Login</button>
            <button class="btn" onclick="openAuthModal('register')" style="padding: 6px 14px; font-size: 13px;">Register</button>
        `;
    }
}

function openAuthModal(mode) {
    const modal = document.getElementById('auth-modal');
    const body = document.getElementById('auth-modal-body');
    if (!modal || !body) return;

    if (mode === 'login') {
        body.innerHTML = `
            <h2 style="font-size: 18px; margin-bottom: 16px;">Login to BlockBuzz</h2>
            <div class="input-group">
                <input type="text" id="auth-username" placeholder="Username">
                <input type="password" id="auth-password" placeholder="Password">
                <button class="btn" onclick="submitLogin()">Login</button>
                <div id="auth-inline-msg" class="inline-msg"></div>
            </div>
            <div class="auth-switch">Don't have an account? <span onclick="openAuthModal('register')">Register</span></div>
        `;
    } else {
        body.innerHTML = `
            <h2 style="font-size: 18px; margin-bottom: 16px;">Create an Account</h2>
            <div class="input-group">
                <input type="text" id="auth-username" placeholder="Username">
                <input type="password" id="auth-password" placeholder="Password">
                <button class="btn" onclick="submitRegister()">Register</button>
                <div id="auth-inline-msg" class="inline-msg"></div>
            </div>
            <div class="auth-switch">Already have an account? <span onclick="openAuthModal('login')">Login</span></div>
        `;
    }
    modal.style.display = 'flex';
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
}

async function submitLogin() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const msg = document.getElementById('auth-inline-msg');

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            closeAuthModal();
            renderAuthNav();
            window.location.reload();
        } else {
            showInlineMsg(msg, data.error || 'Login failed.', 'error');
        }
    } catch (err) {
        showInlineMsg(msg, 'Server error during login.', 'error');
    }
}

async function submitRegister() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const msg = document.getElementById('auth-inline-msg');

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            closeAuthModal();
            renderAuthNav();
            window.location.reload();
        } else {
            showInlineMsg(msg, data.error || 'Registration failed.', 'error');
        }
    } catch (err) {
        showInlineMsg(msg, 'Server error during registration.', 'error');
    }
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        renderAuthNav();
        window.location.reload();
    } catch (err) {
        console.error("Logout failed", err);
    }
}

// ==================== FEED & PROJECTS ====================
async function submitPost() {
    if (!currentUser) {
        openAuthModal('login');
        return;
    }
    const scratchInput = document.getElementById('scratch-input').value.trim();
    const caption = document.getElementById('post-caption').value.trim();
    const msg = document.getElementById('home-msg');

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
            showInlineMsg(msg, 'Project posted successfully!', 'success');
            loadFeed();
        } else {
            showInlineMsg(msg, data.error || 'Failed to post project.', 'error');
        }
    } catch (err) {
        showInlineMsg(msg, 'Server error posting project.', 'error');
    }
}

async function loadFeed() {
    const feed = document.getElementById('feed');
    if (!feed) return;

    try {
        const res = await fetch('/api/posts');
        const posts = await res.json();

        if (!posts || posts.length === 0) {
            feed.innerHTML = '<div class="card" style="color:var(--text-secondary);">No projects shared yet. Be the first!</div>';
            return;
        }

        feed.innerHTML = posts.map(p => `
            <div class="card">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <div class="avatar-wrapper"><img src="${p.avatar || 'https://via.placeholder.com/40'}" alt="avatar"></div>
                    <div>
                        <span class="clickable-user" onclick="viewUserProfile('${p.author}')">${p.author}</span>
                        <div style="font-size: 12px; color: var(--text-secondary);">${new Date(p.created_at).toLocaleDateString()}</div>
                    </div>
                </div>
                <p style="font-size: 14px; margin-bottom: 8px;">${p.caption || ''}</p>
                ${p.thumbnail ? `<img class="project-thumb" src="${p.thumbnail}" alt="Project Thumbnail">` : ''}
                <div class="post-stats">
                    <button class="stat-btn" onclick="likePost(${p.id})">❤️ ${p.likes || 0}</button>
                    <span>💬 ${p.comments_count || 0} Comments</span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Failed to load feed:", err);
    }
}

async function likePost(postId) {
    if (!currentUser) { openAuthModal('login'); return; }
    try {
        await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
        loadFeed();
    } catch (err) {
        console.error("Failed to like post", err);
    }
}

// ==================== DISCUSSIONS & REPLIES ====================
async function submitDiscussion() {
    if (!currentUser) { openAuthModal('login'); return; }
    const title = document.getElementById('discussion-title').value.trim();
    const category = document.getElementById('discussion-category').value;
    const content = document.getElementById('discussion-content').value.trim();
    const msg = document.getElementById('discussion-msg');

    try {
        const res = await fetch('/api/discussions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category, content })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('discussion-title').value = '';
            document.getElementById('discussion-content').value = '';
            showInlineMsg(msg, 'Discussion posted successfully!', 'success');
            loadDiscussions(category);
        } else {
            showInlineMsg(msg, data.error || 'Failed to post discussion.', 'error');
        }
    } catch (err) {
        showInlineMsg(msg, 'Server error posting discussion.', 'error');
    }
}

function switchDiscussionCategory(category) {
    currentDiscussionCategory = category;
    document.querySelectorAll('.disc-tab-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`disc-tab-${category}`);
    if (btn) btn.classList.add('active');
    loadDiscussions(category);
}

async function loadDiscussions(category = 'scratch') {
    const feed = document.getElementById('discussions-feed');
    if (!feed) return;

    try {
        const res = await fetch(`/api/discussions?category=${category}`);
        const discussions = await res.json();

        if (!discussions || discussions.length === 0) {
            feed.innerHTML = '<div class="card" style="color:var(--text-secondary);">No discussions found in this category.</div>';
            return;
        }

        feed.innerHTML = discussions.map(d => `
            <div class="card" style="cursor: pointer;" onclick="openDiscussion(${d.id})">
                <h3 style="font-size: 16px; margin-bottom: 4px;">${d.title}</h3>
                <p style="font-size: 13px; color: var(--text-secondary);">By ${d.author} • ${new Date(d.created_at).toLocaleDateString()}</p>
            </div>
        `).join('');
    } catch (err) {
        console.error("Failed to load discussions:", err);
    }
}

async function openDiscussion(id) {
    currentDiscussionId = id;
    try {
        const res = await fetch('/api/discussions');
        const discussions = await res.json();
        const disc = discussions.find(d => d.id == id);
        if (!disc) return;

        const detailContainer = document.getElementById('discussion-detail-content');
        detailContainer.innerHTML = `
            <div class="card">
                <button class="btn-outline" onclick="switchTab('discussions')" style="margin-bottom: 12px;">← Back to Discussions</button>
                <h2 style="font-size: 20px; margin-bottom: 8px;">${disc.title}</h2>
                <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">Posted by <strong>${disc.author}</strong></p>
                <p style="font-size: 14px; white-space: pre-wrap; margin-bottom: 16px;">${disc.content}</p>
                
                <div class="comments-section">
                    <h4 style="font-size: 14px; margin-bottom: 8px;">Responses</h4>
                    <div id="discussion-comments-list">Loading responses...</div>
                    
                    <div class="input-group" style="margin-top: 12px;">
                        <textarea id="discussion-reply-text" placeholder="Write a response..."></textarea>
                        <div style="text-align: right;">
                            <button class="btn" onclick="submitDiscussionReply()">Post Reply</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        switchTab('discussion-detail');
        loadDiscussionComments(id);
    } catch (err) {
        console.error("Error opening discussion:", err);
    }
}

async function loadDiscussionComments(id) {
    const list = document.getElementById('discussion-comments-list');
    if (!list) return;

    try {
        const res = await fetch(`/api/discussions/${id}/comments`);
        const comments = await res.json();

        if (!comments || comments.length === 0) {
            list.innerHTML = '<p style="font-size: 13px; color: var(--text-secondary);">No responses yet. Be the first!</p>';
            return;
        }

        list.innerHTML = comments.map(c => `
            <div class="comment-item">
                <strong>${c.author}:</strong> ${c.text}
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = '<p style="font-size: 13px; color: #c5221f;">Failed to load responses.</p>';
    }
}

async function submitDiscussionReply() {
    if (!currentUser) { openAuthModal('login'); return; }
    if (!currentDiscussionId) return;

    const textarea = document.getElementById('discussion-reply-text');
    const text = textarea.value.trim();
    if (!text) return;

    try {
        const res = await fetch(`/api/discussions/${currentDiscussionId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await res.json();
        if (data.success) {
            textarea.value = '';
            loadDiscussionComments(currentDiscussionId);
        } else {
            alert(data.error || 'Failed to post reply.');
        }
    } catch (err) {
        alert('Server error posting reply.');
    }
}

// ==================== CONTESTS ====================
async function submitContest() {
    if (!currentUser) { openAuthModal('login'); return; }
    const title = document.getElementById('contest-title').value.trim();
    const description = document.getElementById('contest-desc').value.trim();
    const msg = document.getElementById('contest-msg');

    try {
        const res = await fetch('/api/contests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('contest-title').value = '';
            document.getElementById('contest-desc').value = '';
            showInlineMsg(msg, 'Contest published!', 'success');
            loadContests();
        } else {
            showInlineMsg(msg, data.error || 'Failed to publish contest.', 'error');
        }
    } catch (err) {
        showInlineMsg(msg, 'Server error.', 'error');
    }
}

async function loadContests() {
    const feed = document.getElementById('contests-feed');
    if (!feed) return;
    try {
        const res = await fetch('/api/contests');
        const contests = await res.json();
        if (!contests || contests.length === 0) {
            feed.innerHTML = '<div class="card" style="color:var(--text-secondary);">No active contests.</div>';
            return;
        }
        feed.innerHTML = contests.map(c => `
            <div class="card">
                <h3 style="font-size: 16px; margin-bottom: 4px;">${c.title}</h3>
                <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Organized by ${c.author}</p>
                <p style="font-size: 14px;">${c.description}</p>
            </div>
        `).join('');
    } catch (err) {
        console.error("Failed to load contests", err);
    }
}

// ==================== STUDIOS ====================
async function submitStudio() {
    if (!currentUser) { openAuthModal('login'); return; }
    const title = document.getElementById('studio-title').value.trim();
    const description = document.getElementById('studio-desc').value.trim();
    const msg = document.getElementById('studio-msg');

    try {
        const res = await fetch('/api/studios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('studio-title').value = '';
            document.getElementById('studio-desc').value = '';
            showInlineMsg(msg, 'Studio created!', 'success');
            loadStudios();
        } else {
            showInlineMsg(msg, data.error || 'Failed to create studio.', 'error');
        }
    } catch (err) {
        showInlineMsg(msg, 'Server error.', 'error');
    }
}

async function loadStudios() {
    const feed = document.getElementById('studios-feed');
    if (!feed) return;
    try {
        const res = await fetch('/api/studios');
        const studios = await res.json();
        if (!studios || studios.length === 0) {
            feed.innerHTML = '<div class="card" style="color:var(--text-secondary);">No studios available.</div>';
            return;
        }
        feed.innerHTML = studios.map(s => `
            <div class="card" style="cursor: pointer;" onclick="openStudio(${s.id})">
                <h3 style="font-size: 16px; margin-bottom: 4px;">${s.title}</h3>
                <p style="font-size: 13px; color: var(--text-secondary);">Owner: ${s.author}</p>
            </div>
        `).join('');
    } catch (err) {
        console.error("Failed to load studios", err);
    }
}

async function openStudio(id) {
    currentStudioId = id;
    try {
        const res = await fetch('/api/studios');
        const studios = await res.json();
        const studio = studios.find(s => s.id == id);
        if (!studio) return;

        const content = document.getElementById('studio-detail-content');
        content.innerHTML = `
            <div class="card">
                <button class="btn-outline" onclick="switchTab('studios')" style="margin-bottom: 12px;">← Back to Studios</button>
                <h2 style="font-size: 20px; margin-bottom: 8px;">${studio.title}</h2>
                <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">Owner: ${studio.author}</p>
                <p style="font-size: 14px;">${studio.description}</p>
            </div>
        `;
        switchTab('studio-detail');
    } catch (err) {
        console.error("Error opening studio", err);
    }
}

// ==================== PROFILES ====================
function viewAccountProfile() {
    const content = document.getElementById('account-profile-content');
    if (!content || !currentUser) return;
    content.innerHTML = `
        <div class="card">
            <h2 style="font-size: 20px; margin-bottom: 8px;">My Account Profile</h2>
            <p style="font-size: 14px;">Username: <strong>${currentUser.username}</strong></p>
        </div>
    `;
    switchTab('account');
}

async function viewUserProfile(username) {
    const content = document.getElementById('user-profile-content');
    if (!content) return;
    content.innerHTML = `
        <div class="card">
            <button class="btn-outline" onclick="switchTab('home')" style="margin-bottom: 12px;">← Back to Feed</button>
            <h2 style="font-size: 20px; margin-bottom: 8px;">User Profile: ${username}</h2>
        </div>
    `;
    switchTab('user-profile');
}

// ==================== HELPER UTILS ====================
function showInlineMsg(element, text, type) {
    if (!element) return;
    element.textContent = text;
    element.className = `inline-msg ${type}`;
    element.style.display = 'block';
    setTimeout(() => {
        element.style.display = 'none';
    }, 4000);
}
