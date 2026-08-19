const API_URL = 'https://review-baghdad-est-engagement.trycloudflare.com/api';
let currentUser = localStorage.getItem('blockbuzz_user') || null;

document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    loadPosts();
});

function switchTab(tabName) {
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    document.getElementById('feed-section').style.display = 'none';
    document.getElementById('explore-section').style.display = 'none';
    document.getElementById('notifications-section').style.display = 'none';
    document.getElementById('account-section').style.display = 'none';

    if (tabName === 'home') {
        document.getElementById('feed-section').style.display = 'block';
        loadPosts();
    } else if (tabName === 'explore') {
        document.getElementById('explore-section').style.display = 'block';
        loadExplore();
    } else if (tabName === 'notifications') {
        document.getElementById('notifications-section').style.display = 'block';
        loadNotifications();
    } else if (tabName === 'account') {
        document.getElementById('account-section').style.display = 'block';
        loadAccountPage();
    }
}

async function loadPosts() {
    try {
        const res = await fetch(`${API_URL}/posts`);
        const posts = await res.json();
        renderFeed('feed', posts);
        renderFeatured(posts);
    } catch (err) {
        console.error('Error loading posts:', err);
    }
}

async function loadExplore() {
    try {
        const res = await fetch(`${API_URL}/explore`);
        const posts = await res.json();
        renderFeed('explore-feed', posts);
    } catch (err) {
        console.error('Error loading explore:', err);
    }
}

function renderFeatured(posts) {
    const container = document.getElementById('featured-container');
    if (!posts || posts.length === 0) {
        container.innerHTML = '';
        return;
    }
    // Find the post with the highest engagement (likes + views)
    const featured = [...posts].sort((a, b) => (b.blockbuzz_likes + b.blockbuzz_views) - (a.blockbuzz_likes + a.blockbuzz_views))[0];
    
    container.innerHTML = `
        <div class="featured-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-weight:bold; color:var(--primary-color); font-size:13px;"><i class="fa-solid fa-star"></i> Featured Project</span>
                <span style="font-size:12px; color:#65676b;">By ${featured.author}</span>
            </div>
            <h3 style="margin:0 0 6px 0; font-size:16px;"><a href="#" onclick="openProjectModal(${featured.id}); return false;" style="color:var(--text-color); text-decoration:none;">${featured.title}</a></h3>
            <p style="font-size:13px; color:#65676b; margin:0 0 10px 0;">${featured.caption}</p>
            <img src="${featured.thumbnail}" alt="Thumbnail" class="project-thumb" style="max-height:220px; object-fit:cover;" onclick="openProjectModal(${featured.id})">
        </div>
    `;
}

async function renderFeed(containerId, posts) {
    const feed = document.getElementById(containerId);
    feed.innerHTML = '';
    
    if (posts.length === 0) {
        feed.innerHTML = '<p style="text-align:center; color:#65676b; margin-top: 40px;">No projects found yet.</p>';
        return;
    }

    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'project-card';
        
        const formattedLikes = formatNumber(post.blockbuzz_likes || 0);
        const formattedViews = formatNumber(post.blockbuzz_views || 0);
        const poster = post.posterName || 'Anonymous';
        const caption = post.caption || '';
        const title = post.title || 'Untitled Project';
        const author = post.author || 'Unknown';

        incrementView(post.id);

        let commentsHtml = '';
        if (post.comments && post.comments.length > 0) {
            post.comments.slice(-2).forEach(c => {
                commentsHtml += `<div class="comment-item"><strong>${c.commenterName}:</strong> ${c.text}</div>`;
            });
        } else {
            commentsHtml = `<div class="no-comments">No BlockBuzz comments yet. Be the first!</div>`;
        }

        const likedPosts = JSON.parse(localStorage.getItem('blockbuzz_liked_posts') || '{}');
        const isLoved = likedPosts[post.id] || false;

        card.innerHTML = `
            <div class="card-header">
                <i class="fa-solid fa-circle-user"></i>
                ${poster} shared a project
            </div>
            
            <img src="${post.thumbnail}" alt="Thumbnail" class="project-thumb" onclick="openProjectModal(${post.id})" onerror="this.src='https://uploads.scratch.mit.edu/get_image/project/1_480x360.png'">
            
            <div class="card-body">
                <h2 class="card-title"><a href="#" onclick="openProjectModal(${post.id}); return false;">${title}</a></h2>
                <div class="card-author">Created by ${author}</div>
                <p class="card-caption">${caption}</p>
            </div>

            <div class="action-bar">
                <div class="action-stats">
                    <span><i class="fa-solid fa-heart" style="color:#f02849;"></i> <span id="likes-${post.id}">${formattedLikes}</span></span>
                    <span style="margin-left: 15px;"><i class="fa-solid fa-eye" style="color:#0095f6;"></i> <span id="views-${post.id}">${formattedViews}</span></span>
                </div>
                <button class="action-btn ${isLoved ? 'loved' : ''}" id="like-btn-${post.id}" onclick="toggleLike(${post.id})">
                    <i class="${isLoved ? 'fa-solid' : 'fa-regular'} fa-heart"></i> Love
                </button>
            </div>

            <div class="comments-section">
                <div class="comments-list" id="comments-list-${post.id}">
                    ${commentsHtml}
                </div>
                <div class="comment-input-row">
                    <input type="text" id="comment-text-${post.id}" placeholder="Write a BlockBuzz comment..." class="comment-field" onkeypress="handleCommentKey(event, ${post.id})">
                    <button onclick="submitComment(${post.id})" class="comment-submit-btn">Post</button>
                </div>
            </div>
        `;
        feed.appendChild(card);
    });
}

