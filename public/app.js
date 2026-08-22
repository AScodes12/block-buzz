// --- GLOBAL STATE ---
let currentUser = null;
let currentDiscussionCategory = 'scratch';

// --- SHARED ICONS ---
const replyIcon = '<svg class="icon" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>';

// --- POST REPLY & COMMENT REPLY FEATURES ---
function togglePostReplyBox(postId) {
    const box = document.getElementById('post-reply-box-' + postId);
    if (box) {
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
    }
}

async function addPostReply(postId) {
    const input = document.getElementById('post-reply-input-' + postId);
    if (!input || !input.value.trim()) return;
    try {
        const res = await fetch('/api/posts/' + postId + '/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input.value })
        });
        if (res.ok) {
            input.value = '';
            togglePostReplyBox(postId);
            loadCommentsForPost(postId);
        } else if (res.status === 401) {
            openAuthModal('login');
        }
    } catch (err) { console.error('Error sending post reply'); }
}

function toggleReplyBox(commentKey) {
    const box = document.getElementById('reply-box-' + commentKey);
    if (box) {
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
    }
}

async function addReply(postId, commentId, inputId) {
    const input = document.getElementById(inputId);
    if (!input || !input.value.trim()) return;
    try {
        const res = await fetch('/api/posts/' + postId + '/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input.value, parentId: commentId })
        });
        if (res.ok) {
            input.value = '';
            loadCommentsForPost(postId);
        } else if (res.status === 401) {
            openAuthModal('login');
        }
    } catch (err) { console.error('Error sending reply'); }
}

// --- DISCUSSION REPLY FEATURES ---
function toggleDiscussionReplyBox(discussionId) {
    const box = document.getElementById('discussion-reply-box-' + discussionId);
    if (box) {
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
    }
}

async function addDiscussionReply(discussionId) {
    const input = document.getElementById('discussion-reply-input-' + discussionId);
    if (!input || !input.value.trim()) return;
    try {
        const res = await fetch('/api/discussions/' + discussionId + '/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input.value })
        });
        if (res.ok) {
            input.value = '';
            toggleDiscussionReplyBox(discussionId);
            loadRepliesForDiscussion(discussionId);
        } else if (res.status === 401) {
            openAuthModal('login');
        }
    } catch (err) { console.error('Error sending discussion reply'); }
}

async function loadRepliesForDiscussion(discussionId) {
    const listContainer = document.getElementById('discussion-comments-list-' + discussionId);
    if (!listContainer) return;
    try {
        const res = await fetch('/api/discussions/' + discussionId + '/comments');
        const replies = res.ok ? await res.json() : [];
        if (replies.length === 0) {
            listContainer.innerHTML = '<p style="font-size:13px; color:var(--text-secondary); margin-top:8px;">No replies yet. Be the first to reply!</p>';
            return;
        }
        let html = '<div style="margin-top: 10px; border-top: 1px solid var(--border-color, #eee); padding-top: 8px;">';
        for (let i = 0; i < replies.length; i++) {
            let r = replies[i];
            html += '<div class="comment-item" style="margin-bottom:6px; font-size: 13px;">' +
                '<b class="clickable-user" onclick="viewUserProfile(\'' + escapeHTML(r.author) + '\')">' + escapeHTML(r.author) + ':</b> ' + escapeHTML(r.text) +
            '</div>';
        }
        html += '</div>';
        listContainer.innerHTML = html;
    } catch (err) {
        listContainer.innerHTML = '<p style="font-size:13px; color:var(--text-secondary);">Failed to load replies.</p>';
    }
}

// --- THEME MANAGEMENT ---
function loadTheme() {
    const isLegacy = localStorage.getItem('blockbuzz_legacy_theme') === 'true';
    if (isLegacy) document.body.classList.add('legacy-theme');
    updateThemeButtonUI();
}

function toggleTheme() {
    const isLegacy = document.body.classList.contains('legacy-theme');
    if (isLegacy) {
        document.body.classList.remove('legacy-theme');
        localStorage.setItem('blockbuzz_legacy_theme', 'false');
    } else {
        document.body.classList.add('legacy-theme');
        localStorage.setItem('blockbuzz_legacy_theme', 'true');
    }
    updateThemeButtonUI();
}

