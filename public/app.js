let currentUser = null;
let currentDiscussionCategory = 'scratch';
let currentVerificationCode = '';

// --- THEME MANAGEMENT ---
function loadTheme() {
    const isLegacy = localStorage.getItem('blockbuzz_legacy_theme') === 'true';
    if (isLegacy) {
        document.body.classList.add('legacy-theme');
    } else {
        document.body.classList.remove('legacy-theme');
    }
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
    if (!btn) return;
    const isLegacy = document.body.classList.contains('legacy-theme');
    btn.textContent = isLegacy ? 'Disable Legacy UI' : 'Enable Legacy UI';
}

// --- AUTH MODAL & CONTROLS ---
function openAuthModal() {
    document.getElementById('auth-modal').style.display = 'flex';
}

function closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
}

function toggleAuthForm(type) {
    const loginForm = document.getElementById('login-form-container');
    const signupForm = document.getElementById('signup-form-container');

    if (type === 'signup') {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    } else {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    }
}

async function submitLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const msg = document.getElementById('login-msg');

    if (!username || !password) {
        showMsg(msg, 'Please enter username and password.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success) {
            currentUser = data.user;
            renderAuthUI();
            closeAuthModal();
            loadFeed();
        } else {
            showMsg(msg, data.error || 'Invalid credentials.', 'error');
        }
    } catch (err) {
        showMsg(msg, 'Server error logging in.', 'error');
    }
}

async function startSignupVerification() {
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const msg = document.getElementById('signup-msg-1');

    if (!username || !password) {
        showMsg(msg, 'Username and password are required.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/start-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();

        if (data.success) {
            currentVerificationCode = data.code;
            document.getElementById('verification-code-display').textContent = data.code;
            document.getElementById('signup-step-1').style.display = 'none';
            document.getElementById('signup-step-2').style.display = 'block';
        } else {
            showMsg(msg, data.error || 'Failed to generate verification code.', 'error');
        }
    } catch (err) {
        showMsg(msg, 'Server error initiating verification.', 'error');
    }
}

async function confirmSignupVerification() {
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const msg = document.getElementById('signup-msg-2');

    try {
        const res = await fetch('/api/auth/confirm-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, code: currentVerificationCode })
        });
        const data = await res.json();

        if (data.success) {
            currentUser = data.user;
            renderAuthUI();
            closeAuthModal();
            resetSignupForm();
            loadFeed();
        } else {
            showMsg(msg, data.error || 'Verification comment not found yet. Try again in a moment!', 'error');
        }
    } catch (err) {
        showMsg(msg, 'Server error creating account.', 'error');
    }
}

function resetSignupForm() {
    document.getElementById('signup-step-1').style.display = 'block';
    document.getElementById('signup-step-2').style.display = 'none';
    document.getElementById('signup-username').value = '';
    document.getElementById('signup-password').value = '';
    currentVerificationCode = '';
}

// --- NAVIGATION ---
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    const section = document.getElementById(`${tabName}-section`);
    const navBtn = document.getElementById(`nav-${tabName}`);

    if (section) section.style.display = 'block';
    if (navBtn) navBtn.classList.add('active');

    if (tabName === 'home') loadFeed();
    if (tabName === 'discussions') loadDiscussions(currentDiscussionCategory);
    if (tabName === 'contests') loadContests();
    if (tabName === 'studios') loadStudios();
    if (tabName === 'notifications') loadNotifications();
    if (tabName === 'account') loadAccountProfile();
}