async function incrementView(postId) {
    try {
        const res = await fetch(`${API_URL}/posts/${postId}/view`, { method: 'POST' });
        const data = await res.json();
        const viewEl = document.getElementById(`views-${postId}`);
        if (viewEl) viewEl.innerText = formatNumber(data.views);
    } catch (err) {
        console.error('Error incrementing view:', err);
    }
}

async function toggleLike(id) {
    const likedPosts = JSON.parse(localStorage.getItem('blockbuzz_liked_posts') || '{}');
    const isAlreadyLoved = likedPosts[id] || false;
    const action = isAlreadyLoved ? 'unlike' : 'like';

    try {
        const res = await fetch(`${API_URL}/posts/${id}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        const data = await res.json();
        
        document.getElementById(`likes-${id}`).innerText = formatNumber(data.likes);
        
        const btnElement = document.getElementById(`like-btn-${id}`);
        const icon = btnElement.querySelector('i');
        
        if (action === 'like') {
            likedPosts[id] = true;
            btnElement.classList.add('loved');
            icon.classList.remove('fa-regular');
            icon.classList.add('fa-solid');
        } else {
            delete likedPosts[id];
            btnElement.classList.remove('loved');
            icon.classList.remove('fa-solid');
            icon.classList.add('fa-regular');
        }
        localStorage.setItem('blockbuzz_liked_posts', JSON.stringify(likedPosts));
    } catch (error) {
        console.error('Error liking post:', error);
    }
}

async function openProjectModal(postId) {
    const modal = document.getElementById('project-detail-modal');
    const modalBody = document.getElementById('detail-modal-body');
    modalBody.innerHTML = '<p style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading project from Scratch...</p>';
    modal.style.display = 'flex';

    try {
        const res = await fetch(`${API_URL}/posts/${postId}`);
        const post = await res.json();

        modalBody.innerHTML = `
            <img src="${post.thumbnail}" alt="Thumbnail" class="project-thumb" style="max-height:240px; object-fit:cover;">
            <h2 style="margin: 0 0 5px 0;"><a href="https://scratch.mit.edu/projects/${post.scratchId}" target="_blank" style="color:var(--primary-color); text-decoration:none;">${post.title} <i class="fa-solid fa-external-link" style="font-size:12px;"></i></a></h2>
            <div style="font-size:13px; color:#65676b; margin-bottom:12px;">Created by <b>${post.author}</b> • Shared by @${post.posterName || 'Anonymous'}</div>
            <p style="font-size:14px; background:#f0f2f5; padding:10px; border-radius:6px; margin-bottom:12px;"><b>Caption:</b> ${post.caption}</p>
            
            <div style="margin-bottom:12px;">
                <h4 style="margin:0 0 4px 0; font-size:14px;">Instructions:</h4>
                <p style="font-size:13px; color:#333; margin:0; background:#f9fafb; padding:8px; border-radius:6px; border:1px solid #eee;">${post.instructions}</p>
            </div>

            <div style="margin-bottom:15px;">
                <h4 style="margin:0 0 4px 0; font-size:14px;">Notes and Credits:</h4>
                <p style="font-size:13px; color:#333; margin:0; background:#f9fafb; padding:8px; border-radius:6px; border:1px solid #eee;">${post.description}</p>
            </div>
        `;
    } catch (err) {
        modalBody.innerHTML = '<p style="text-align:center; color:red;">Could not load project details.</p>';
    }
}

function closeProjectModal() {
    document.getElementById('project-detail-modal').style.display = 'none';
}

async function loadAccountPage() {
    const container = document.getElementById('account-profile-content');
    if (!currentUser) {
        container.innerHTML = '<div class="project-card" style="text-align:center; padding:30px;"><p>You are not logged in.</p><button onclick="openAuthModal()" class="comment-submit-btn">Login / Verify with Scratch</button></div>';
        return;
    }

    container.innerHTML = `<p style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading profile...</p>`;

    try {
        const res = await fetch(`${API_URL}/users/${currentUser}`);
        const data = await res.json();

        let postsHtml = '';
        if (data.posts && data.posts.length > 0) {
            data.posts.forEach(p => {
                postsHtml += `
                    <div style="display:flex; align-items:center; gap:10px; background:#f9fafb; padding:10px; border-radius:8px; border:1px solid #ddd; margin-bottom:8px;">
                        <img src="${p.thumbnail}" style="width:80px; height:60px; border-radius:4px; object-fit:cover;">
                        <div>
                            <h4 style="margin:0 0 4px 0; font-size:14px;">${p.title}</h4>
                            <span style="font-size:12px; color:#65676b;"><i class="fa-solid fa-heart" style="color:#f02849;"></i> ${p.blockbuzz_likes || 0} &nbsp;|&nbsp; <i class="fa-solid fa-eye" style="color:#0095f6;"></i> ${p.blockbuzz_views || 0}</span>
                        </div>
                    </div>
                `;
            });
        } else {
            postsHtml = '<p style="color:#65676b; font-size:13px; font-style:italic;">You haven\'t shared any projects yet.</p>';
        }

        container.innerHTML = `
            <div class="project-card" style="text-align:center; padding:25px;">
                <i class="fa-solid fa-circle-user" style="font-size:60px; color:var(--primary-color); margin-bottom:10px;"></i>
                <h2 style="margin:0 0 5px 0;">@${data.username}</h2>
                <p style="font-size:13px; color:#65676b; margin-bottom:15px;">Verified Scratch Creator on BlockBuzz</p>
                <div style="display:flex; justify-content:center; gap:30px; border-top:1px solid #ddd; border-bottom:1px solid #ddd; padding:10px 0; margin-bottom:20px; font-size:14px;">
                    <div><b>${data.posts.length}</b> Shared Projects</div>
                    <div><b>${data.commentCount}</b> Comments Made</div>
                </div>
                <button onclick="logoutUser()" class="action-btn" style="background:#fee2e2; color:#dc2626; padding:8px 16px; border-radius:6px; margin:0 auto; justify-content:center;">Log Out</button>
            </div>
            <h3 style="margin-top:20px;">Your Shared Projects</h3>
            ${postsHtml}
        `;
    } catch (err) {
        container.innerHTML = '<p style="text-align:center; color:red;">Error loading account profile.</p>';
    }
}

async function submitPost() {
    if (!currentUser) {
        alert("You must log in with your Scratch account first!");
        openAuthModal();
        return;
    }

    const scratchInput = document.getElementById('scratch-input');
    const captionInput = document.getElementById('post-caption');
    const btn = document.querySelector('.post-btn');
    
    if(!scratchInput.value) {
        alert("A Scratch Project URL or ID is required!");
        return;
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                scratchInput: scratchInput.value,
                caption: captionInput.value,
                username: currentUser
            })
        });
        
        if (!response.ok) {
            alert("Could not load project from Scratch. Check your link or ID!");
        } else {
            scratchInput.value = '';
            captionInput.value = '';
            switchTab('home');
        }
    } catch (err) {
        console.error(err);
        alert("Server error connecting to API.");
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Post';
        btn.disabled = false;
    }
}

async function submitComment(postId) {
    if (!currentUser) {
        alert("Please log in with Scratch to comment.");
        openAuthModal();
        return;
    }

    const textInput = document.getElementById(`comment-text-${postId}`);
    if (!textInput.value.trim()) return;

    try {
        const res = await fetch(`${API_URL}/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                commenterName: currentUser,
                text: textInput.value
            })
        });

        if (res.ok) {
            textInput.value = '';
            loadPosts();
        }
    } catch (err) {
        console.error('Error posting comment:', err);
    }
}

