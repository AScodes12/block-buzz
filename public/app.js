import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. Initialize Supabase (Replace with your actual project details)
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global State
let currentUser = null; // From Supabase Auth
let userData = null;    // From your custom 'users' table

// 2. Main Router - Runs when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    await fetchCurrentUser();

    const path = window.location.pathname;

    // Route to the correct functions based on the current page
    if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
        initHome();
    } else if (path.includes('create.html')) {
        initCreate();
    } else if (path.includes('shop.html')) {
        initShop();
    } else if (path.includes('profile.html')) {
        initProfile();
    } else if (path.includes('admin.html')) {
        initAdmin();
    }
});

// 3. User Authentication & Data Fetching
async function fetchCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;

    if (currentUser) {
        // Fetch custom user data (coins, badges, color) from your database schema
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id) // Assuming auth.uid maps to your users table
            .single();

        if (data) userData = data;
    }
}

// ---------------------------------------------------------
// PAGE SPECIFIC LOGIC
// ---------------------------------------------------------

// --- HOME PAGE (index.html) ---
async function initHome() {
    const container = document.getElementById('posts-container');
    
    const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p>Error loading posts: ${error.message}</p>`;
        return;
    }

    if (posts.length === 0) {
        container.innerHTML = `<p>No projects posted yet. Be the first!</p>`;
        return;
    }

    container.innerHTML = posts.map(post => `
        <div class="post" style="border: 1px solid #ccc; padding: 15px; margin-bottom: 10px; border-radius: 8px;">
            <h3>${post.title}</h3>
            <p><strong>By:</strong> ${post.author}</p>
            <p>${post.caption}</p>
            <p><small>Project ID: ${post.project_id}</small></p>
        </div>
    `).join('');
}

// --- CREATE PAGE (create.html) ---
function initCreate() {
    if (!currentUser) {
        alert("You must be logged in to post!");
        window.location.href = 'index.html'; // Redirect to home/login
        return;
    }

    const form = document.getElementById('create-post-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('title').value;
        const projectId = document.getElementById('project-id').value;
        const caption = document.getElementById('caption').value;

        // Generate a random ID for the post
        const id = Math.floor(Math.random() * 1000000000); 

        const { error } = await supabase.from('posts').insert([{
            id: id,
            title: title,
            project_id: projectId,
            caption: caption,
            author: userData ? userData.username : 'Unknown',
            author_pfp: userData ? userData.pfp : null
        }]);

        if (error) {
            alert('Error posting: ' + error.message);
        } else {
            alert('Project posted successfully!');
            window.location.href = 'index.html'; // Send back to feed
        }
    });
}

// --- SHOP PAGE (shop.html) ---
function initShop() {
    if (!currentUser || !userData) {
        document.getElementById('coin-balance').innerText = "0 (Log in first)";
        return;
    }

    // Update UI with current balance
    document.getElementById('coin-balance').innerText = userData.coins;

    // Attach shop functions to the window object so HTML inline onclick can see them
    window.buyColor = async function(colorHex, cost) {
        if (userData.coins < cost) return alert("Not enough coins! 🪙");

        const { error } = await supabase.from('users')
            .update({ 
                color: colorHex, 
                coins: userData.coins - cost 
            })
            .eq('id', userData.id);

        if (!error) {
            alert("Color purchased successfully!");
            location.reload(); // Refresh to update stats
        } else {
            alert("Purchase failed: " + error.message);
        }
    };

    window.buyBadge = async function(badgeName, cost) {
        if (userData.coins < cost) return alert("Not enough coins! 🪙");
        if (userData.badges.includes(badgeName)) return alert("You already own this badge!");

        const updatedBadges = [...userData.badges, badgeName];

        const { error } = await supabase.from('users')
            .update({ 
                badges: updatedBadges, 
                coins: userData.coins - cost 
            })
            .eq('id', userData.id);

        if (!error) {
            alert("Badge purchased successfully!");
            location.reload();
        } else {
            alert("Purchase failed: " + error.message);
        }
    };
}

// --- PROFILE PAGE (profile.html) ---
async function initProfile() {
    if (!currentUser || !userData) {
        document.querySelector('.container').innerHTML = '<h2>Please log in to view your profile.</h2>';
        return;
    }

    // Populate user info
    document.getElementById('profile-username').innerText = userData.username;
    document.getElementById('profile-username').style.color = userData.color; // Apply custom color
    document.getElementById('profile-badges').innerText = "Badges: " + (userData.badges.length > 0 ? userData.badges.join(', ') : 'None');
    document.getElementById('referral-code').innerText = userData.referral_code || "Generate one in settings";
    if (userData.pfp) {
        document.getElementById('profile-pfp').src = userData.pfp;
    }

    // Fetch ONLY the posts created by this user
    const container = document.getElementById('user-posts-container');
    const { data: myPosts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('author', userData.username)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p>Error loading your posts.</p>`;
        return;
    }

    if (myPosts.length === 0) {
        container.innerHTML = `<p>You haven't posted any projects yet.</p>`;
        return;
    }

    container.innerHTML = myPosts.map(post => `
        <div class="post" style="border: 1px solid #ccc; padding: 15px; margin-bottom: 10px;">
            <h3>${post.title}</h3>
            <p>${post.caption}</p>
        </div>
    `).join('');
}

// --- ADMIN PAGE (admin.html) ---
function initAdmin() {
    if (!userData || !userData.is_admin) {
        document.querySelector('.container').innerHTML = '<h1 style="color:red;">Access Denied. You are not an admin.</h1>';
        return;
    }

    window.adminDeletePost = async function() {
        const postId = document.getElementById('delete-post-id').value;
        const { error } = await supabase.from('posts').delete().eq('id', postId);
        
        if (error) alert("Error: " + error.message);
        else alert(`Post ${postId} deleted successfully.`);
    };

    window.adminGiveCoins = async function() {
        const username = document.getElementById('reward-username').value;
        const amount = parseInt(document.getElementById('reward-amount').value);

        // First get the user's current coins
        const { data: targetUser, error: fetchErr } = await supabase.from('users').select('coins').eq('username', username).single();
        if (fetchErr) return alert("User not found.");

        // Add the coins
        const { error: updateErr } = await supabase.from('users').update({ coins: targetUser.coins + amount }).eq('username', username);
        
        if (updateErr) alert("Error: " + updateErr.message);
        else alert(`Successfully gave ${amount} coins to ${username}!`);
    };
}