function updateThemeButtonUI() {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.textContent = document.body.classList.contains('legacy-theme') ? 'Disable Legacy UI' : 'Enable Legacy UI';
}

// --- NAVIGATION & TABS ---
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    const section = document.getElementById(tabName + '-section');
    const navBtn = document.getElementById('nav-' + tabName);

    if (section) section.style.display = 'block';
    if (navBtn) navBtn.classList.add('active');

    if (tabName === 'home') loadFeed();
    if (tabName === 'account') loadAccountProfile();
    if (tabName === 'discussions') loadDiscussions(currentDiscussionCategory);
    if (tabName === 'contests') loadContests();
    if (tabName === 'studios') loadStudios();
    
    window.scrollTo(0, 0);
}

// --- POSTS & FEED ---
function renderPostCard(post) {
    const postId = post.id;
    const views = Array.isArray(post.views) ? post.views.length : 0;
    const likes = Array.isArray(post.likes) ? post.likes.length : 0;

    const isAuthor = currentUser && (currentUser.username === post.author || currentUser.is_admin);
    const deleteBtnHtml = isAuthor ? '<button class="stat-btn" style="color: #d93025; margin-left: auto; font-size: 12px; padding: 2px 8px;" onclick="deletePost(\'' + postId + '\')">Delete</button>' : '';

    const eyeIcon = '<svg class="icon" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>';
    const heartIcon = '<svg class="icon" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

    return '<div class="card" id="post-' + postId + '">' +
        '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">' +
            '<div class="avatar-wrapper" style="cursor:pointer;" onclick="viewUserProfile(\'' + escapeHTML(post.author) + '\')">' +
                '<img src="' + (post.author_pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png') + '">' +
            '</div>' +
            '<span class="clickable-user" onclick="viewUserProfile(\'' + escapeHTML(post.author) + '\')">' + escapeHTML(post.author) + '<span class="verified-badge">✓</span></span>' +
            deleteBtnHtml +
        '</div>' +
        '<a href="' + escapeHTML(post.scratch_link) + '" target="_blank" style="text-decoration:none; color:inherit;" onclick="registerView(\'' + postId + '\')">' +
            '<img class="project-thumb" src="' + (post.thumbnail || 'https://scratch.mit.edu/images/scratch-og.png') + '">' +
            '<h3 style="font-size: 16px; color:var(--text-primary); margin-top:8px;">' + escapeHTML(post.title || 'Scratch Project') + '</h3>' +
        '</a>' +
        '<p style="font-size:14px; color:var(--text-secondary); margin-top:4px;">' + escapeHTML(post.caption || '') + '</p>' +
        '<div class="post-stats">' +
            '<span class="stat-item">' + eyeIcon + ' <span id="view-count-' + postId + '">' + views + '</span> views</span>' +
            '<button class="stat-btn" onclick="toggleLike(\'' + postId + '\')">' + heartIcon + ' <span id="like-count-' + postId + '">' + likes + '</span> Likes</button>' +
            '<button class="stat-btn" onclick="togglePostReplyBox(\'' + postId + '\')">' + replyIcon + '</button>' +
        '</div>' +
        '<div id="post-reply-box-' + postId + '" style="display:none; margin-top:8px;" class="comment-input-row">' +
            '<input type="text" id="post-reply-input-' + postId + '" placeholder="Write a reply to this post..." style="padding: 6px 12px; font-size: 13px;">' +
            '<button class="btn" style="padding: 6px 16px; font-size: 13px;" onclick="addPostReply(\'' + postId + '\')">Send</button>' +
        '</div>' +
        '<div class="comments-section">' +
            '<div id="comments-list-' + postId + '"><p style="font-size:13px; color:var(--text-secondary);">Loading comments...</p></div>' +
            '<div class="comment-input-row">' +
                '<input type="text" id="comment-input-' + postId + '" placeholder="Add a comment..." style="padding: 6px 12px; font-size: 13px;">' +
                '<button class="btn" style="padding: 6px 16px; font-size: 13px;" onclick="addComment(\'' + postId + '\')">Post</button>' +
            '</div>' +
        '</div>' +
    '</div>';
}

async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this project post?')) return;
    try {
        const res = await fetch('/api/posts/' + postId, { method: 'DELETE' });
        if (res.ok) {
            const card = document.getElementById('post-' + postId);
            if (card) card.remove();
        } else if (res.status === 401) {
            openAuthModal('login');
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to delete post.');
        }
    } catch (err) {
        console.error('Error deleting post:', err);
    }
}

