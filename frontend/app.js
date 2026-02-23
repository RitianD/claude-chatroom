// API Configuration
// 使用相对路径，自动适配当前域名
const API_BASE_URL = ''; // 使用相对路径
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

// State
let authToken = localStorage.getItem('auth_token');
let userId = localStorage.getItem('user_id');
let username = localStorage.getItem('username');
let ws = null;
let musicQueue = [];
let currentQueueIndex = 0;

// DOM Elements
const authSection = document.getElementById('auth-section');
const chatSection = document.getElementById('chat-section');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authTitle = document.getElementById('auth-title');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const currentUserSpan = document.getElementById('current-user');
const logoutBtn = document.getElementById('logout-btn');
const messagesContainer = document.getElementById('messages-container');
const onlineUsersList = document.getElementById('online-users-list');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const queueList = document.getElementById('queue-list');
const musicUrlInput = document.getElementById('music-url-input');
const musicTitleInput = document.getElementById('music-title-input');
const addMusicBtn = document.getElementById('add-music-btn');
const musicFileInput = document.getElementById('music-file-input');
const uploadStatus = document.getElementById('upload-status');
const audioPlayer = document.getElementById('audio-player');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const nowPlayingInfo = document.getElementById('now-playing-info');

// ============ Utility Functions ============

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ Auth Functions ============

function showAuthSection() {
    authSection.classList.remove('hidden');
    chatSection.classList.add('hidden');
}

function showChatSection() {
    authSection.classList.add('hidden');
    chatSection.classList.remove('hidden');
    currentUserSpan.textContent = `当前用户: ${username}`;
}

async function register(username, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('注册成功，请登录', 'success');
            showLoginForm();
        } else {
            showToast(data.detail || '注册失败', 'error');
        }
    } catch (error) {
        showToast('网络错误，请重试', 'error');
        console.error('Register error:', error);
    }
}

async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.access_token;
            userId = data.user_id;
            username = data.username;

            localStorage.setItem('auth_token', authToken);
            localStorage.setItem('user_id', userId);
            localStorage.setItem('username', username);

            showToast('登录成功', 'success');
            showChatSection();
            connectWebSocket();
            loadMessages();
        } else {
            showToast(data.detail || '登录失败', 'error');
        }
    } catch (error) {
        showToast('网络错误，请重试', 'error');
        console.error('Login error:', error);
    }
}

function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');

    authToken = null;
    userId = null;
    username = null;

    if (ws) {
        ws.close();
    }

    showAuthSection();
    showToast('已退出登录', 'info');
}

// ============ Form Handlers ============

function showRegisterForm() {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    authTitle.textContent = '注册账号';
}

function showLoginForm() {
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    authTitle.textContent = '欢迎来到聊天室';
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    login(username, password);
});

registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (password !== confirmPassword) {
        showToast('两次输入的密码不一致', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('密码至少需要6个字符', 'error');
        return;
    }

    register(username, password);
});

showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
});

logoutBtn.addEventListener('click', logout);

// ============ WebSocket Functions ============

function connectWebSocket() {
    if (!authToken) return;

    ws = new WebSocket(`${WS_URL}?token=${authToken}`);

    ws.onopen = () => {
        console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Auto-reconnect after 3 seconds
        setTimeout(() => {
            if (authToken) {
                connectWebSocket();
            }
        }, 3000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'new_message':
            appendMessage(data);
            scrollToBottom();
            break;

        case 'user_joined':
            showToast(`${data.username} 加入了聊天室`, 'info');
            updateOnlineUsers(data.online_users || []);
            break;

        case 'user_left':
            showToast(`${data.username} 离开了聊天室`, 'info');
            updateOnlineUsers(data.online_users || []);
            break;

        case 'queue_update':
            musicQueue = data.queue || [];
            updateQueueList();
            break;
    }
}

// ============ Message Functions ============

async function loadMessages() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/messages?limit=50`);
        const messages = await response.json();

        messagesContainer.innerHTML = '';
        messages.forEach(msg => appendMessage(msg));
        scrollToBottom();
    } catch (error) {
        console.error('Load messages error:', error);
    }
}

function appendMessage(msg) {
    const messageDiv = document.createElement('div');
    const isOwn = parseInt(msg.user_id) === parseInt(userId);

    messageDiv.className = `message ${isOwn ? 'own' : ''}`;

    if (msg.message_type === 'system') {
        messageDiv.innerHTML = `
            <div class="message-content system">${escapeHtml(msg.content)}</div>
        `;
    } else if (msg.message_type === 'music') {
        messageDiv.classList.add('music-message');
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-username">${escapeHtml(msg.username)}</span>
                <span class="message-time">${formatTime(msg.created_at)}</span>
            </div>
            <div class="message-content">
                ${escapeHtml(msg.content)}
                <br>
                <a href="${escapeHtml(msg.music_url)}" class="music-link" target="_blank">🎵 播放音乐</a>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-username">${escapeHtml(msg.username)}</span>
                <span class="message-time">${formatTime(msg.created_at)}</span>
            </div>
            <div class="message-content">${escapeHtml(msg.content)}</div>
        `;
    }

    messagesContainer.appendChild(messageDiv);
}

