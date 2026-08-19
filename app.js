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

    if (tabName === 'home') {
        document.getElementById('feed-section').style.display = 'block';
        loadPosts();
    } else if (tabName === 'explore') {
        document.getElementById('explore-section').style.display = 'block';
        loadExplore();
    } else if (tabName === 'notifications') {
        document.getElementById('notifications-section').style.display = 'block';
        loadNotifications();
    }
}

async function loadPosts() {
    try {
        const res = await fetch(`${API_URL}/posts`);
        const posts = await res.json();
        renderFeed('feed', posts);
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

        // Register view when card is rendered/viewed
        incrementView(post.id);

        let commentsHtml = '';
        if (post.comments && post.comments.length > 0) {
            post.comments.forEach(c => {
                commentsHtml += `<div class="comment-item"><strong>${c.commenterName}:</strong> ${c.text}</div>`;
            });
        } else {
            commentsHtml = `<div class="no-comments">No BlockBuzz comments yet. Be the first!</div>`;
        }

        card.innerHTML = `
            <div class="card-header">
                <i class="fa-solid fa-circle-user"></i>
                ${poster} shared a project
            </div>
            
            <img src="${post.thumbnail}" alt="Thumbnail" class="project-thumb" onerror="this.src='https://uploads.scratch.mit.edu/get_image/project/1_480x360.png'">
            
            <div class="card-body">
                <h2 class="card-title"><a href="https://scratch.mit.edu/projects/${post.scratchId}" target="_blank">${title}</a></h2>
                <div class="card-author">Created by ${author}</div>
                <p class="card-caption">${caption}</p>
            </div>

            <div class="action-bar">
                <div class="action-stats">
                    <span><i class="fa-solid fa-heart" style="color:#f02849;"></i> <span id="likes-${post.id}">${formattedLikes}</span></span>
                    <span style="margin-left: 15px;"><i class="fa-solid fa-eye" style="color:#0095f6;"></i> <span id="views-${post.id}">${formattedViews}</span></span>
                </div>
                <button class="action-btn" onclick="likePost(${post.id}, this)">
                    <i class="fa-regular fa-heart"></i> Love
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

async function likePost(id, btnElement) {
    try {
        const res = await fetch(`${API_URL}/posts/${id}/like`, { method: 'POST' });
        const data = await res.json();
        document.getElementById(`likes-${id}`).innerText = formatNumber(data.likes);
        
        const icon = btnElement.querySelector('i');
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid');
        btnElement.style.color = '#f02849';
    } catch (error) {
        console.error('Error liking post:', error);
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

// Scratch Comment Verification Auth Flow
let verificationTempCode = '';

function openAuthModal() {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Scratch Account Verification</h3>
                <div id="auth-step-1">
                    <p>Enter your Scratch username to verify your identity via profile comment:</p>
                    <input type="text" id="scratch-username-input" placeholder="Scratch Username" class="comment-field" style="width:100%; margin-bottom:10px;">
                    <button onclick="requestVerificationCode()" class="comment-submit-btn" style="width:100%; padding: 10px;">Get Verification Code</button>
                </div>
                <div id="auth-step-2" style="display:none;">
                    <p id="verify-instructions" style="font-size:13px; line-height:1.4; color:#333;"></p>
                    <input type="password" id="new-password-input" placeholder="Choose a BlockBuzz Password" class="comment-field" style="width:100%; margin:10px 0;">
                    <button onclick="verifyAndRegister()" class="comment-submit-btn" style="width:100%; padding: 10px;">Verify & Register</button>
                </div>
                <div id="auth-login-toggle" style="margin-top:15px; text-align:center; font-size:13px;">
                    Already verified? <a href="#" onclick="toggleLoginMode()" style="color:#0095f6;">Log in instead</a>
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
        document.getElementById('verify-instructions').innerHTML = `1. Go to your <a href="https://scratch.mit.dev/users/${username}" target="_blank">Scratch Profile</a>.<br>2. Post this exact code as a comment: <b>${verificationCode}</b><br>3. Come back here and set your password!`;
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
        alert(`Successfully verified and logged in as @${currentUser}!`);
    } catch (err) {
        alert(err.message);
    }
}

function toggleLoginMode() {
    const step1 = document.getElementById('auth-step-1');
    step1.innerHTML = `
        <p>Log in with your verified Scratch username:</p>
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
        authContainer.innerHTML = `<span style="font-weight:600; color:#0095f6;">@${currentUser}</span> <button onclick="logoutUser()" class="comment-submit-btn" style="padding: 4px 8px; margin-left: 8px; font-size:11px;">Logout</button>`;
    } else {
        authContainer.innerHTML = `<button onclick="openAuthModal()" class="comment-submit-btn" style="padding: 6px 12px; font-size:12px;">Login / Verify with Scratch</button>`;
    }
}

function formatNumber(num) {
    return num >= 1000 ? (num / 1000).toFixed(1) + 'K' : num;
}
