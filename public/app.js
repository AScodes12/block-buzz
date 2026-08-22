let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndInit();
    loadPosts();
    loadContests();
    loadStudios();
    loadStore();
});

// --- AUTH STATE & HEADER ---
async function checkAuthAndInit() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        currentUser = data.user;
        
        const authContainer = document.getElementById('auth-container');
        const createPostCard = document.getElementById('create-post-card');

        if (currentUser) {
            authContainer.innerHTML = `
                <div style="font-size: 13px; font-weight: 600;">🪙 ${currentUser.coins}</div>
                <div class="avatar-wrapper" style="cursor: pointer;" onclick="switchTab('account')">
                    <img src="${currentUser.pfp}" alt="PFP">
                </div>
                <button onclick="handleLogout()" class="btn-outline" style="padding: 6px 12px; font-size: 13px;">Log Out</button>
            `;
            if (createPostCard) createPostCard.style.display = 'block';
        } else {
            authContainer.innerHTML = `
                <a href="login.html" class="btn" style="text-decoration: none; padding: 6px 16px; font-size: 13px; display: inline-block;">Log In</a>
            `;
            if (createPostCard) createPostCard.style.display = 'none';
        }
    } catch (err) {
        console.error("Auth check failed:", err);
    }
}

async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'index.html';
}

// --- TAB NAVIGATION ---
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    const targetSection = document.getElementById(`${tabName}-section`);
    const targetNav = document.getElementById(`nav-${tabName}`);

    if (targetSection) targetSection.style.display = 'block';
    if (targetNav) targetNav.classList.add('active');

    if (tabName === 'account') {
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }
        loadProfile(currentUser.username);
    }
}

function showMsg(elementId, text, isError = true) {
    const msg = document.getElementById(elementId);
    if (!msg) return;
    msg.textContent = text;
    msg.className = `inline-msg ${isError ? 'error' : 'success'}`;
    msg.style.display = 'block';
}

