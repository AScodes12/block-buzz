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

// --- DATA FETCHING (MATCHING YOUR SCHEMA) ---
async function fetchPosts() {
    const container = document.getElementById('posts-container');
    if (!container) return;

    try {
        const { data: posts, error } = await supabase
            .from('posts')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;

        if (posts && posts.length > 0) {
            container.innerHTML = posts.map(p => `
                <article class="post-card">
                    <div class="post-header">
                        <span class="post-author" style="color: ${p.author_color || 'inherit'}">${p.author}</span>
                    </div>
                    ${p.title ? `<h3>${p.title}</h3>` : ''}
                    <p class="post-text">${p.caption || ''}</p>
                    ${p.project_id ? `<a href="https://scratch.mit.edu/projects/${p.project_id}" target="_blank" class="btn primary w-100">Play Scratch Project</a>` : ''}
                </article>
            `).join('');
            return;
        }
    } catch (err) {
        console.log('Database notice: Ensure your tables are created in Supabase.', err);
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

// --- EVENTS & SCRATCH VERIFICATION ---
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
                const targetUrl = `https://api.scratch.mit.edu/users/${pendingUsername}`;
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
                
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('User not found');
                
                const userInfo = await response.json();
                const bio = userInfo.profile ? (userInfo.profile.bio || '') + ' ' + (userInfo.profile.status || '') : '';

                if (bio.includes(verificationCode)) {
                    // Check or create user in Supabase 'users' table matching your schema
                    let { data: existingUser } = await supabase
                        .from('users')
                        .select('*')
                        .eq('username', pendingUsername)
                        .single();

                    if (!existingUser) {
                        const newUser = {
                            username: pendingUsername,
                            coins: 100,
                            color: '#0f172a',
                            badges: ['Member'],
                            referral_code: 'REF-' + Math.floor(1000 + Math.random() * 9000)
                        };
                        await supabase.from('users').insert([newUser]);
                        currentUser = newUser;
                    } else {
                        currentUser = existingUser;
                    }

                    alert('Verification successful! Welcome, ' + pendingUsername);

                    document.getElementById('verify-step-2').classList.add('hidden');
                    document.getElementById('verify-step-1').classList.remove('hidden');
                    document.getElementById('username-form').reset();

                    updateUI();
                    renderProfile();
                    switchPage('profile');
                } else {
                    alert(`Code "${verificationCode}" not found in your Scratch bio yet. Save your bio on Scratch and try again.`);
                }
            } catch (err) {
                alert('Could not verify profile. Please check that your Scratch username is correct.');
                console.error(err);
            } finally {
                verifyBioBtn.textContent = "I've put it in my bio, Verify Me!";
            }
        };
    }

    // Post Form (Matches your posts table schema)
    const postForm = document.getElementById('create-post-form');
    if (postForm) {
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return alert('Please log in first!');

            const projectLinkInput = document.getElementById('post-project-link').value;
            // Extract project ID from Scratch link if user pasted full URL
            const projectIdMatch = projectLinkInput.match(/projects\/(\d+)/);
            const projectId = projectIdMatch ? projectIdMatch[1] : projectLinkInput;

            await supabase.from('posts').insert([{
                id: Date.now(), // Generating a unique bigint ID
                project_id: projectId,
                title: document.getElementById('post-title')?.value || 'Untitled Post',
                caption: document.getElementById('post-text').value,
                author: currentUser.username,
                author_color: currentUser.color,
                author_badges: currentUser.badges
            }]);

            postForm.reset();
            fetchPosts();
        });
    }

    // Studio Ad Form (Matches studios table schema)
    const studioForm = document.getElementById('studio-ad-form');
    if (studioForm) {
        studioForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return alert('Please log in first!');

            const studioLink = document.getElementById('studio-link').value;
            const studioIdMatch = studioLink.match(/studios\/(\d+)/);
            const studioId = studioIdMatch ? studioIdMatch[1] : studioLink;

            await supabase.from('studios').insert([{
                studio_id: studioId,
                title: document.getElementById('studio-title')?.value || 'Studio Ad',
                description: document.getElementById('studio-desc').value,
                advertiser: currentUser.username
            }]);

            alert('Studio Ad Published!');
            studioForm.reset();
            switchPage('home');
        });
    }

    // Contest Form (Matches contests table schema)
    const contestForm = document.getElementById('contest-form');
    if (contestForm) {
        contestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return alert('Please log in first!');

            const contestLink = document.getElementById('contest-link').value;
            const contestIdMatch = contestLink.match(/projects\/(\d+)/) || contestLink.match(/studios\/(\d+)/);
            const contestId = contestIdMatch ? contestIdMatch[1] : contestLink;

            await supabase.from('contests').insert([{
                contest_id: contestId,
                description: document.getElementById('contest-rules').value,
                advertiser: currentUser.username
            }]);

            alert('Contest Created!');
            contestForm.reset();
            switchPage('home');
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
