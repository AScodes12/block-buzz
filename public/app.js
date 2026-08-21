import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- APP STATE ---
let currentUser = {
    id: 'demo-user',
    username: 'ScratchDev',
    coins: 100,
    color: '#2563eb',
    badges: ['Member'],
    referral_code: 'REF-1001'
};

const pages = ['home', 'studio', 'contests', 'shop', 'profile'];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    setupRouter();
    updateUI();
    setupEvents();
    fetchPosts();
});

// --- FIXED ROUTING HANDLER ---
function setupRouter() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
}

function handleRoute() {
    let hash = window.location.hash.replace('#', '') || 'home';
    if (!pages.includes(hash)) hash = 'home';

    pages.forEach(p => {
        const pageEl = document.getElementById(`page-${p}`);
        const navEl = document.getElementById(`nav-${p}`);

        if (pageEl) {
            pageEl.classList.toggle('hidden', p !== hash);
        }
        
        if (navEl) {
            if (p === hash) {
                navEl.classList.add('active');
            } else {
                navEl.classList.remove('active');
            }
        }
    });

    if (hash === 'profile') renderProfile();
}

// --- DATA FETCHING & RENDERING ---
async function fetchPosts() {
    const container = document.getElementById('posts-container');

    const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

    const postsList = (posts && posts.length > 0) ? posts : [
        {
            id: '1',
            title: 'Welcome to the BlockBuzz Feed!',
            text: 'Posts are rendered one per row with complete text support.',
            author: 'System',
            author_color: '#2563eb',
            type: 'General'
        }
    ];

    container.innerHTML = postsList.map(p => `
        <article class="post-card">
            ${p.type ? `<span class="post-tag">${p.type}</span>` : ''}
            <div class="post-header">
                <span class="post-author" style="color: ${p.author_color || 'inherit'}">${p.author}</span>
            </div>
            <h3 class="post-title">${p.title}</h3>
            <p class="post-text">${p.text}</p>
        </article>
    `).join('');
}

function renderProfile() {
    const loggedInView = document.getElementById('profile-logged-in');
    const loggedOutView = document.getElementById('profile-logged-out');

    if (!currentUser) {
        loggedInView.classList.add('hidden');
        loggedOutView.classList.remove('hidden');
        return;
    }

    loggedInView.classList.remove('hidden');
    loggedOutView.classList.add('hidden');

    const nameEl = document.getElementById('profile-username');
    nameEl.textContent = currentUser.username;
    nameEl.style.color = currentUser.color;

    document.getElementById('referral-code').textContent = currentUser.referral_code;
    document.getElementById('profile-badges').innerHTML = (currentUser.badges || []).map(b => `<span class="badge">${b}</span>`).join('');
}

function updateUI() {
    const coinDisplays = document.querySelectorAll('#user-coins-display');
    coinDisplays.forEach(el => el.textContent = currentUser ? currentUser.coins : 0);

    const authBtn = document.getElementById('auth-btn');
    if (authBtn) {
        authBtn.textContent = currentUser ? 'Profile' : 'Login';
        authBtn.onclick = () => window.location.hash = 'profile';
    }
}

// --- EVENT HANDLERS ---
function setupEvents() {
    // Create Post Form Submission
    document.getElementById('create-post-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('post-title').value;
        const text = document.getElementById('post-text').value;

        const newPost = {
            title,
            text,
            author: currentUser?.username || 'Guest',
            author_color: currentUser?.color || '#0f172a',
            type: 'Post'
        };

        await supabase.from('posts').insert([newPost]);
        document.getElementById('create-post-form').reset();
        fetchPosts();
    });

    // Studio Form Submission
    document.getElementById('studio-ad-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('studio-title').value;
        const link = document.getElementById('studio-link').value;
        const desc = document.getElementById('studio-desc').value;

        await supabase.from('posts').insert([{
            title: `Studio Ad: ${title}`,
            text: `${desc}\n\nLink: ${link}`,
            author: currentUser?.username || 'Guest',
            author_color: currentUser?.color || '#0f172a',
            type: 'Studio'
        }]);

        alert('Studio Ad Published!');
        document.getElementById('studio-ad-form').reset();
        window.location.hash = 'home';
        fetchPosts();
    });

    // Contest Form Submission
    document.getElementById('contest-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('contest-title').value;
        const rules = document.getElementById('contest-rules').value;

        await supabase.from('posts').insert([{
            title: `Contest: ${title}`,
            text: rules,
            author: currentUser?.username || 'Guest',
            author_color: currentUser?.color || '#0f172a',
            type: 'Contest'
        }]);

        alert('Contest Created!');
        document.getElementById('contest-form').reset();
        window.location.hash = 'home';
        fetchPosts();
    });

    // Shop Purchasing
    document.getElementById('btn-buy-crimson').onclick = () => purchase('color', '#dc2626', 50);
    document.getElementById('btn-buy-amber').onclick = () => purchase('color', '#d97706', 50);
    document.getElementById('btn-buy-verified').onclick = () => purchase('badge', 'Verified', 100);

    // Login / Logout
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        currentUser = { id: 'u-' + Date.now(), username, coins: 50, color: '#0f172a', badges: ['Member'], referral_code: 'REF-' + Math.floor(Math.random()*9000) };
        updateUI();
        renderProfile();
    });

    document.getElementById('logout-btn').onclick = () => {
        currentUser = null;
        updateUI();
        renderProfile();
    };
}

async function purchase(type, value, price) {
    if (!currentUser) return alert('Please login first!');
    if (currentUser.coins < price) return alert('Not enough coins!');

    currentUser.coins -= price;
    if (type === 'color') currentUser.color = value;
    if (type === 'badge' && !currentUser.badges.includes(value)) currentUser.badges.push(value);

    await supabase.from('users').update({
        coins: currentUser.coins,
        color: currentUser.color,
        badges: currentUser.badges
    }).eq('username', currentUser.username);

    alert('Purchase successful!');
    updateUI();
    renderProfile();
}
