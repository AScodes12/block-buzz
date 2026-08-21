const API_BASE_URL = 'https://regional-personally-acting-surgical.trycloudflare.com';
let currentUser = null;

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

function checkSession() {
    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            currentUser = data.user ? data.user.username : null;
            updateAuthUI();
            loadPosts();
        })
        .catch(err => console.error('Session check error:', err));
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
        container.innerHTML = `
            <button onclick="startVerificationFlow()" class="btn">Log In</button>
        `;
    }
}

async function fetchUserCoins() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(currentUser)}`, { credentials: 'include' });
        const data = await res.json();
        const coinsEl = document.getElementById('header-coins');
        if (coinsEl && data.coins !== undefined) coinsEl.textContent = data.coins;
    } catch (e) {
        console.error('Failed to fetch coins', e);
    }
}

async function startVerificationFlow() {
    const username = prompt('Enter your Scratch Username:');
    if (!username || !username.trim()) return;

    const refCode = prompt('Enter a Referral Code (Optional - leave blank if none):');

    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/register-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
                username: username.trim(),
                referralCode: refCode 
            })
        });
        const data = await res.json();

        if (data.error) return alert(data.error);

        const code = data.verificationCode;
        alert(`Step 1: Copy this code:\n\n${code}\n\nStep 2: Paste it into your Scratch Profile Bio.\nStep 3: Click OK to verify.`);

        verifyAccount(username.trim());
    } catch (e) {
        alert('Network error connecting to backend.');
    }
}

async function verifyAccount(username) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username })
        });
        const data = await res.json();

        if (data.error) {
            alert(data.error);
        } else {
            if (data.isNewUser) {
                // Show bonus banner only if a valid referral code was used
                const banner = document.getElementById('bonus-banner');
                if (data.bonusApplied) {
                    banner.style.display = 'block';
                } else {
                    banner.style.display = 'none';
                }
                document.getElementById('verification-modal').style.display = 'flex';
            } else {
                alert(`Welcome back, ${data.username}!`);
            }
            checkSession();
        }
    } catch (e) {
        alert('Verification request failed.');
    }
}

function closeModal() {
    document.getElementById('verification-modal').style.display = 'none';
}

async function logout() {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    currentUser = null;
    updateAuthUI();
    loadPosts();
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));

    const section = document.getElementById(`${tabName}-section`);
    const navBtn = document.getElementById(`nav-${tabName}`);

    if (section) section.style.display = 'block';
    if (navBtn) navBtn.classList.add('active');

    if (tabName === 'account') loadAccountPage();
    if (tabName === 'store') renderStore();
}

async function loadPosts() {
    const feed = document.getElementById('feed');
    if (!feed) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/posts`, { credentials: 'include' });
        const posts = await res.json();

        feed.innerHTML = '';
        if (posts.length === 0) {
            feed.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">No posts shared yet.</p>';
            return;
        }

        posts.forEach(post => {
            const card = document.createElement('div');
            card.className = 'project-card';

            card.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="avatar-wrapper"><img src="${escapeHTML(post.authorPfp)}"></div>
                    <strong style="color:${escapeHTML(post.authorColor)}">${escapeHTML(post.author)}</strong>
                </div>
                <img src="${escapeHTML(post.thumbnail)}" class="project-thumb">
                <h4 style="margin-bottom:6px;">${escapeHTML(post.title)}</h4>
                <p style="font-size:14px;">${escapeHTML(post.caption)}</p>
            `;
            feed.appendChild(card);
        });
    } catch (e) {
        feed.innerHTML = '<p style="color:red; text-align:center;">Error loading posts.</p>';
    }
}

async function submitPost() {
    if (!currentUser) return alert('Log in to share a project.');

    const scratchInput = document.getElementById('scratch-input').value;
    const caption = document.getElementById('post-caption').value;

    const res = await fetch(`${API_BASE_URL}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scratchInput, caption })
    });

    const data = await res.json();
    if (data.error) {
        alert(data.error);
    } else {
        document.getElementById('scratch-input').value = '';
        document.getElementById('post-caption').value = '';
        fetchUserCoins();
        loadPosts();
    }
}

function renderStore() {
    const container = document.getElementById('store-items');
    if (!container) return;

    const items = [
        { name: 'Gold Glow', price: 100, color: '#eab308' },
        { name: 'Neon Purple', price: 150, color: '#a855f7' },
        { name: 'Emerald Green', price: 150, color: '#10b981' },
        { name: 'Ruby Red', price: 200, color: '#ef4444' },
        { name: 'Ocean Blue', price: 150, color: '#0ea5e9' },
        { name: 'Hot Pink', price: 250, color: '#ec4899' }
    ];

    container.innerHTML = items.map(item => `
        <div style="border:1px solid var(--border-color); padding:12px; border-radius:10px; text-align:center; background:#fff;">
            <div style="width:28px; height:28px; background:${item.color}; border-radius:50%; margin:0 auto 8px auto;"></div>
            <strong>${escapeHTML(item.name)}</strong>
            <p style="font-size:13px; color:var(--text-secondary); margin:4px 0 10px 0;">${item.price} Coins</p>
            <button onclick="buyItem('${item.color}', ${item.price})" class="btn" style="width:100%; font-size:13px;">Buy</button>
        </div>
    `).join('');
}

async function buyItem(color, price) {
    if (!currentUser) return alert('Log in to buy items from the store.');

    const res = await fetch(`${API_BASE_URL}/api/store/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ color, price })
    });

    const data = await res.json();
    if (data.error) {
        alert(data.error);
    } else {
        alert('Item purchased successfully! Your new post header color has been updated.');
        fetchUserCoins();
        loadPosts();
    }
}

async function loadAccountPage() {
    const container = document.getElementById('account-profile-content');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = '<div class="create-card"><p>Please log in to view profile details.</p></div>';
        return;
    }

    const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(currentUser)}`, { credentials: 'include' });
    const data = await res.json();

    container.innerHTML = `
        <div class="create-card">
            <h2 style="color:${escapeHTML(data.color)}">${escapeHTML(data.username)}</h2>
            <p style="margin-top:8px;">Coin Balance: <strong>${data.coins}</strong></p>
            <p>Referral Code: <code>${escapeHTML(data.referralCode)}</code></p>
        </div>
    `;
}
