const API_URL = 'https://review-baghdad-est-engagement.trycloudflare.com'; 

async function loadPosts() {
    try {
        const response = await fetch(`${API_URL}/posts`);
        const posts = await response.json();
        const feed = document.getElementById('feed');
        feed.innerHTML = '';
        
        posts.forEach(post => {
            const card = document.createElement('div');
            card.className = 'project-card';
            
            const formattedLikes = formatNumber(post.likes);
            const formattedViews = formatNumber(post.views);

            card.innerHTML = `
                <img src="${post.thumbnail}" alt="Thumbnail" class="project-thumbnail" onerror="this.src='https://uploads.scratch.mit.edu/get_image/project/1_480x360.png'">
                <div class="card-left">
                    <h2><a href="https://scratch.mit.edu/projects/${post.scratchId}" target="_blank" style="color:white; text-decoration:none;">${post.title}</a></h2>
                    <div class="author-info">${post.author} &nbsp;&nbsp; Level: ${post.level}</div>
                    <div class="desc">${post.description}</div>
                </div>
                <div class="card-right">
                    <div class="stars">
                        <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star-half-alt"></i>
                        <span>${post.rating} Stars</span>
                    </div>
                    <button class="love-btn" onclick="likePost(${post.id})">
                        <i class="fas fa-heart"></i> LOVE
                    </button>
                    <div class="stats">
                        <div><span id="likes-${post.id}">${formattedLikes}</span> likes</div>
                        <div><span>${formattedViews}</span> views</div>
                    </div>
                </div>
            `;
            feed.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading posts:', error);
        document.getElementById('feed').innerHTML = '<p style="text-align:center;">Could not connect to the backend server.</p>';
    }
}

async function submitPost() {
    const inputField = document.getElementById('scratch-input');
    
    if(!inputField.value) {
        alert("Please enter a Scratch Project URL or ID!");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scratchInput: inputField.value })
        });
        
        if (!response.ok) {
            alert("Could not load project from Scratch. Check your link or ID!");
            return;
        }

        inputField.value = '';
        loadPosts();
    } catch (err) {
        console.error(err);
        alert("Server error connecting to Scratch API.");
    }
}

async function likePost(id) {
    try {
        const res = await fetch(`${API_URL}/posts/${id}/like`, { method: 'POST' });
        const data = await res.json();
        document.getElementById(`likes-${id}`).innerText = formatNumber(data.likes);
    } catch (error) {
        console.error('Error liking post:', error);
    }
}

function formatNumber(num) {
    return num >= 1000 ? (num / 1000).toFixed(1) + 'K' : num;
}

loadPosts();