async function loadCommentsForPost(postId) {
    const listContainer = document.getElementById('comments-list-' + postId);
    if (!listContainer) return;
    try {
        const res = await fetch('/api/posts/' + postId + '/comments');
        const comments = res.ok ? await res.json() : [];
        if (comments.length === 0) {
            listContainer.innerHTML = '<p style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;">No comments yet.</p>';
            return;
        }

        const topLevel = comments.filter(c => !c.parent_id);
        const replies = comments.filter(c => c.parent_id);

        let html = '';
        for (let i = 0; i < topLevel.length; i++) {
            let c = topLevel[i];
            let cId = c.id;
            html += '<div class="comment-item" style="margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid var(--border-color, #eee);">' +
                '<div><b class="clickable-user" onclick="viewUserProfile(\'' + escapeHTML(c.author) + '\')">' + escapeHTML(c.author) + ':</b> ' + escapeHTML(c.text) + '</div>' +
                '<button class="stat-btn" style="font-size: 11px; padding: 2px 6px; margin-top: 4px; background: var(--bg-hover, #f0f0f0); border-radius: 4px;" onclick="toggleReplyBox(\'' + postId + '-' + cId + '\')">' + replyIcon + '</button>' +
                '<div id="reply-box-' + postId + '-' + cId + '" style="display:none; margin-top:6px; margin-left:12px;" class="comment-input-row">' +
                    '<input type="text" id="reply-input-' + postId + '-' + cId + '" placeholder="Write a reply..." style="padding: 4px 8px; font-size: 12px;">' +
                    '<button class="btn" style="padding: 4px 12px; font-size: 12px;" onclick="addReply(\'' + postId + '\', \'' + cId + '\', \'reply-input-' + postId + '-' + cId + '\')">Send</button>' +
                '</div>';

            let commentReplies = replies.filter(r => r.parent_id === cId);
            for (let j = 0; j < commentReplies.length; j++) {
                let r = commentReplies[j];
                html += '<div style="margin-top:6px; margin-left:16px; padding-left:8px; border-left:2px solid var(--border-color, #ddd); font-size: 12px;">' +
                    '<b>' + escapeHTML(r.author) + ':</b> ' + escapeHTML(r.text) +
                '</div>';
            }

            html += '</div>';
        }
        listContainer.innerHTML = html;
    } catch (err) {
        listContainer.innerHTML = '<p style="font-size:13px; color:var(--text-secondary);">Failed to load comments.</p>';
    }
}

async function loadFeed() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    try {
        const res = await fetch('/api/posts');
        const posts = res.ok ? await res.json() : [];
        if (posts.length === 0) {
            feed.innerHTML = '<div class="card"><p style="text-align:center; color:var(--text-secondary);">No projects found.</p></div>';
            return;
        }
        let html = '';
        for (let i = 0; i < posts.length; i++) {
            html += renderPostCard(posts[i]);
        }
        feed.innerHTML = html;
        for (let i = 0; i < posts.length; i++) {
            loadCommentsForPost(posts[i].id);
        }
    } catch (err) { feed.innerHTML = '<div class="card"><p>Error loading posts.</p></div>'; }
}

async function submitPost() {
    const scratchInput = document.getElementById('scratch-input').value;
    const caption = document.getElementById('post-caption').value;
    const msg = document.getElementById('home-msg');
    if (!scratchInput) return showMsg(msg, 'Project URL is required.', 'error');

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
            showMsg(msg, 'Project posted!', 'success');
            loadFeed();
        } else {
            showMsg(msg, data.error || 'Failed to post.', 'error');
        }
    } catch (err) { showMsg(msg, 'Network error.', 'error'); }
}

