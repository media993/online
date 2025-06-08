const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// Environment variables
const PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

console.log('🚂 Starting Domino Game Server...');
console.log('📊 Environment:', NODE_ENV);
console.log('🌐 Port:', PORT);
console.log('🔒 CORS Origin:', CORS_ORIGIN);

// Create HTTP server
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      rooms: rooms.size,
      players: playerRooms.size
    }));
    return;
  }
  
  // Serve the embedded game
  res.writeHead(200, { 
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  res.end(getEmbeddedGamePage());
});

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(','),
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Game state
const rooms = new Map();
const playerRooms = new Map();

// Embedded game page
function getEmbeddedGamePage() {
  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>🎲 لعبة الدومينو</title>
      <script src="/socket.io/socket.io.js"></script>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          min-height: 100vh;
          padding: 20px;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
        }
        
        .header {
          margin-bottom: 30px;
        }
        
        .title {
          font-size: 48px;
          margin-bottom: 10px;
          text-shadow: 3px 3px 6px rgba(0,0,0,0.4);
        }
        
        .subtitle {
          font-size: 18px;
          opacity: 0.9;
          margin-bottom: 20px;
        }
        
        .status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.1);
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
        }
        
        .status-dot.connected {
          background: #22c55e;
        }
        
        .game-section {
          background: rgba(255,255,255,0.1);
          border-radius: 15px;
          padding: 30px;
          margin: 20px 0;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
        }
        
        .input-group {
          margin: 20px 0;
        }
        
        .input-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: bold;
        }
        
        .input-row {
          display: flex;
          gap: 10px;
          justify-content: center;
          align-items: center;
        }
        
        input {
          padding: 12px 16px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          background: rgba(255,255,255,0.9);
          color: #333;
          min-width: 200px;
        }
        
        button {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .btn-primary {
          background: #3b82f6;
          color: white;
        }
        
        .btn-primary:hover {
          background: #2563eb;
          transform: translateY(-2px);
        }
        
        .btn-secondary {
          background: #6b7280;
          color: white;
        }
        
        .btn-secondary:hover {
          background: #4b5563;
        }
        
        .btn-random {
          background: #f59e0b;
          color: white;
          padding: 12px;
          min-width: auto;
        }
        
        .btn-random:hover {
          background: #d97706;
        }
        
        .game-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin: 30px 0;
        }
        
        .game-btn {
          padding: 20px;
          background: rgba(255,255,255,0.1);
          border: 2px solid rgba(255,255,255,0.2);
          border-radius: 12px;
          color: white;
          text-decoration: none;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        
        .game-btn:hover {
          background: rgba(255,255,255,0.2);
          border-color: rgba(255,255,255,0.4);
          transform: translateY(-2px);
        }
        
        .game-btn-icon {
          font-size: 32px;
        }
        
        .game-btn-title {
          font-size: 18px;
          font-weight: bold;
        }
        
        .game-btn-desc {
          font-size: 14px;
          opacity: 0.8;
        }
        
        .rules {
          text-align: right;
          background: rgba(255,255,255,0.05);
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        
        .rules h3 {
          color: #fbbf24;
          margin-bottom: 15px;
        }
        
        .rules ul {
          list-style: none;
          padding: 0;
        }
        
        .rules li {
          margin: 8px 0;
          padding-right: 20px;
          position: relative;
        }
        
        .rules li:before {
          content: "🎯";
          position: absolute;
          right: 0;
        }
        
        @media (max-width: 768px) {
          .title {
            font-size: 36px;
          }
          
          .game-buttons {
            grid-template-columns: 1fr;
          }
          
          .input-row {
            flex-direction: column;
          }
          
          input {
            min-width: 100%;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">🎲 لعبة الدومينو</h1>
          <p class="subtitle">العب مع أصدقائك أونلاين - دخول مباشر بدون تسجيل!</p>
          <div class="status">
            <div class="status-dot" id="statusDot"></div>
            <span id="statusText">جاري الاتصال...</span>
          </div>
        </div>
        
        <div class="game-section">
          <div class="input-group">
            <label>اسم اللاعب</label>
            <div class="input-row">
              <input type="text" id="playerName" placeholder="أدخل اسمك" maxlength="20">
              <button class="btn-random" onclick="generateRandomName()" title="توليد اسم عشوائي">🎲</button>
            </div>
            <p style="font-size: 12px; opacity: 0.7; margin-top: 8px;">
              💡 يمكنك تعديل الاسم أو الضغط على 🎲 لتوليد اسم جديد
            </p>
          </div>
          
          <div class="game-buttons">
            <button class="game-btn" onclick="createRoom()">
              <div class="game-btn-icon">🎯</div>
              <div class="game-btn-title">إنشاء غرفة جديدة</div>
              <div class="game-btn-desc">ابدأ لعبة جديدة</div>
            </button>
            
            <button class="game-btn" onclick="showJoinRoom()">
              <div class="game-btn-icon">🔗</div>
              <div class="game-btn-title">انضمام بالكود</div>
              <div class="game-btn-desc">لديك كود غرفة؟</div>
            </button>
          </div>
          
          <div id="joinRoomSection" style="display: none; margin-top: 20px;">
            <div class="input-group">
              <label>كود الغرفة</label>
              <div class="input-row">
                <input type="text" id="roomCode" placeholder="أدخل كود الغرفة" maxlength="6">
                <button class="btn-primary" onclick="joinRoom()">انضمام</button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="rules">
          <h3>📋 قواعد اللعبة</h3>
          <ul>
            <li>يلعب 4 أشخاص في كل غرفة</li>
            <li>كل لاعب يحصل على 7 قطع دومينو</li>
            <li>يبدأ اللاعب الذي لديه أعلى دبل</li>
            <li>الهدف هو التخلص من جميع القطع أولاً</li>
            <li>يجب أن تتطابق الأرقام عند وضع القطع</li>
            <li>استخدم المحادثة للتواصل مع اللاعبين</li>
          </ul>
        </div>
      </div>
      
      <script>
        // Socket.IO connection
        const socket = io();
        let isConnected = false;
        
        // Generate random Arabic name
        function generateRandomName() {
          const adjectives = ['سريع', 'ذكي', 'قوي', 'ماهر', 'بطل', 'نجم', 'أسطورة', 'محترف'];
          const nouns = ['اللاعب', 'البطل', 'النجم', 'الماهر', 'القائد', 'الخبير', 'المحارب', 'الأسطورة'];
          const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
          const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
          const randomNum = Math.floor(Math.random() * 999) + 1;
          document.getElementById('playerName').value = randomAdj + ' ' + randomNoun + ' ' + randomNum;
        }
        
        // Initialize with random name
        generateRandomName();
        
        // Socket events
        socket.on('connect', () => {
          isConnected = true;
          updateStatus('متصل بالخادم', true);
        });
        
        socket.on('disconnect', () => {
          isConnected = false;
          updateStatus('انقطع الاتصال', false);
        });
        
        socket.on('connect_error', () => {
          updateStatus('خطأ في الاتصال', false);
        });
        
        function updateStatus(text, connected) {
          document.getElementById('statusText').textContent = text;
          document.getElementById('statusDot').className = 'status-dot' + (connected ? ' connected' : '');
        }
        
        function createRoom() {
          const playerName = document.getElementById('playerName').value.trim();
          if (!playerName) {
            alert('يرجى إدخال اسم اللاعب');
            return;
          }
          if (!isConnected) {
            alert('يرجى انتظار الاتصال بالخادم');
            return;
          }
          
          socket.emit('createRoom', { playerName });
        }
        
        function showJoinRoom() {
          const section = document.getElementById('joinRoomSection');
          section.style.display = section.style.display === 'none' ? 'block' : 'none';
        }
        
        function joinRoom() {
          const playerName = document.getElementById('playerName').value.trim();
          const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
          
          if (!playerName) {
            alert('يرجى إدخال اسم اللاعب');
            return;
          }
          if (!roomCode) {
            alert('يرجى إدخال كود الغرفة');
            return;
          }
          if (!isConnected) {
            alert('يرجى انتظار الاتصال بالخادم');
            return;
          }
          
          socket.emit('joinRoom', { roomId: roomCode, playerName });
        }
        
        // Game events
        socket.on('roomJoined', (data) => {
          if (data.success) {
            alert('تم الانضمام للغرفة: ' + data.roomId + '\\nانتظر باقي اللاعبين...');
          }
        });
        
        socket.on('error', (data) => {
          alert('خطأ: ' + data.message);
        });
        
        socket.on('playerJoined', (data) => {
          console.log('لاعب جديد انضم:', data.newPlayer.name);
        });
        
        socket.on('gameStarted', (data) => {
          alert('بدأت اللعبة! استمتع!');
        });
      </script>
    </body>
    </html>
  `;
}

// Socket.IO events (same as basic-server.js)
io.on('connection', (socket) => {
  console.log('🎮 Player connected:', socket.id);

  socket.on('createRoom', (data) => {
    const { playerName } = data;
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const room = {
      id: roomId,
      players: [{
        id: socket.id,
        name: playerName,
        isReady: false,
        isHost: true,
        handCount: 0
      }],
      gameStarted: false,
      gameEnded: false,
      board: [],
      currentPlayer: 0
    };
    
    rooms.set(roomId, room);
    playerRooms.set(socket.id, roomId);
    socket.join(roomId);
    
    socket.emit('roomJoined', {
      success: true,
      roomId,
      game: room,
      playerHand: []
    });
    
    console.log('🏠 Room created:', roomId, 'by', playerName);
  });

  socket.on('joinRoom', (data) => {
    const { roomId, playerName } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    if (room.players.length >= 4) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }
    
    const newPlayer = {
      id: socket.id,
      name: playerName,
      isReady: false,
      isHost: false,
      handCount: 0
    };
    
    room.players.push(newPlayer);
    playerRooms.set(socket.id, roomId);
    socket.join(roomId);
    
    socket.emit('roomJoined', {
      success: true,
      roomId,
      game: room,
      playerHand: []
    });
    
    socket.to(roomId).emit('playerJoined', {
      game: room,
      newPlayer
    });
    
    console.log('👥', playerName, 'joined room', roomId);
  });

  socket.on('disconnect', () => {
    console.log('👋 Player disconnected:', socket.id);
    
    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        
        if (room.players.length === 0) {
          rooms.delete(roomId);
          console.log('🗑️ Room', roomId, 'deleted (empty)');
        } else {
          socket.to(roomId).emit('playerLeft', {
            playerId: socket.id,
            game: room
          });
        }
      }
      playerRooms.delete(socket.id);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('🎮 Domino Game Server running on port', PORT);
  console.log('🎲 Game Ready! Open: http://localhost:' + PORT);
});
