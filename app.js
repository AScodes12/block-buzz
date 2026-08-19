const API_URL = 'https://fluid-mail-municipal-harbor.trycloudflare.com/api'; 

async function loadPosts() {
    try {
        const response = await fetch(`${API_URL}/posts`);
        const posts = await response.json();
        const feed = document.getElementById('feed');
        feed.innerHTML = '';
        
        posts.forEach(post => {
            const card = document.createElement('div');
            card.className = 'project-card';
            
            // Clean up fallback variables in case the backend sends undefined data
            const formattedLikes = formatNumber(post.likes || 0);
            const formattedViews = formatNumber(post.views || 0);
            const poster = post.posterName || 'Anonymous';
            const caption = post.caption || '';
            const title = post.title || 'Untitled Project';
            const author = post.author || 'Unknown';

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
                        <span><i class="fa-solid fa-eye"></i> ${formattedViews}</span>
                    </div>
                    <button class="action-btn" onclick="likePost(${post.id}, this)">
                        <i class="fa-regular fa-heart"></i> Like
                    </button>
                </div>
            `;
            feed.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading posts:', error);
        document.getElementById('feed').innerHTML = '<p style="text-align:center; color:#65676b; margin-top: 40px;">Cannot connect to the backend server.</p>';
    }
}

async function submitPost() {
    const userInput = document.getElementById('post-username');
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
                username: userInput.value
            })
        });
        
        if (!response.ok) {
            alert("Could not load project from Scratch. Check your link or ID!");
        } else {
            scratchInput.value = '';
            captionInput.value = '';
            loadPosts();
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
        icon.classList.add('fa-solid', 'loved');
        btnElement.style.color = '#f02849';
    } catch (error) {
        console.error('Error liking post:', error);
    }
}

function formatNumber(num) {
    return num >= 1000 ? (num / 1000).toFixed(1) + 'K' : num;
}

loadPosts();
