let currentUser = null;
let pendingUsername = '';

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
                <span>${currentUser.username}</span>
                <span style="background: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 12px; font-size: 12px;">🪙 ${currentUser.coins}</span>
            </div>
        `;
    } else {
        authContainer.innerHTML = `<button onclick="switchTab('account')" class="btn" style="padding: 6px 14px; font-size: 13px;">Login / Sign Up</button>`;
    }
}

// --- PROFILE & AUTH MODES ---
function renderProfile() {
    const container = document.getElementById('account-profile-content');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = `
            <div class="card" style="max-width: 400px; margin: 0 auto;">
                <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <button onclick="switchAuthMode('signup')" id="btn-mode-signup" class="btn" style="flex: 1;">Sign Up</button>
                    <button onclick="switchAuthMode('login')" id="btn-mode-login" class="btn-outline" style="flex: 1;">Log In</button>
                </div>

                <!-- SIGN UP FORM -->
                <div id="auth-signup-form">
                    <h2>Scratch Sign Up</h2>
                    <p style="color:var(--text-secondary); margin-bottom: 16px; font-size: 13px;">Create your platform account using your Scratch credentials.</p>
                    
                    <div class="input-group">
                        <input type="text" id="scratch-username" placeholder="Scratch Username">
                        <input type="password" id="signup-password" placeholder="Create Password">
                        <input type="text" id="referral-code-input" placeholder="Referral Code (Optional)">
                        <button onclick="requestVerification()" class="btn">Next: Verify Profile</button>
                        <div id="account-msg-1" class="inline-msg"></div>
                    </div>
                </div>

                <!-- LOGIN FORM -->
                <div id="auth-login-form" style="display: none;">
                    <h2>Welcome Back</h2>
                    <p style="color:var(--text-secondary); margin-bottom: 16px; font-size: 13px;">Log in using your verified username and password.</p>
                    <div class="input-group">
                        <input type="text" id="login-username" placeholder="Scratch Username">
                        <input type="password" id="login-password" placeholder="Password">
                        <button onclick="loginUser()" class="btn">Log In</button>
                        <div id="account-msg-3" class="inline-msg"></div>
                    </div>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="card" style="max-width: 400px; margin: 0 auto;">
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
                    <div class="avatar-wrapper" style="width: 60px; height: 60px;"><img src="${currentUser.pfp}" alt="PFP"></div>
                    <div>
                        <h2>${currentUser.username}</h2>
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

function switchAuthMode(mode) {
    const signupForm = document.getElementById('auth-signup-form');
    const loginForm = document.getElementById('auth-login-form');
    const btnSignup = document.getElementById('btn-mode-signup');
    const btnLogin = document.getElementById('btn-mode-login');

    if (!signupForm || !loginForm) return;

    if (mode === 'signup') {
        signupForm.style.display = 'block';
        loginForm.style.display = 'none';
        btnSignup.className = 'btn';
        btnLogin.className = 'btn-outline';
    } else {
        signupForm.style.display = 'none';
        loginForm.style.display = 'block';
        btnSignup.className = 'btn-outline';
        btnLogin.className = 'btn';
    }
}

// --- VERIFICATION WORKFLOW ---
async function requestVerification() {
    const usernameInput = document.getElementById('scratch-username');
    const passwordInput = document.getElementById('signup-password');
    const referralInput = document.getElementById('referral-code-input');
    const msg = document.getElementById('account-msg-1');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    const referralCode = referralInput ? referralInput.value.trim() : '';

    if (!username || !password) {
        return showMsg(msg, 'Username and password are required.', 'error');
    }

    try {
        const res = await fetch('/api/auth/register-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, referralCode })
        });
        const data = await res.json();

        if (res.ok) {
            pendingUsername = username;
            const container = document.getElementById('auth-signup-form');
            container.innerHTML = `
                <h2>Verify Your Account</h2>
                <p style="color:var(--text-secondary); margin-bottom: 12px; font-size: 13px;">
                    Paste this code on the <strong>top line</strong> of your <strong>"What I'm working on"</strong> section on Scratch:
                </p>
                <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center; margin-bottom: 12px;">
                    <strong style="font-size: 18px; color: var(--accent-color);">${data.verificationCode}</strong>
                </div>
                <a href="${data.profileUrl}" target="_blank" class="btn-outline" style="display: block; text-align: center; margin-bottom: 16px; text-decoration: none; padding: 8px;">Open My Scratch Profile ↗</a>
                <p style="color:var(--text-secondary); margin-bottom: 12px; font-size: 12px;">Save it on Scratch, wait <strong>15 seconds</strong> for Scratch to update, then click below!</p>
                <button onclick="confirmVerification()" class="btn">Check Verification</button>
                <div id="account-msg-2" class="inline-msg" style="margin-top: 10px;"></div>
            `;
        } else {
            showMsg(msg, data.error, 'error');
        }
    } catch (err) {
        showMsg(msg, 'Registration request failed.', 'error');
    }
}