function handleCommentKey(event, postId) {
    if (event.key === 'Enter') {
        submitComment(postId);
    }
}

async function loadNotifications() {
    const container = document.getElementById('notifications-container');
    if (!currentUser) {
        container.innerHTML = '<p style="text-align:center; color:#65676b; margin-top: 40px;">Please log in to see your notifications.</p>';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/notifications/${currentUser}`);
        const notes = await res.json();
        container.innerHTML = '';

        if (notes.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#65676b; margin-top: 40px;">No notifications yet.</p>';
            return;
        }

        notes.forEach(n => {
            const item = document.createElement('div');
            item.className = 'notification-item';
            item.innerHTML = `<span>${n.text}</span> <small>${n.timestamp}</small>`;
            container.appendChild(item);
        });
    } catch (err) {
        console.error('Error loading notifications:', err);
    }
}

let verificationTempCode = '';

function openAuthModal() {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Scratch Bio Verification</h3>
                <div id="auth-step-1">
                    <p style="font-size:13px; color:#65676b; margin-bottom:10px;">Enter your Scratch username to verify your identity:</p>
                    <input type="text" id="scratch-username-input" placeholder="Scratch Username" class="comment-field" style="width:100%; margin-bottom:10px;">
                    <button onclick="requestVerificationCode()" class="comment-submit-btn" style="width:100%; padding: 10px;">Get Verification Code</button>
                </div>
                <div id="auth-step-2" style="display:none;">
                    <p id="verify-instructions" style="font-size:13px; line-height:1.4; color:#333; margin-bottom:10px;"></p>
                    <input type="password" id="new-password-input" placeholder="Choose a BlockBuzz Password" class="comment-field" style="width:100%; margin-bottom:10px;">
                    <button onclick="verifyAndRegister()" class="comment-submit-btn" style="width:100%; padding: 10px;">Verify & Register</button>
                </div>
                <div id="auth-login-toggle" style="margin-top:15px; text-align:center; font-size:13px;">
                    Already registered? <a href="#" onclick="toggleLoginMode()" style="color:#0095f6;">Log in instead</a>
                </div>
                <button onclick="closeAuthModal()" style="margin-top:15px; background:none; border:none; color:#666; cursor:pointer; width:100%;">Cancel</button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
}

async function requestVerificationCode() {
    const username = document.getElementById('scratch-username-input').value.trim();
    if (!username) return alert("Enter your Scratch username!");

    try {
        const res = await fetch(`${API_URL}/auth/register-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        verificationTempCode = data.verificationCode;
        window.tempUsername = username;

        document.getElementById('auth-step-1').style.display = 'none';
        document.getElementById('auth-step-2').style.display = 'block';
        document.getElementById('verify-instructions').innerHTML = `1. Go to your <a href="https://scratch.mit.edu/users/${username}" target="_blank">Scratch Profile</a>.<br>2. Add this code to your <b>About Me (Bio)</b>: <br><code style="background:#e4e6eb; padding:3px 6px; font-weight:bold; display:inline-block; margin:4px 0;">${verificationTempCode}</code><br>3. Come back here and set your password!`;
    } catch (err) {
        alert(err.message);
    }
}

