import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://jslfotggoxgibjhsgfpe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bM9jO-5AWPtyF_ME6gbKug_-FN56QxP';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- APP STATE ---
let currentUser = null;
let pendingUsername = '';
let verificationCode = '';

const pages = ['home', 'studio', 'contests', 'shop', 'profile'];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    updateUI();
    renderProfile();
    setupEvents();
    fetchPosts();
});

// --- NAVIGATION ---
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-link');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = btn.getAttribute('data-target');
            if (targetPage) switchPage(targetPage);
        });
    });
}

function switchPage(pageId) {
    window.location.hash = pageId;
    pages.forEach(p => {
        const pageEl = document.getElementById(`page-${p}`);
        if (pageEl) pageEl.classList.toggle('hidden', p !== pageId);
    });
    document.querySelectorAll('.nav-link').forEach(btn => {
        if (btn.getAttribute('data-target') === pageId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    if (pageId === 'profile') renderProfile();
}

// --- DATA FETCHING ---
async function fetchPosts() {
    const container = document.getElementById('posts-container');
    if (!container) return;

    try {
        const { data: posts, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (posts && posts.length > 0) {
            container.innerHTML = posts.map(p => `
                <article class="post-card">
                    ${p.type ? `<span class="post-tag">${p.type}</span>` : ''}
                    <div class="post-header">
                        <span class="post-author" style="color: ${p.author_color || 'inherit'}">${p.author}</span>
                    </div>
                    <p class="post-text">${p.text}</p>
                    ${p.project_link ? `<a href="${p.project_link}" target="_blank" class="btn primary w-100">Play Scratch Project</a>` : ''}
                </article>
            `).join('');
            return;
        }
    } catch (err) {
        console.log('Database notice: Ensure your "posts" table is created in Supabase.');
    }

    container.innerHTML = `<p class="text-center" style="color: gray; padding: 20px;">No posts yet. Be the first to create one!</p>`;
}

function renderProfile() {
    const loggedInView = document.getElementById('profile-logged-in');
    const loggedOutView = document.getElementById('profile-logged-out');
    if (!loggedInView || !loggedOutView) return;

    if (!currentUser) {
        loggedInView.classList.add('hidden');
        loggedOutView.classList.remove('hidden');
        return;
    }

    loggedInView.classList.remove('hidden');
    loggedOutView.classList.add('hidden');

    const nameEl = document.getElementById('profile-username');
    if (nameEl) {
        nameEl.textContent = currentUser.username;
        nameEl.style.color = currentUser.color;
    }

    const refEl = document.getElementById('referral-code');
    if (refEl) refEl.textContent = currentUser.referral_code;

    const badgesEl = document.getElementById('profile-badges');
    if (badgesEl) {
        badgesEl.innerHTML = (currentUser.badges || []).map(b => `<span class="badge">${b}</span>`).join('');
    }
}

function updateUI() {
    const coinDisplays = document.querySelectorAll('#user-coins-display');
    coinDisplays.forEach(el => el.textContent = currentUser ? currentUser.coins : 0);

    const authBtn = document.getElementById('auth-btn');
    if (authBtn) {
        authBtn.textContent = currentUser ? 'Profile' : 'Login';
        authBtn.onclick = () => switchPage('profile');
    }
}

// --- EVENTS & VERIFICATION ---
function setupEvents() {
    const usernameForm = document.getElementById('username-form');
    if (usernameForm) {
        usernameForm.addEventListener('submit', (e) => {
            e.preventDefault();
            pendingUsername = document.getElementById('scratch-username-input').value.trim();
            
            verificationCode = 'BB-' + Math.random().toString(36).substring(2, 8).toUpperCase();
            document.getElementById('verification-code-display').textContent = verificationCode;

            document.getElementById('verify-step-1').classList.add('hidden');
            document.getElementById('verify-step-2').classList.remove('hidden');
        });
    }

    const backBtn = document.getElementById('btn-back-username');
    if (backBtn) {
        backBtn.onclick = () => {
            document.getElementById('verify-step-2').classList.add('hidden');
            document.getElementById('verify-step-1').classList.remove('hidden');
        };
    }

    const verifyBioBtn = document.getElementById('btn-verify-bio');
    if (verifyBioBtn) {
        verifyBioBtn.onclick = async () => {
            verifyBioBtn.textContent = 'Checking profile...';
            
            try {
                // Using an alternative proxy endpoint route to avoid 403 blocks
                const targetUrl = `https://api.scratch.mit.edu/users/${pendingUsername}`;
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
                
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('User not found or proxy blocked');
                
                const userInfo = await response.json();
                const bio = userInfo.profile ? (userInfo.profile.bio || '') + ' ' + (userInfo.profile.status || '') : '';

                if (bio.includes(verificationCode)) {
                    alert('Verification successful! Welcome, ' + pendingUsername);
                    
                    currentUser = {
                        id: 'u-' + pendingUsername.toLowerCase(),
                        username: pendingUsername,
                        coins: 100,
                        color: '#2563eb',
                        badges: ['Member'],
                        referral_code: 'REF-' + Math.floor(1000 + Math.random() * 9000)
                    };

                    document.getElementById('verify-step-2').classList.add('hidden');
                    document.getElementById('verify-step-1').classList.remove('hidden');
                    document.getElementById('username-form').reset();

                    updateUI();
                    renderProfile();
                    switchPage('profile');
                } else {
                    alert(`Code "${verificationCode}" not found in your Scratch bio yet. Save your bio on Scratch and try again in a few seconds.`);
                }
            } catch (err) {
                alert('Could not reach Scratch profile. Please check that your Scratch username is correct.');
                console.error(err);
            } finally {
                verifyBioBtn.textContent = "I've put it in my bio, Verify Me!";
            }
        };
    }

    // Forms and actions
    const postForm = document.getElementById('create-post-form');
    if (postForm) {
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return alert('Please log in first!');

            await supabase.from('posts').insert([{
                project_link: document.getElementById('post-project-link').value,
                text: document.getElementById('post-text').value,
                author: currentUser.username,
                author_color: currentUser.color,
                type: 'Post'
            }]);

            postForm.reset();
            fetchPosts();
        });
    }

    const studioForm = document.getElementById('studio-ad-form');
    if (studioForm) {
        studioForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return alert('Please log in first!');

            await supabase.from('posts').insert([{
                project_link: document.getElementById('studio-link').value,
                text: document.getElementById('studio-desc').value,
                author: currentUser.username,
                author_color: currentUser.color,
                type: 'Studio Ad'
            }]);

            alert('Studio Ad Published!');
            studioForm.reset();
            switchPage('home');
            fetchPosts();
        });
    }

    const contestForm = document.getElementById('contest-form');
    if (contestForm) {
        contestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return alert('Please log in first!');

            await supabase.from('posts').insert([{
                project_link: document.getElementById('contest-link').value,
                text: document.getElementById('contest-rules').value,
                author: currentUser.username,
                author_color: currentUser.color,
                type: 'Contest'
            }]);

            alert('Contest Created!');
            contestForm.reset();
            switchPage('home');
            fetchPosts();
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            currentUser = null;
            updateUI();
            renderProfile();
        };
    }
}