async function confirmVerification() {
    const msg = document.getElementById('account-msg-2');
    try {
        const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: pendingUsername })
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
        showMsg(msg, 'Verification check failed. Try again.', 'error');
    }
}

async function loginUser() {
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const msg = document.getElementById('account-msg-3');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
        return showMsg(msg, 'Please enter username and password.', 'error');
    }

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
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
        showMsg(msg, 'Login failed.', 'error');
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    updateAuthUI();
    renderProfile();
}

// --- POSTS & FEED ---
async function submitPost() {
    const scratchInputEl = document.getElementById('scratch-input');
    const captionEl = document.getElementById('post-caption');
    const msg = document.getElementById('home-msg');

    const scratchInput = scratchInputEl ? scratchInputEl.value.trim() : '';
    const caption = captionEl ? captionEl.value.trim() : '';

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
            if (scratchInputEl) scratchInputEl.value = '';
            if (captionEl) captionEl.value = '';
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

        let htmlContent = '';
        for (const p of posts) {
            const isLiked = currentUser && p.likes && p.likes.includes(currentUser.username);
            const viewCount = p.views ? p.views.length : 0;
            const likeCount = p.likes ? p.likes.length : 0;

            let commentsHtml = '';
            try {
                const commRes = await fetch(`/api/posts/${p.id}/comments`);
                const comments = await commRes.json();
                if (comments && comments.length > 0) {
                    commentsHtml = comments.map(c => `
                        <div style="background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 12px; margin-bottom: 4px;">
                            <strong>${c.author}:</strong> ${c.text}
                        </div>
                    `).join('');
                } else {
                    commentsHtml = `<p style="color: var(--text-secondary); font-size: 12px; font-style: italic;">No comments yet.</p>`;
                }
            } catch (e) {
                commentsHtml = `<p style="color: #ef4444; font-size: 12px;">Failed to load comments.</p>`;
            }

            const viewLineArtIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 2px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

            htmlContent += `
                <div class="card post-item" data-id="${p.id}" style="margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="avatar-wrapper" style="width: 28px; height: 28px;"><img src="${p.author_pfp || ''}" alt=""></div>
                            <span style="font-weight: 600; font-size: 13px;">${p.author}</span>
                        </div>
                    </div>
                    
                    <h3 style="font-size: 16px; margin-bottom: 6px;">${p.title}</h3>
                    <p style="font-size: 14px; color: var(--text-primary); margin-bottom: 10px; white-space: pre-wrap; line-height: 1.4;">${p.caption || ''}</p>
                    
                    <a href="${p.scratch_link}" target="_blank">
                        <img src="${p.thumbnail}" class="project-thumb" alt="Thumbnail" style="width: 100%; border-radius: 8px; margin-bottom: 10px;">
                    </a>
                    
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 14px;">
                        <button onclick="toggleLike('${p.id}')" class="btn-outline" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; border-color: ${isLiked ? '#dc2626' : 'var(--border-color)'}; color: ${isLiked ? '#dc2626' : 'var(--text-primary)'}; background: ${isLiked ? '#fee2e2' : 'transparent'};">
                            <span>Like (${likeCount})</span>
                        </button>
                        <div style="font-size: 12px; color: var(--text-secondary); padding: 0 4px; display: flex; align-items: center; gap: 3px;">${viewLineArtIcon} ${viewCount} views</div>
                    </div>

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
        if (res.ok) fetchPosts();
    } catch (err) {
        console.error('Comment error', err);
    }
}

async function toggleLike(postId) {
    if (!currentUser) return alert('Please login to like posts!');
    await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
    fetchPosts();
}

// --- CONTESTS & STUDIOS ---
async function fetchContests() {
    const feed = document.getElementById('contests-feed');
    if (!feed) return;
    try {
        const res = await fetch('/api/contests');
        const contests = await res.json();
        if (!contests || contests.length === 0) {
            feed.innerHTML = `<div class="card" style="text-align: center; color: var(--text-secondary);">No active contests advertised yet.</div>`;
            return;
        }
        feed.innerHTML = contests.map(c => `
            <div class="card" style="margin-bottom: 16px;">
                <h3 style="font-size: 16px; margin-bottom: 4px;">${c.title}</h3>
                <p style="font-size: 13px; color: var(--text-primary); margin-bottom: 8px;">${c.description || ''}</p>
                <a href="${c.scratch_link}" target="_blank" class="btn" style="display: inline-block; text-decoration: none; font-size: 13px; padding: 6px 12px;">Visit Contest on Scratch</a>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function submitContest() {
    const titleEl = document.getElementById('contest-title');
    const descEl = document.getElementById('contest-desc');
    const prizeEl = document.getElementById('contest-prize');
    const linkEl = document.getElementById('contest-link');
    const msg = document.getElementById('contest-msg');

    const title = titleEl ? titleEl.value.trim() : '';
    const description = descEl ? descEl.value.trim() : '';
    const prize = prizeEl ? prizeEl.value.trim() : '';
    const scratchLink = linkEl ? linkEl.value.trim() : '';

    if (!currentUser) return showMsg(msg, 'Please login first!', 'error');
    if (!title || !scratchLink) return showMsg(msg, 'Title and Scratch link are required.', 'error');

    try {
        const res = await fetch('/api/contests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, prize, scratchLink })
        });
        const data = await res.json();

        if (res.ok) {
            if (titleEl) titleEl.value = '';
            if (descEl) descEl.value = '';
            if (prizeEl) prizeEl.value = '';
            if (linkEl) linkEl.value = '';
            showMsg(msg, 'Contest posted successfully!', 'success');
            fetchContests();
        } else {
            showMsg(msg, data.error, 'error');
        }
    } catch (err) {
        showMsg(msg, 'Failed to post contest.', 'error');
    }
}

async function fetchStudios() {
    const feed = document.getElementById('studios-feed');
    if (!feed) return;
    try {
        const res = await fetch('/api/studios');
        const studios = await res.json();
        if (!studios || studios.length === 0) {
            feed.innerHTML = `<div class="card" style="text-align: center; color: var(--text-secondary);">No studios advertised yet.</div>`;
            return;
        }
        feed.innerHTML = studios.map(s => `
            <div class="card" style="margin-bottom: 16px;">
                <h3 style="font-size: 16px; margin-bottom: 4px;">${s.title}</h3>
                <p style="font-size: 13px; color: var(--text-primary); margin-bottom: 10px;">${s.description || ''}</p>
                <a href="${s.scratch_link}" target="_blank" class="btn" style="display: inline-block; text-decoration: none; font-size: 13px; padding: 6px 12px;">Explore Studio on Scratch</a>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function submitStudio() {
    const titleEl = document.getElementById('studio-title');
    const descEl = document.getElementById('studio-desc');
    const linkEl = document.getElementById('studio-link');
    const msg = document.getElementById('studio-msg');

    const title = titleEl ? titleEl.value.trim() : '';
    const description = descEl ? descEl.value.trim() : '';
    const scratchLink = linkEl ? linkEl.value.trim() : '';

    if (!currentUser) return showMsg(msg, 'Please login first!', 'error');
    if (!title || !scratchLink) return showMsg(msg, 'Title and Scratch link are required.', 'error');

    try {
        const res = await fetch('/api/studios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, scratchLink })
        });
        const data = await res.json();

        if (res.ok) {
            if (titleEl) titleEl.value = '';
            if (descEl) descEl.value = '';
            if (linkEl) linkEl.value = '';
            showMsg(msg, 'Studio posted successfully!', 'success');
            fetchStudios();
        } else {
            showMsg(msg, data.error, 'error');
        }
    } catch (err) {
        showMsg(msg, 'Failed to post studio.', 'error');
    }
}

function renderStore() {
    const storeColors = document.getElementById('store-colors');
    if (storeColors) storeColors.innerHTML = `<p style="font-size:13px; color:var(--text-secondary);">Store inventory loaded.</p>`;
}

function showMsg(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = `inline-msg ${type}`;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}
