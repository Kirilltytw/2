// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
const DOM = {
    connectionStatus: null,
    statusIcon: null,
    statusText: null,
    videoFrame: null,
    videoUrl: null,
    loadBtn: null,
    playBtn: null,
    pauseBtn: null,
    chatMessages: null,
    chatInput: null,
    sendBtn: null,
    roomUrl: null,
    copyBtn: null
};

const state = {
    peer: null,
    conn: null,
    roomId: window.location.hash.substring(1) || generateRoomId(),
    isHost: !window.location.hash,
    currentVideo: null
};

// ========== ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    initDOMReferences();
    setupEventListeners();
    initPeerConnection();
});

function initDOMReferences() {
    DOM.connectionStatus = document.getElementById('connection-status');
    DOM.statusIcon = document.getElementById('status-icon');
    DOM.statusText = document.getElementById('status-text');
    DOM.videoFrame = document.getElementById('video-frame');
    DOM.videoUrl = document.getElementById('video-url');
    DOM.loadBtn = document.getElementById('load-btn');
    DOM.playBtn = document.getElementById('play-btn');
    DOM.pauseBtn = document.getElementById('pause-btn');
    DOM.chatMessages = document.getElementById('chat-messages');
    DOM.chatInput = document.getElementById('chat-input');
    DOM.sendBtn = document.getElementById('send-btn');
    DOM.roomUrl = document.getElementById('room-url');
    DOM.copyBtn = document.getElementById('copy-btn');
}

// ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========
function setupEventListeners() {
    DOM.copyBtn.addEventListener('click', copyRoomLink);
    DOM.loadBtn.addEventListener('click', handleLoadVideo);
    DOM.playBtn.addEventListener('click', handlePlay);
    DOM.pauseBtn.addEventListener('click', handlePause);
    DOM.sendBtn.addEventListener('click', sendMessage);
    DOM.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// ========== PEERJS СОЕДИНЕНИЕ ==========
function initPeerConnection() {
    updateStatus('Подключение к P2P-сети...', 'disconnected');
    
    state.peer = new Peer({
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        config: {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        }
    });

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
function updateStatus(message, status) {
    if (!DOM.connectionStatus || !DOM.statusIcon || !DOM.statusText) return;
    
    DOM.connectionStatus.className = `status-${status}`;
    DOM.statusText.textContent = message;
    DOM.statusIcon.textContent = status === 'connected' ? '🟢' : '🔴';
}

function updateRoomLink() {
    if (DOM.roomUrl) {
        DOM.roomUrl.value = window.location.href;
    }
}

function enableControls() {
    [DOM.playBtn, DOM.pauseBtn, DOM.sendBtn, DOM.chatInput].forEach(el => {
        if (el) el.disabled = false;
    });
}

// ========== ФУНКЦИИ ВИДЕО ==========
function handleLoadVideo() {
    const url = DOM.videoUrl.value.trim();
    if (url && state.conn) {
        loadVideo(url);
        state.conn.send({ type: 'video', url });
    }
}

function loadVideo(url) {
    let embedUrl = '';
    
    if (url.includes('vk.com')) {
        const videoId = url.match(/video(-?\d+_\d+)/)[1];
        embedUrl = `https://vk.com/video_ext.php?oid=${videoId.split('_')[0]}&id=${videoId.split('_')[1]}`;
    } else if (url.includes('rutube.ru')) {
        const videoId = url.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)/)[1];
        embedUrl = `https://rutube.ru/play/embed/${videoId}`;
    }
    
    if (embedUrl && DOM.videoFrame) {
        DOM.videoFrame.src = embedUrl;
        state.currentVideo = url;
        updateStatus('Видео загружено', 'connected');
    }
}

function handlePlay() {
    if (state.conn && DOM.videoFrame) {
        DOM.videoFrame.contentWindow.postMessage('play', '*');
        state.conn.send({ type: 'play' });
    }
}

function handlePause() {
    if (state.conn && DOM.videoFrame) {
        DOM.videoFrame.contentWindow.postMessage('pause', '*');
        state.conn.send({ type: 'pause' });
    }
}

// ========== ФУНКЦИИ ЧАТА ==========
function sendMessage() {
    const text = DOM.chatInput.value.trim();
    if (text && state.conn) {
        state.conn.send({ 
            type: 'chat', 
            sender: state.isHost ? 'Хост' : 'Участник', 
            text 
        });
        addMessage('Вы', text);
        DOM.chatInput.value = '';
    }
}

function addMessage(sender, text) {
    if (!DOM.chatMessages) return;
    
    const message = document.createElement('div');
    message.innerHTML = `<strong>${sender}:</strong> ${text}`;
    DOM.chatMessages.appendChild(message);
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8);
}

function copyRoomLink() {
    if (DOM.roomUrl) {
        DOM.roomUrl.select();
        document.execCommand('copy');
        alert('Ссылка скопирована!');
    }
}

function handleData(data) {
    switch(data.type) {
        case 'video': loadVideo(data.url); break;
        case 'play': handlePlay(); break;
        case 'pause': handlePause(); break;
        case 'chat': addMessage(data.sender, data.text); break;
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
