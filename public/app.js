import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://jslfotggoxgibjhsgfpe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bM9jO-5AWPtyF_ME6gbKug_-FN56QxP';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- APP STATE ---
let currentUser = null; // Starts completely logged out (no demo user)
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

// --- WORKING NAVIGATION HANDLER ---
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-link');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = btn.getAttribute('data-target');
            if (targetPage) {
                switchPage(targetPage);
            }
        });
    });
}

function switchPage(pageId) {
    window.location.hash = pageId;

    pages.forEach(p => {
        const pageEl = document.getElementById(`page-${p}`);
        if (pageEl) {
            pageEl.classList.toggle('hidden', p !== pageId);
        }
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

// --- DATA FETCHING & RENDERING ---
async function fetchPosts() {
    const container = document.getElementById('posts-container');
    if (!container) return;

    let postsList = [];
    try {
        const { data: posts } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (posts && posts.length > 0) {
            postsList = posts;
        }
    } catch (err) {
        console.log('Supabase connection note: using local fallback data.');
    }

    if (postsList.length === 0) {
        postsList = [
            {
                id: '1',
                project_link: 'https://scratch.mit.edu/projects/10421312/',
                text: 'Check out this sample Scratch project link on our feed!',
                author: 'System',
                author_color: '#2563eb',
                type: 'General'
            }
        ];
    }

    container.innerHTML = postsList.map(p => `
        <article class="post-card">
            ${p.type ? `<span class="post-tag">${p.type}</span>` : ''}
            <div class="post-header">
                <span class="post-author" style="color: ${p.author_color || 'inherit'}">${p.author}</span>
            </div>
            <p class="post-text">${p.text}</p>
            ${p.project_link ? `<a href="${p.project_link}" target="_blank" class="btn primary w-100">Play Scratch Project</a>` : ''}
        </article>
    `).join('');
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

// --- EVENT HANDLERS & SCRATCH VERIFICATION ---
function setupEvents() {
    // Step 1: Submit Username & Generate Code
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

    // Back button for verification view
    const backBtn = document.getElementById('btn-back-username');
    if (backBtn) {
        backBtn.onclick = () => {
            document.getElementById('verify-step-2').classList.add('hidden');
            document.getElementById('verify-step-1').classList.remove('hidden');
        };
    }

    // Step 2: Check Scratch Profile Bio via API
    const verifyBioBtn = document.getElementById('btn-verify-bio');
    if (verifyBioBtn) {
        verifyBioBtn.onclick = async () => {
            verifyBioBtn.textContent = 'Checking profile...';
            
            try {
                // Adding a timestamp parameter forces the proxy to bypass cache and fetch fresh data
                const targetUrl = `https://api.scratch.mit.edu/users/${pendingUsername}?t=${Date.now()}`;
                const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
                
                const response = await fetch(proxyUrl);
                const data = await response.json();
                
                if (!data.contents) {
                    throw new Error('User not found');
                }

                const userInfo = JSON.parse(data.contents);
                
                // Debugging: Check your browser's F12 Console to see what bio text was grabbed
                console.log("Fetched Scratch User Data:", userInfo);

                const bio = userInfo.profile ? (userInfo.profile.bio || '') + ' ' + (userInfo.profile.status || '') : '';

                console.log("Combined Bio/Status text found:", bio);
                console.log("Looking for code:", verificationCode);

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
                    alert(`Code "${verificationCode}" not found in your Scratch bio yet. Make sure you hit "Save" on your Scratch profile and wait a few seconds!`);
                }
            } catch (err) {
                alert('Could not verify user. Make sure the Scratch username is correct.');
                console.error(err);
            } finally {
                verifyBioBtn.textContent = "I've put it in my bio, Verify Me!";
            }
        };
    }

    // Create Post Form Submission
    const postForm = document.getElementById('create-post-form');
    if (postForm) {
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return alert('Please log in first!');

            const project_link = document.getElementById('post-project-link').value;
            const text = document.getElementById('post-text').value;

            const newPost = {
                project_link,
                text,
                author: currentUser.username,
                author_color: currentUser.color,
                type: 'Post'
            };

            try {
                await supabase.from('posts').insert([newPost]);
            } catch (err) {}

            postForm.reset();
            fetchPosts();
        });
    }

    // Studio Form Submission
    const studioForm = document.getElementById('studio-ad-form');
    if (studioForm) {
        studioForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return alert('Please log in first!');

            const link = document.getElementById('studio-link').value;
            const desc = document.getElementById('studio-desc').value;

            try {
                await supabase.from('posts').insert([{
                    project_link: link,
                    text: desc,
                    author: currentUser.username,
                    author_color: currentUser.color,
                    type: 'Studio Ad'
                }]);
            } catch (err) {}

            alert('Studio Ad Published!');
            studioForm.reset();
            switchPage('home');
            fetchPosts();
        });
    }

    // Contest Form Submission
    const contestForm = document.getElementById('contest-form');
    if (contestForm) {
        contestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return alert('Please log in first!');

            const link = document.getElementById('contest-link').value;
            const rules = document.getElementById('contest-rules').value;

            try {
                await supabase.from('posts').insert([{
                    project_link: link,
                    text: rules,
                    author: currentUser.username,
                    author_color: currentUser.color,
                    type: 'Contest'
                }]);
            } catch (err) {}

            alert('Contest Created!');
            contestForm.reset();
            switchPage('home');
            fetchPosts();
        });
    }

    // Shop Purchasing
    const crimsonBtn = document.getElementById('btn-buy-crimson');
    if (crimsonBtn) crimsonBtn.onclick = () => purchase('color', '#dc2626', 50);

    const amberBtn = document.getElementById('btn-buy-amber');
    if (amberBtn) amberBtn.onclick = () => purchase('color', '#d97706', 50);

    const verifiedBtn = document.getElementById('btn-buy-verified');
    if (verifiedBtn) verifiedBtn.onclick = () => purchase('badge', 'Verified', 100);

    // Logout Button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            currentUser = null;
            updateUI();
            renderProfile();
        };
    }
}

async function purchase(type, value, price) {
    if (!currentUser) return alert('Please login first!');
    if (currentUser.coins < price) return alert('Not enough coins!');

    currentUser.coins -= price;
    if (type === 'color') currentUser.color = value;
    if (type === 'badge' && !currentUser.badges.includes(value)) currentUser.badges.push(value);

    try {
        await supabase.from('users').update({
            coins: currentUser.coins,
            color: currentUser.color,
            badges: currentUser.badges
        }).eq('username', currentUser.username);
    } catch (err) {}

    alert('Purchase successful!');
    updateUI();
    renderProfile();
}