async function toggleLike(postId) {
    try {
        const res = await fetch('/api/posts/' + postId + '/like', { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            const countSpan = document.getElementById('like-count-' + postId);
            if (countSpan) countSpan.textContent = data.likes.length;
        } else if (res.status === 401) {
            openAuthModal('login');
        }
    } catch (err) { console.error('Error liking'); }
}

async function registerView(postId) {
    try {
        await fetch('/api/posts/' + postId + '/view', { method: 'POST' });
    } catch (err) { console.error('Error recording view'); }
}

async function addComment(postId) {
    const input = document.getElementById('comment-input-' + postId);
    if (!input || !input.value.trim()) return;
    try {
        const res = await fetch('/api/posts/' + postId + '/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input.value })
        });
        if (res.ok) { 
            input.value = ''; 
            loadCommentsForPost(postId); 
        } else if (res.status === 401) {
            openAuthModal('login');
        }
    } catch (err) { console.error('Error commenting'); }
}

// --- DISCUSSIONS ---
function switchDiscussionCategory(category) {
    currentDiscussionCategory = category;
    document.querySelectorAll('.disc-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('disc-tab-' + category).classList.add('active');
    loadDiscussions(category);
}

async function loadDiscussions(category) {
    const feed = document.getElementById('discussions-feed');
    if (!feed) return;
    try {
        const res = await fetch('/api/discussions?category=' + category);
        const filtered = res.ok ? await res.json() : [];
        if (filtered.length === 0) {
            feed.innerHTML = '<div class="card"><p style="text-align:center; color:var(--text-secondary);">No discussions found in this category.</p></div>';
            return;
        }
        let html = '';
        for (let i = 0; i < filtered.length; i++) {
            let item = filtered[i];
            let upvotes = Array.isArray(item.upvotes) ? item.upvotes.length : 0;
            const thumbUpIcon = '<svg class="icon" viewBox="0 0 24 24"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>';

            html += '<div class="card" id="discussion-' + item.id + '">' +
                '<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">' +
                    '<div class="avatar-wrapper" style="width:28px; height:28px; cursor:pointer;" onclick="viewUserProfile(\'' + escapeHTML(item.author) + '\')"><img src="' + (item.author_pfp || '') + '"></div>' +
                    '<span class="clickable-user" onclick="viewUserProfile(\'' + escapeHTML(item.author) + '\')">' + escapeHTML(item.author) + '</span>' +
                '</div>' +
                '<h3 style="font-size:16px; margin:4px 0;">' + escapeHTML(item.title) + '</h3>' +
                '<p style="font-size:14px; color:var(--text-secondary); margin-bottom:12px;">' + escapeHTML(item.content) + '</p>' +
                '<div class="post-stats">' +
                    '<button class="stat-btn" onclick="toggleDiscussionUpvote(\'' + item.id + '\')">' + thumbUpIcon + ' <span id="upvote-count-' + item.id + '">' + upvotes + '</span> Upvotes</button>' +
                    '<button class="stat-btn" onclick="toggleDiscussionReplyBox(\'' + item.id + '\')">' + replyIcon + '</button>' +
                '</div>' +
                '<div id="discussion-reply-box-' + item.id + '" style="display:none; margin-top:8px;" class="comment-input-row">' +
                    '<input type="text" id="discussion-reply-input-' + item.id + '" placeholder="Write a reply to this discussion..." style="padding: 6px 12px; font-size: 13px;">' +
                    '<button class="btn" style="padding: 6px 16px; font-size: 13px;" onclick="addDiscussionReply(\'' + item.id + '\')">Send</button>' +
                '</div>' +
                '<div id="discussion-comments-list-' + item.id + '">' +
                    '<p style="font-size:13px; color:var(--text-secondary); margin-top:8px;">Loading replies...</p>' +
                '</div>' +
            '</div>';
        }
        feed.innerHTML = html;
        for (let i = 0; i < filtered.length; i++) {
            loadRepliesForDiscussion(filtered[i].id);
        }
    } catch (err) { feed.innerHTML = '<div class="card"><p>Error loading discussions.</p></div>'; }
}

async function toggleDiscussionUpvote(discussionId) {
    try {
        const res = await fetch('/api/discussions/' + discussionId + '/upvote', { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            const countSpan = document.getElementById('upvote-count-' + discussionId);
            if (countSpan) countSpan.textContent = data.upvotes.length;
        } else if (res.status === 401) {
            openAuthModal('login');
        }
    } catch (err) { console.error('Error upvoting discussion'); }
}

async function submitDiscussion() {
    const title = document.getElementById('discussion-title').value;
    const content = document.getElementById('discussion-content').value;
    const category = document.getElementById('discussion-category').value;
    const msg = document.getElementById('discussion-msg');
    
    if (!title || !content) return showMsg(msg, 'Title and content required.', 'error');
    
    try {
        const res = await fetch('/api/discussions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, category })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            document.getElementById('discussion-title').value = '';
            document.getElementById('discussion-content').value = '';
            showMsg(msg, 'Discussion posted successfully!', 'success');
            loadDiscussions(category);
        } else if (res.status === 401) {
            openAuthModal('login');
        } else {
            showMsg(msg, data.error || 'Failed to post discussion.', 'error');
        }
    } catch (err) { 
        showMsg(msg, 'Network or server error.', 'error'); 
    }
}

// --- CONTESTS ---
async function loadContests() {
    const feed = document.getElementById('contests-feed');
    try {
        const res = await fetch('/api/contests');
        const contests = res.ok ? await res.json() : [];
        let html = '';
        if (contests.length === 0) {
            html = '<div class="card"><p style="text-align:center; color:var(--text-secondary);">No contests found.</p></div>';
        } else {
            for (let i = 0; i < contests.length; i++) {
                let c = contests[i];
                html += '<div class="card">' +
                    '<h3 style="font-size: 16px; color:var(--text-primary);">' + escapeHTML(c.title) + '</h3>' +
                    '<p style="font-size: 14px; color:var(--text-secondary); margin-top:4px;">' + escapeHTML(c.description) + '</p>' +
                '</div>';
            }
        }
        feed.innerHTML = html;
    } catch (err) { feed.innerHTML = '<div class="card"><p>Error loading contests.</p></div>'; }
}

async function submitContest() {
    const title = document.getElementById('contest-title').value;
    const description = document.getElementById('contest-desc').value;
    const msg = document.getElementById('contest-msg');
    if (!title) return showMsg(msg, 'Contest title is required.', 'error');
    try {
        const res = await fetch('/api/contests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });
        if (res.ok) {
            document.getElementById('contest-title').value = '';
            document.getElementById('contest-desc').value = '';
            showMsg(msg, 'Contest published!', 'success');
            loadContests();
        } else if (res.status === 401) {
            openAuthModal('login');
        }
    } catch (err) { showMsg(msg, 'Error publishing contest.', 'error'); }
}

// --- STUDIOS & STUDIO DETAIL PAGE ---
async function loadStudios() {
    const feed = document.getElementById('studios-feed');
    try {
        const res = await fetch('/api/studios');
        const studios = res.ok ? await res.json() : [];
        let html = '';
        if (studios.length === 0) {
            html = '<div class="card"><p style="text-align:center; color:var(--text-secondary);">No studios found.</p></div>';
        } else {
            for (let i = 0; i < studios.length; i++) {
                let s = studios[i];
                html += '<div class="card">' +
                    '<h3 style="font-size: 16px; color:var(--text-primary); margin-bottom:4px;">' + escapeHTML(s.title) + '</h3>' +
                    '<p style="font-size: 14px; color:var(--text-secondary); margin-bottom:12px;">' + escapeHTML(s.description) + '</p>' +
                    '<button class="btn-outline" onclick="viewStudioDetails(\'' + s.id + '\')">View Studio</button>' +
                '</div>';
            }
        }
        feed.innerHTML = html;
    } catch (err) { feed.innerHTML = '<div class="card"><p>Error loading studios.</p></div>'; }
}

async function submitStudio() {
    const title = document.getElementById('studio-title').value;
    const description = document.getElementById('studio-desc').value;
    const msg = document.getElementById('studio-msg');
    if (!title) return showMsg(msg, 'Studio name is required.', 'error');
    try {
        const res = await fetch('/api/studios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });
        if (res.ok) {
            document.getElementById('studio-title').value = '';
            document.getElementById('studio-desc').value = '';
            showMsg(msg, 'Studio created successfully!', 'success');
            loadStudios();
        } else if (res.status === 401) {
            openAuthModal('login');
        }
    } catch (err) { showMsg(msg, 'Error creating studio.', 'error'); }
}

async function viewStudioDetails(id) {
    switchTab('studio-detail');
    const container = document.getElementById('studio-detail-content');
    container.innerHTML = '<button class="btn-outline" onclick="switchTab(\'studios\')" style="margin-bottom: 12px;">← Back to Studios</button>' +
        '<div class="card"><p style="text-align:center;">Loading studio...</p></div>';
    try {
        const res = await fetch('/api/studios/' + id);
        const studio = res.ok ? await res.json() : null;
        if (!studio) {
            container.innerHTML = '<button class="btn-outline" onclick="switchTab(\'studios\')" style="margin-bottom: 12px;">← Back to Studios</button><div class="card"><p>Studio not found.</p></div>';
            return;
        }
        container.innerHTML = '<button class="btn-outline" onclick="switchTab(\'studios\')" style="margin-bottom: 12px;">← Back to Studios</button>' +
            '<div class="card">' +
                '<h2 style="font-size: 20px; color:var(--text-primary); margin-bottom: 8px;">' + escapeHTML(studio.title) + '</h2>' +
                '<p style="font-size: 14px; color:var(--text-secondary); margin-bottom: 12px;">' + escapeHTML(studio.description) + '</p>' +
                '<p style="font-size: 13px; color:var(--text-secondary);">Created by <b class="clickable-user" onclick="viewUserProfile(\'' + escapeHTML(studio.author) + '\')">' + escapeHTML(studio.author) + '</b></p>' +
            '</div>';
    } catch (err) {
        container.innerHTML = '<button class="btn-outline" onclick="switchTab(\'studios\')" style="margin-bottom: 12px;">← Back to Studios</button><div class="card"><p>Error loading studio details.</p></div>';
    }
}

// --- PROFILES & SCRATCH VERIFICATION ---
async function viewUserProfile(username) {
    switchTab('user-profile');
    const container = document.getElementById('user-profile-content');
    container.innerHTML = '<button class="btn-outline" onclick="switchTab(\'home\')" style="margin-bottom: 12px;">← Back</button><div class="card"><p style="text-align:center;">Loading profile...</p></div>';
    try {
        const res = await fetch('/api/users/' + username);
        const data = res.ok ? await res.json() : null;
        if (!data || !data.user) {
            container.innerHTML = '<button class="btn-outline" onclick="switchTab(\'home\')" style="margin-bottom: 12px;">← Back</button><div class="card"><p>User not found.</p></div>';
            return;
        }
        const user = data.user;
        const posts = data.posts || [];
        
        let postsHtml = '';
        for(let i=0; i<posts.length; i++) {
            postsHtml += renderPostCard(posts[i]);
        }

        container.innerHTML = '<button class="btn-outline" onclick="switchTab(\'home\')" style="margin-bottom: 12px;">← Back</button>' +
            '<div class="card" style="display:flex; align-items:center; gap:16px;">' +
                '<div class="avatar-wrapper" style="width:64px; height:64px;"><img src="' + (user.pfp || '') + '"></div>' +
                '<div>' +
                    '<h2 style="font-size: 20px;">' + escapeHTML(user.username) + '<span class="verified-badge">✓</span></h2>' +
                    '<p style="color:var(--text-secondary); font-size: 13px;">Coins: ' + (user.coins || 0) + ' | Member since ' + new Date(user.created_at).toLocaleDateString() + '</p>' +
                '</div>' +
            '</div>' +
            '<h3 style="margin: 16px 0 8px 0; font-size: 16px;">User Projects</h3>' +
            (postsHtml || '<div class="card"><p style="text-align:center; color:var(--text-secondary);">No projects posted yet.</p></div>');
        
        for(let i=0; i<posts.length; i++) {
            loadCommentsForPost(posts[i].id);
        }
    } catch (err) { container.innerHTML = '<div class="card"><p>Error loading profile.</p></div>'; }
}

async function loadAccountProfile() {
    if (!currentUser) {
        document.getElementById('account-profile-content').innerHTML = '<div class="card" style="text-align: center;"><h3 style="margin-bottom:8px;">Sign in required</h3><button class="btn" onclick="openAuthModal(\'login\')">Sign in</button></div>';
        return;
    }
    
    const container = document.getElementById('account-profile-content');
    container.innerHTML = '<div class="card" style="display:flex; align-items:center; gap:16px;">' +
        '<div class="avatar-wrapper" style="width:64px; height:64px;"><img src="' + (currentUser.pfp || '') + '"></div>' +
        '<div>' +
            '<h2 style="font-size: 20px;">' + escapeHTML(currentUser.username) + '<span class="verified-badge">✓</span></h2>' +
            '<p style="color:var(--text-secondary); font-size: 13px;">Coins: ' + currentUser.coins + ' | Verified Scratch Account</p>' +
            '<p style="color:#137333; font-size: 13px; margin-top:4px;">Referral Code: <b>' + currentUser.referral_code + '</b></p>' +
        '</div>' +
    '</div>';
}

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        currentUser = data.user || null;
        renderAuthUI();
    } catch (err) { console.error('Auth check failed'); }
}

// --- AUTH UI ---
function renderAuthUI() {
    let container = document.getElementById('auth-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'auth-container';
        container.style.cssText = 'position: fixed; top: 12px; right: 16px; z-index: 9999; display: flex; align-items: center; gap: 8px;';
        document.body.appendChild(container);
    }
    if (currentUser) {
        container.innerHTML = '<div class="avatar-wrapper" style="width:32px; height:32px; cursor:pointer;" onclick="switchTab(\'account\')"><img src="' + (currentUser.pfp || '') + '"></div><button class="btn-outline" style="padding: 6px 16px; font-size: 13px; background:var(--bg-card); color:var(--text-primary);" onclick="logout()">Sign out</button>';
    } else {
        container.innerHTML = '<button class="btn" style="padding: 8px 16px;" onclick="openAuthModal(\'login\')">Sign in</button>';
    }
}

function openAuthModal(mode = 'login') {
    const overlay = document.getElementById('auth-modal');
    const body = document.getElementById('auth-modal-body');
    overlay.style.display = 'flex';

    if (mode === 'login') {
        body.innerHTML = '<h3 style="margin-bottom: 20px; font-size: 18px;">Sign in to BlockBuzz</h3>' +
            '<div class="input-group">' +
                '<input type="text" id="auth-username" placeholder="Scratch Username">' +
                '<input type="password" id="auth-password" placeholder="Password">' +
                '<button class="btn" onclick="submitAuthLogin()" style="width: 100%; margin-top: 8px;">Sign In</button>' +
                '<div class="auth-switch">Need an account? <span onclick="openAuthModal(\'signup\')">Sign up</span></div>' +
                '<div class="auth-switch" style="margin-top: 4px;"><span onclick="openAuthModal(\'reset\')">Forgot password?</span></div>' +
            '</div>';
    } else if (mode === 'signup') {
        body.innerHTML = '<h3 style="margin-bottom: 20px; font-size: 18px;">Register with Scratch</h3>' +
            '<div class="input-group">' +
                '<input type="text" id="auth-username" placeholder="Scratch Username">' +
                '<input type="password" id="auth-password" placeholder="Create Password">' +
                '<input type="text" id="auth-referral" placeholder="Referral Code (Optional)">' +
                '<button class="btn" onclick="submitAuthRegisterRequest()" style="width: 100%; margin-top: 8px;">Next: Verify Profile</button>' +
                '<div class="auth-switch">Already have an account? <span onclick="openAuthModal(\'login\')">Sign in</span></div>' +
            '</div>';
    } else if (mode === 'reset') {
        body.innerHTML = '<h3 style="margin-bottom: 20px; font-size: 18px;">Reset Password</h3>' +
            '<div class="input-group">' +
                '<input type="text" id="auth-username" placeholder="Scratch Username">' +
                '<button class="btn" onclick="submitAuthResetRequest()" style="width: 100%; margin-top: 8px;">Request Code</button>' +
                '<div class="auth-switch"><span onclick="openAuthModal(\'login\')">Back to Sign in</span></div>' +
            '</div>';
    }
}

function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }

async function submitAuthLogin() {
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
        currentUser = data.user;
        renderAuthUI();
        closeAuthModal();
        loadFeed();
    } else {
        alert(data.error || 'Login failed.');
    }
}

