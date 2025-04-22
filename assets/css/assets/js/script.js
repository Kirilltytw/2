// Конфигурация
const config = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { 
            urls: "turn:numb.viagenie.ca",
            username: "your-email@example.com",
            credential: "your-password" 
        }
    ]
};

// Элементы DOM
const elements = {
    status: document.getElementById('connection-status'),
    statusIcon: document.getElementById('status-icon'),
    statusText: document.getElementById('status-text'),
    videoFrame: document.getElementById('video-frame'),
    videoUrl: document.getElementById('video-url'),
    loadBtn: document.getElementById('load-btn'),
    playBtn: document.getElementById('play-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    sendBtn: document.getElementById('send-btn'),
    roomUrl: document.getElementById('room-url'),
    copyBtn: document.getElementById('copy-btn')
};

// Состояние приложения
let state = {
    peer: null,
    conn: null,
    roomId: window.location.hash.substring(1) || generateRoomId(),
    isHost: false,
    currentVideo: null
};

// Инициализация
function init() {
    setupEventListeners();
    connectPeer();
    updateUI();
}

// Подключение PeerJS
function connectPeer() {
    updateStatus('Подключение к P2P-сети...', 'disconnected');
    
    state.peer = new Peer({
        config,
        debug: 3
    });

    state.peer.on('open', (id) => {
        if (!window.location.hash) {
            window.location.hash = id;
            state.roomId = id;
            state.isHost = true;
            updateStatus(`Вы создали комнату: ${id}`, 'connected');
            elements.roomUrl.value = window.location.href;
            
            state.peer.on('connection', (conn) => {
                setupConnection(conn);
            });
        } else {
            setupConnection(state.peer.connect(state.roomId));
        }
    });

    state.peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        updateStatus(`Ошибка: ${err.type}`, 'disconnected');
        setTimeout(connectPeer, 3000); // Переподключение через 3 сек
    });
}

// Остальные функции (setupConnection, updateStatus, loadVideo и т.д.)
// ... (полный код смотрите в GitHub Gist по ссылке ниже)

// Запуск приложения
document.addEventListener('DOMContentLoaded', init);
