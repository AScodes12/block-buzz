// Relative API URL works because server.js serves frontend statically
const API_BASE_URL = ''; 
let currentUser = null;
let activeVerificationData = null;

// Escapes special characters to prevent DOM Injection
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
}

// Display non-blocking inline messages
function showMsg(elementId, text, isError = false) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.className = `inline-msg ${isError ? 'error' : 'success'}`;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

// Safely validate responses before parsing JSON
async function parseJsonResponse(res) {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return await res.json();
    }
    throw new Error(`Server returned non-JSON response (${res.status})`);
}

document.addEventListener('DOMContentLoaded', () => checkSession());

function checkSession() {
    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
        .then(parseJsonResponse)
        .then(data => {
            currentUser = data.user ? data.user.username : null;
            updateAuthUI();
            loadPosts();
        }).catch(err => {
            console.error('Session check error:', err);
            updateAuthUI();
        });
}

function updateAuthUI() {
    const container = document.getElementById('auth-container');
    if (!container) return;

    if (currentUser) {
        container.innerHTML = `
            <div style="background:#eff6ff; border: 1px solid #bfdbfe; padding: 6px 14px; border-radius: 20px; font-weight:700; font-size:13px; color:#d97706;">
                Coins: <span id="header-coins">...</span>
            </div>
            <span style="font-size:14px; font-weight:600;">${escapeHTML(currentUser)}</span>
            <button onclick="logout()" class="btn-outline" style="color:#dc2626; border-color:#dc2626; padding: 6px 12px; font-size:13px;">Logout</button>
        `;
        fetchUserCoins();
    } else {
        container.innerHTML = `<button onclick="renderLoginPanel()" class="btn">Log In</button>`;
    }
}

function renderLoginPanel() {
    switchTab('account');
    const container = document.getElementById('account-profile-content');
    container.innerHTML = `
        <div class="card">
            <h3 style="margin-bottom: 6px;">Log In / Verify Scratch Account</h3>
            <p style="font-size:13px; color:var(--text-secondary); margin-bottom: 16px;">Enter your Scratch username to connect your profile securely.</p>
            <div class="input-group">
                <input type="text" id="inline-username" placeholder="Scratch Username...">
                <input type="text" id="inline-ref" placeholder="Referral Code (Optional)...">
                <button onclick="requestVerificationCode()" class="btn">Get Verification Code</button>
                <div id="login-msg" class="inline-msg"></div>
            </div>
            <div id="verify-step-2" style="margin-top: 16px;"></div>
        </div>
    `;
}

async function requestVerificationCode() {
    const username = document.getElementById('inline-username').value.trim();
    const referralCode = document.getElementById('inline-ref').value.trim();
    if (!username) return showMsg('login-msg', 'Please enter a username.', true);

    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/register-request`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ username, referralCode })
        });
        const data = await parseJsonResponse(res);
        if (data.error) return showMsg('login-msg', data.error, true);

        activeVerificationData = { username, referralCode };

        document.getElementById('verify-step-2').innerHTML = `
            <div style="background:#f8fafc; border:1px solid var(--border-color); padding:16px; border-radius:var(--radius-md);">
                <h4 style="margin-bottom:6px; font-size:14px; color:var(--accent-color);">Step 2: Add Code to Bio</h4>
                <p style="font-size:13px; margin-bottom:8px; color:var(--text-secondary);">Copy this code and paste it anywhere in your Scratch profile Bio or Status:</p>
                <div style="background:#fff; padding:10px; border:1px dashed var(--accent-color); border-radius:8px; font-family:monospace; font-weight:bold; font-size:15px; margin-bottom:12px; text-align:center;">
                    ${escapeHTML(data.verificationCode)}
                </div>
                <button onclick="confirmVerification()" class="btn" style="width:100%;">I've Added It to My Bio - Verify Now</button>
                <div id="verify-msg" class="inline-msg" style="margin-top:10px;"></div>
            </div>
        `;
    } catch (e) { showMsg('login-msg', 'Network error or rate limit hit. Try again later.', true); }
}

async function confirmVerification() {
    if (!activeVerificationData) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/verify`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ username: activeVerificationData.username })
        });
        const data = await parseJsonResponse(res);
        if (data.error) return showMsg('verify-msg', data.error, true);

        checkSession();
        switchTab('home');
    } catch (e) { showMsg('verify-msg', 'Verification failed.', true); }
}