async function submitAuthRegisterRequest() {
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    const referralCode = document.getElementById('auth-referral').value;
    const res = await fetch('/api/auth/register-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, referralCode })
    });
    const data = await res.json();
    if (res.ok) {
        const body = document.getElementById('auth-modal-body');
        body.innerHTML = '<h3 style="margin-bottom: 12px; font-size: 18px;">Verify Scratch Profile</h3>' +
            '<p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">Add this code to your Scratch bio or What I\'m Working On section:</p>' +
            '<div style="background:#f1f3f4; padding:12px; border-radius:8px; font-weight:bold; text-align:center; font-size:16px; margin-bottom:12px;">' + data.verificationCode + '</div>' +
            '<a href="' + data.profileUrl + '" target="_blank" class="btn-outline" style="display:block; text-align:center; margin-bottom:12px;">Open Scratch Profile</a>' +
            '<button class="btn" onclick="submitAuthVerify(\'' + username + '\')" style="width:100%;">I\'ve Added It, Verify Me!</button>';
    } else {
        alert(data.error || 'Registration request failed.');
    }
}

async function submitAuthVerify(username) {
    const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (res.ok) {
        currentUser = data.user;
        renderAuthUI();
        closeAuthModal();
        loadFeed();
        alert('Verification successful! Welcome to BlockBuzz.');
    } else {
        alert(data.error || 'Verification code not found on profile yet.');
    }
}

