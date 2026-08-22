let currentUser = null;
let pendingVerification = null;

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    fetchPosts();
    fetchContests();
    fetchStudios();
    renderStore();
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

        // Render posts and load inline comments for each
        let htmlContent = '';
        for (const p of posts) {
            const isLiked = currentUser && p.likes && p.likes.includes(currentUser.username);
            const canDelete = currentUser && (currentUser.is_admin || currentUser.username === p.author);
            const viewCount = p.views ? p.views.length : 0;
            const likeCount = p.likes ? p.likes.length : 0;

            // Fetch comments for each post to display inline
            let commentsHtml = '';
            try {
                const commRes = await fetch(`/api/posts/${p.id}/comments`);
                const comments = await commRes.json();
                if (comments && comments.length > 0) {
                    commentsHtml = comments.map(c => `
                        <div style="background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 12px; margin-bottom: 4px;">
                            <strong style="color: ${c.author_color || 'inherit'}">${c.author}:</strong> ${c.text}
                        </div>
                    `).join('');
                } else {
                    commentsHtml = `<p style="color: var(--text-secondary); font-size: 12px; font-style: italic;">No comments yet.</p>`;
                }
            } catch (e) {
                commentsHtml = `<p style="color: #ef4444; font-size: 12px;">Failed to load comments.</p>`;
            }

            htmlContent += `
                <div class="card post-item" data-id="${p.id}" style="margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="avatar-wrapper" style="width: 28px; height: 28px;"><img src="${p.author_pfp || ''}" alt=""></div>
                            <span style="font-weight: 600; font-size: 13px; color: ${p.author_color || 'inherit'}">${p.author}</span>
                        </div>
                        ${canDelete ? `<button onclick="deletePost('${p.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:12px;">Delete</button>` : ''}
                    </div>
                    
                    <h3 style="font-size: 16px; margin-bottom: 6px;">${p.title}</h3>
                    <p style="font-size: 14px; color: var(--text-primary); margin-bottom: 10px; white-space: pre-wrap; line-height: 1.4;">${p.caption || ''}</p>
                    
                    <img src="${p.thumbnail}" class="project-thumb" alt="Thumbnail" style="width: 100%; border-radius: 8px; margin-bottom: 10px;">
                    
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 14px;">
                        <button onclick="toggleLike('${p.id}')" class="btn-outline" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; border-color: ${isLiked ? '#dc2626' : 'var(--border-color)'}; color: ${isLiked ? '#dc2626' : 'var(--text-primary)'}; background: ${isLiked ? '#fee2e2' : 'transparent'};">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? '#dc2626' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                            <span>Like (${likeCount})</span>
                        </button>
                        <div style="font-size: 12px; color: var(--text-secondary); padding: 0 4px;">👁️ ${viewCount} views</div>
                    </div>

                    <!-- Inline Comments Section -->
                    <div style="border-top: 1px solid var(--border-color); padding-top: 10px; margin-top: 10px;">
                        <h4 style="font-size: 13px; margin-bottom: 8px; color: var(--text-secondary);">Comments</h4>
                        <div style="max-height: 150px; overflow-y: auto; margin-bottom: 8px;">
                            ${commentsHtml}
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <input type="text" id="comment-input-${p.id}" placeholder="Add a comment..." style="flex: 1; padding: 6px 10px; font-size: 13px; border: 1px solid var(--border-color); border-radius: 6px;">
                            <button onclick="submitInlineComment('${p.id}')" class="btn" style="padding: 6px 12px; font-size: 13px;">Send</button>
                        </div>
                    </div>
                </div>
            `;
        }

        feed.innerHTML = htmlContent;
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

// --- INLINE COMMENT ACTIONS ---
async function submitInlineComment(postId) {
    const textInput = document.getElementById(`comment-input-${postId}`);
    const text = textInput ? textInput.value.trim() : '';
    if (!text) return;

    if (!currentUser) return alert('Please login to comment!');

    try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        if (res.ok) {
            fetchPosts(); // Refresh feed to display new comment inline
        } else {
            alert('Failed to send comment.');
        }
    } catch (err) {
        alert('Network error while commenting.');
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
