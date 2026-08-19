const API_URL = 'http://localhost:3000/api'; 

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
                <div class="card-left">
                    <h2>${post.title}</h2>
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
    const titleInput = document.getElementById('post-title');
    const descInput = document.getElementById('post-desc');
    
    if(!titleInput.value) {
        alert("A project title is required!");
        return;
    }

    await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: titleInput.value,
            description: descInput.value,
            author: '@ScratchCoder'
        })
    });
    
    titleInput.value = '';
    descInput.value = '';
    loadPosts();
}

async function likePost(id) {
    try {
        const response = type => fetch(`${API_URL}/posts/${id}/like`, { method: 'POST' });
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