async function submitAuthResetRequest() {
    const username = document.getElementById('auth-username').value;
    const res = await fetch('/api/auth/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (res.ok) {
        const body = document.getElementById('auth-modal-body');
        body.innerHTML = '<h3 style="margin-bottom: 12px; font-size: 18px;">Reset Password</h3>' +
            '<p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">Add reset code <b>' + data.verificationCode + '</b> to your Scratch bio, then enter your new password below:</p>' +
            '<div class="input-group">' +
                '<input type="password" id="reset-new-password" placeholder="New Password">' +
                '<button class="btn" onclick="submitAuthConfirmReset(\'' + username + '\')" style="width: 100%; margin-top: 8px;">Update Password</button>' +
            '</div>';
    } else {
        alert(data.error || 'Reset request failed.');
    }
}

async function submitAuthConfirmReset(username) {
    const newPassword = document.getElementById('reset-new-password').value;
    const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, newPassword })
    });
    const data = await res.json();
    if (res.ok) {
        alert('Password updated successfully!');
        openAuthModal('login');
    } else {
        alert(data.error || 'Password reset failed.');
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    renderAuthUI();
    loadFeed();
    switchTab('home');
}

// --- UTILS ---
function showMsg(element, text, type) { 
    if (!element) return; 
    element.textContent = text; 
    element.className = 'inline-msg ' + type; 
    element.style.display = 'block'; 
    setTimeout(function() { element.style.display = 'none'; }, 4000); 
}

function escapeHTML(str) { 
    return str ? String(str).replace(/[&<>'"]/g, function(tag) { 
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag; 
    }) : ''; 
}

document.addEventListener('DOMContentLoaded', function() { 
    loadTheme(); 
    checkAuth(); 
    loadFeed(); 
});
