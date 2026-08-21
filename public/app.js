import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// --- DATABASE CONFIGURATION ---
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- APP STATE ---
let currentUser = {
    id: 'demo-user',
    username: 'ScratchDev',
    coins: 150,
    color: '#2563eb',
    badges: ['Verified'],
    referral_code: 'REF-8392'
};

const pages = ['home', 'create', 'shop', 'profile', 'admin'];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    setupRouter();
    updateUI();
    setupEvents();
    fetchPosts();
});

// --- MULTI-PAGE ROUTER ---
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
        if (pageEl) pageEl.classList.toggle('hidden', p !== hash);
        if (navEl) navEl.classList.toggle('active', p === hash);
    });

    if (hash === 'profile') renderProfile();
}

// --- DATA FETCHING & RENDERING ---
async function fetchPosts() {
    const feed = document.getElementById('posts-container');

    const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

    const displayPosts = (posts && posts.length > 0) ? posts : [
        { id: 10421312, title: 'Platformer v2.0', author: 'ScratchDev', author_color: currentUser?.color || '#2563eb', thumbnail: 'https://uploads.scratch.mit.edu/projects/thumbnails/10421312.png' },
        { id: 10421313, title: '3D Engine Demo', author: 'GamerX', author_color: '#0f172a', thumbnail: 'https://uploads.scratch.mit.edu/projects/thumbnails/10421312.png' }
    ];

    feed.innerHTML = displayPosts.map(p => `
        <div class="post-card">
            <img src="${p.thumbnail}" alt="Thumbnail">
            <div class="post-info">
                <div class="post-title">${p.title}</div>
                <div class="post-author" style="color: ${p.author_color || 'inherit'}">${p.author}</div>
            </div>
        </div>
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
    
    document.getElementById('user-posts-container').innerHTML = `
        <div class="post-card">
            <img src="https://uploads.scratch.mit.edu/projects/thumbnails/10421312.png" alt="Thumbnail">
            <div class="post-info">
                <div class="post-title">Platformer v2.0</div>
            </div>
        </div>
    `;
}

// --- GLOBAL UI UPDATE ---
function updateUI() {
    const coinDisplays = document.querySelectorAll('#user-coins-display');
    coinDisplays.forEach(el => el.textContent = currentUser ? currentUser.coins : 0);

    const authBtn = document.getElementById('auth-btn');
    if (authBtn) {
        authBtn.textContent = currentUser ? 'Profile' : 'Login';
        authBtn.onclick = () => window.location.hash = 'profile';
    }
}

// --- SHOP PURCHASES & DATA MUTATION ---
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

// --- EVENT LISTENERS ---
function setupEvents() {
    document.getElementById('create-post-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const projectId = document.getElementById('project-id').value;
        const caption = document.getElementById('caption').value;

        const newPost = {
            project_id: projectId,
            title: `Project #${projectId}`,
            caption,
            author: currentUser?.username || 'Guest',
            author_color: currentUser?.color || '#0f172a',
            thumbnail: `https://uploads.scratch.mit.edu/projects/thumbnails/${projectId}.png`
        };

        await supabase.from('posts').insert([newPost]);

        alert(`Published project #${projectId}!`);
        window.location.hash = 'home';
        fetchPosts();
    });

    document.getElementById('btn-buy-crimson').onclick = () => purchase('color', '#dc2626', 50);
    document.getElementById('btn-buy-amber').onclick = () => purchase('color', '#d97706', 50);
    document.getElementById('btn-buy-verified').onclick = () => purchase('badge', 'Verified', 100);
    document.getElementById('btn-buy-bughunter').onclick = () => purchase('badge', 'Bug Hunter', 100);

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        currentUser = { id: 'u-' + Date.now(), username, coins: 50, color: '#0f172a', badges: [], referral_code: 'REF-' + Math.floor(Math.random()*9000) };
        updateUI();
        renderProfile();
    });

    document.getElementById('logout-btn').onclick = () => {
        currentUser = null;
        updateUI();
        renderProfile();
    };

    document.getElementById('admin-delete-btn').onclick = async () => {
        const postId = document.getElementById('delete-post-id').value;
        if (postId) {
            await supabase.from('posts').delete().eq('id', postId);
            alert(`Deleted project ${postId}`);
            fetchPosts();
        }
    };
}