// --- POSTS / HOME FEED ---
async function loadPosts() {
    const feed = document.getElementById('feed');
    try {
        const res = await fetch('/api/posts');
        const posts = await res.json();

        if (!posts.length) {
            feed.innerHTML = `<div class="card" style="text-align: center; color: var(--text-secondary);">No posts yet. Be the first to share!</div>`;
            return;
        }

        feed.innerHTML = posts.map(post => {
            const isLiked = currentUser && post.likes && post.likes.includes(currentUser.username);
            return `
                <div class="card" data-post-id="${post.id}">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; cursor: pointer;" onclick="loadProfile('${post.author}')">
                        <div class="avatar-wrapper"><img src="${post.author_pfp}" alt="${post.author}"></div>
                        <div>
                            <div style="font-weight: 600; font-size: 14px;">${post.author}</div>
                            <div style="font-size: 11px; color: var(--text-secondary);">${new Date(post.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <h3 style="font-size: 16px; margin-bottom: 6px;"><a href="${post.scratch_link}" target="_blank" style="color: var(--accent-color); text-decoration: none;">${post.title}</a></h3>
                    <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px;">${post.caption}</p>
                    <a href="${post.scratch_link}" target="_blank">
                        <img src="${post.thumbnail}" class="project-thumb" alt="Thumbnail" onerror="this.src='https://cdn2.scratch.mit.edu/get_image/project/default_480x360.png'">
                    </a>
                    <div style="display: flex; gap: 16px; align-items: center; margin-top: 12px; font-size: 14px;">
                        <button onclick="likePost('${post.id}')" class="btn-outline" style="padding: 4px 10px; font-size: 13px;">
                            ❤️ ${post.likes ? post.likes.length : 0} ${isLiked ? 'Liked' : 'Like'}
                        </button>
                        <span style="color: var(--text-secondary); font-size: 13px;">👁️ ${post.views ? post.views.length : 0} views</span>
                    </div>
                    <div style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 12px;">
                        <div id="comments-${post.id}" style="font-size: 13px; margin-bottom: 8px;">Loading comments...</div>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="comment-input-${post.id}" placeholder="Write a comment..." style="padding: 8px 12px; font-size: 13px;">
                            <button onclick="addComment('${post.id}')" class="btn" style="padding: 8px 14px; font-size: 13px;">Send</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        posts.forEach(post => {
            loadComments(post.id);
            if (currentUser) recordView(post.id);
        });
    } catch (err) {
        feed.innerHTML = `<div class="card" style="text-align: center; color: #991b1b;">Failed to load feed.</div>`;
    }
}

async function submitPost() {
    if (!currentUser) return window.location.href = 'login.html';
    const scratchInput = document.getElementById('scratch-input').value.trim();
    const caption = document.getElementById('post-caption').value.trim();

    if (!scratchInput) return showMsg('home-msg', 'Please provide a project link or ID.');

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scratchInput, caption })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        document.getElementById('scratch-input').value = '';
        document.getElementById('post-caption').value = '';
        showMsg('home-msg', 'Project posted successfully!', false);
        loadPosts();
    } catch (err) {
        showMsg('home-msg', err.message);
    }
}

async function likePost(postId) {
    if (!currentUser) return window.location.href = 'login.html';
    await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
    loadPosts();
}

async function recordView(postId) {
    await fetch(`/api/posts/${postId}/view`, { method: 'POST' });
}

// --- COMMENTS ---
async function loadComments(postId) {
    const container = document.getElementById(`comments-${postId}`);
    try {
        const res = await fetch(`/api/posts/${postId}/comments`);
        const comments = await res.json();
        if (!comments.length) {
            container.innerHTML = `<span style="color: var(--text-secondary);">No comments yet.</span>`;
            return;
        }
        container.innerHTML = comments.map(c => `
            <div style="margin-bottom: 6px;"><b>${c.author}:</b> ${c.text}</div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<span>Failed to load comments.</span>`;
    }
}

async function addComment(postId) {
    if (!currentUser) return window.location.href = 'login.html';
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if (!text) return;

    await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    input.value = '';
    loadComments(postId);
}

// --- CONTESTS & STUDIOS ---
async function loadContests() {
    const feed = document.getElementById('contests-feed');
    const res = await fetch('/api/contests');
    const contests = await res.json();
    if (!contests.length) {
        feed.innerHTML = `<div class="card" style="text-align: center; color: var(--text-secondary);">No contests active right now.</div>`;
        return;
    }
    feed.innerHTML = contests.map(c => `
        <div class="card">
            <h3><a href="${c.scratch_link}" target="_blank" style="color: var(--accent-color); text-decoration: none;">${c.title}</a></h3>
            <p style="font-size: 14px; color: var(--text-secondary); margin: 8px 0;">${c.description}</p>
            <div style="font-size: 12px; color: var(--text-secondary);">Posted by ${c.author}</div>
        </div>
    `).join('');
}

async function submitContest() {
    if (!currentUser) return window.location.href = 'login.html';
    const scratchLink = document.getElementById('contest-input').value.trim();
    const description = document.getElementById('contest-desc').value.trim();
    if (!scratchLink || !description) return showMsg('contest-msg', 'All fields required.');

    const res = await fetch('/api/contests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Scratch Contest', description, scratchLink })
    });
    if (res.ok) {
        document.getElementById('contest-input').value = '';
        document.getElementById('contest-desc').value = '';
        showMsg('contest-msg', 'Contest advertised!', false);
        loadContests();
    }
}

async function loadStudios() {
    const feed = document.getElementById('studios-feed');
    const res = await fetch('/api/studios');
    const studios = await res.json();
    if (!studios.length) {
        feed.innerHTML = `<div class="card" style="text-align: center; color: var(--text-secondary);">No studios posted yet.</div>`;
        return;
    }
    feed.innerHTML = studios.map(s => `
        <div class="card">
            <h3><a href="${s.scratch_link}" target="_blank" style="color: var(--accent-color); text-decoration: none;">${s.title}</a></h3>
            <p style="font-size: 14px; color: var(--text-secondary); margin: 8px 0;">${s.description}</p>
            <div style="font-size: 12px; color: var(--text-secondary);">Posted by ${s.author}</div>
        </div>
    `).join('');
}

async function submitStudio() {
    if (!currentUser) return window.location.href = 'login.html';
    const title = document.getElementById('studio-title').value.trim();
    const scratchLink = document.getElementById('studio-link').value.trim();
    const description = document.getElementById('studio-desc').value.trim();
    if (!title || !scratchLink) return showMsg('studio-msg', 'Title and link required.');

    const res = await fetch('/api/studios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, scratchLink })
    });
    if (res.ok) {
        document.getElementById('studio-title').value = '';
        document.getElementById('studio-link').value = '';
        document.getElementById('studio-desc').value = '';
        showMsg('studio-msg', 'Studio posted!', false);
        loadStudios();
    }
}

// --- STORE ---
function loadStore() {
    document.getElementById('store-colors').innerHTML = `<p style="font-size:13px; color:var(--text-secondary);">Colors coming soon!</p>`;
    document.getElementById('store-badges').innerHTML = `<p style="font-size:13px; color:var(--text-secondary);">Badges coming soon!</p>`;
}

// --- PROFILE ---
async function loadProfile(username) {
    switchTab('account');
    const container = document.getElementById('account-profile-content');
    try {
        const res = await fetch(`/api/users/${username}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        container.innerHTML = `
            <div class="card" style="text-align: center;">
                <div class="avatar-wrapper" style="width: 80px; height: 80px; margin: 0 auto 12px auto;">
                    <img src="${data.user.pfp}" alt="PFP">
                </div>
                <h2>${data.user.username}</h2>
                <p style="color: var(--text-secondary); font-size: 13px; margin-top: 4px;">🪙 ${data.user.coins} Coins &bull; Badges: ${(data.user.badges || []).join(', ')}</p>
                <div style="margin-top: 12px; font-size: 13px; color: var(--text-secondary);">Referral Code: <b>${data.user.referral_code}</b></div>
            </div>
            <h3 style="margin-bottom: 12px;">Posts by ${data.user.username}</h3>
            <div>
                ${data.posts.map(p => `
                    <div class="card">
                        <h4><a href="${p.scratch_link}" target="_blank" style="color: var(--accent-color); text-decoration: none;">${p.title}</a></h4>
                        <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">${p.caption}</p>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="card" style="color: #991b1b;">User profile not found.</div>`;
    }
}
