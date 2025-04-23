// Конфигурация PeerJS
const peer = new Peer({
  host: 'peerjs-server.herokuapp.com',
  secure: true,
  port: 443
});

// Состояние приложения
const state = {
  conn: null,
  roomId: window.location.hash.substring(1) || generateRoomId(),
  isHost: !window.location.hash
};

// Генерация ID комнаты
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  initConnection();
  setupEventListeners();
});

function initConnection() {
  updateStatus('Подключение...', 'disconnected');
  
  peer.on('open', (id) => {
    if (state.isHost) {
      window.location.hash = id;
      state.roomId = id;
      updateRoomLink();
      
      peer.on('connection', (conn) => {
        setupConnection(conn);
      });
    } else {
      setupConnection(peer.connect(state.roomId));
    }
  });

  peer.on('error', (err) => {
    console.error('Ошибка PeerJS:', err);
    updateStatus(`Ошибка: ${err.type}`, 'disconnected');
  });
}

function setupConnection(connection) {
  state.conn = connection;
  
  connection.on('open', () => {
    updateStatus('Подключено!', 'connected');
    enableControls();
  });

  connection.on('data', handleData);
  connection.on('close', () => updateStatus('Соединение закрыто', 'disconnected'));
}

function handleData(data) {
  switch(data.type) {
    case 'video':
      loadVideo(data.url);
      break;
    case 'chat':
      addMessage(data.sender, data.text);
      break;
    // ... другие типы сообщений
  }
}

// Остальные функции (updateStatus, loadVideo и т.д.)
// ... [остальной код из предыдущего ответа]
