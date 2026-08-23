// ==========================================
// BLOCKBUZZ - FRONTEND APPLICATION SCRIPT
// ==========================================

// --- GLOBAL STATE ---
let currentUser = null;
let currentDiscussionCategory = 'scratch';

// --- SHARED ICONS ---
const replyIcon = '<svg class="icon" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>';

// --- ROUTING ENGINE (HTML5 History API) ---
function navigateTo(path, pushState = true) {
    if (pushState) {
        window.history.pushState({}, '', path);
    }
    const cleanPath = path.split('?')[0].replace(/\/$/, '') || '/home';
    
    if (cleanPath === '/home' || cleanPath === '') {
        switchTab('home');
    } else if (cleanPath === '/discussions') {
        switchTab('discussions');
    } else if (cleanPath === '/contests') {
        switchTab('contests');
    } else if (cleanPath === '/studios') {
        switchTab('studios');
    } else if (cleanPath === '/account') {
        switchTab('account');
    } else if (cleanPath.startsWith('/profile/')) {
        const username = cleanPath.replace('/profile/', '');
        viewUserProfile(username);
    } else {
        switchTab('home');
    }
}

window.addEventListener('popstate', () => {
    navigateTo(window.location.pathname, false);
});

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
    
    window.scrollTo(0, 0);
}

// --- HELPER: EXTRACT SCRATCH ID ---
function getScratchId(url) {
    if (!url) return null;
    const match = url.match(/projects\/(\d+)/);
    return match ? match[1] : null;
}

