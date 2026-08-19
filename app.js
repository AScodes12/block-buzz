const API_URL = 'http://localhost:3000/api';
let currentUser = localStorage.getItem('blockbuzz_user') || null;

let cachedPosts = null;
let cachedExplore = null;
let cachedContests = null;
let isSubmittingPost = false;

document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    loadPosts(true);
});

function switchTab(tabName) {
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(`${tabName}-section`).style.display = 'block';

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    if (tabName === 'home') loadPosts();
    else if (tabName === 'explore') loadExplore();
    else if (tabName === 'contests') loadContests();
    else if (tabName === 'shop') loadShop();
    else if (tabName === 'account') loadAccountPage();
}

async function loadPosts(forceRefresh = false) {
    if (cachedPosts && !forceRefresh) {
        renderFeed('feed', cachedPosts);
        return;
    }
    try {
        const res = await fetch(`${API_URL}/posts`);
        cachedPosts = await res.json();
        renderFeed('feed', cachedPosts);
    } catch (err) { console.error('Error loading posts:', err); }
}

async function loadExplore() {
    if (cachedExplore) {
        renderFeed('explore-feed', cachedExplore);
        return;
    }
    try {
        const res = await fetch(`${API_URL}/explore`);
        cachedExplore = await res.json();
        renderFeed('explore-feed', cachedExplore);
    } catch (err) { console.error('Error loading explore:', err); }
}

async function loadContests() {
    try {
        const res = await fetch(`${API_URL}/contests`);
        cachedContests = await res.json();
        renderContests(cachedContests);
    } catch(e) {}
}

function renderContests(contests) {
    const container = document.getElementById('contests-container');
    if (!container) return;
    container.innerHTML = contests.map(c => `
        <div class="contest-card">
            <h3><i class="fa-solid fa-award"></i> ${c.title}</h3>
            <p>${c.description}</p>
            <p style="font-size:13px; color:#16a34a; font-weight:bold;"><i class="fa-solid fa-gift"></i> Prize: ${c.prize}</p>
            <small style="color:#65676b;">Advertised by @${c.poster}</small>
            <div style="margin-top:10px;">
                <button onclick="switchTab('home')" class="comment-submit-btn">Share Project to Enter</button>
            </div>
        </div>
    `).join('');
}

async function submitContest() {
    if (!currentUser) return openAuthModal();
    const title = document.getElementById('contest-title').value.trim();
    const description = document.getElementById('contest-desc').value.trim();
    const prize = document.getElementById('contest-prize').value.trim();

    if (!title || !description) return alert("Title and description are required!");

    try {
        const res = await fetch(`${API_URL}/contests`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ title, description, prize, username: currentUser })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        document.getElementById('contest-title').value = '';
        document.getElementById('contest-desc').value = '';
        document.getElementById('contest-prize').value = '';
        alert("Contest published successfully!");
        loadContests();
    } catch (err) { alert(err.message); }
}

function getAverageRating(ratings) {
    if (!ratings || ratings.length === 0) return 'No Ratings';
    const sum = ratings.reduce((a, b) => a + b.score, 0);
    return (sum / ratings.length).toFixed(1) + ' / 10';
}

function renderComments(comments, postId) {
    const mainComments = comments.filter(c => !c.parentId);
    let html = '';
    
    mainComments.slice(-3).forEach(c => {
        html += `<div class="comment-item">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <div class="avatar-wrapper frame-${c.commenterFrame || 'none'}" style="width:24px; height:24px;"><img src="https://uploads.scratch.mit.edu/get_image/user/1_90x90.png"></div>
                <strong style="color:${c.commenterColor || '#050505'}">${c.commenterName}:</strong>
            </div>
            <div>${c.text}</div>
            <button class="reply-btn" onclick="toggleReplyBox(${c.id})"><i class="fa-solid fa-reply"></i> Reply</button>
        `;
        const replies = comments.filter(r => r.parentId === c.id);
        replies.forEach(r => {
            html += `<div class="reply-item"><strong><i class="fa-solid fa-arrow-turn-up fa-rotate-90"></i> ${r.commenterName}:</strong> ${r.text}</div>`;
        });
        
        html += `<div class="reply-input-row" id="reply-box-${c.id}">
            <input type="text" id="reply-text-${c.id}" placeholder="Write a reply..." class="comment-field" style="padding:6px; font-size:12px;">
            <button onclick="submitReply(${postId}, ${c.id})" class="comment-submit-btn" style="padding:6px 10px; font-size:12px;">Reply</button>
        </div></div>`;
    });
    return html || '<div style="color:#65676b; font-style:italic;">No comments yet.</div>';
}

