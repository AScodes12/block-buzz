const API_BASE_URL = 'https://regional-personally-acting-surgical.trycloudflare.com';
let currentUser = null;

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
}

document.addEventListener('DOMContentLoaded', () => checkSession());

function checkSession() {
    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            currentUser = data.user ? data.user.username : null;
            updateAuthUI();
            loadPosts();
        }).catch(err => {
            console.error('Session check error:', err);
            updateAuthUI(); // Fallback update so login button displays even if fetch fails
        });
}

function updateAuthUI() {
    const container = document.getElementById('auth-container');
    if (!container) return;

    if (currentUser) {
        container.innerHTML = `
            <div style="background:#f1f5f9; padding: 6px 12px; border-radius: 20px; font-weight:700; font-size:13px; color:#d97706;">
                Coins: <span id="header-coins">...</span>
            </div>
            <span style="font-size:14px; font-weight:600;">${escapeHTML(currentUser)}</span>
            <button onclick="logout()" class="btn-outline" style="color:#dc2626; border-color:#dc2626; padding: 6px 12px; font-size:13px;">Logout</button>
        `;
        fetchUserCoins();
    } else {
        container.innerHTML = `<button onclick="startVerificationFlow()" class="btn">Log In</button>`;
    }
}

async function fetchUserCoins() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(currentUser)}`);
        const data = await res.json();
        const coinsEl = document.getElementById('header-coins');
        if (coinsEl && data.coins !== undefined) coinsEl.textContent = data.coins;
    } catch (e) { console.error(e); }
}

async function startVerificationFlow() {
    const username = prompt('Enter your Scratch Username:');
    if (!username || !username.trim()) return;
    const refCode = prompt('Enter a Referral Code (Optional - leave blank if none):');

    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/register-request`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username.trim(), referralCode: refCode })
        });
        const data = await res.json();
        if (data.error) return alert(data.error);

        alert(`Step 1: Copy this code:\n\n${data.verificationCode}\n\nStep 2: Paste it into your Scratch Profile Bio.\nStep 3: Click OK to verify.`);
        verifyAccount(username.trim());
    } catch (e) { alert('Network error connecting to backend.'); }
}

async function verifyAccount(username) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/verify`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username })
        });
        const data = await res.json();

        if (data.error) return alert(data.error);
        if (data.isNewUser) {
            document.getElementById('bonus-banner').style.display = data.bonusApplied ? 'block' : 'none';
            document.getElementById('verification-modal').style.display = 'flex';
        } else {
            alert(`Welcome back, ${data.username}!`);
        }
        checkSession();
    } catch (e) { alert('Verification request failed.'); }
}

function closeModal() { document.getElementById('verification-modal').style.display = 'none'; }
async function logout() {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    currentUser = null; updateAuthUI(); loadPosts();
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
        const posts = await res.json();
        feed.innerHTML = posts.length === 0 ? '<p style="text-align:center; color:var(--text-secondary);">No posts yet.</p>' : '';
        
        posts.forEach(post => {
            const badgesHTML = (post.authorBadges || []).map(b => `<span style="font-size:16px;">${b}</span>`).join('');
            feed.innerHTML += `
                <div class="card">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="avatar-wrapper"><img src="${escapeHTML(post.authorPfp)}"></div>
                        <strong style="color:${escapeHTML(post.authorColor)}">${escapeHTML(post.author)} ${badgesHTML}</strong>
                    </div>
                    <img src="${escapeHTML(post.thumbnail)}" class="project-thumb">
                    <h4 style="margin-bottom:6px;">${escapeHTML(post.title)}</h4>
                    <p style="font-size:14px;">${escapeHTML(post.caption)}</p>
                </div>
            `;
        });
    } catch (e) { feed.innerHTML = '<p style="color:red; text-align:center;">Error loading posts.</p>'; }
}

async function submitPost() {
    if (!currentUser) return alert('Log in to share a project.');
    const scratchInput = document.getElementById('scratch-input').value;
    const caption = document.getElementById('post-caption').value;

    const res = await fetch(`${API_BASE_URL}/api/posts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ scratchInput, caption })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    
    document.getElementById('scratch-input').value = '';
    document.getElementById('post-caption').value = '';
    loadPosts();
    alert('Project posted successfully!');
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
        <div style="border:1px solid var(--border-color); padding:12px; border-radius:10px; text-align:center; background:#f8fafc;">
            <div style="width:24px; height:24px; background:${c.val}; border-radius:50%; margin:0 auto 8px;"></div>
            <strong>${c.name}</strong><br><small>${c.price} Coins</small>
            <button onclick="buyItem('color', '${c.val}', ${c.price})" class="btn" style="width:100%; margin-top:8px; padding:4px;">Buy</button>
        </div>
    `).join('');

    document.getElementById('store-badges').innerHTML = badges.map(b => `
        <div style="border:1px solid var(--border-color); padding:12px; border-radius:10px; text-align:center; background:#f8fafc;">
            <div style="font-size:24px; margin-bottom:8px;">${b.val}</div>
            <strong>${b.name}</strong><br><small>${b.price} Coins</small>
            <button onclick="buyItem('badge', '${b.val}', ${b.price})" class="btn" style="width:100%; margin-top:8px; padding:4px;">Buy</button>
        </div>
    `).join('');
}

async function buyItem(type, value, price) {
    if (!currentUser) return alert('Log in to use the store.');
    const res = await fetch(`${API_BASE_URL}/api/store/buy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ type, value, price })
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    else { alert('Purchased!'); fetchUserCoins(); }
}

