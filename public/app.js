let currentUser = null;
let currentDiscussionCategory = 'scratch';

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
}

// --- AUTH CHECK ---
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        currentUser = data.user;
        renderAuthUI();
    } catch (err) {
        console.error('Auth error:', err);
    }
}

function renderAuthUI() {
    const container = document.getElementById('auth-container');
    if (!container) return;

    if (currentUser) {
        container.innerHTML = `
            <div class="avatar-wrapper"><img src="${currentUser.pfp}"></div>
            <span style="font-weight: 600; font-size: 14px;">${escapeHTML(currentUser.username)}</span>
            <button class="btn-outline" onclick="logout()">Logout</button>
        `;
    } else {
        container.innerHTML = `
            <button class="btn" onclick="alert('Please register/login using the API endpoint')">Log In / Sign Up</button>
        `;
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    renderAuthUI();
    loadFeed();
}

// --- DISCUSSIONS FEATURE ---
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
        const discussions = await res.json();

        if (!discussions || discussions.length === 0) {
            feed.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">No discussions here yet. Start one above!</p></div>`;
            return;
        }

        feed.innerHTML = discussions.map(item => {
            const upvotes = item.upvotes || [];
            const isUpvoted = currentUser && upvotes.includes(currentUser.username);
            
            return `
                <div class="card">
                    <div class="discussion-card">
                        <div class="upvote-container">
                            <button class="upvote-btn ${isUpvoted ? 'upvoted' : ''}" onclick="toggleUpvote(${item.id})">▲</button>
                            <span class="upvote-count">${upvotes.length}</span>
                        </div>
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                <div class="avatar-wrapper" style="width:24px; height:24px;">
                                    <img src="${item.author_pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png'}">
                                </div>
                                <span style="font-weight:600; font-size:13px;">${escapeHTML(item.author)}</span>
                                <span style="font-size:12px; color:var(--text-secondary); margin-left:auto;">${new Date(item.created_at).toLocaleDateString()}</span>
                            </div>
                            <h3 style="font-size: 16px; margin-bottom: 6px; color:var(--text-primary);">${escapeHTML(item.title)}</h3>
                            <p style="font-size: 14px; color:var(--text-secondary); white-space: pre-wrap;">${escapeHTML(item.content)}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        feed.innerHTML = `<div class="card"><p style="color:#991b1b;">Failed to load discussions.</p></div>`;
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

async function toggleUpvote(id) {
    if (!currentUser) {
        alert('Please log in to upvote.');
        return;
    }

    try {
        const res = await fetch(`/api/discussions/${id}/upvote`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            loadDiscussions(currentDiscussionCategory);
        }
    } catch (err) {
        console.error('Upvote failed:', err);
    }
}

// --- POSTS FEED ---
async function loadFeed() {
    const feed = document.getElementById('feed');
    if (!feed) return;

    try {
        const res = await fetch('/api/posts');
        const posts = await res.json();

        if (!posts || posts.length === 0) {
            feed.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">No projects shared yet.</p></div>`;
            return;
        }

        feed.innerHTML = posts.map(post => `
            <div class="card">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <div class="avatar-wrapper"><img src="${post.author_pfp}"></div>
                    <span style="font-weight:600;">${escapeHTML(post.author)}</span>
                </div>
                <a href="${post.scratch_link}" target="_blank" style="text-decoration:none; color:inherit;">
                    <img class="project-thumb" src="${post.thumbnail}">
                    <h3 style="font-size:16px; color:var(--accent-color);">${escapeHTML(post.title)}</h3>
                </a>
                <p style="font-size:14px; color:var(--text-secondary); margin-top:6px;">${escapeHTML(post.caption || '')}</p>
            </div>
        `).join('');
    } catch (err) {
        feed.innerHTML = `<div class="card"><p style="color:#991b1b;">Failed to load feed.</p></div>`;
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

// Placeholders for Contests/Studios
function loadContests() {}
function loadStudios() {}
function submitContest() {}
function submitStudio() {}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadFeed();
});
