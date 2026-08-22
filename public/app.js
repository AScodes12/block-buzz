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
    if (tabName === 'notifications') loadNotifications();
}

// --- AUTH CHECK ---
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        currentUser = data.user;
        renderAuthUI();
        if (currentUser) loadUnreadNotificationCount();
    } catch (err) {
        console.error('Auth error:', err);
    }
}

function renderAuthUI() {
    const container = document.getElementById('auth-container');
    if (!container) return;

    if (currentUser) {
        container.innerHTML = `
            <button class="nav-link" id="nav-notifications" onclick="switchTab('notifications')">
                🔔 <span id="notif-badge" style="background:#ef4444; color:white; border-radius:50%; padding:2px 6px; font-size:11px; display:none;">0</span>
            </button>
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

                            <!-- COMMENTS SECTION -->
                            <div style="margin-top:16px; border-top:1px solid var(--border-color); padding-top:12px;">
                                <h4 style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;">Comments (${comments.length})</h4>
                                <div id="comments-list-${item.id}">
                                    ${comments.map(c => `
                                        <div style="background:#f8fafc; border-radius:8px; padding:8px 12px; margin-bottom:6px; font-size:13px;">
                                            <strong>${escapeHTML(c.author)}:</strong> ${escapeHTML(c.text)}
                                        </div>
                                    `).join('')}
                                </div>
                                
                                <div style="display:flex; gap:8px; margin-top:8px;">
                                    <input type="text" id="reply-input-${item.id}" placeholder="Write a reply..." style="padding:6px 12px; font-size:13px;">
                                    <button class="btn" style="padding:6px 12px; font-size:13px;" onclick="submitReply(${item.id})">Reply</button>
                                </div>
                            </div>
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

async function submitReply(discussionId) {
    if (!currentUser) {
        alert('Please log in to reply.');
        return;
    }

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

// --- CONTESTS FEATURE ---
async function loadContests() {
    const feed = document.getElementById('contests-feed');
    if (!feed) return;

    try {
        const res = await fetch('/api/contests');
        const contests = await res.json();

        if (!contests || contests.length === 0) {
            feed.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">No active contests. Share one above!</p></div>`;
            return;
        }

        feed.innerHTML = contests.map(c => `
            <div class="card">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                    <div class="avatar-wrapper"><img src="${c.author_pfp}"></div>
                    <span style="font-weight:600;">${escapeHTML(c.author)}</span>
                    <span style="font-size:12px; color:var(--text-secondary); margin-left:auto;">${new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <a href="${c.contest_link}" target="_blank" style="text-decoration:none; color:inherit;">
                    <img class="project-thumb" src="${c.thumbnail || 'https://scratch.mit.edu/images/scratch-og.png'}">
                    <h3 style="font-size:16px; color:var(--accent-color);">${escapeHTML(c.title || 'Scratch Contest')}</h3>
                </a>
                <p style="font-size:14px; color:var(--text-secondary); margin-top:6px;">${escapeHTML(c.description)}</p>
            </div>
        `).join('');
    } catch (err) {
        feed.innerHTML = `<div class="card"><p style="color:#991b1b;">Failed to load contests.</p></div>`;
    }
}

async function submitContest() {
    const contestLink = document.getElementById('contest-input').value;
    const description = document.getElementById('contest-desc').value;
    const msg = document.getElementById('contest-msg');

    if (!contestLink || !description) {
        showMsg(msg, 'All fields are required.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/contests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contestLink, description })
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('contest-input').value = '';
            document.getElementById('contest-desc').value = '';
            showMsg(msg, 'Contest posted successfully!', 'success');
            loadContests();
        } else {
            showMsg(msg, data.error || 'Failed to post contest.', 'error');
        }
    } catch (err) {
        showMsg(msg, 'Server error posting contest.', 'error');
    }
}

// --- STUDIOS FEATURE ---
async function loadStudios() {
    const feed = document.getElementById('studios-feed');
    if (!feed) return;

    try {
        const res = await fetch('/api/studios');
        const studios = await res.json();

        if (!studios || studios.length === 0) {
            feed.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">No studios promoted yet. Promote yours above!</p></div>`;
            return;
        }

        feed.innerHTML = studios.map(s => `
            <div class="card">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                    <div class="avatar-wrapper"><img src="${s.author_pfp}"></div>
                    <span style="font-weight:600;">${escapeHTML(s.author)}</span>
                </div>
                <h3 style="font-size:16px; margin-bottom:4px;">
                    <a href="${s.link}" target="_blank" style="color:var(--accent-color); text-decoration:none;">${escapeHTML(s.title)}</a>
                </h3>
                <p style="font-size:14px; color:var(--text-secondary);">${escapeHTML(s.description)}</p>
            </div>
        `).join('');
    } catch (err) {
        feed.innerHTML = `<div class="card"><p style="color:#991b1b;">Failed to load studios.</p></div>`;
    }
}

async function submitStudio() {
    const title = document.getElementById('studio-title').value;
    const link = document.getElementById('studio-link').value;
    const description = document.getElementById('studio-desc').value;
    const msg = document.getElementById('studio-msg');

    if (!title || !link || !description) {
        showMsg(msg, 'All fields are required.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/studios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, link, description })
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('studio-title').value = '';
            document.getElementById('studio-link').value = '';
            document.getElementById('studio-desc').value = '';
            showMsg(msg, 'Studio posted successfully!', 'success');
            loadStudios();
        } else {
            showMsg(msg, data.error || 'Failed to post studio.', 'error');
        }
    } catch (err) {
        showMsg(msg, 'Server error posting studio.', 'error');
    }
}

// --- NOTIFICATIONS FEATURE ---
async function loadUnreadNotificationCount() {
    try {
        const res = await fetch('/api/notifications/unread-count');
        const data = await res.json();
        const badge = document.getElementById('notif-badge');
        if (badge && data.count > 0) {
            badge.textContent = data.count;
            badge.style.display = 'inline-block';
        }
    } catch (err) {
        console.error('Error fetching notifications count:', err);
    }
}

async function loadNotifications() {
    const section = document.getElementById('notifications-section');
    if (!section) return;

    try {
        const res = await fetch('/api/notifications');
        const notifs = await res.json();

        if (!notifs || notifs.length === 0) {
            section.innerHTML = `<div class="card"><p style="color:var(--text-secondary); text-align:center;">No notifications yet.</p></div>`;
            return;
        }

        section.innerHTML = `
            <div class="card">
                <h3>Notifications</h3>
                <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
                    ${notifs.map(n => `
                        <div style="padding:10px 14px; background:${n.read ? '#ffffff' : '#eff6ff'}; border:1px solid var(--border-color); border-radius:8px; font-size:14px;">
                            ${escapeHTML(n.message)}
                            <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">${new Date(n.created_at).toLocaleString()}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (err) {
        section.innerHTML = `<div class="card"><p style="color:#991b1b;">Failed to load notifications.</p></div>`;
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

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadFeed();
});