async function loadContests() {
    const feed = document.getElementById('contests-feed');
    try {
        const res = await fetch(`${API_BASE_URL}/api/contests`);
        const contests = await res.json();
        feed.innerHTML = contests.length === 0 ? '<p style="text-align:center; color:var(--text-secondary); margin-top:20px;">No contests advertised yet. Be the first!</p>' : '';
        
        contests.forEach(c => {
            feed.innerHTML += `
                <div class="card">
                    <h3>Scratch Contest #${escapeHTML(c.contestId)}</h3>
                    <p style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;">Advertised by <strong>${escapeHTML(c.advertiser)}</strong></p>
                    <p style="font-size:14px; margin-bottom:12px;">${escapeHTML(c.description)}</p>
                    <a href="https://scratch.mit.edu/projects/${c.contestId}" target="_blank" class="btn-outline" style="width:100%;">View Scratch Contest</a>
                </div>
            `;
        });
    } catch (e) { feed.innerHTML = '<p style="color:red; text-align:center;">Error loading contests.</p>'; }
}

async function submitContest() {
    if (!currentUser) return alert('Log in to advertise a contest.');
    const contestInput = document.getElementById('contest-input').value;
    const description = document.getElementById('contest-desc').value;

    const res = await fetch(`${API_BASE_URL}/api/contests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ contestInput, description })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);

    document.getElementById('contest-input').value = '';
    document.getElementById('contest-desc').value = '';
    fetchUserCoins(); loadContests();
    alert('Contest advertised successfully! +5 Coins');
}

async function loadStudios() {
    const feed = document.getElementById('studios-feed');
    try {
        const res = await fetch(`${API_BASE_URL}/api/studios`);
        const studios = await res.json();
        feed.innerHTML = studios.length === 0 ? '<p style="text-align:center; color:var(--text-secondary); margin-top:20px;">No studios advertised yet. Be the first!</p>' : '';
        
        studios.forEach(s => {
            feed.innerHTML += `
                <div class="card">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="${escapeHTML(s.image)}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;">
                        <div>
                            <h3>${escapeHTML(s.title)}</h3>
                            <p style="font-size:13px; color:var(--text-secondary);">Advertised by <strong>${escapeHTML(s.advertiser)}</strong></p>
                        </div>
                    </div>
                    <p style="font-size:14px; margin:12px 0;">${escapeHTML(s.description)}</p>
                    <a href="https://scratch.mit.edu/studios/${s.studioId}" target="_blank" class="btn-outline" style="width:100%;">Visit Scratch Studio</a>
                </div>
            `;
        });
    } catch (e) { feed.innerHTML = '<p style="color:red; text-align:center;">Error loading studios.</p>'; }
}

async function submitStudio() {
    if (!currentUser) return alert('Log in to advertise a studio.');
    const studioInput = document.getElementById('studio-input').value;
    const description = document.getElementById('studio-desc').value;

    const res = await fetch(`${API_BASE_URL}/api/studios`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ studioInput, description })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);

    document.getElementById('studio-input').value = '';
    document.getElementById('studio-desc').value = '';
    fetchUserCoins(); loadStudios();
    alert('Studio advertised successfully! +5 Coins');
}

async function loadAccountPage() {
    const container = document.getElementById('account-profile-content');
    if (!currentUser) return container.innerHTML = '<div class="card"><p>Log in to view profile details.</p></div>';

    const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(currentUser)}`);
    const data = await res.json();
    
    container.innerHTML = `
        <div class="card">
            <h2 style="color:${escapeHTML(data.color)}">${escapeHTML(data.username)} ${(data.badges || []).join(' ')}</h2>
            <p style="margin-top:8px;">Coins: <strong>${data.coins}</strong></p>
            <p>Referral Code: <code>${escapeHTML(data.referralCode)}</code></p>
        </div>
    `;
}