async function fetchUserCoins() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(currentUser)}`);
        const data = await parseJsonResponse(res);
        const coinsEl = document.getElementById('header-coins');
        if (coinsEl && data.coins !== undefined) coinsEl.textContent = data.coins;
    } catch (e) { console.error(e); }
}

async function logout() {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    currentUser = null; updateAuthUI(); loadPosts();
    switchTab('home');
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    document.getElementById(`${tabName}-section`).style.display = 'block';
    document.getElementById(`nav-${tabName}`).classList.add('active');

    if (tabName === 'account') loadAccountPage();
    if (tabName === 'store') renderStore();
    if (tabName === 'contests') loadContests();
    if (tabName === 'studios') loadStudios();
}

async function loadPosts() {
    const feed = document.getElementById('feed');
    try {
        const res = await fetch(`${API_BASE_URL}/api/posts`, { credentials: 'include' });
        const posts = await parseJsonResponse(res);
        feed.innerHTML = posts.length === 0 ? '<p style="text-align:center; color:var(--text-secondary); margin-top:20px;">No posts yet.</p>' : '';
        
        posts.forEach(post => {
            const badgesHTML = (post.authorBadges || []).map(b => `<span style="font-size:16px;">${escapeHTML(b)}</span>`).join('');
            feed.innerHTML += `
                <div class="card">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div class="avatar-wrapper"><img src="${escapeHTML(post.authorPfp)}"></div>
                        <strong style="color:${escapeHTML(post.authorColor)}">${escapeHTML(post.author)} ${badgesHTML}</strong>
                    </div>
                    <img src="${escapeHTML(post.thumbnail)}" class="project-thumb">
                    <h4 style="margin-bottom:6px;">${escapeHTML(post.title)}</h4>
                    <p style="font-size:14px; color:var(--text-secondary);">${escapeHTML(post.caption)}</p>
                </div>
            `;
        });
    } catch (e) { feed.innerHTML = '<p style="color:red; text-align:center;">Error loading posts.</p>'; }
}

async function submitPost() {
    if (!currentUser) return showMsg('home-msg', 'Log in to share a project.', true);
    const scratchInput = document.getElementById('scratch-input').value;
    const caption = document.getElementById('post-caption').value;

    try {
        const res = await fetch(`${API_BASE_URL}/api/posts`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            credentials: 'include',
            body: JSON.stringify({ scratchInput, caption })
        });
        const data = await parseJsonResponse(res);
        if (data.error) return showMsg('home-msg', data.error, true);
        
        document.getElementById('scratch-input').value = '';
        document.getElementById('post-caption').value = '';
        loadPosts();
        showMsg('home-msg', 'Project posted successfully!');
    } catch (e) { showMsg('home-msg', 'Failed to submit post.', true); }
}

function renderStore() {
    const colors = [
        { name: 'Gold', price: 100, val: '#eab308' }, { name: 'Purple', price: 150, val: '#a855f7' },
        { name: 'Green', price: 150, val: '#10b981' }, { name: 'Red', price: 200, val: '#ef4444' }
    ];
    const badges = [
        { name: 'Star', price: 50, val: '⭐' }, { name: 'Fire', price: 100, val: '🔥' },
        { name: 'Diamond', price: 300, val: '💎' }, { name: 'Verified', price: 500, val: '✔️' }
    ];

    document.getElementById('store-colors').innerHTML = colors.map(c => `
        <div style="border:1px solid var(--border-color); padding:16px; border-radius:var(--radius-md); text-align:center; background:#f8fafc;">
            <div style="width:28px; height:28px; background:${c.val}; border-radius:50%; margin:0 auto 10px; box-shadow:var(--shadow-sm);"></div>
            <strong style="font-size:14px;">${c.name}</strong><br><small style="color:var(--text-secondary);">${c.price} Coins</small>
            <button onclick="buyItem('color', '${c.val}', ${c.price})" class="btn" style="width:100%; margin-top:10px; padding:6px;">Buy</button>
        </div>
    `).join('');

    document.getElementById('store-badges').innerHTML = badges.map(b => `
        <div style="border:1px solid var(--border-color); padding:16px; border-radius:var(--radius-md); text-align:center; background:#f8fafc;">
            <div style="font-size:28px; margin-bottom:10px;">${b.val}</div>
            <strong style="font-size:14px;">${b.name}</strong><br><small style="color:var(--text-secondary);">${b.price} Coins</small>
            <button onclick="buyItem('badge', '${b.val}', ${b.price})" class="btn" style="width:100%; margin-top:10px; padding:6px;">Buy</button>
        </div>
    `).join('');
}

async function buyItem(type, value, price) {
    if (!currentUser) return showMsg('store-msg', 'Log in to use the store.', true);
    try {
        const res = await fetch(`${API_BASE_URL}/api/store/buy`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            credentials: 'include',
            body: JSON.stringify({ type, value, price })
        });
        const data = await parseJsonResponse(res);
        if (data.error) showMsg('store-msg', data.error, true);
        else { showMsg('store-msg', 'Purchased successfully!'); fetchUserCoins(); }
    } catch (e) { showMsg('store-msg', 'Transaction failed.', true); }
}

async function loadContests() {
    const feed = document.getElementById('contests-feed');
    try {
        const res = await fetch(`${API_BASE_URL}/api/contests`);
        const contests = await parseJsonResponse(res);
        feed.innerHTML = contests.length === 0 ? '<p style="text-align:center; color:var(--text-secondary); margin-top:20px;">No contests advertised yet. Be the first!</p>' : '';
        
        contests.forEach(c => {
            feed.innerHTML += `
                <div class="card">
                    <h3>Scratch Contest #${escapeHTML(c.contestId)}</h3>
                    <p style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;">Advertised by <strong>${escapeHTML(c.advertiser)}</strong></p>
                    <p style="font-size:14px; margin-bottom:14px;">${escapeHTML(c.description)}</p>
                    <a href="https://scratch.mit.edu/projects/${encodeURIComponent(c.contestId)}" target="_blank" class="btn-outline" style="width:100%;">View Scratch Contest</a>
                </div>
            `;
        });
    } catch (e) { feed.innerHTML = '<p style="color:red; text-align:center;">Error loading contests.</p>'; }
}

async function submitContest() {
    if (!currentUser) return showMsg('contest-msg', 'Log in to advertise a contest.', true);
    const contestInput = document.getElementById('contest-input').value;
    const description = document.getElementById('contest-desc').value;

    try {
        const res = await fetch(`${API_BASE_URL}/api/contests`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            credentials: 'include',
            body: JSON.stringify({ contestInput, description })
        });
        const data = await parseJsonResponse(res);
        if (data.error) return showMsg('contest-msg', data.error, true);

        document.getElementById('contest-input').value = '';
        document.getElementById('contest-desc').value = '';
        loadContests();
        showMsg('contest-msg', 'Contest advertised successfully!');
    } catch (e) { showMsg('contest-msg', 'Failed to advertise contest.', true); }
}

async function loadStudios() {
    const feed = document.getElementById('studios-feed');
    try {
        const res = await fetch(`${API_BASE_URL}/api/studios`);
        const studios = await parseJsonResponse(res);
        feed.innerHTML = studios.length === 0 ? '<p style="text-align:center; color:var(--text-secondary); margin-top:20px;">No studios advertised yet. Be the first!</p>' : '';
        
        studios.forEach(s => {
            feed.innerHTML += `
                <div class="card">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="${escapeHTML(s.image)}" style="width:50px; height:50px; object-fit:cover; border-radius:8px; border:1px solid var(--border-color);">
                        <div>
                            <h3 style="font-size:16px;">${escapeHTML(s.title)}</h3>
                            <p style="font-size:13px; color:var(--text-secondary);">Advertised by <strong>${escapeHTML(s.advertiser)}</strong></p>
                        </div>
                    </div>
                    <p style="font-size:14px; margin:14px 0; color:var(--text-secondary);">${escapeHTML(s.description)}</p>
                    <a href="https://scratch.mit.edu/studios/${encodeURIComponent(s.studioId)}" target="_blank" class="btn-outline" style="width:100%;">Visit Scratch Studio</a>
                </div>
            `;
        });
    } catch (e) { feed.innerHTML = '<p style="color:red; text-align:center;">Error loading studios.</p>'; }
}

async function submitStudio() {
    if (!currentUser) return showMsg('studio-msg', 'Log in to advertise a studio.', true);
    const studioInput = document.getElementById('studio-input').value;
    const description = document.getElementById('studio-desc').value;

    try {
        const res = await fetch(`${API_BASE_URL}/api/studios`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            credentials: 'include',
            body: JSON.stringify({ studioInput, description })
        });
        const data = await parseJsonResponse(res);
        if (data.error) return showMsg('studio-msg', data.error, true);

        document.getElementById('studio-input').value = '';
        document.getElementById('studio-desc').value = '';
        loadStudios();
        showMsg('studio-msg', 'Studio advertised successfully!');
    } catch (e) { showMsg('studio-msg', 'Failed to advertise studio.', true); }
}

async function loadAccountPage() {
    const container = document.getElementById('account-profile-content');
    if (!currentUser) {
        return renderLoginPanel();
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(currentUser)}`);
        const data = await parseJsonResponse(res);
        
        container.innerHTML = `
            <div class="card">
                <h2 style="color:${escapeHTML(data.color)}; font-size:1.5rem; margin-bottom:8px;">${escapeHTML(data.username)} ${(data.badges || []).map(b => escapeHTML(b)).join(' ')}</h2>
                <p style="font-size:14px; margin-bottom:4px;">Coins: <strong style="color:#d97706;">${data.coins}</strong></p>
                <p style="font-size:14px; margin-bottom:16px;">Referral Code: <code style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${escapeHTML(data.referralCode)}</code></p>
                <button onclick="logout()" class="btn-outline" style="color:#dc2626; border-color:#dc2626;">Log Out of Account</button>
            </div>
        `;
    } catch (e) { container.innerHTML = '<p style="color:red; text-align:center;">Error loading profile.</p>'; }
}
