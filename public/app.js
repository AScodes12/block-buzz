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

function renderPostCard(post) {
    const postId = post.id || Math.random().toString(36).substr(2, 9);
    const views = post.views || 142;
    const likes = post.likes || 12;
    const comments = post.comments || [];

    return `
        <div class="card" id="post-${postId}">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div class="avatar-wrapper" style="cursor:pointer;" onclick="viewUserProfile('${escapeHTML(post.author || 'ScratchCat')}')"><img src="${post.author_pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png'}"></div>
                <span class="clickable-user" onclick="viewUserProfile('${escapeHTML(post.author || 'ScratchCat')}')">${escapeHTML(post.author || 'ScratchCat')}</span>
            </div>
            <a href="${post.scratch_link || '#'}" target="_blank" style="text-decoration:none; color:inherit;">
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

function toggleLike(postId) {
    const countSpan = document.getElementById(`like-count-${postId}`);
    if (countSpan) {
        let currentLikes = parseInt(countSpan.textContent, 10);
        countSpan.textContent = currentLikes + 1;
    }
}

function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (section) section.classList.toggle('open');
}

function addComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const list = document.getElementById(`comments-list-${postId}`);
    if (!input || !input.value.trim()) return;

    const username = currentUser ? currentUser.username : 'Guest';
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment-item';
    commentDiv.innerHTML = `<b>${escapeHTML(username)}:</b> ${escapeHTML(input.value)}`.trim();
    
    list.appendChild(commentDiv);
    input.value = '';
}

async function loadFeed() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    feed.innerHTML = renderPostCard({
        id: 'demo-1',
        author: 'ScratchCat',
        title: 'Platformer Engine v3',
        caption: 'Check out my new smooth movement engine!',
        views: 328,
        likes: 45,
        comments: [{ author: 'Coder123', text: 'This engine is super smooth, thanks for sharing!' }]
    });
}

async function submitPost() {
    const scratchInput = document.getElementById('scratch-input').value;
    const caption = document.getElementById('post-caption').value;
    const msg = document.getElementById('home-msg');
    if (!scratchInput) return showMsg(msg, 'Project URL is required.', 'error');

    const feed = document.getElementById('feed');
    const newCardHTML = renderPostCard({
        id: Math.random().toString(36).substr(2, 9),
        author: currentUser ? currentUser.username : 'You',
        title: 'New Scratch Project',
        caption: caption,
        views: 1,
        likes: 0,
        comments: []
    });
    feed.insertAdjacentHTML('afterbegin', newCardHTML);
    document.getElementById('scratch-input').value = '';
    document.getElementById('post-caption').value = '';
    showMsg(msg, 'Project posted successfully!', 'success');
}

// Discussions
function switchDiscussionCategory(category) {
    currentDiscussionCategory = category;
    document.querySelectorAll('.disc-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`disc-tab-${category}`).classList.add('active');
    loadDiscussions(category);
}

function loadDiscussions(category) {
    const feed = document.getElementById('discussions-feed');
    feed.innerHTML = `
        <div class="card">
            <h3 style="font-size:16px; margin-bottom:4px;">Welcome to ${category === 'scratch' ? 'Scratch Topics' : 'BlockBuzz Feedback'}</h3>
            <p style="font-size:14px; color:var(--text-secondary);">Start a conversation above or share your thoughts with the community.</p>
        </div>
    `;
}

function submitDiscussion() {
    showMsg(document.getElementById('discussion-msg'), 'Discussion posted successfully!', 'success');
    document.getElementById('discussion-title').value = '';
    document.getElementById('discussion-content').value = '';
}

// Contests & Studios
function loadContests() {
    document.getElementById('contests-feed').innerHTML = `<div class="card"><p style="text-align:center; color:var(--text-secondary);">No active contests right now.</p></div>`;
}
function loadStudios() {
    document.getElementById('studios-feed').innerHTML = `<div class="card"><p style="text-align:center; color:var(--text-secondary);">No featured studios right now.</p></div>`;
}
function submitContest() { showMsg(document.getElementById('contest-msg'), 'Contest promoted!', 'success'); }
function submitStudio() { showMsg(document.getElementById('studio-msg'), 'Studio promoted!', 'success'); }

// Notifications & Profiles
function loadNotifications() {
    document.getElementById('notifications-section').innerHTML = `<div class="card"><p style="text-align:center; color:var(--text-secondary);">No new notifications.</p></div>`;
}

function viewUserProfile(username) {
    switchTab('user-profile');
    document.getElementById('user-profile-content').innerHTML = `
        <div class="card" style="display:flex; align-items:center; gap:16px;">
            <div class="avatar-wrapper" style="width:64px; height:64px;"><img src="https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png"></div>
            <div>
                <h2 style="font-size: 20px; color:var(--text-primary); margin-bottom:4px;">${escapeHTML(username)}</h2>
                <p style="color:var(--text-secondary); font-size: 13px;">Scratcher</p>
            </div>
        </div>
    `;
}

function loadAccountProfile() {
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

// Auth
function openAuthModal() { document.getElementById('auth-modal').style.display = 'flex'; }
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }
function submitLogin() { currentUser = { username: 'ScratcherX' }; renderAuthUI(); closeAuthModal(); }

function renderAuthUI() {
    const container = document.getElementById('auth-container');
    if (!container) return;
    if (currentUser) {
        container.innerHTML = `
            <div class="avatar-wrapper" style="width:32px; height:32px; cursor:pointer;" onclick="switchTab('account')">
                <img src="https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png">
            </div>
            <button class="btn-outline" style="padding: 6px 16px; font-size: 13px;" onclick="currentUser=null; renderAuthUI(); switchTab('home');">Sign out</button>
        `;
    } else {
        container.innerHTML = `<button class="btn" style="padding: 8px 16px;" onclick="openAuthModal()">Sign in</button>`;
    }
}

// Utils
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

document.addEventListener('DOMContentLoaded', () => { loadTheme(); renderAuthUI(); loadFeed(); });