function toggleReplyBox(commentId) {
    if (!currentUser) return openAuthModal();
    const box = document.getElementById(`reply-box-${commentId}`);
    if (box) box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
}

function renderFeed(containerId, posts) {
    const feed = document.getElementById(containerId);
    if (!feed) return;
    feed.innerHTML = posts.length === 0 ? '<p style="text-align:center;">No projects found.</p>' : '';

    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = `project-card theme-${post.authorCardTheme || 'default'}`;
        
        const isLiked = currentUser && post.likes.includes(currentUser);
        const avgRating = getAverageRating(post.ratings);
        const userRating = post.ratings.find(r => r.username === currentUser)?.score || '';

        if (currentUser && !post.views.includes(currentUser)) {
            fetch(`${API_URL}/posts/${post.id}/view`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentUser })
            }).then(() => { post.views.push(currentUser); });
        }

        let badgesHtml = (post.authorBadges || []).map(b => `<span class="badge-tag ${b.class}">${b.text}</span>`).join(' ');

        let emojisHtml = '';
        ['👍', '🔥', '😂', '🎉'].forEach(emoji => {
            const arr = post.reactions[emoji] || [];
            const active = currentUser && arr.includes(currentUser) ? 'active' : '';
            emojisHtml += `<button class="emoji-btn ${active}" onclick="reactPost(${post.id}, '${emoji}')">${emoji} ${arr.length}</button>`;
        });

        card.innerHTML = `
            <div class="card-header">
                <div class="avatar-wrapper frame-${post.authorFrame || 'none'}">
                    <img src="${post.authorPfp}">
                </div>
                <div>
                    <span style="color:${post.authorColor}; font-weight:bold;">@${post.posterName}</span>
                    <div style="margin-top:2px;">${badgesHtml}</div>
                </div>
            </div>
            
            <img src="${post.thumbnail}" class="project-thumb" onclick="openProjectModal(${post.id})">
            
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h2 class="card-title"><a href="#" onclick="openProjectModal(${post.id}); return false;" style="color:inherit;">${post.title}</a></h2>
                <div class="rating-box"><i class="fa-solid fa-star"></i> ${avgRating}</div>
            </div>
            
            <p class="card-caption">${post.caption}</p>

            <div class="action-bar">
                <div style="display:flex; gap:15px; font-size:14px; font-weight:bold; color:#65676b;">
                    <span><i class="fa-solid fa-eye" style="color:#0095f6;"></i> ${post.views.length}</span>
                    <span><i class="fa-solid fa-heart" style="color:#f02849;"></i> ${post.likes.length}</span>
                </div>
                <div class="emoji-bar">${emojisHtml}</div>
                <button id="like-btn-${post.id}" class="action-btn ${isLiked ? 'loved' : ''}" onclick="toggleLike(${post.id})">
                    <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i> ${isLiked ? 'Loved' : 'Love'}
                </button>
            </div>

            <div style="margin-bottom:10px; display:flex; gap:10px; align-items:center;">
                <label style="font-size:12px; font-weight:bold;">Rate this project:</label>
                <select id="rate-${post.id}" onchange="submitRating(${post.id})" style="padding:4px; border-radius:4px; border:1px solid #ddd;">
                    <option value="">-</option>
                    ${[1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}" ${userRating === n ? 'selected' : ''}>${n}</option>`).join('')}
                </select> / 10
            </div>

            <div class="comments-section">
                ${renderComments(post.comments, post.id)}
                <div style="display:flex; gap:8px; margin-top:8px;">
                    <input type="text" id="comment-text-${post.id}" placeholder="Write a comment..." class="comment-field">
                    <button onclick="submitComment(${post.id})" class="comment-submit-btn">Post</button>
                </div>
            </div>
        `;
        feed.appendChild(card);
    });
}

const likedInProgress = new Set();
async function toggleLike(postId) {
    if (!currentUser) return openAuthModal();
    if (likedInProgress.has(postId)) return;
    
    likedInProgress.add(postId);
    const btn = document.getElementById(`like-btn-${postId}`);
    if (btn) btn.style.pointerEvents = 'none';

    try {
        const res = await fetch(`${API_URL}/posts/${postId}/like`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentUser })
        });
        if (res.ok) {
            cachedPosts = null;
            loadPosts();
        }
    } finally {
        likedInProgress.delete(postId);
        if (btn) btn.style.pointerEvents = 'auto';
    }
}

async function openProjectModal(postId) {
    const modal = document.getElementById('project-detail-modal');
    const modalBody = document.getElementById('detail-modal-body');
    if (!modal || !modalBody) return;
    modalBody.innerHTML = '<p style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading data...</p>';
    modal.style.display = 'flex';

    try {
        const res = await fetch(`${API_URL}/posts/${postId}`);
        const post = await res.json();
        
        if (currentUser && !post.views.includes(currentUser)) {
            await fetch(`${API_URL}/posts/${post.id}/view`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentUser }) });
        }

        const stats = post.scratchStats || {};

        modalBody.innerHTML = `
            <div style="background:#000; border-radius:8px; padding:10px; text-align:center; margin-bottom:15px;">
                <img src="${post.thumbnail}" style="max-height:220px; border-radius:4px;">
            </div>
            <h2 style="margin: 0 0 5px 0;">${post.title}</h2>
            <div style="font-size:13px; color:#65676b; margin-bottom:12px;">By <b>${post.author}</b></div>
            
            <div class="stats-grid">
                <div class="stat-box"><i class="fa-solid fa-eye" style="color:#0095f6;"></i><br><b>${stats.views || 0}</b><br><small>Scratch Views</small></div>
                <div class="stat-box"><i class="fa-solid fa-heart" style="color:#f02849;"></i><br><b>${stats.loves || 0}</b><br><small>Scratch Loves</small></div>
                <div class="stat-box"><i class="fa-solid fa-star" style="color:#eab308;"></i><br><b>${stats.favorites || 0}</b><br><small>Scratch Favorites</small></div>
                <div class="stat-box"><i class="fa-solid fa-code-branch" style="color:#10b981;"></i><br><b>${stats.remixes || 0}</b><br><small>Scratch Remixes</small></div>
            </div>

            <div style="margin-bottom:12px;">
                <h4 style="margin:0 0 4px 0; font-size:14px;"><i class="fa-solid fa-gamepad"></i> Instructions</h4>
                <div style="font-size:13px; background:#f9fafb; padding:10px; border-radius:6px; border:1px solid #eee; white-space:pre-wrap;">${post.instructions || 'None'}</div>
            </div>

            <div>
                <h4 style="margin:0 0 4px 0; font-size:14px;"><i class="fa-solid fa-clipboard"></i> Notes & Credits</h4>
                <div style="font-size:13px; background:#f9fafb; padding:10px; border-radius:6px; border:1px solid #eee; white-space:pre-wrap;">${post.description || 'None'}</div>
            </div>
            
            <div style="text-align:center; margin-top:20px;">
                <a href="https://scratch.mit.edu/projects/${post.scratchId}" target="_blank" class="comment-submit-btn" style="text-decoration:none;"><i class="fa-solid fa-external-link"></i> Play on Scratch</a>
            </div>
        `;
    } catch (err) { modalBody.innerHTML = '<p style="color:red; text-align:center;">Failed to load project details.</p>'; }
}

function closeProjectModal() { 
    const modal = document.getElementById('project-detail-modal');
    if (modal) modal.style.display = 'none'; 
}

async function reactPost(postId, emoji) {
    if (!currentUser) return openAuthModal();
    await fetch(`${API_URL}/posts/${postId}/react`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentUser, emoji })
    });
    cachedPosts = null;
    loadPosts();
}

async function submitRating(postId) {
    if (!currentUser) return openAuthModal();
    const select = document.getElementById(`rate-${postId}`);
    if (!select) return;
    const score = parseInt(select.value);
    if (!score) return;
    await fetch(`${API_URL}/posts/${postId}/rate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentUser, score })
    });
    cachedPosts = null;
    loadPosts();
}

