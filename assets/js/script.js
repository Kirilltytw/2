// Конфигурация
const CONFIG = {
    peer: {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        }
    },
    syncInterval: 3000 // Интервал синхронизации в мс
};

// Состояние приложения
const state = {
    peer: null,
    conn: null,
    roomId: window.location.hash.substring(1) || generateRoomId(),
    isHost: !window.location.hash,
    currentVideo: null,
    videoState: {
        isPlaying: false,
        currentTime: 0,
        lastUpdate: 0
    },
    syncTimer: null
};

// Элементы DOM
const DOM = {
    connectionStatus: null,
    statusIcon: null,
    statusText: null,
    videoFrame: null,
    videoUrl: null,
    loadBtn: null,
    playBtn: null,
    pauseBtn: null,
    syncBtn: null,
    videoStatus: null,
    chatMessages: null,
    chatInput: null,
    sendBtn: null,
    roomUrl: null,
    copyBtn: null
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    initDOM();
    setupEventListeners();
    initPeerConnection();
});

function initDOM() {
    DOM.connectionStatus = document.getElementById('connection-status');
    DOM.statusIcon = document.getElementById('status-icon');
    DOM.statusText = document.getElementById('status-text');
    DOM.videoFrame = document.getElementById('video-frame');
    DOM.videoUrl = document.getElementById('video-url');
    DOM.loadBtn = document.getElementById('load-btn');
    DOM.playBtn = document.getElementById('play-btn');
    DOM.pauseBtn = document.getElementById('pause-btn');
    DOM.syncBtn = document.getElementById('sync-btn');
    DOM.videoStatus = document.getElementById('video-status');
    DOM.chatMessages = document.getElementById('chat-messages');
    DOM.chatInput = document.getElementById('chat-input');
    DOM.sendBtn = document.getElementById('send-btn');
    DOM.roomUrl = document.getElementById('room-url');
    DOM.copyBtn = document.getElementById('copy-btn');
    
    if (state.isHost) {
        DOM.roomUrl.value = window.location.href;
    }
}

function setupEventListeners() {
    DOM.copyBtn.addEventListener('click', copyRoomLink);
    DOM.loadBtn.addEventListener('click', handleLoadVideo);
    DOM.playBtn.addEventListener('click', handlePlay);
    DOM.pauseBtn.addEventListener('click', handlePause);
    DOM.syncBtn.addEventListener('click', handleSync);
    DOM.sendBtn.addEventListener('click', sendMessage);
    DOM.chatInput.addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());
}

// Работа с PeerJS
function initPeerConnection() {
    updateStatus('Подключение к серверу...', 'disconnected');
    
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
        updateStatus('Успешное подключение!', 'connected');
        enableControls();
        startSyncTimer();
        
        if (!state.isHost) {
            conn.send({ type: 'request_state' });
        }
    });

    conn.on('data', handleData);
    conn.on('close', handleDisconnect);
    conn.on('error', handleConnectionError);
}

// Обработка сообщений
function handleData(data) {
    switch(data.type) {
        case 'video':
            loadVideo(data.url);
            break;
        case 'play':
            setVideoState(true, data.currentTime, data.timestamp);
            break;
        case 'pause':
            setVideoState(false, data.currentTime, data.timestamp);
            break;
        case 'sync':
            syncVideo(data.currentTime, data.isPlaying);
            break;
        case 'chat':
            addMessage(data.sender, data.text, false);
            break;
        case 'request_state':
            if (state.isHost) {
                sendVideoState();
            }
            break;
    }
}

// Управление видео
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
        DOM.videoFrame.src = embedUrl;
        state.currentVideo = url;
        DOM.videoStatus.textContent = `Видео загружено: ${url.substring(0, 50)}...`;
        
        if (state.conn) {
            state.conn.send({ 
                type: 'video', 
                url: url 
            });
        }
    }
}

function setVideoState(isPlaying, currentTime, timestamp) {
    state.videoState = {
        isPlaying,
        currentTime,
        lastUpdate: timestamp || Date.now()
    };
    
    if (isPlaying) {
        DOM.playBtn.classList.add('active');
        DOM.pauseBtn.classList.remove('active');
        DOM.videoFrame.contentWindow.postMessage(JSON.stringify({
            method: 'play',
            value: currentTime
        }), '*');
    } else {
        DOM.pauseBtn.classList.add('active');
        DOM.playBtn.classList.remove('active');
        DOM.videoFrame.contentWindow.postMessage(JSON.stringify({
            method: 'pause',
            value: currentTime
        }), '*');
    }
}

