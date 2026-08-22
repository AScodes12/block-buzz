// --- AUTH MODAL CONTROLS ---
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
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const msg = document.getElementById('login-msg');

    if (!username || !password) {
        showMsg(msg, 'Please fill in all fields.', 'error');
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
            showMsg(msg, data.error || 'Login failed.', 'error');
        }
    } catch (err) {
        showMsg(msg, 'Server error logging in.', 'error');
    }
}

async function submitSignup() {
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    const msg = document.getElementById('signup-msg');

    if (!username || !password) {
        showMsg(msg, 'Please fill in all fields.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/signup', {
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
            showMsg(msg, data.error || 'Signup failed.', 'error');
        }
    } catch (err) {
        showMsg(msg, 'Server error creating account.', 'error');
    }
}

// --- UPDATED RENDER AUTH UI ---
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
            <button class="btn" onclick="openAuthModal()">Log In / Sign Up</button>
        `;
    }
}

// --- ACCOUNT / PROFILE SECTION ---
async function loadAccountProfile() {
    const profileContainer = document.getElementById('account-profile-content');
    if (!profileContainer) return;

    if (!currentUser) {
        profileContainer.innerHTML = `
            <div class="card" style="text-align: center;">
                <h3>You are not logged in</h3>
                <p style="color:var(--text-secondary); margin: 12px 0;">Log in or create an account to view your profile and manage cosmetics.</p>
                <button class="btn" onclick="openAuthModal()">Log In / Sign Up</button>
            </div>
        `;
        return;
    }

    profileContainer.innerHTML = `
        <div class="card">
            <div style="display: flex; align-items: center; gap: 16px;">
                <div class="avatar-wrapper" style="width:64px; height:64px;">
                    <img src="${currentUser.pfp}">
                </div>
                <div>
                    <h2 style="font-size: 1.25rem;">${escapeHTML(currentUser.username)}</h2>
                    <p style="color:var(--text-secondary); font-size: 14px;">Coins: 🪙 ${currentUser.coins || 0}</p>
                </div>
            </div>
        </div>

        <div class="card">
            <h3>Your Cosmetics & Badges</h3>
            <p style="color:var(--text-secondary); font-size: 13px; margin-top: 4px;">Equipped Username Color: <strong style="color:${currentUser.color || 'inherit'}">${currentUser.color || 'Default'}</strong></p>
            <div style="margin-top: 12px;">
                <button class="btn-outline" onclick="switchTab('store')">Visit Coin Store</button>
            </div>
        </div>
    `;
}

// Update switchTab to load the profile when account tab is active:
const originalSwitchTab = switchTab;
switchTab = function(tabName) {
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
};
