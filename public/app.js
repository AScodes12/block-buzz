let currentUser = null;
let pendingVerification = null;
let activeCommentPostId = null;

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    fetchPosts();
    fetchContests();
    fetchStudios();
    renderStore();
    setupCommentsModal();
});

// --- SESSION CHECK ---
async function checkSession() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        currentUser = data.user;
        updateAuthUI();
    } catch (err) {
        console.error('Session check failed', err);
    }
}

// --- TAB SWITCHING ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('nav .nav-link').forEach(btn => btn.classList.remove('active'));

    const targetSection = document.getElementById(`${tabId}-section`);
    const targetNav = document.getElementById(`nav-${tabId}`);

    if (targetSection) targetSection.style.display = 'block';
    if (targetNav) targetNav.classList.add('active');

    if (tabId === 'account') renderProfile();
}

// --- AUTH UI UPDATES ---
function updateAuthUI() {
    const authContainer = document.getElementById('auth-container');
    if (!authContainer) return;

    if (currentUser) {
        authContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px;">
                <div class="avatar-wrapper"><img src="${currentUser.pfp || ''}" alt="PFP"></div>
                <span style="color: ${currentUser.color || 'inherit'}">${currentUser.username}</span>
                <span style="background: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 12px; font-size: 12px;">🪙 ${currentUser.coins}</span>
            </div>
        `;
    } else {
        authContainer.innerHTML = `<button onclick="switchTab('account')" class="btn" style="padding: 6px 14px; font-size: 13px;">Login</button>`;
    }
}

// --- PROFILE & VERIFICATION ---
function renderProfile() {
    const container = document.getElementById('account-profile-content');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = `
            <div class="card" style="text-align: center;">
                <h2>Scratch Verification</h2>
                <p style="color:var(--text-secondary); margin-bottom: 16px; font-size: 14px;">Link your Scratch account securely using your bio.</p>
                
                <div id="step-1" class="input-group">
                    <input type="text" id="scratch-username" placeholder="Enter your Scratch username...">
                    <input type="text" id="referral-code-input" placeholder="Referral Code (Optional)">
                    <button onclick="requestVerification()" class="btn">Get Verification Code</button>
                    <div id="account-msg-1" class="inline-msg"></div>
                </div>

                <div id="step-2" class="input-group" style="display: none;">
                    <p style="font-size: 14px;">Paste this code into your <strong>Scratch Bio</strong> or <strong>Status</strong>:</p>
                    <div id="code-display" style="font-size: 18px; font-weight: bold; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px dashed var(--accent-color); color: var(--accent-color);"></div>
                    <button onclick="confirmVerification()" class="btn">I've put it in my bio, Verify Me!</button>
                    <button onclick="resetVerification()" class="btn-outline" style="margin-top: 6px;">Back</button>
                    <div id="account-msg-2" class="inline-msg"></div>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="card">
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
                    <div class="avatar-wrapper" style="width: 60px; height: 60px;"><img src="${currentUser.pfp}" alt="PFP"></div>
                    <div>
                        <h2 style="color: ${currentUser.color || 'inherit'}">${currentUser.username}</h2>
                        <p style="color: var(--text-secondary); font-size: 13px;">Coins: 🪙 ${currentUser.coins}</p>
                        <div style="display: flex; gap: 6px; margin-top: 6px;">
                            ${(currentUser.badges || []).map(b => `<span style="background: #eff6ff; color: var(--accent-color); padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: bold;">${b}</span>`).join('')}
                            ${currentUser.is_admin ? '<span style="background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: bold;">Admin</span>' : ''}
                        </div>
                    </div>
                </div>
                <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 16px;">
                    <p style="font-size: 13px; color: var(--text-secondary);">Your Referral Code:</p>
                    <strong style="font-size: 15px; color: var(--text-primary);">${currentUser.referral_code}</strong>
                </div>
                <button onclick="logout()" class="btn-outline" style="width: 100%; border-color: #ef4444; color: #ef4444;">Log Out</button>
            </div>
        `;
    }
}

async function requestVerification() {
    const username = document.getElementById('scratch-username').value.trim();
    const referralCode = document.getElementById('referral-code-input').value.trim();
    const msg = document.getElementById('account-msg-1');

    if (!username) {
        showMsg(msg, 'Please enter a username.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/register-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, referralCode })
        });
        const data = await res.json();

        if (res.ok) {
            pendingVerification = username;
            document.getElementById('code-display').textContent = data.verificationCode;
            document.getElementById('step-1').style.display = 'none';
            document.getElementById('step-2').style.display = 'flex';
        } else {
            showMsg(msg, data.error, 'error');
        }
    } catch (err) {
        showMsg(msg, 'Network error. Try again.', 'error');
    }
}

function resetVerification() {
    document.getElementById('step-2').style.display = 'none';
    document.getElementById('step-1').style.display = 'flex';
    pendingVerification = null;
}

async function confirmVerification() {
    const msg = document.getElementById('account-msg-2');
    try {
        const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: pendingVerification })
        });
        const data = await res.json();

        if (res.ok) {
            currentUser = data.user;
            updateAuthUI();
            renderProfile();
        } else {
            showMsg(msg, data.error, 'error');
        }
    } catch (err) {
        showMsg(msg, 'Verification failed.', 'error');
    }
}

async function logout() {
    currentUser = null;
    updateAuthUI();
    renderProfile();
}

// --- POSTS, FEED, VIEWS & COMMENTS ---
async function submitPost() {
    const scratchInput = document.getElementById('scratch-input').value.trim();
    const caption = document.getElementById('post-caption').value.trim();
    const msg = document.getElementById('home-msg');

    if (!currentUser) return showMsg(msg, 'Please login first!', 'error');
    if (!scratchInput) return showMsg(msg, 'Please enter a project URL or ID.', 'error');

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scratchInput, caption })
        });
        const data = await res.json();

        if (res.ok) {
            document.getElementById('scratch-input').value = '';
            document.getElementById('post-caption').value = '';
            showMsg(msg, 'Project posted successfully!', 'success');
            fetchPosts();
        } else {
            showMsg(msg, data.error, 'error');
        }
    } catch (err) {
        showMsg(msg, 'Failed to post project.', 'error');
    }
}

async function fetchPosts() {
    const feed = document.getElementById('feed');
    if (!feed) return;

    try {
        const res = await fetch('/api/posts');
        const posts = await res.json();

        if (!posts || posts.length === 0) {
            feed.innerHTML = `<div class="card" style="text-align: center; color: var(--text-secondary);">No projects posted yet.</div>`;
            return;
        }

        feed.innerHTML = posts.map(p => {
            const isLiked = currentUser && p.likes && p.likes.includes(currentUser.username);
            const canDelete = currentUser && (currentUser.is_admin || currentUser.username === p.author);
            const viewCount = p.views ? p.views.length : 0;
            const likeCount = p.likes ? p.likes.length : 0;

            return `
                <div class="card post-item" data-id="${p.id}">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="avatar-wrapper" style="width: 28px; height: 28px;"><img src="${p.author_pfp || ''}" alt=""></div>
                            <span style="font-weight: 600; font-size: 13px; color: ${p.author_color || 'inherit'}">${p.author}</span>
                        </div>
                        ${canDelete ? `<button onclick="deletePost('${p.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:12px;">Delete</button>` : ''}
                    </div>
                    <h3 style="font-size: 16px;">${p.title}</h3>
                    <p style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">${p.caption || ''}</p>
                    <img src="${p.thumbnail}" class="project-thumb" alt="Thumbnail">
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <a href="https://scratch.mit.edu/projects/${p.project_id}" target="_blank" class="btn-outline" style="flex: 1; text-align:center;">Play on Scratch</a>
                        <button onclick="toggleLike('${p.id}')" class="btn-outline" style="display: flex; align-items: center; gap: 4px; border-color: ${isLiked ? '#dc2626' : 'var(--border-color)'}; color: ${isLiked ? '#dc2626' : 'var(--text-primary)'}; background: ${isLiked ? '#fee2e2' : 'transparent'};">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? '#dc2626' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                            <span>${likeCount}</span>
                        </button>
                        <button onclick="openComments('${p.id}')" class="btn-outline" style="display: flex; align-items: center; gap: 4px;">💬</button>
                    </div>
                    <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary); text-align: right;">👁️ ${viewCount} views</div>
                </div>
            `;
        }).join('');

        setupViewObserver();
    } catch (err) {
        console.error('Failed to load posts', err);
    }
}

// --- VIEW OBSERVER ---
function setupViewObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && currentUser) {
                const postId = entry.target.getAttribute('data-id');
                fetch(`/api/posts/${postId}/view`, { method: 'POST' });
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.6 });

    document.querySelectorAll('.post-item').forEach(el => observer.observe(el));
}

// --- COMMENTS MODAL SETUP & ACTIONS ---
function setupCommentsModal() {
    if (document.getElementById('comments-modal')) return;
    const modalHtml = `
        <div id="comments-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; justify-content: center; align-items: center;">
            <div class="card" style="width: 100%; max-width: 480px; max-height: 80vh; display: flex; flex-direction: column; margin: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3>Comments</h3>
                    <button onclick="closeComments()" style="background:none; border:none; font-size: 18px; cursor:pointer;">&times;</button>
                </div>
                <div id="comments-list" style="flex: 1; overflow-y: auto; max-height: 300px; display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;"></div>
                <div class="input-group" style="margin-top: 0;">
                    <input type="text" id="comment-input" placeholder="Write a comment...">
                    <button onclick="submitComment()" class="btn">Send</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function openComments(postId) {
    activeCommentPostId = postId;
    document.getElementById('comments-modal').style.display = 'flex';
    loadComments(postId);
}

function closeComments() {
    document.getElementById('comments-modal').style.display = 'none';
    activeCommentPostId = null;
}

async function loadComments(postId) {
    const list = document.getElementById('comments-list');
    list.innerHTML = `<p style="color:var(--text-secondary); font-size:13px;">Loading comments...</p>`;

    try {
        const res = await fetch(`/api/posts/${postId}/comments`);
        const comments = await res.json();

        if (!comments || comments.length === 0) {
            list.innerHTML = `<p style="color:var(--text-secondary); font-size:13px;">No comments yet. Start the conversation!</p>`;
            return;
        }

        list.innerHTML = comments.map(c => `
            <div style="background: #f8fafc; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
                <strong style="color: ${c.author_color || 'inherit'}">${c.author}:</strong> ${c.text}
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = `<p style="color:#ef4444; font-size:13px;">Failed to load comments.</p>`;
    }
}

async function submitComment() {
    const textInput = document.getElementById('comment-input');
    const text = textInput.value.trim();
    if (!text || !activeCommentPostId) return;

    if (!currentUser) return alert('Please login to comment!');

    try {
        const res = await fetch(`/api/posts/${activeCommentPostId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        if (res.ok) {
            textInput.value = '';
            loadComments(activeCommentPostId);
        }
    } catch (err) {
        alert('Failed to send comment.');
    }
}

async function toggleLike(postId) {
    if (!currentUser) return alert('Please login to like posts!');
    await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
    fetchPosts();
}

async function deletePost(postId) {
    if (!confirm('Delete this post?')) return;
    await fetch(`/api/moderation/posts/${postId}`, { method: 'DELETE' });
    fetchPosts();
}

// --- PLACEHOLDERS ---
function fetchContests() { document.getElementById('contests-feed').innerHTML = `<div class="card" style="text-align:center; color:var(--text-secondary);">Contests feature ready.</div>`; }
function fetchStudios() { document.getElementById('studios-feed').innerHTML = `<div class="card" style="text-align:center; color:var(--text-secondary);">Studios feature ready.</div>`; }
function submitContest() { alert('Contest advertisement ready!'); }
function submitStudio() { alert('Studio advertisement ready!'); }
function renderStore() {
    document.getElementById('store-colors').innerHTML = `<p style="font-size:13px; color:var(--text-secondary);">Colors loaded via store configurations.</p>`;
    document.getElementById('store-badges').innerHTML = `<p style="font-size:13px; color:var(--text-secondary);">Badges loaded via store configurations.</p>`;
}

// --- UTILITIES ---
function showMsg(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = `inline-msg ${type}`;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}