function syncVideo(currentTime, isPlaying) {
    DOM.videoFrame.contentWindow.postMessage(JSON.stringify({
        method: 'seekTo',
        value: currentTime
    }), '*');
    
    setVideoState(isPlaying, currentTime);
}

// Обработчики кнопок
function handleLoadVideo() {
    const url = DOM.videoUrl.value.trim();
    if (url) {
        loadVideo(url);
    }
}

function handlePlay() {
    if (!state.conn || !state.currentVideo) return;
    
    const currentTime = calculateCurrentTime();
    setVideoState(true, currentTime);
    
    state.conn.send({
        type: 'play',
        currentTime: currentTime,
        timestamp: Date.now()
    });
}

function handlePause() {
    if (!state.conn || !state.currentVideo) return;
    
    const currentTime = calculateCurrentTime();
    setVideoState(false, currentTime);
    
    state.conn.send({
        type: 'pause',
        currentTime: currentTime,
        timestamp: Date.now()
    });
}

function handleSync() {
    if (!state.conn || !state.currentVideo) return;
    
    const currentTime = calculateCurrentTime();
    syncVideo(currentTime, state.videoState.isPlaying);
    
    state.conn.send({
        type: 'sync',
        currentTime: currentTime,
        isPlaying: state.videoState.isPlaying,
        timestamp: Date.now()
    });
}

// Синхронизация
function startSyncTimer() {
    stopSyncTimer();
    state.syncTimer = setInterval(() => {
        if (state.isHost && state.conn && state.videoState.isPlaying) {
            const currentTime = calculateCurrentTime();
            state.conn.send({
                type: 'sync',
                currentTime: currentTime,
                isPlaying: true,
                timestamp: Date.now()
            });
        }
    }, CONFIG.syncInterval);
}

function stopSyncTimer() {
    if (state.syncTimer) {
        clearInterval(state.syncTimer);
        state.syncTimer = null;
    }
}

function calculateCurrentTime() {
    if (state.videoState.isPlaying) {
        return state.videoState.currentTime + (Date.now() - state.videoState.lastUpdate) / 1000;
    }
    return state.videoState.currentTime;
}

function sendVideoState() {
    if (!state.conn || !state.isHost) return;
    
    state.conn.send({
        type: 'sync',
        currentTime: calculateCurrentTime(),
        isPlaying: state.videoState.isPlaying,
        timestamp: Date.now()
    });
}

// Чат
function sendMessage() {
    const text = DOM.chatInput.value.trim();
    if (text && state.conn) {
        addMessage('Вы', text, true);
        state.conn.send({
            type: 'chat',
            sender: state.isHost ? 'Хост' : 'Участник',
            text: text
        });
        DOM.chatInput.value = '';
    }
}

function addMessage(sender, text, isMyMessage) {
    const message = document.createElement('div');
    message.className = `chat-message ${isMyMessage ? 'my-message' : ''}`;
    message.innerHTML = `<strong>${sender}:</strong> ${text}`;
    DOM.chatMessages.appendChild(message);
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

// Вспомогательные функции
function updateStatus(message, status) {
    if (!DOM.connectionStatus || !DOM.statusText) return;
    
    DOM.connectionStatus.className = `status-${status}`;
    DOM.statusText.textContent = message;
    DOM.statusIcon.textContent = status === 'connected' ? '🟢' : '🔴';
}

function enableControls() {
    [DOM.playBtn, DOM.pauseBtn, DOM.syncBtn, DOM.chatInput, DOM.sendBtn].forEach(el => {
        if (el) el.disabled = false;
    });
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8);
}

function updateRoomLink() {
    if (DOM.roomUrl) {
        DOM.roomUrl.value = window.location.href;
    }
}

function copyRoomLink() {
    if (DOM.roomUrl) {
        DOM.roomUrl.select();
        document.execCommand('copy');
        alert('Ссылка скопирована в буфер обмена!');
    }
}

function handleDisconnect() {
    updateStatus('Соединение разорвано', 'disconnected');
    stopSyncTimer();
    setTimeout(() => {
        if (!state.conn || state.conn.open) return;
        initPeerConnection();
    }, 3000);
}

function handlePeerError(err) {
    console.error('PeerJS error:', err);
    updateStatus(`Ошибка: ${err.type}`, 'disconnected');
    handleDisconnect();
}

function handleConnectionError(err) {
    console.error('Connection error:', err);
    updateStatus('Ошибка соединения', 'disconnected');
    handleDisconnect();
}