async function submitPost() {
    if (!currentUser) return openAuthModal();
    if (isSubmittingPost) return; 

    const scratchInputElem = document.getElementById('scratch-input');
    const captionInputElem = document.getElementById('post-caption');
    if (!scratchInputElem) return;

    const scratchInput = scratchInputElem.value.trim();
    const captionInput = captionInputElem ? captionInputElem.value.trim() : '';
    if (!scratchInput) return alert("URL or Scratch Project ID required!");

    isSubmittingPost = true;
    const postBtn = document.querySelector('.post-btn');
    if (postBtn) {
        postBtn.style.opacity = '0.5';
        postBtn.innerText = 'Posting...';
    }

    try {
        const res = await fetch(`${API_URL}/posts`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scratchInput, caption: captionInput, username: currentUser })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        scratchInputElem.value = '';
        if (captionInputElem) captionInputElem.value = '';
        cachedPosts = null;
        loadPosts();
    } catch (err) { 
        alert(err.message); 
    } finally {
        isSubmittingPost = false;
        if (postBtn) {
            postBtn.style.opacity = '1';
            postBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Post';
        }
    }
}

async function submitComment(postId, parentId = null) {
    if (!currentUser) return openAuthModal();
    const inputId = parentId ? `reply-text-${parentId}` : `comment-text-${postId}`;
    const inputElem = document.getElementById(inputId);
    if (!inputElem) return;
    const text = inputElem.value.trim();
    if (!text) return;

    await fetch(`${API_URL}/posts/${postId}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commenterName: currentUser, text, parentId })
    });
    cachedPosts = null;
    loadPosts();
}

async function submitReply(postId, parentId) { submitComment(postId, parentId); }

const shopItems = [
    { type: 'banner', name: 'Ocean Breeze Banner (Default)', description: 'Classic blue gradient background profile banner', style: 'linear-gradient(135deg, #0095f6 0%, #60a5fa 100%)', cost: 0 },
    { type: 'banner', name: 'Neon Sunset Banner', description: 'Vibrant pink and orange gradient profile banner', style: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)', cost: 50 },
    { type: 'banner', name: 'Gold VIP Banner', description: 'Luxurious golden gradient profile banner', style: 'linear-gradient(135deg, #eab308 0%, #fde047 100%)', cost: 100 },
    { type: 'color', name: 'Emerald Name Color', description: 'Green colored username visible across all posts', style: '#10b981', cost: 40 },
    { type: 'color', name: 'Purple Star Name Color', description: 'Purple colored username visible across all posts', style: '#8b5cf6', cost: 60 },
    { type: 'frame', name: 'Gold Avatar Frame', description: 'Golden ring surrounding your profile picture', style: 'gold', cost: 60 },
    { type: 'frame', name: 'Neon Glowing Frame', description: 'Glowing pink ring surrounding your profile picture', style: 'neon', cost: 90 },
    { type: 'frame', name: 'Rainbow Frame', description: 'Animated multicolored ring surrounding your profile picture', style: 'rainbow', cost: 140 },
    { type: 'theme', name: 'Neon Post Theme', description: 'Unique neon styling applied directly to your shared post cards', style: 'neon', cost: 80 },
    { type: 'theme', name: 'Gold Post Theme', description: 'Gold accented styling applied directly to your shared post cards', style: 'gold', cost: 120 },
    { type: 'theme', name: 'Dark Mode Post Theme', description: 'Sleek dark theme applied directly to your shared post cards', style: 'dark', cost: 150 }
];

async function loadShop() {
    const container = document.getElementById('shop-items-container');
    if (!container) return;
    if (!currentUser) return container.innerHTML = '<p style="text-align:center;">Log in to view shop.</p>';
    
    try {
        const user = await (await fetch(`${API_URL}/users/${currentUser}`)).json();
        let html = `<div style="margin-bottom:15px; font-weight:bold; font-size:16px;"><i class="fa-solid fa-coins" style="color:#eab308;"></i> Balance: ${user.coins} Coins</div>`;
        html += `<p style="font-size:13px; color:#65676b; margin-bottom:15px;">Note: Badges are 100% free and earned automatically on your profile when you refer friends or create projects!</p>`;
        
        shopItems.forEach(item => {
            const owned = user.inventory.includes(item.style) || item.cost === 0;
            let equipped = (item.type === 'banner' && user.banner === item.style) ||
                           (item.type === 'color' && user.nameColor === item.style) ||
                           (item.type === 'frame' && user.pfpFrame === item.style) ||
                           (item.type === 'theme' && user.cardTheme === item.style);

            html += `
                <div class="shop-card" style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:12px; border-radius:8px; margin-bottom:10px; border:1px solid #ddd;">
                    <div>
                        <b style="font-size:15px;">${item.name}</b><br>
                        <small style="color:#65676b;">${item.description}</small><br>
                        <span style="font-size:12px; font-weight:bold; color:#eab308;"><i class="fa-solid fa-coins"></i> ${item.cost} Coins</span>
                    </div>
                    <div>
                        ${equipped ? '<b style="color:green; font-size:14px;">Equipped</b>' : owned ? `<button onclick="equipPerk('${item.type}', '${item.style}')" class="comment-submit-btn" style="background:gray;">Equip</button>` : `<button onclick="buyPerk('${item.type}', '${item.style}', ${item.cost})" class="comment-submit-btn">Buy</button>`}
                    </div>
                </div>`;
        });
        container.innerHTML = html;
    } catch(e) {}
}

async function buyPerk(type, value, cost) {
    if (!currentUser) return openAuthModal();
    const res = await fetch(`${API_URL}/shop/buy`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: currentUser, itemType: type, itemValue: value, cost})});
    const data = await res.json();
    if (res.ok) { cachedPosts = null; loadShop(); } else alert(data.error);
}

async function equipPerk(type, value) {
    if (!currentUser) return openAuthModal();
    await fetch(`${API_URL}/shop/equip`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: currentUser, itemType: type, itemValue: value})});
    cachedPosts = null;
    loadShop();
}

async function loadAccountPage() {
    const container = document.getElementById('account-profile-content');
    if (!container) return;
    if (!currentUser) return container.innerHTML = '<p style="text-align:center;">You are not logged in.</p>';

    try {
        const res = await fetch(`${API_URL}/users/${currentUser}`);
        const data = await res.json();
        
        let badgesHtml = (data.earnedBadges || []).map(b => `<span class="badge-tag ${b.class}"><i class="fa-solid fa-shield"></i> ${b.text}</span>`).join(' ') || '<span style="font-size:12px; color:#65676b;">No badges unlocked yet. Refer friends or post 3+ projects to earn free badges!</span>';

        let lovedHtml = (data.lovedPosts || []).map(p => `
            <div style="display:flex; align-items:center; gap:10px; background:#f9fafb; padding:8px; border-radius:6px; margin-bottom:6px; cursor:pointer;" onclick="openProjectModal(${p.id})">
                <img src="${p.thumbnail}" style="width:50px; height:40px; object-fit:cover; border-radius:4px;">
                <div><b style="font-size:13px;">${p.title}</b><br><small style="color:#65676b;">By ${p.author}</small></div>
            </div>
        `).join('') || '<p style="color:#65676b; font-size:13px;">No loved projects yet.</p>';

        container.innerHTML = `
            <div class="discord-profile-card">
                <div class="discord-banner" style="background: ${data.banner}; height:90px; border-radius:8px 8px 0 0;"></div>
                <div class="discord-profile-body" style="padding:15px;">
                    <div class="discord-avatar-container frame-${data.pfpFrame}" style="width:60px; height:60px; border-radius:50%; overflow:hidden; margin-top:-35px; border:3px solid white; background:#fff;"><img src="${data.pfp}" style="width:100%; height:100%; object-fit:cover;"></div>
                    <h2 style="color:${data.nameColor}; margin:5px 0;">@${data.username}</h2>
                    <div style="margin-bottom:10px; display:flex; flex-wrap:wrap; gap:5px;">${badgesHtml}</div>
                    <p><i class="fa-solid fa-coins" style="color:#eab308;"></i> <b>${data.coins}</b> Coins</p>
                    
                    <div class="ref-box" style="background:#f0fdf4; border:1px solid #22c55e; padding:10px; border-radius:6px; margin-bottom:15px;">
                        <b style="color:#15803d; font-size:14px;">Your Referral Code: ${data.referralCode}</b>
                        <p style="font-size:12px; margin:5px 0 0 0; color:#166534;">Share this code with friends! When they sign up using your code, you both earn bonus coins.</p>
                    </div>

                    <h3 style="margin-top:15px; font-size:15px;"><i class="fa-solid fa-heart" style="color:#f02849;"></i> Your Hearted Projects</h3>
                    <div style="max-height:200px; overflow-y:auto; margin-bottom:15px;">${lovedHtml}</div>

                    <button onclick="logoutUser()" class="action-btn" style="background:#fee2e2; color:#dc2626; padding:8px; margin-top:10px; width:100%; justify-content:center; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Log Out</button>
                </div>
            </div>
        `;
    } catch(e) {
        container.innerHTML = '<p style="color:red; text-align:center;">Failed to load profile.</p>';
    }
}

let tempUsername = '';
function openAuthModal() {
    let m = document.getElementById('auth-modal');
    if (!m) {
        m = document.createElement('div');
        m.id = 'auth-modal';
        m.className = 'modal-backdrop';
        m.innerHTML = `
            <div class="modal-content" style="background:#fff; padding:20px; border-radius:8px; width:320px; max-width:90%;">
                <h3>Sign Up / Log In</h3>
                <div id="auth-step-1">
                    <input type="text" id="auth-user" placeholder="Scratch Username" class="comment-field" style="margin-bottom:10px; width:100%; padding:8px;">
                    <button onclick="reqCode()" class="comment-submit-btn" style="width:100%;">Get Verification Code</button>
                </div>
                <div id="auth-step-2" style="display:none;">
                    <p id="auth-inst" style="font-size:13px; margin-bottom:10px;"></p>
                    <input type="password" id="auth-pass" placeholder="Create Password" class="comment-field" style="margin-bottom:10px; width:100%; padding:8px;">
                    
                    <div style="background:#f0fdf4; border:1px solid #22c55e; padding:10px; border-radius:6px; margin-bottom:10px;">
                        <b style="font-size:12px; color:#15803d;"><i class="fa-solid fa-gift"></i> Have a friend's referral code?</b>
                        <p style="font-size:11px; color:#166534; margin:3px 0 8px 0;">Enter it below to get 10 free starting coins when you sign up!</p>
                        <input type="text" id="auth-ref" placeholder="Friend's Referral Code (Optional)" class="comment-field" style="border-color:#22c55e; width:100%; padding:6px;">
                    </div>

                    <button onclick="verifyCode()" class="comment-submit-btn" style="width:100%;">Verify & Register</button>
                </div>
                <div id="auth-toggle" style="margin-top:15px; text-align:center; font-size:13px;"><a href="#" onclick="toggleLogin()">Log in instead</a></div>
                <button onclick="closeAuthModal()" style="margin-top:10px; background:none; border:none; width:100%; cursor:pointer;">Cancel</button>
            </div>
        `;
        document.body.appendChild(m);
    }
    m.style.display = 'flex';
}

function closeAuthModal() { 
    const m = document.getElementById('auth-modal');
    if (m) m.style.display = 'none'; 
}

async function reqCode() {
    tempUsername = document.getElementById('auth-user').value;
    const res = await fetch(`${API_URL}/auth/register-request`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: tempUsername})});
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    document.getElementById('auth-step-1').style.display = 'none';
    document.getElementById('auth-step-2').style.display = 'block';
    document.getElementById('auth-inst').innerHTML = `Add <b>${data.verificationCode}</b> to your Scratch Bio, then click verify!`;
}

async function verifyCode() {
    const password = document.getElementById('auth-pass').value;
    const refCode = document.getElementById('auth-ref').value;
    const res = await fetch(`${API_URL}/auth/verify`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: tempUsername, password, referralCodeUsed: refCode})});
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    currentUser = data.username;
    localStorage.setItem('blockbuzz_user', currentUser);
    if(data.coins > 0) alert(`Success! You earned bonus coins!`);
    updateAuthUI(); closeAuthModal(); switchTab('account');
}

function toggleLogin() {
    const step1 = document.getElementById('auth-step-1');
    const toggle = document.getElementById('auth-toggle');
    if (!step1) return;
    step1.innerHTML = `
        <input type="text" id="login-user" placeholder="Username" class="comment-field" style="margin-bottom:10px; width:100%; padding:8px;">
        <input type="password" id="login-pass" placeholder="Password" class="comment-field" style="margin-bottom:10px; width:100%; padding:8px;">
        <button onclick="loginUser()" class="comment-submit-btn" style="width:100%;">Log In</button>
    `;
    if (toggle) toggle.style.display = 'none';
}

async function loginUser() {
    const usernameElem = document.getElementById('login-user');
    const passwordElem = document.getElementById('login-pass');
    if (!usernameElem || !passwordElem) return;
    const username = usernameElem.value;
    const password = passwordElem.value;

    const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username, password})});
    if (!res.ok) return alert("Invalid credentials");
    currentUser = (await res.json()).username;
    localStorage.setItem('blockbuzz_user', currentUser);
    updateAuthUI(); closeAuthModal(); cachedPosts = null; loadPosts();
}

function logoutUser() { currentUser = null; localStorage.removeItem('blockbuzz_user'); updateAuthUI(); switchTab('home'); }
function updateAuthUI() { 
    const container = document.getElementById('auth-container');
    if (container) {
        container.innerHTML = currentUser ? `<b style="color:#0095f6;cursor:pointer;" onclick="switchTab('account')">@${currentUser}</b>` : `<button onclick="openAuthModal()" class="comment-submit-btn">Login / Sign Up</button>`;
    }
}