function sendMessage() {
    const content = messageInput.value.trim();

    if (!content) return;

    ws.send(JSON.stringify({
        type: 'chat_message',
        content: content
    }));

    messageInput.value = '';
    messageInput.focus();
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// ============ Online Users Functions ============

function updateOnlineUsers(users) {
    onlineUsersList.innerHTML = '';

    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user.username;
        onlineUsersList.appendChild(li);
    });
}

// ============ Music Functions ============

function addMusicToQueue(url, title) {
    ws.send(JSON.stringify({
        type: 'add_to_queue',
        music_url: url,
        title: title || '未知歌曲'
    }));

    showToast('已添加到播放队列', 'success');
}

function removeFromQueue(queueId) {
    ws.send(JSON.stringify({
        type: 'remove_from_queue',
        queue_id: queueId
    }));
}

function updateQueueList() {
    queueList.innerHTML = '';

    if (musicQueue.length === 0) {
        queueList.innerHTML = '<li class="queue-empty">队列为空</li>';
        return;
    }

    musicQueue.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'queue-item';

        const isPlaying = index === currentQueueIndex;

        li.innerHTML = `
            <span class="queue-item-title">
                ${isPlaying ? '▶ ' : ''}${escapeHtml(item.title || '未知歌曲')}
            </span>
            <span class="queue-item-user">by ${escapeHtml(item.username)}</span>
            <button class="queue-item-remove" data-id="${item.id}">×</button>
        `;

        li.addEventListener('click', (e) => {
            if (e.target.classList.contains('queue-item-remove')) {
                const queueId = e.target.getAttribute('data-id');
                removeFromQueue(queueId);
            } else {
                currentQueueIndex = index;
                playCurrentSong();
            }
        });

        queueList.appendChild(li);
    });
}

function playCurrentSong() {
    if (musicQueue.length === 0 || currentQueueIndex >= musicQueue.length) {
        nowPlayingInfo.innerHTML = '<p>暂无播放中的歌曲</p>';
        audioPlayer.src = '';
        return;
    }

    const song = musicQueue[currentQueueIndex];
    nowPlayingInfo.innerHTML = `
        <p><strong>歌曲:</strong> ${escapeHtml(song.title || '未知歌曲')}</p>
        <p><strong>点歌人:</strong> ${escapeHtml(song.username)}</p>
    `;

    audioPlayer.src = song.music_url.startsWith('http')
        ? song.music_url
        : `${API_BASE_URL}${song.music_url}`;

    audioPlayer.play().catch(err => {
        console.error('Play error:', err);
        showToast('播放失败，可能需要用户交互', 'error');
    });

    updateQueueList();
}

function playNext() {
    if (musicQueue.length === 0) return;

    currentQueueIndex = (currentQueueIndex + 1) % musicQueue.length;
    playCurrentSong();
}

function playPrevious() {
    if (musicQueue.length === 0) return;

    currentQueueIndex = currentQueueIndex === 0
        ? musicQueue.length - 1
        : currentQueueIndex - 1;
    playCurrentSong();
}

// Add music from URL
addMusicBtn.addEventListener('click', () => {
    const url = musicUrlInput.value.trim();
    const title = musicTitleInput.value.trim();

    if (!url) {
        showToast('请输入音乐URL', 'error');
        return;
    }

    addMusicToQueue(url, title);
    musicUrlInput.value = '';
    musicTitleInput.value = '';
});

// Upload music file
musicFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    uploadStatus.textContent = '上传中...';

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE_URL}/api/upload-music`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            uploadStatus.textContent = '上传成功！';
            addMusicToQueue(data.music_url, file.name);
        } else {
            uploadStatus.textContent = '上传失败';
            showToast(data.detail || '上传失败', 'error');
        }
    } catch (error) {
        uploadStatus.textContent = '上传失败';
        showToast('网络错误', 'error');
        console.error('Upload error:', error);
    }

    musicFileInput.value = '';
});

// Player controls
prevBtn.addEventListener('click', playPrevious);
nextBtn.addEventListener('click', playNext);

// Auto-play next song when current song ends
audioPlayer.addEventListener('ended', playNext);

// Load initial queue
async function loadQueue() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/queue`);
        const data = await response.json();
        musicQueue = data.queue || [];
        updateQueueList();
    } catch (error) {
        console.error('Load queue error:', error);
    }
}

// ============ Initialization ============

function init() {
    if (authToken) {
        showChatSection();
        connectWebSocket();
        loadMessages();
        loadQueue();
    } else {
        showAuthSection();
    }
}

// Start the app
init();