// --- PUBLIC USER PROFILES ---
async function viewUserProfile(username) {
    switchTab('user-profile');
    const profileContainer = document.getElementById('user-profile-content');
    profileContainer.innerHTML = `<div class="card"><p style="text-align:center;">Loading ${escapeHTML(username)}'s profile...</p></div>`;

    try {
        const res = await fetch(`/api/users/${username}`);
        if (!res.ok) throw new Error('User not found');
        const user = await res.json();

        profileContainer.innerHTML = `
            <div class="card" style="display:flex; align-items:center; gap:20px;">
                <div class="avatar-wrapper" style="width:80px; height:80px;">
                    <img src="${user.pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png'}">
                </div>
                <div>
                    <h2 style="font-size: 1.5rem; color:${user.color || 'var(--text-primary)'}">${escapeHTML(user.username)}</h2>
                    <p style="color:var(--text-secondary); font-size: 15px; margin-top:4px;">Coins: ${user.coins || 0}</p>
                </div>
            </div>
            <h3 style="margin: 24px 0 16px 0;">Recent Posts</h3>
            <div id="public-user-posts">
                <p style="color:var(--text-secondary);">Posts will appear here...</p>
            </div>
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

// --- AUTH CHECK & UI ---
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        currentUser = data.user;
        renderAuthUI();
        if (currentUser) loadUnreadNotificationCount();
    } catch (err) {
        console.error('Auth check error:', err);
    }
}

function renderAuthUI() {
    const container = document.getElementById('auth-container');
    if (!container) return;

    if (currentUser) {
        container.innerHTML = `
            <button class="nav-link" id="nav-notifications" onclick="switchTab('notifications')" style="position:relative; display:flex; align-items:center; gap:6px;">
                Alerts
                <span id="notif-badge" class="badge">0</span>
            </button>
            <div class="avatar-wrapper" style="width:36px; height:36px; cursor:pointer;" onclick="switchTab('account')">
                <img src="${currentUser.pfp}">
            </div>
            <button class="btn-outline" style="padding: 8px 16px; font-size: 13px;" onclick="logout()">Logout</button>
        `;
    } else {
        container.innerHTML = `<button class="btn" onclick="openAuthModal()">Log In / Sign Up</button>`;
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    renderAuthUI();
    loadFeed();
}

// --- ACCOUNT / PROFILE ---
async function loadAccountProfile() {
    const profileContainer = document.getElementById('account-profile-content');
    if (!profileContainer) return;

    if (!currentUser) {
        profileContainer.innerHTML = `
            <div class="card" style="text-align: center;">
                <h3 style="margin-bottom:12px;">You are not logged in</h3>
                <p style="color:var(--text-secondary); margin-bottom: 24px;">Log in or create an account to view your profile.</p>
                <button class="btn" onclick="openAuthModal()">Log In / Sign Up</button>
            </div>
        `;
        return;
    }

    profileContainer.innerHTML = `
        <div class="card">
            <div style="display: flex; align-items: center; gap: 20px;">
                <div class="avatar-wrapper" style="width:80px; height:80px;">
                    <img src="${currentUser.pfp}">
                </div>
                <div>
                    <h2 style="font-size: 1.5rem; color:${currentUser.color || 'var(--text-primary)'}">${escapeHTML(currentUser.username)}</h2>
                    <p style="color:var(--text-secondary); font-size: 15px; margin-top:4px;">Coins: ${currentUser.coins || 0}</p>
                </div>
            </div>
        </div>

        <div class="card">
            <h3 style="margin-bottom: 8px;">Your Cosmetics & Settings</h3>
            <p style="color:var(--text-secondary); font-size: 14px; margin-bottom: 20px;">Equipped Color: <strong style="color:${currentUser.color || 'inherit'}">${currentUser.color || 'Default'}</strong></p>
            <div style="display:flex; gap:16px;">
                <button class="btn" onclick="switchTab('store')">Visit Store</button>
                <a href="reset.html" class="btn-outline">Reset Password</a>
            </div>
        </div>
    `;
}

// --- DISCUSSIONS & REPLIES ---
function switchDiscussionCategory(category) {
    currentDiscussionCategory = category;
    document.querySelectorAll('.disc-tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`disc-tab-${category}`);
    if (activeBtn) activeBtn.classList.add('active');
    loadDiscussions(category);
}

async function loadDiscussions(category) {
    const feed = document.getElementById('discussions-feed');
    if (!feed) return;

    try {
        const res = await fetch(`/api/discussions?category=${category}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const discussions = await res.json();

        if (!discussions || discussions.length === 0) {
            feed.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">No discussions here yet. Start one above!</p></div>`;
            return;
        }

        feed.innerHTML = discussions.map(item => {
            const upvotes = item.upvotes || [];
            const isUpvoted = currentUser && upvotes.includes(currentUser.username);
            const comments = item.comments || [];
            
            return `
                <div class="card">
                    <div class="discussion-card">
                        <div class="upvote-container">
                            <button class="upvote-btn ${isUpvoted ? 'upvoted' : ''}" onclick="toggleUpvote(${item.id})">^</button>
                            <span class="upvote-count">${upvotes.length}</span>
                        </div>
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                                <div class="avatar-wrapper" style="width:28px; height:28px; cursor:pointer;" onclick="viewUserProfile('${escapeHTML(item.author)}')">
                                    <img src="${item.author_pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png'}">
                                </div>
                                <span class="clickable-user" onclick="viewUserProfile('${escapeHTML(item.author)}')">${escapeHTML(item.author)}</span>
                                <span style="font-size:13px; color:var(--text-secondary); margin-left:auto;">${new Date(item.created_at).toLocaleDateString()}</span>
                            </div>
                            <h3 style="font-size: 1.1rem; margin-bottom: 8px; color:var(--text-primary);">${escapeHTML(item.title)}</h3>
                            <p style="font-size: 15px; color:var(--text-secondary); white-space: pre-wrap; line-height: 1.6;">${escapeHTML(item.content)}</p>

                            <div style="margin-top:20px; border-top:1px solid var(--border-color); padding-top:16px;">
                                <h4 style="font-size:14px; color:var(--text-secondary); margin-bottom:12px;">Comments (${comments.length})</h4>
                                <div id="comments-list-${item.id}">
                                    ${comments.map(c => `
                                        <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:12px 16px; margin-bottom:8px; font-size:14px;">
                                            <strong class="clickable-user" onclick="viewUserProfile('${escapeHTML(c.author)}')">${escapeHTML(c.author)}:</strong> 
                                            <span style="color:var(--text-secondary);">${escapeHTML(c.text)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                                
                                <div style="display:flex; gap:12px; margin-top:12px;">
                                    <input type="text" id="reply-input-${item.id}" placeholder="Write a reply..." style="padding:10px 16px; font-size:14px;">
                                    <button class="btn" style="padding:10px 20px; font-size:14px;" onclick="submitReply(${item.id})">Reply</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        feed.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">Feed could not be loaded at this time.</p></div>`;
    }
}

async function submitDiscussion() {
    const title = document.getElementById('discussion-title').value;
    const category = document.getElementById('discussion-category').value;
    const content = document.getElementById('discussion-content').value;
    const msg = document.getElementById('discussion-msg');

    if (!title || !content) {
        showMsg(msg, 'Title and content are required.', 'error');
        return;
    }

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
            showMsg(msg, 'Discussion posted successfully!', 'success');
            switchDiscussionCategory(category);
        } else {
            showMsg(msg, data.error || 'Failed to post discussion.', 'error');
        }
    } catch (err) {
        showMsg(msg, 'Server error posting discussion.', 'error');
    }
}

async function submitReply(discussionId) {
    if (!currentUser) return alert('Please log in to reply.');
    const input = document.getElementById(`reply-input-${discussionId}`);
    const text = input ? input.value : '';
    if (!text.trim()) return;

    try {
        const res = await fetch(`/api/discussions/${discussionId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await res.json();
        if (data.success) {
            input.value = '';
            loadDiscussions(currentDiscussionCategory);
        } else {
            alert(data.error || 'Failed to reply.');
        }
    } catch (err) {
        console.error('Error submitting reply:', err);
    }
}

async function toggleUpvote(id) {
    if (!currentUser) return alert('Please log in to upvote.');
    try {
        const res = await fetch(`/api/discussions/${id}/upvote`, { method: 'POST' });
        const data = await res.json();
        if (data.success) loadDiscussions(currentDiscussionCategory);
    } catch (err) {
        console.error('Upvote failed:', err);
    }
}

// --- CONTESTS & STUDIOS ---
async function loadContests() {
    const feed = document.getElementById('contests-feed');
    if (!feed) return;
    try {
        const res = await fetch('/api/contests');
        if (!res.ok) throw new Error('API Error');
        const contests = await res.json();

        if (!contests || contests.length === 0) {
            feed.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">No active contests. Share one above!</p></div>`;
            return;
        }

        feed.innerHTML = contests.map(c => `
            <div class="card">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                    <div class="avatar-wrapper" style="cursor:pointer;" onclick="viewUserProfile('${escapeHTML(c.author)}')"><img src="${c.author_pfp}"></div>
                    <span class="clickable-user" onclick="viewUserProfile('${escapeHTML(c.author)}')">${escapeHTML(c.author)}</span>
                    <span style="font-size:13px; color:var(--text-secondary); margin-left:auto;">${new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <a href="${c.contest_link}" target="_blank" style="text-decoration:none; color:inherit;">
                    <img class="project-thumb" src="${c.thumbnail || 'https://scratch.mit.edu/images/scratch-og.png'}">
                    <h3 style="font-size:1.1rem; color:var(--accent-color); margin-top:8px;">${escapeHTML(c.title || 'Scratch Contest')}</h3>
                </a>
                <p style="font-size:15px; color:var(--text-secondary); margin-top:8px;">${escapeHTML(c.description)}</p>
            </div>
        `).join('');
    } catch (err) {
        feed.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">Could not load contests at this time.</p></div>`;
    }
}

async function loadStudios() {
    const feed = document.getElementById('studios-feed');
    if (!feed) return;
    try {
        const res = await fetch('/api/studios');
        if (!res.ok) throw new Error('API Error');
        const studios = await res.json();

        if (!studios || studios.length === 0) {
            feed.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">No studios promoted yet.</p></div>`;
            return;
        }

        feed.innerHTML = studios.map(s => `
            <div class="card">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                    <div class="avatar-wrapper" style="cursor:pointer;" onclick="viewUserProfile('${escapeHTML(s.author)}')"><img src="${s.author_pfp}"></div>
                    <span class="clickable-user" onclick="viewUserProfile('${escapeHTML(s.author)}')">${escapeHTML(s.author)}</span>
                </div>
                <h3 style="font-size:1.1rem; margin-bottom:8px;">
                    <a href="${s.link}" target="_blank" style="color:var(--accent-color); text-decoration:none;">${escapeHTML(s.title)}</a>
                </h3>
                <p style="font-size:15px; color:var(--text-secondary);">${escapeHTML(s.description)}</p>
            </div>
        `).join('');
    } catch (err) {
        feed.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">Could not load studios at this time.</p></div>`;
    }
}

// --- NOTIFICATIONS (WITH ERROR HANDLING FIX) ---
async function loadUnreadNotificationCount() {
    try {
        const res = await fetch('/api/notifications/unread-count');
        if (!res.ok) return; 
        const data = await res.json();
        const badge = document.getElementById('notif-badge');
        if (badge && data.count > 0) {
            badge.textContent = data.count;
            badge.style.display = 'inline-block';
        } else if (badge) {
            badge.style.display = 'none';
        }
    } catch (err) {
        console.error('Silent error fetching notifications count:', err);
    }
}

async function loadNotifications() {
    const section = document.getElementById('notifications-section');
    if (!section) return;

    try {
        const res = await fetch('/api/notifications');
        
        // Fix: Properly handle missing backend routes gracefully instead of breaking
        if (!res.ok) throw new Error(`Status ${res.status}`);
        
        const notifs = await res.json();

        if (!notifs || notifs.length === 0) {
            section.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">You have no notifications yet.</p></div>`;
            return;
        }

        section.innerHTML = `
            <div class="card">
                <h3 style="margin-bottom:16px;">Your Alerts</h3>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    ${notifs.map(n => `
                        <div style="padding:16px; background:${n.read ? 'transparent' : '#f8fafc'}; border:1px solid var(--border-color); border-radius:var(--radius-md); font-size:15px;">
                            ${escapeHTML(n.message)}
                            <div style="font-size:13px; color:var(--text-secondary); margin-top:6px;">${new Date(n.created_at).toLocaleString()}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (err) {
        // Fix: Render a clean fallback card instead of just a raw error message
        section.innerHTML = `
            <div class="card">
                <h3 style="margin-bottom:8px;">Notifications</h3>
                <p style="color:var(--text-secondary); text-align:center; padding: 24px 0;">No notifications found or service unavailable.</p>
            </div>
        `;
    }
}

// --- POSTS FEED ---
async function loadFeed() {
    const feed = document.getElementById('feed');
    if (!feed) return;

    try {
        const res = await fetch('/api/posts');
        if (!res.ok) throw new Error('API Error');
        const posts = await res.json();

        if (!posts || posts.length === 0) {
            feed.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">No projects shared yet.</p></div>`;
            return;
        }

        feed.innerHTML = posts.map(post => `
            <div class="card">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <div class="avatar-wrapper" style="cursor:pointer;" onclick="viewUserProfile('${escapeHTML(post.author)}')"><img src="${post.author_pfp}"></div>
                    <span class="clickable-user" onclick="viewUserProfile('${escapeHTML(post.author)}')">${escapeHTML(post.author)}</span>
                </div>
                <a href="${post.scratch_link}" target="_blank" style="text-decoration:none; color:inherit;">
                    <img class="project-thumb" src="${post.thumbnail}">
                    <h3 style="font-size:1.1rem; color:var(--accent-color); margin-top:8px;">${escapeHTML(post.title)}</h3>
                </a>
                <p style="font-size:15px; color:var(--text-secondary); margin-top:8px;">${escapeHTML(post.caption || '')}</p>
            </div>
        `).join('');
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

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    checkAuth();
    loadFeed();
});
