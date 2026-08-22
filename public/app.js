document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    let activeDiscussionCategory = 'scratch';

    // --- NAVIGATION ROUTING ---
    const navButtons = document.querySelectorAll('.nav-btn');
    const pageSections = document.querySelectorAll('.page-section');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            
            navButtons.forEach(b => b.classList.remove('active'));
            pageSections.forEach(s => s.classList.remove('active'));

            btn.classList.add('active');
            const targetEl = document.getElementById(target);
            if (targetEl) targetEl.classList.add('active');

            if (target === 'feed-page') loadPosts();
            if (target === 'discussions-page') loadDiscussions(activeDiscussionCategory);
            if (target === 'contests-page') loadContests();
            if (target === 'studios-page') loadStudios();
        });
    });

    // --- INITIAL SESSION CHECK ---
    async function checkAuth() {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            currentUser = data.user;
            renderUserNav();
        } catch (err) {
            console.error('Auth check error:', err);
        }
    }

    function renderUserNav() {
        const container = document.getElementById('user-nav-container');
        if (!container) return;

        if (currentUser) {
            container.innerHTML = `
                <div class="user-pill">
                    <img src="${currentUser.pfp}" class="nav-pfp" alt="${currentUser.username}">
                    <span>${currentUser.username} (${currentUser.coins} coins)</span>
                    <button class="btn btn-secondary btn-sm" id="btn-logout">Logout</button>
                </div>
            `;
            const logoutBtn = document.getElementById('btn-logout');
            if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
        } else {
            container.innerHTML = `
                <button class="btn btn-secondary" id="btn-open-login">Log In</button>
                <button class="btn btn-primary" id="btn-open-register">Sign Up</button>
            `;
        }
    }

    async function handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        renderUserNav();
        loadPosts();
    }

    // --- POSTS FEED ---
    async function loadPosts() {
        const container = document.getElementById('posts-container');
        if (!container) return;

        try {
            const res = await fetch('/api/posts');
            const posts = await res.json();
            
            if (!posts.length) {
                container.innerHTML = '<p class="empty-state">No projects shared yet!</p>';
                return;
            }

            container.innerHTML = posts.map(post => {
                const liked = currentUser && (post.likes || []).includes(currentUser.username);
                return `
                    <div class="post-card" data-id="${post.id}">
                        <div class="post-header">
                            <img src="${post.author_pfp}" class="author-pfp" alt="${post.author}">
                            <span class="author-name">${escapeHTML(post.author)}</span>
                        </div>
                        <a href="${post.scratch_link}" target="_blank" class="post-thumb-link">
                            <img src="${post.thumbnail}" class="post-thumb" alt="${post.title}">
                            <div class="post-title">${escapeHTML(post.title)}</div>
                        </a>
                        <p class="post-caption">${escapeHTML(post.caption || '')}</p>
                        <div class="post-actions">
                            <button class="btn-like ${liked ? 'liked' : ''}" onclick="toggleLike(${post.id})">
                                ❤️ ${(post.likes || []).length}
                            </button>
                            <span class="views-count">👁️ ${(post.views || []).length}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            container.innerHTML = '<p class="error-state">Failed to load posts.</p>';
        }
    }

    window.toggleLike = async function(id) {
        if (!currentUser) {
            alert('Please log in to like posts.');
            return;
        }
        try {
            const res = await fetch(`/api/posts/${id}/like`, { method: 'POST' });
            const data = await res.json();
            if (data.success) loadPosts();
        } catch (err) {
            console.error('Like failed:', err);
        }
    };

    // --- DISCUSSIONS FEATURE ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(tab => {
        tab.addEventListener('click', () => {
            tabButtons.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeDiscussionCategory = tab.getAttribute('data-category');
            loadDiscussions(activeDiscussionCategory);
        });
    });

    async function loadDiscussions(category) {
        const container = document.getElementById('discussions-container');
        if (!container) return;

        container.innerHTML = '<p class="loading-state">Loading discussions...</p>';

        try {
            const res = await fetch(`/api/discussions?category=${category}`);
            const discussions = await res.json();

            if (!discussions.length) {
                container.innerHTML = `<p class="empty-state">No discussions in this category yet. Be the first to start one!</p>`;
                return;
            }

            container.innerHTML = discussions.map(item => {
                const upvoted = currentUser && (item.upvotes || []).includes(currentUser.username);
                const dateStr = new Date(item.created_at).toLocaleDateString();

                return `
                    <div class="post-card" style="margin-bottom: 12px;">
                        <div style="display: flex; gap: 12px; align-items: flex-start;">
                            <div style="text-align: center; min-width: 36px;">
                                <button class="btn btn-secondary ${upvoted ? 'active' : ''}" onclick="toggleUpvote(${item.id})" style="padding: 4px 8px;">
                                    ▲
                                </button>
                                <div style="font-weight: bold; margin-top: 4px;">${(item.upvotes || []).length}</div>
                            </div>
                            <div style="flex: 1;">
                                <div class="post-header" style="margin-bottom: 4px;">
                                    <img src="${item.author_pfp || 'https://cdn2.scratch.mit.edu/get_image/user/default_90x90.png'}" class="author-pfp">
                                    <span class="author-name">${escapeHTML(item.author)}</span>
                                    <span style="font-size: 0.8em; color: #888; margin-left: auto;">${dateStr}</span>
                                </div>
                                <h3 style="margin: 4px 0;">${escapeHTML(item.title)}</h3>
                                <p style="white-space: pre-wrap; margin: 4px 0;">${escapeHTML(item.content)}</p>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            container.innerHTML = '<p class="error-state">Failed to load discussions.</p>';
        }
    }

    window.toggleUpvote = async function(id) {
        if (!currentUser) {
            alert('Please log in to upvote discussions.');
            return;
        }

        try {
            const res = await fetch(`/api/discussions/${id}/upvote`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                loadDiscussions(activeDiscussionCategory);
            } else {
                alert(data.error || 'Failed to toggle upvote.');
            }
        } catch (err) {
            alert('Server error processing upvote.');
        }
    };

    // --- MODALS & FORMS ---
    const modalDiscussion = document.getElementById('modal-create-discussion');
    const btnOpenDiscussion = document.getElementById('btn-open-create-discussion');
    const formDiscussion = document.getElementById('form-create-discussion');

    if (btnOpenDiscussion) {
        btnOpenDiscussion.addEventListener('click', () => {
            if (!currentUser) {
                alert('Please log in to start a discussion.');
                return;
            }
            if (modalDiscussion) modalDiscussion.style.display = 'block';
        });
    }

    if (formDiscussion) {
        formDiscussion.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('discussion-title').value;
            const category = document.getElementById('discussion-category').value;
            const content = document.getElementById('discussion-content').value;

            try {
                const res = await fetch('/api/discussions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, category, content })
                });

                const data = await res.json();
                if (data.success) {
                    formDiscussion.reset();
                    if (modalDiscussion) modalDiscussion.style.display = 'none';
                    activeDiscussionCategory = category;

                    tabButtons.forEach(t => {
                        if (t.getAttribute('data-category') === category) t.classList.add('active');
                        else t.classList.remove('active');
                    });

                    loadDiscussions(category);
                } else {
                    alert(data.error || 'Failed to create discussion.');
                }
            } catch (err) {
                alert('Server error creating discussion.');
            }
        });
    }

    const formCreatePost = document.getElementById('form-create-post');
    const modalCreatePost = document.getElementById('modal-create-post');
    const btnOpenCreatePost = document.getElementById('btn-open-create-post');

    if (btnOpenCreatePost) {
        btnOpenCreatePost.addEventListener('click', () => {
            if (!currentUser) {
                alert('Please log in to share a project.');
                return;
            }
            if (modalCreatePost) modalCreatePost.style.display = 'block';
        });
    }

    if (formCreatePost) {
        formCreatePost.addEventListener('submit', async (e) => {
            e.preventDefault();
            const scratchInput = document.getElementById('post-scratch-input').value;
            const caption = document.getElementById('post-caption').value;

            try {
                const res = await fetch('/api/posts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scratchInput, caption })
                });

                const data = await res.json();
                if (data.success) {
                    formCreatePost.reset();
                    if (modalCreatePost) modalCreatePost.style.display = 'none';
                    loadPosts();
                } else {
                    alert(data.error || 'Failed to post project.');
                }
            } catch (err) {
                alert('Server error posting project.');
            }
        });
    }

    // --- CONTESTS & STUDIOS PLACEHOLDERS ---
    async function loadContests() {
        const container = document.getElementById('contests-container');
        if (!container) return;
        try {
            const res = await fetch('/api/contests');
            const data = await res.json();
            if (!data.length) {
                container.innerHTML = '<p class="empty-state">No contests available right now.</p>';
                return;
            }
            container.innerHTML = data.map(c => `<div class="card"><h3>${escapeHTML(c.title)}</h3><p>${escapeHTML(c.description || '')}</p></div>`).join('');
        } catch (err) {
            container.innerHTML = '<p class="error-state">Failed to load contests.</p>';
        }
    }

    async function loadStudios() {
        const container = document.getElementById('studios-container');
        if (!container) return;
        try {
            const res = await fetch('/api/studios');
            const data = await res.json();
            if (!data.length) {
                container.innerHTML = '<p class="empty-state">No studios added yet.</p>';
                return;
            }
            container.innerHTML = data.map(s => `<div class="card"><h3>${escapeHTML(s.title)}</h3><p>${escapeHTML(s.description || '')}</p></div>`).join('');
        } catch (err) {
            container.innerHTML = '<p class="error-state">Failed to load studios.</p>';
        }
    }

    // --- GENERAL MODAL CLOSING ---
    document.querySelectorAll('.modal-close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // Startup
    checkAuth();
    loadPosts();
});
