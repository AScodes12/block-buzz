/* ==========================================================================
   FRONTEND APPLICATION LOGIC (XSS SAFE)
   ========================================================================== */

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
    fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
            currentUser = data.user ? data.user.username : null;
            updateAuthUI();
            loadPosts();
        });
}

function updateAuthUI() {
    const container = document.getElementById('auth-container');
    if (!container) return;

    if (currentUser) {
        container.innerHTML = `
            <span style="font-size:14px; margin-right:10px; font-weight:600;">${escapeHTML(currentUser)}</span>
            <button onclick="logout()" class="btn" style="background:#dc2626;">Logout</button>
        `;
    } else {
        container.innerHTML = `
            <button onclick="startVerificationFlow()" class="btn">Login with Scratch</button>
        `;
    }
}

async function startVerificationFlow() {
    const username = prompt('Enter your Scratch Username:');
    if (!username || !username.trim()) return;

    try {
        const res = await fetch('/api/auth/register-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username.trim() })
        });
        const data = await res.json();

        if (data.error) return alert(data.error);

        const code = data.verificationCode;
        alert(`Step 1: Copy this code:\n\n${code}\n\nStep 2: Paste it into your Scratch Profile Bio.\nStep 3: Click OK to complete verification.`);

        verifyAccount(username.trim());
    } catch (e) {
        alert('Network error.');
    }
}

async function verifyAccount(username) {
    try {
        const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();

        if (data.error) {
            alert(data.error);
        } else {
            alert('Verified successfully!');
            checkSession();
        }
    } catch (e) {
        alert('Verification request failed.');
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    updateAuthUI();
    loadPosts();
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));

    const section = document.getElementById(`${tabName}-section`);
    if (section) section.style.display = 'block';

    if (tabName === 'account') loadAccountPage();
}

async function loadPosts() {
    const feed = document.getElementById('feed');
    if (!feed) return;

    try {
        const res = await fetch('/api/posts');
        const posts = await res.json();

        feed.innerHTML = '';
        if (posts.length === 0) {
            feed.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">No posts shared yet.</p>';
            return;
        }

        posts.forEach(post => {
            const card = document.createElement('div');
            card.className = 'project-card';

            const safeAuthor = escapeHTML(post.author);
            const safeTitle = escapeHTML(post.title);
            const safeCaption = escapeHTML(post.caption);

            card.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="avatar-wrapper"><img src="${escapeHTML(post.authorPfp)}"></div>
                    <strong style="color:${escapeHTML(post.authorColor)}">${safeAuthor}</strong>
                </div>
                <img src="${escapeHTML(post.thumbnail)}" class="project-thumb">
                <h4 style="margin-bottom:6px;">${safeTitle}</h4>
                <p style="font-size:14px;">${safeCaption}</p>
            `;
            feed.appendChild(card);
        });
    } catch (e) {
        feed.innerHTML = '<p style="color:red;">Error loading posts.</p>';
    }
}

async function submitPost() {
    if (!currentUser) return alert('Log in to share a project.');

    const scratchInput = document.getElementById('scratch-input').value;
    const caption = document.getElementById('post-caption').value;

    const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scratchInput, caption })
    });

    const data = await res.json();
    if (data.error) {
        alert(data.error);
    } else {
        document.getElementById('scratch-input').value = '';
        document.getElementById('post-caption').value = '';
        loadPosts();
    }
}

async function loadAccountPage() {
    const container = document.getElementById('account-profile-content');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = '<p>Please log in to view profile details.</p>';
        return;
    }

    const res = await fetch(`/api/users/${encodeURIComponent(currentUser)}`);
    const data = await res.json();

    container.innerHTML = `
        <div class="create-card">
            <h2>${escapeHTML(data.username)}</h2>
            <p style="margin-top:8px;">Coins: <strong>${data.coins}</strong></p>
            <p>Referral Code: <code>${escapeHTML(data.referralCode)}</code></p>
        </div>
    `;
}