// --- TURBOWARP / EMBED PLAYER MODAL ---
function openEmbedModal(projectId, title) {
    let modal = document.getElementById('embed-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'embed-modal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:520px; width:90%; padding:16px; background:var(--bg-card, #fff); border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="margin:0;">${escapeHTML(title || 'BlockBuzz Player')}</h3>
                <button class="btn-outline" style="padding:4px 8px; cursor:pointer;" onclick="closeEmbedModal()">✕</button>
            </div>
            <iframe src="https://turbowarp.org/${projectId}/embed" width="100%" height="400" frameborder="0" allowfullscreen style="border-radius:8px;"></iframe>
        </div>
    `;
}

function closeEmbedModal() {
    const modal = document.getElementById('embed-modal');
    if (modal) modal.style.display = 'none';
}

// --- AUTH MODAL HANDLER ---
function openAuthModal(mode = 'login') {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:360px; width:90%; padding:20px; background:var(--bg-card, #fff); border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3 style="margin:0;">${mode === 'login' ? 'Sign In to BlockBuzz' : 'Create Account'}</h3>
                <button class="btn-outline" style="padding:2px 6px; cursor:pointer;" onclick="closeAuthModal()">✕</button>
            </div>
            <div id="auth-msg" style="display:none; margin-bottom:10px;"></div>
            <form onsubmit="handleAuthSubmit(event, '${mode}')">
                <div style="margin-bottom:12px;">
                    <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:4px;">Username</label>
                    <input type="text" id="auth-username" required style="width:100%; padding:8px; box-sizing:border-box;">
                </div>
                <div style="margin-bottom:16px;">
                    <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:4px;">Password</label>
                    <input type="password" id="auth-password" required style="width:100%; padding:8px; box-sizing:border-box;">
                </div>
                <button class="btn" type="submit" style="width:100%; padding:8px; cursor:pointer;">${mode === 'login' ? 'Sign In' : 'Register'}</button>
            </form>
            <p style="font-size:12px; text-align:center; margin-top:12px;">
                ${mode === 'login' 
                    ? `Don't have an account? <a href="#" onclick="openAuthModal('register')">Register</a>` 
                    : `Already have an account? <a href="#" onclick="openAuthModal('login')">Sign In</a>`}
            </p>
        </div>
    `;
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
}

async function handleAuthSubmit(e, mode) {
    e.preventDefault();
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    const msg = document.getElementById('auth-msg');

    try {
        const res = await fetch('/api/auth/' + mode, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // CRITICAL: Sends session cookie
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data.user;
            closeAuthModal();
            loadAccountProfile();
            loadFeed();
        } else {
            showMsg(msg, data.error || 'Authentication failed', 'error');
        }
    } catch (err) {
        showMsg(msg, 'Server error during authentication', 'error');
    }
}

// --- POST REPLY & COMMENT REPLY FEATURES ---
function togglePostReplyBox(postId) {
    const box = document.getElementById('post-reply-box-' + postId);
    if (box) {
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
    }
}

async function addPostReply(postId) {
    const input = document.getElementById('post-reply-input-' + postId);
    if (!input || !input.value.trim()) return;
    try {
        const res = await fetch('/api/posts/' + postId + '/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // CRITICAL: Sends session cookie
            body: JSON.stringify({ text: input.value })
        });
        if (res.ok) {
            input.value = '';
            togglePostReplyBox(postId);
            loadCommentsForPost(postId);
        } else if (res.status === 401) {
            openAuthModal('login');
        }
    } catch (err) { console.error('Error sending post reply', err); }
}

function toggleReplyBox(commentKey) {
    const box = document.getElementById('reply-box-' + commentKey);
    if (box) {
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
    }
}

async function addReply(postId, commentId, inputId) {
    const input = document.getElementById(inputId);
    if (!input || !input.value.trim()) return;
    try {
        const res = await fetch('/api/posts/' + postId + '/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // CRITICAL: Sends session cookie
            body: JSON.stringify({ text: input.value, parentId: commentId })
        });
        if (res.ok) {
            input.value = '';
            toggleReplyBox(postId + '-' + commentId);
            loadCommentsForPost(postId);
        } else if (res.status === 401) {
            openAuthModal('login');
        }
    } catch (err) { console.error('Error sending reply', err); }
}

// --- POSTS & GRID FEED ---
function renderPostCard(post) {
    const postId = post.id;
    const scratchId = getScratchId(post.scratch_link);
    const views = Array.isArray(post.views) ? post.views.length : (post.views || 0);
    const likes = Array.isArray(post.likes) ? post.likes.length : (post.likes || 0);
    const isAuthor = currentUser && currentUser.username === post.author;
    const isPinned = post.is_pinned;

    const eyeIcon = '<svg class="icon" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>';
    const heartIcon = '<svg class="icon" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

    return `
    <div class="card post-card" id="post-${postId}">
        ${isPinned ? '<div class="pinned-badge">📌 Pinned Project</div>' : ''}
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div class="avatar-wrapper" style="width:28px; height:28px; cursor:pointer;" onclick="navigateTo('/profile/${escapeHTML(post.author)}')">
                <img src="${post.author_pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png'}" alt="${escapeHTML(post.author)}">
            </div>
            <span class="clickable-user" onclick="navigateTo('/profile/${escapeHTML(post.author)}')">${escapeHTML(post.author)}</span>
            ${isAuthor ? `
                <button class="btn-outline" style="margin-left:auto; font-size:11px; padding:2px 6px;" onclick="togglePinPost('${postId}')">${isPinned ? 'Unpin' : 'Pin'}</button>
                <button class="btn" style="background:#d93025; color:#fff; font-size:11px; padding:2px 6px;" onclick="deletePost('${postId}')">Delete</button>
            ` : ''}
        </div>

        <div style="position:relative; cursor:pointer;" onclick="registerView('${postId}')">
            <img class="project-thumb" src="${post.thumbnail || 'https://scratch.mit.edu/images/scratch-og.png'}" style="width:100%; border-radius:6px; aspect-ratio:4/3; object-fit:cover;" alt="Thumbnail">
        </div>

        <h3 style="font-size: 15px; margin:8px 0 4px 0;">${escapeHTML(post.title || 'Scratch Project')}</h3>
        <p style="font-size:13px; color:var(--text-secondary, #666); margin:0 0 10px 0;">${escapeHTML(post.caption || '')}</p>

        <!-- Play & External Action Links -->
        <div class="project-links-row" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;">
            ${scratchId ? `<button class="btn" style="flex:1; font-size:12px; padding:4px 8px;" onclick="openEmbedModal('${scratchId}', '${escapeHTML(post.title)}')">▶ Play in BlockBuzz</button>` : ''}
            <a href="${escapeHTML(post.scratch_link)}" target="_blank" rel="noopener noreferrer" class="btn-outline" style="font-size:11px; padding:4px 6px; text-decoration:none;">Scratch ↗</a>
            ${scratchId ? `<a href="https://turbowarp.org/${scratchId}" target="_blank" rel="noopener noreferrer" class="btn-outline" style="font-size:11px; padding:4px 6px; text-decoration:none;">TurboWarp ↗</a>` : ''}
        </div>

        <div class="post-stats" style="display:flex; gap:12px; font-size:12px; color:var(--text-secondary, #666);">
            <span>${eyeIcon} <span id="view-count-${postId}">${views}</span></span>
            <button class="stat-btn" onclick="toggleLike('${postId}')">${heartIcon} <span id="like-count-${postId}">${likes}</span></button>
            <button class="stat-btn" onclick="togglePostReplyBox('${postId}')">💬 Reply</button>
        </div>

        <div id="post-reply-box-${postId}" style="display:none; margin-top:8px;" class="comment-input-row">
            <input type="text" id="post-reply-input-${postId}" placeholder="Write a reply..." style="padding: 4px 8px; font-size: 12px;">
            <button class="btn" style="padding: 4px 10px; font-size: 12px;" onclick="addPostReply('${postId}')">Send</button>
        </div>

        <div class="comments-section" style="margin-top:8px; font-size:12px;">
            <div id="comments-list-${postId}"><p style="color:var(--text-secondary, #666);">Loading comments...</p></div>
            <div class="comment-input-row" style="margin-top:6px;">
                <input type="text" id="comment-input-${postId}" placeholder="Add comment..." style="padding: 4px 8px; font-size: 12px;">
                <button class="btn" style="padding: 4px 10px; font-size: 12px;" onclick="addComment('${postId}')">Post</button>
            </div>
        </div>
    </div>`;
}

async function loadFeed() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    try {
        const res = await fetch('/api/posts', { credentials: 'include' });
        const posts = res.ok ? await res.json() : [];
        if (posts.length === 0) {
            feed.innerHTML = '<div class="card" style="grid-column: 1/-1;"><p style="text-align:center;">No projects found.</p></div>';
            return;
        }
        feed.className = 'grid-feed-container';
        let html = '';
        for (let i = 0; i < posts.length; i++) {
            html += renderPostCard(posts[i]);
        }
        feed.innerHTML = html;
        posts.forEach(p => loadCommentsForPost(p.id));
    } catch (err) {
        feed.innerHTML = '<div class="card" style="grid-column: 1/-1;"><p>Error loading posts.</p></div>';
    }
}

async function togglePinPost(postId) {
    try {
        const res = await fetch('/api/posts/' + postId + '/pin', { 
            method: 'POST',
            credentials: 'include' 
        });
        if (res.ok) {
            loadFeed();
        }
    } catch (err) { console.error('Error toggling pin:', err); }
}

async function deletePost(postId) {
    if (!confirm('Delete this post?')) return;
    try {
        const res = await fetch('/api/posts/' + postId, { 
            method: 'DELETE',
            credentials: 'include' 
        });
        if (res.ok) {
            const card = document.getElementById('post-' + postId);
            if (card) card.remove();
        }
    } catch (err) { console.error('Error deleting post:', err); }
}

async function registerView(postId) {
    try {
        const res = await fetch('/api/posts/' + postId + '/view', { 
            method: 'POST',
            credentials: 'include' 
        });
        if (res.ok) {
            const data = await res.json();
            const countSpan = document.getElementById('view-count-' + postId);
            if (countSpan && data.views !== undefined) {
                countSpan.textContent = Array.isArray(data.views) ? data.views.length : data.views;
            }
        }
    } catch (err) { console.error('Error view count'); }
}

async function toggleLike(postId) {
    try {
        const res = await fetch('/api/posts/' + postId + '/like', { 
            method: 'POST',
            credentials: 'include' 
        });
        if (res.ok) {
            const data = await res.json();
            const countSpan = document.getElementById('like-count-' + postId);
            if (countSpan) countSpan.textContent = Array.isArray(data.likes) ? data.likes.length : data.likes;
        }
    } catch (err) { console.error('Error liking post'); }
}

// --- COMMENTS & REPLIES ---
async function loadCommentsForPost(postId) {
    const listContainer = document.getElementById('comments-list-' + postId);
    if (!listContainer) return;
    try {
        const res = await fetch('/api/posts/' + postId + '/comments', { credentials: 'include' });
        const comments = res.ok ? await res.json() : [];
        if (comments.length === 0) {
            listContainer.innerHTML = '<p style="color:var(--text-secondary, #666);">No comments yet.</p>';
            return;
        }
        let html = '';
        comments.forEach(c => {
            const commentKey = `${postId}-${c.id}`;
            html += `
                <div style="margin-bottom:6px;" id="comment-${c.id}">
                    <b>${escapeHTML(c.author)}:</b> ${escapeHTML(c.text)}
                    <button class="stat-btn" style="font-size:11px; padding:0 4px; margin-left:6px;" onclick="toggleReplyBox('${commentKey}')">Reply</button>
                    <div id="reply-box-${commentKey}" style="display:none; margin-top:4px; margin-left:12px;" class="comment-input-row">
                        <input type="text" id="reply-input-${commentKey}" placeholder="Reply to ${escapeHTML(c.author)}..." style="padding: 2px 6px; font-size: 11px;">
                        <button class="btn" style="padding: 2px 8px; font-size: 11px;" onclick="addReply('${postId}', '${c.id}', 'reply-input-${commentKey}')">Send</button>
                    </div>
                </div>`;
        });
        listContainer.innerHTML = html;
    } catch (err) {
        listContainer.innerHTML = '<p style="color:var(--text-secondary, #666);">Failed comments load.</p>';
    }
}

async function addComment(postId) {
    const input = document.getElementById('comment-input-' + postId);
    if (!input || !input.value.trim()) return;
    try {
        const res = await fetch('/api/posts/' + postId + '/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ text: input.value })
        });
        if (res.ok) {
            input.value = '';
            loadCommentsForPost(postId);
        }
    } catch (err) { console.error('Error adding comment'); }
}

// --- DISCUSSIONS ---
function switchDiscussionCategory(category) {
    currentDiscussionCategory = category;
    document.querySelectorAll('.disc-tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('disc-tab-' + category);
    if (activeBtn) activeBtn.classList.add('active');
    loadDiscussions(category);
}

async function loadDiscussions(category = currentDiscussionCategory) {
    const feed = document.getElementById('discussions-feed');
    if (!feed) return;
    try {
        const res = await fetch('/api/discussions?category=' + category, { credentials: 'include' });
        const filtered = res.ok ? await res.json() : [];
        if (filtered.length === 0) {
            feed.innerHTML = '<div class="card"><p style="text-align:center;">No discussions found in this category.</p></div>';
            return;
        }
        let html = '';
        for (let i = 0; i < filtered.length; i++) {
            let item = filtered[i];
            let upvotes = Array.isArray(item.upvotes) ? item.upvotes.length : (item.upvotes || 0);
            let downvotes = Array.isArray(item.downvotes) ? item.downvotes.length : (item.downvotes || 0);

            html += `
            <div class="card" id="discussion-${item.id}">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <div class="avatar-wrapper" style="width:24px; height:24px; cursor:pointer;" onclick="navigateTo('/profile/${escapeHTML(item.author)}')">
                        <img src="${item.author_pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png'}" alt="${escapeHTML(item.author)}">
                    </div>
                    <span class="clickable-user" onclick="navigateTo('/profile/${escapeHTML(item.author)}')">${escapeHTML(item.author)}</span>
                    <span style="margin-left:auto; font-size:11px; background:var(--bg-hover, #eee); padding:2px 6px; border-radius:4px;">${escapeHTML(item.category)}</span>
                </div>
                <h3 style="font-size:16px; margin:4px 0;">${escapeHTML(item.title)}</h3>
                <p style="font-size:14px; color:var(--text-secondary, #666); margin-bottom:12px;">${escapeHTML(item.content)}</p>
                <div class="post-stats" style="display:flex; gap:8px;">
                    <button class="stat-btn" onclick="toggleDiscussionUpvote('${item.id}')">👍 <span id="upvote-count-${item.id}">${upvotes}</span></button>
                    <button class="stat-btn" onclick="toggleDiscussionDownvote('${item.id}')">👎 <span id="downvote-count-${item.id}">${downvotes}</span></button>
                    <button class="stat-btn" onclick="toggleDiscussionReplyBox('${item.id}')">💬 Reply</button>
                </div>
                <div id="discussion-reply-box-${item.id}" style="display:none; margin-top:8px;" class="comment-input-row">
                    <input type="text" id="discussion-reply-input-${item.id}" placeholder="Reply..." style="padding: 4px 8px; font-size: 12px;">
                    <button class="btn" style="padding: 4px 10px; font-size: 12px;" onclick="addDiscussionReply('${item.id}')">Send</button>
                </div>
                <div id="discussion-comments-list-${item.id}"></div>
            </div>`;
        }
        feed.innerHTML = html;
    } catch (err) { feed.innerHTML = '<div class="card"><p>Error loading discussions.</p></div>'; }
}

async function toggleDiscussionUpvote(id) {
    try {
        const res = await fetch('/api/discussions/' + id + '/upvote', { 
            method: 'POST',
            credentials: 'include' 
        });
        if (res.ok) {
            const data = await res.json();
            document.getElementById('upvote-count-' + id).textContent = Array.isArray(data.upvotes) ? data.upvotes.length : data.upvotes;
            if (data.downvotes !== undefined) {
                document.getElementById('downvote-count-' + id).textContent = Array.isArray(data.downvotes) ? data.downvotes.length : data.downvotes;
            }
        }
    } catch (err) { console.error('Upvote error:', err); }
}

async function toggleDiscussionDownvote(id) {
    try {
        const res = await fetch('/api/discussions/' + id + '/downvote', { 
            method: 'POST',
            credentials: 'include' 
        });
        if (res.ok) {
            const data = await res.json();
            document.getElementById('upvote-count-' + id).textContent = Array.isArray(data.upvotes) ? data.upvotes.length : data.upvotes;
            document.getElementById('downvote-count-' + id).textContent = Array.isArray(data.downvotes) ? data.downvotes.length : data.downvotes;
        }
    } catch (err) { console.error('Downvote error:', err); }
}

function toggleDiscussionReplyBox(id) {
    const box = document.getElementById('discussion-reply-box-' + id);
    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

async function addDiscussionReply(id) {
    const input = document.getElementById('discussion-reply-input-' + id);
    if (!input || !input.value.trim()) return;
    try {
        const res = await fetch('/api/discussions/' + id + '/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ text: input.value })
        });
        if (res.ok) {
            input.value = '';
            document.getElementById('discussion-reply-box-' + id).style.display = 'none';
            loadDiscussions(currentDiscussionCategory);
        }
    } catch (err) { console.error('Error discussion reply'); }
}

async function submitDiscussion() {
    const titleEl = document.getElementById('discussion-title');
    const contentEl = document.getElementById('discussion-content');
    const categoryEl = document.getElementById('discussion-category');
    const msg = document.getElementById('discussion-msg');

    if (!titleEl || !contentEl) return;
    const title = titleEl.value.trim();
    const content = contentEl.value.trim();
    const category = categoryEl ? categoryEl.value : 'scratch';

    if (!title || !content) return showMsg(msg, 'Title and content required.', 'error');

    try {
        const res = await fetch('/api/discussions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ title, content, category })
        });
        if (res.ok) {
            titleEl.value = '';
            contentEl.value = '';
            showMsg(msg, 'Discussion posted!', 'success');
            loadDiscussions(category);
        }
    } catch (err) { showMsg(msg, 'Error posting discussion.', 'error'); }
}

// --- CONTESTS & STUDIOS LOADERS ---
async function loadContests() {
    const section = document.getElementById('contests-section');
    if (!section) return;
    try {
        const res = await fetch('/api/contests', { credentials: 'include' });
        const contests = res.ok ? await res.json() : [];
        if (contests.length === 0) {
            section.innerHTML = '<div class="card"><p style="text-align:center;">No active contests right now.</p></div>';
            return;
        }
        let html = '<h2 style="margin-bottom:16px;">🏆 Community Contests</h2><div class="grid-feed-container">';
        contests.forEach(c => {
            html += `
                <div class="card">
                    <h3>${escapeHTML(c.title)}</h3>
                    <p style="font-size:13px; color:var(--text-secondary, #666);">${escapeHTML(c.description)}</p>
                    <p style="font-size:12px; font-weight:bold;">Prize: ${c.prize || 'Badge'} | Deadline: ${c.deadline || 'TBD'}</p>
                </div>
            `;
        });
        html += '</div>';
        section.innerHTML = html;
    } catch (err) {
        section.innerHTML = '<div class="card"><p>Error loading contests.</p></div>';
    }
}

async function loadStudios() {
    const section = document.getElementById('studios-section');
    if (!section) return;
    try {
        const res = await fetch('/api/studios', { credentials: 'include' });
        const studios = res.ok ? await res.json() : [];
        if (studios.length === 0) {
            section.innerHTML = '<div class="card"><p style="text-align:center;">No studios found.</p></div>';
            return;
        }
        let html = '<h2 style="margin-bottom:16px;">🎨 Featured Studios</h2><div class="grid-feed-container">';
        studios.forEach(s => {
            html += `
                <div class="card">
                    <h3>${escapeHTML(s.title)}</h3>
                    <p style="font-size:13px; color:var(--text-secondary, #666);">${escapeHTML(s.description)}</p>
                    <span style="font-size:11px; background:var(--bg-hover, #eee); padding:2px 6px; border-radius:4px;">${s.project_count || 0} Projects</span>
                </div>
            `;
        });
        html += '</div>';
        section.innerHTML = html;
    } catch (err) {
        section.innerHTML = '<div class="card"><p>Error loading studios.</p></div>';
    }
}

// --- USER PROFILES, BIO & PINNED POSTS ---
async function viewUserProfile(username) {
    switchTab('user-profile');
    const container = document.getElementById('user-profile-content');
    if (!container) return;
    container.innerHTML = '<div class="card"><p style="text-align:center;">Loading profile...</p></div>';
    try {
        const res = await fetch('/api/users/' + username, { credentials: 'include' });
        const data = res.ok ? await res.json() : null;
        if (!data || !data.user) {
            container.innerHTML = '<div class="card"><p>User not found.</p></div>';
            return;
        }
        const user = data.user;
        const posts = data.posts || [];
        const pinnedPosts = posts.filter(p => p.is_pinned);
        const regularPosts = posts.filter(p => !p.is_pinned);

        let pinnedHtml = '';
        if (pinnedPosts.length > 0) {
            pinnedHtml = '<h3 style="margin:16px 0 8px 0;">📌 Pinned Projects</h3><div class="grid-feed-container">';
            pinnedPosts.forEach(p => pinnedHtml += renderPostCard(p));
            pinnedHtml += '</div>';
        }

        let regularHtml = '<h3 style="margin:16px 0 8px 0;">Projects</h3><div class="grid-feed-container">';
        regularPosts.forEach(p => regularHtml += renderPostCard(p));
        regularHtml += '</div>';

        container.innerHTML = `
            <button class="btn-outline" onclick="navigateTo('/home')" style="margin-bottom:12px; cursor:pointer;">← Back</button>
            <div class="card" style="display:flex; gap:16px; align-items:flex-start;">
                <div class="avatar-wrapper" style="width:64px; height:64px;">
                    <img src="${user.pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png'}" alt="${escapeHTML(user.username)}">
                </div>
                <div style="flex:1;">
                    <h2 style="font-size:20px; margin:0;">${escapeHTML(user.username)} ✓</h2>
                    <p style="color:var(--text-secondary, #666); font-size:13px; margin:4px 0 8px 0;">Coins: ${user.coins || 0}</p>
                    <p style="font-size:14px; background:var(--bg-hover, #f8f9fa); padding:8px; border-radius:6px; margin:0;">${escapeHTML(user.bio || 'No bio written yet.')}</p>
                </div>
            </div>
            ${pinnedHtml}
            ${regularHtml}
        `;
    } catch (err) { container.innerHTML = '<div class="card"><p>Error loading profile.</p></div>'; }
}

async function loadAccountProfile() {
    const container = document.getElementById('account-profile-content');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = '<div class="card" style="text-align:center;"><h3>Sign in required</h3><button class="btn" onclick="openAuthModal(\'login\')">Sign in</button></div>';
        return;
    }

    container.innerHTML = `
        <div class="card">
            <div style="display:flex; gap:16px; align-items:center; margin-bottom:12px;">
                <div class="avatar-wrapper" style="width:64px; height:64px;"><img src="${currentUser.pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png'}" alt="Profile"></div>
                <div>
                    <h2 style="font-size:20px; margin:0;">${escapeHTML(currentUser.username)} ✓</h2>
                    <p style="color:var(--text-secondary, #666); font-size:13px; margin-top:2px;">Coins: ${currentUser.coins || 0}</p>
                </div>
            </div>
            <div style="margin-top:12px;">
                <label style="font-size:13px; font-weight:bold; display:block; margin-bottom:4px;">Edit Your Bio:</label>
                <textarea id="account-bio-input" style="width:100%; height:60px; padding:8px; box-sizing:border-box;">${escapeHTML(currentUser.bio || '')}</textarea>
                <button class="btn" style="margin-top:8px; cursor:pointer;" onclick="saveBio()">Save Bio</button>
            </div>
        </div>
    `;
}

async function saveBio() {
    const bioInput = document.getElementById('account-bio-input');
    if (!bioInput) return;
    const bio = bioInput.value;
    try {
        const res = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ bio })
        });
        if (res.ok) {
            if (currentUser) currentUser.bio = bio;
            alert('Bio updated successfully!');
        }
    } catch (err) { alert('Failed to update bio'); }
}

// --- AUTH & INIT ---
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        currentUser = data.user || null;
    } catch (err) { console.error('Auth check error:', err); }
}

function showMsg(element, text, type) {
    if (!element) return;
    element.textContent = text;
    element.className = 'msg-box ' + type;
    element.style.display = 'block';
    setTimeout(() => { element.style.display = 'none'; }, 4000);
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    navigateTo(window.location.pathname, false);
});
