// ========== КОНФИГУРАЦИЯ ==========
const CONFIG = {
    peer: {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        debug: 3,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        }
    }
};

// ========== СОСТОЯНИЕ ПРИЛОЖЕНИЯ ==========
const state = {
    peer: null,
    conn: null,
    roomId: window.location.hash.substring(1) || generateRoomId(),
    isHost: !window.location.hash,
    currentVideo: null
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initPeerConnection();
});

// ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========
function setupEventListeners() {
    // Копирование ссылки комнаты
    document.getElementById('copy-btn').addEventListener('click', () => {
        const input = document.getElementById('room-url');
        input.select();
        document.execCommand('copy');
        alert('Ссылка скопирована!');
    });
    
    // Загрузка видео
    document.getElementById('load-btn').addEventListener('click', () => {
        const url = document.getElementById('video-url').value.trim();
        if (url && state.conn) {
            loadVideo(url);
            state.conn.send({ type: 'video', url: url });
        }
    });
    
    // Управление видео
    document.getElementById('play-btn').addEventListener('click', () => {
        if (state.conn) {
            playVideo();
            state.conn.send({ type: 'play' });
        }
    });
    
    document.getElementById('pause-btn').addEventListener('click', () => {
        if (state.conn) {
            pauseVideo();
            state.conn.send({ type: 'pause' });
        }
    });
    
    // Чат
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// ========== РАБОТА С PEERJS ==========
function initPeerConnection() {
    updateStatus('Подключение к P2P-сети...', 'disconnected');
    
    state.peer = new Peer(CONFIG.peer);

    state.peer.on('open', (id) => {
        if (state.isHost) {
            window.location.hash = id;
            state.roomId = id;
            updateRoomLink();
            updateStatus(`Комната создана: ${id}`, 'connected');
            
            state.peer.on('connection', (conn) => {
                setupConnection(conn);
            });
        } else {
            setupConnection(state.peer.connect(state.roomId));
        }
    });

    state.peer.on('error', handlePeerError);
}

function setupConnection(conn) {
    state.conn = conn;
    
    conn.on('open', () => {
        updateStatus('Подключено к комнате!', 'connected');
        enableControls();
    });

    conn.on('data', handleData);
    conn.on('close', () => updateStatus('Соединение разорвано', 'disconnected'));
    conn.on('error', handleConnectionError);
}

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========
function loadVideo(url) {
    if (!url) return;
    
    let embedUrl = '';
    if (url.includes('vk.com')) {
        const videoId = url.match(/video(-?\d+_\d+)/)[1];
        embedUrl = `https://vk.com/video_ext.php?oid=${videoId.split('_')[0]}&id=${videoId.split('_')[1]}`;
    } else if (url.includes('rutube.ru')) {
        const videoId = url.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)/)[1];
        embedUrl = `https://rutube.ru/play/embed/${videoId}`;
    }
    
    if (embedUrl) {
        document.getElementById('video-frame').src = embedUrl;
        state.currentVideo = url;
        updateStatus('Видео загружено', 'connected');
    }
}

function playVideo() {
    const iframe = document.getElementById('video-frame');
    iframe.contentWindow.postMessage('play', '*');
}

function pauseVideo() {
    const iframe = document.getElementById('video-frame');
    iframe.contentWindow.postMessage('pause', '*');
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function updateStatus(message, status) {
    const element = document.getElementById('connection-status');
    element.textContent = message;
    element.className = `status-${status}`;
    document.getElementById('status-icon').textContent = status === 'connected' ? '🟢' : '🔴';
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8);
}

function updateRoomLink() {
    document.getElementById('room-url').value = window.location.href;
}

function enableControls() {
    document.querySelectorAll('button:disabled').forEach(btn => {
        btn.disabled = false;
    });
    document.getElementById('chat-input').disabled = false;
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text && state.conn) {
        state.conn.send({ 
            type: 'chat', 
            sender: state.isHost ? 'Хост' : 'Участник', 
            text: text 
        });
        addMessage('Вы', text);
        input.value = '';
    }
}

function addMessage(sender, text) {
    const chat = document.getElementById('chat-messages');
    const message = document.createElement('div');
    message.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chat.appendChild(message);
    chat.scrollTop = chat.scrollHeight;
}

function handleData(data) {
    switch(data.type) {
        case 'video':
            loadVideo(data.url);
            break;
        case 'play':
            playVideo();
            break;
        case 'pause':
            pauseVideo();
            break;
        case 'chat':
            addMessage(data.sender, data.text);
            break;
    }
}

function handlePeerError(err) {
    console.error('PeerJS Error:', err);
    updateStatus(`Ошибка: ${err.type}`, 'disconnected');
    setTimeout(initPeerConnection, 3000);
}

function handleConnectionError(err) {
    console.error('Connection Error:', err);
    updateStatus('Ошибка соединения', 'disconnected');
}