async function verifyAndRegister() {
    const password = document.getElementById('new-password-input').value;
    if (!password) return alert("Enter a password!");

    try {
        const res = await fetch(`${API_URL}/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: window.tempUsername, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        currentUser = data.username;
        localStorage.setItem('blockbuzz_user', currentUser);
        updateAuthUI();
        closeAuthModal();
        alert(`Successfully verified and logged in as @${currentUser}! You can now remove the code from your Scratch bio.`);
    } catch (err) {
        alert(err.message);
    }
}

function toggleLoginMode() {
    const step1 = document.getElementById('auth-step-1');
    step1.innerHTML = `
        <p style="font-size:13px; color:#65676b; margin-bottom:10px;">Log in with your verified Scratch username:</p>
        <input type="text" id="login-username" placeholder="Scratch Username" class="comment-field" style="width:100%; margin-bottom:10px;">
        <input type="password" id="login-password" placeholder="Password" class="comment-field" style="width:100%; margin-bottom:10px;">
        <button onclick="loginUser()" class="comment-submit-btn" style="width:100%; padding: 10px;">Log In</button>
    `;
    document.getElementById('auth-login-toggle').style.display = 'none';
}

async function loginUser() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) return alert("Fill in all fields!");

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        currentUser = data.username;
        localStorage.setItem('blockbuzz_user', currentUser);
        updateAuthUI();
        closeAuthModal();
    } catch (err) {
        alert(err.message);
    }
}

function logoutUser() {
    currentUser = null;
    localStorage.removeItem('blockbuzz_user');
    updateAuthUI();
    switchTab('home');
}

function updateAuthUI() {
    const authContainer = document.getElementById('auth-container');
    if (!authContainer) return;

    if (currentUser) {
        authContainer.innerHTML = `<span style="font-weight:600; color:#0095f6; cursor:pointer;" onclick="switchTab('account')">@${currentUser}</span>`;
    } else {
        authContainer.innerHTML = `<button onclick="openAuthModal()" class="comment-submit-btn" style="padding: 6px 12px; font-size:12px;">Login / Verify</button>`;
    }
}

function formatNumber(num) {
    return num >= 1000 ? (num / 1000).toFixed(1) + 'K' : num;
}
