let currentUser = null;
let currentActivePostId = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    loadPosts();
});

async function checkSession() {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
        currentUser = data.user;
        document.getElementById('auth-btn').innerText = `Logout`;
        document.getElementById('auth-btn').onclick = logout;
        document.getElementById('user-coins').classList.remove('hidden');
        document.getElementById('user-coins').innerText = `🪙 ${currentUser.coins}`;
        document.getElementById('post-creator').classList.remove('hidden');
        document.getElementById('profile-btn').classList.remove('hidden');
    } else {
        document.getElementById('auth-btn').onclick = () => {
            document.getElementById('modal-overlay').classList.remove('hidden');
            document.getElementById('auth-modal').classList.remove('hidden');
        };
    }
}

// --- MODALS ---
function closeModals(e) {
    if (e && e.target.id === 'modal-overlay') closeAllModals();
}
function closeAllModals() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    currentActivePostId = null;
}

function openProfileModal() {
    if (!currentUser) return;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('profile-modal').classList.remove('hidden');
    document.getElementById('prof-username').textContent = currentUser.username;
    document.getElementById('prof-ref').textContent = currentUser.referral_code || 'None';
}

// --- AUTHENTICATION ---
async function requestLogin() {
    const username = document.getElementById('auth-username').value;
    const referralCode = document.getElementById('auth-referral').value;
    const res = await fetch('/api/auth/register-request', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username, referralCode })
    });
    const data = await res.json();
    if (data.verificationCode) {
        document.getElementById('auth-step-1').classList.add('hidden');
        document.getElementById('auth-step-2').classList.remove('hidden');
        document.getElementById('verification-code-display').innerText = data.verificationCode;
    } else alert(data.error);
}

async function verifyLogin() {
    const username = document.getElementById('auth-username').value;
    const res = await fetch('/api/auth/verify', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (data.success) {
        closeAllModals();
        location.reload();
    } else alert(data.error);
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.reload();
}

// --- FEED & POSTS ---
async function loadPosts() {
    const res = await fetch('/api/posts');
    const posts = await res.json();
    const container = document.getElementById('posts-container');
    container.innerHTML = '';

    posts.forEach(post => {
        const hasLiked = currentUser && post.likes && post.likes.includes(currentUser.username);
        const isAdmin = currentUser && currentUser.is_admin;
        
        const card = document.createElement('div');
        card.className = 'post-card';
        card.innerHTML = `
            <img src="${post.thumbnail}" alt="thumb" onclick="openPostModal(${post.id}, ${post.project_id})">
            <div class="post-info">
                <div class="post-title"></div>
                <div class="post-author"></div>
                <div class="post-stats">
                    <span class="like-btn ${hasLiked ? 'liked' : ''}" onclick="toggleLike(${post.id}, event)">
                        ❤️ <span class="like-count">${(post.likes || []).length}</span>
                    </span>
                    <span>👁️ ${(post.views || []).length}</span>
                    ${isAdmin ? `<button class="btn danger" onclick="deletePost(${post.id}, event)">🗑️</button>` : ''}
                </div>
            </div>
        `;
        
        card.querySelector('.post-title').textContent = post.title;
        
        const authorDiv = card.querySelector('.post-author');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = post.author;
        nameSpan.style.color = post.author_color || 'var(--text)';
        nameSpan.style.fontWeight = 'bold';
        authorDiv.appendChild(nameSpan);
        
        if (post.author_badges) {
            post.author_badges.forEach(b => {
                const badgeSpan = document.createElement('span');
                badgeSpan.className = 'badge';
                badgeSpan.textContent = b;
                authorDiv.appendChild(badgeSpan);
            });
        }
        
        container.appendChild(card);
    });
}

async function submitPost() {
    const scratchInput = document.getElementById('post-url').value;
    const caption = document.getElementById('post-caption').value;
    const res = await fetch('/api/posts', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ scratchInput, caption })
    });
    if (res.ok) {
        document.getElementById('post-url').value = '';
        document.getElementById('post-caption').value = '';
        loadPosts();
    } else {
        const err = await res.json();
        alert(err.error || "Failed to post.");
    }
}

// --- INTERACTION (LIKES, VIEWS, MODERATION) ---
async function toggleLike(postId, event) {
    event.stopPropagation();
    if (!currentUser) return alert("Log in first!");
    const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
    if (res.ok) loadPosts();
}

async function deletePost(postId, event) {
    event.stopPropagation();
    if (!confirm("Delete this post?")) return;
    const res = await fetch(`/api/moderation/posts/${postId}`, { method: 'DELETE' });
    if (res.ok) loadPosts();
}

// --- POST DETAILS (MODAL & COMMENTS & LIVE STATS) ---
async function openPostModal(postId, projectId) {
    currentActivePostId = postId;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('post-modal').classList.remove('hidden');
    document.getElementById('modal-comments').innerHTML = 'Loading comments...';
    
    if (currentUser) fetch(`/api/posts/${postId}/view`, { method: 'POST' }).then(() => loadPosts());

    try {
        const scratchRes = await fetch(`https://api.scratch.mit.edu/projects/${projectId}`);
        if (scratchRes.ok) {
            const data = await scratchRes.json();
            document.getElementById('modal-title').textContent = data.title;
            document.getElementById('modal-img').src = data.image;
            document.getElementById('scratch-loves').textContent = `❤️ ${data.stats.loves}`;
            document.getElementById('scratch-faves').textContent = `⭐ ${data.stats.favorites}`;
            document.getElementById('scratch-remixes').textContent = `🌀 ${data.stats.remixes}`;
        }
    } catch(e) {}

    loadComments();
}

async function loadComments() {
    if (!currentActivePostId) return;
    const res = await fetch(`/api/posts/${currentActivePostId}/comments`);
    const comments = await res.json();
    const box = document.getElementById('modal-comments');
    box.innerHTML = '';
    
    comments.forEach(c => {
        const div = document.createElement('div');
        div.className = 'comment';
        
        const authorStr = document.createElement('strong');
        authorStr.textContent = c.author + ": ";
        
        const textStr = document.createElement('span');
        textStr.textContent = c.text;
        
        div.appendChild(authorStr);
        div.appendChild(textStr);
        box.appendChild(div);
    });
}

async function submitComment() {
    const text = document.getElementById('comment-text').value;
    if (!text) return;
    const res = await fetch(`/api/posts/${currentActivePostId}/comments`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ text })
    });
    if (res.ok) {
        document.getElementById('comment-text').value = '';
        loadComments();
    } else {
        alert("Must be logged in!");
    }
}

// --- STORE LOGIC ---
async function buyItem(type, value, price) {
    if (!confirm(`Buy this for ${price} coins?`)) return;
    const res = await fetch('/api/store/buy', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ type, value, price })
    });
    const data = await res.json();
    if (data.success) {
        alert("Bought successfully!");
        checkSession();
        loadPosts();
    } else {
        alert(data.error);
    }
}
