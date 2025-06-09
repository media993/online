const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 10000;

console.log('🎮 Starting Complete Domino Game...');

// Create HTTP server
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
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
      rooms: rooms.size,
      players: playerRooms.size
    }));
    return;
  }
  
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(getGameHTML());
});

// Socket.IO
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Game state
const rooms = new Map();
const playerRooms = new Map();

// Game modes
const GAME_MODES = {
  SINGLE: { name: 'فردي', players: 1, description: 'ضد الكمبيوتر' },
  PAIR: { name: 'زوجي', players: 2, description: 'لاعبان فقط' },
  TEAM: { name: 'فرق', players: 4, description: '4 لاعبين' }
};

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateRandomName() {
  const adjectives = ['سريع', 'ذكي', 'قوي', 'ماهر', 'بطل', 'نجم', 'أسطورة', 'محترف'];
  const nouns = ['اللاعب', 'البطل', 'النجم', 'الماهر', 'القائد', 'الخبير', 'المحارب', 'الأسطورة'];
  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNum = Math.floor(Math.random() * 999) + 1;
  return randomAdj + ' ' + randomNoun + ' ' + randomNum;
}

function createAIPlayers() {
  return [
    { id: 'ai_1', name: 'الكمبيوتر الذكي', isAI: true, isReady: true, handCount: 7, hand: [] },
    { id: 'ai_2', name: 'الروبوت الماهر', isAI: true, isReady: true, handCount: 7, hand: [] },
    { id: 'ai_3', name: 'الذكاء الاصطناعي', isAI: true, isReady: true, handCount: 7, hand: [] }
  ];
}

// Domino game logic
function createDominoSet() {
  const dominoes = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      dominoes.push({ left: i, right: j, id: `${i}-${j}` });
    }
  }
  return dominoes;
}

function shuffleDominoes(dominoes) {
  const shuffled = [...dominoes];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function distributeDominoes(players) {
  const dominoes = shuffleDominoes(createDominoSet());
  const dominoesPerPlayer = 7;
  
  players.forEach((player, index) => {
    player.hand = dominoes.slice(index * dominoesPerPlayer, (index + 1) * dominoesPerPlayer);
    player.handCount = player.hand.length;
  });
  
  return dominoes.slice(players.length * dominoesPerPlayer);
}

function findHighestDouble(players) {
  let highestDouble = -1;
  let playerWithHighest = -1;
  
  players.forEach((player, index) => {
    player.hand.forEach(domino => {
      if (domino.left === domino.right && domino.left > highestDouble) {
        highestDouble = domino.left;
        playerWithHighest = index;
      }
    });
  });
  
  return playerWithHighest;
}

function canPlayDomino(domino, board) {
  if (board.length === 0) return true;
  
  const leftEnd = board[0].left;
  const rightEnd = board[board.length - 1].right;
  
  return domino.left === leftEnd || domino.right === leftEnd || 
         domino.left === rightEnd || domino.right === rightEnd;
}

function playDomino(domino, board, side) {
  const newBoard = [...board];
  
  if (board.length === 0) {
    newBoard.push(domino);
  } else if (side === 'left') {
    const leftEnd = board[0].left;
    if (domino.right === leftEnd) {
      newBoard.unshift(domino);
    } else if (domino.left === leftEnd) {
      newBoard.unshift({ left: domino.right, right: domino.left, id: domino.id });
    }
  } else if (side === 'right') {
    const rightEnd = board[board.length - 1].right;
    if (domino.left === rightEnd) {
      newBoard.push(domino);
    } else if (domino.right === rightEnd) {
      newBoard.push({ left: domino.right, right: domino.left, id: domino.id });
    }
  }
  
  return newBoard;
}

function getPlayablePositions(domino, board) {
  const positions = [];
  
  if (board.length === 0) {
    positions.push('center');
    return positions;
  }
  
  const leftEnd = board[0].left;
  const rightEnd = board[board.length - 1].right;
  
  if (domino.left === leftEnd || domino.right === leftEnd) {
    positions.push('left');
  }
  
  if (domino.left === rightEnd || domino.right === rightEnd) {
    positions.push('right');
  }
  
  return positions;
}

function hasPlayableDomino(player, board) {
  return player.hand.some(domino => canPlayDomino(domino, board));
}

function makeAIMove(player, board, boneyard) {
  const playableDominoes = player.hand.filter(domino => canPlayDomino(domino, board));
  
  if (playableDominoes.length > 0) {
    const chosenDomino = playableDominoes[0];
    const positions = getPlayablePositions(chosenDomino, board);
    const side = positions[0] === 'center' ? 'center' : positions[0];
    
    player.hand = player.hand.filter(d => d.id !== chosenDomino.id);
    player.handCount = player.hand.length;
    
    return { domino: chosenDomino, side: side };
  }
  
  if (boneyard.length > 0) {
    const drawnDomino = boneyard.pop();
    player.hand.push(drawnDomino);
    player.handCount = player.hand.length;
    
    if (canPlayDomino(drawnDomino, board)) {
      const positions = getPlayablePositions(drawnDomino, board);
      const side = positions[0] === 'center' ? 'center' : positions[0];
      
      player.hand = player.hand.filter(d => d.id !== drawnDomino.id);
      player.handCount = player.hand.length;
      
      return { domino: drawnDomino, side: side };
    }
  }
  
  return null;
}

// Handle AI turns
function handleAITurns(room, roomId) {
  setTimeout(() => {
    if (room.gamePhase !== 'playing') return;
    
    const currentPlayer = room.players[room.currentPlayer];
    if (!currentPlayer.isAI) return;
    
    console.log('🤖 AI turn:', currentPlayer.name);
    
    const aiMove = makeAIMove(currentPlayer, room.board, room.boneyard);
    
    if (aiMove) {
      room.board = playDomino(aiMove.domino, room.board, aiMove.side);
      
      if (currentPlayer.handCount === 0) {
        room.gamePhase = 'finished';
        room.winner = room.currentPlayer;
      }
      
      console.log('🤖 AI played:', aiMove.domino.id);
      
      room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
      
      io.to(roomId).emit('dominoPlayed', {
        game: room,
        playedBy: room.players.findIndex(p => p.id === currentPlayer.id),
        domino: aiMove.domino,
        side: aiMove.side,
        gameData: {
          board: room.board,
          currentPlayer: room.currentPlayer,
          players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            handCount: p.handCount,
            isAI: p.isAI || false
          })),
          gamePhase: room.gamePhase,
          winner: room.winner,
          boneyardCount: room.boneyard.length
        }
      });
      
      if (room.gamePhase === 'playing') {
        handleAITurns(room, roomId);
      }
    } else {
      room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
      
      console.log('🤖 AI passed turn');
      
      io.to(roomId).emit('turnPassed', {
        game: room,
        passedBy: room.players.findIndex(p => p.id === currentPlayer.id),
        gameData: {
          currentPlayer: room.currentPlayer,
          boneyardCount: room.boneyard.length
        }
      });
      
      if (room.gamePhase === 'playing') {
        handleAITurns(room, roomId);
      }
    }
  }, 1500);
}

// Socket events
io.on('connection', (socket) => {
  console.log('🎮 Player connected:', socket.id);

  socket.on('createRoom', (data) => {
    console.log('📥 Create room request:', data);

    const { playerName, gameMode = 'SINGLE' } = data;
    const roomId = generateRoomId();
    const mode = GAME_MODES[gameMode] || GAME_MODES.SINGLE;

    const room = {
      id: roomId,
      gameMode: gameMode,
      maxPlayers: mode.players,
      players: [{
        id: socket.id,
        name: playerName || generateRandomName(),
        isHost: true,
        isReady: false,
        handCount: 0,
        hand: []
      }],
      gameStarted: false,
      gameEnded: false,
      board: [],
      currentPlayer: 0
    };

    if (gameMode === 'SINGLE') {
      room.players.push(...createAIPlayers());
      console.log('🤖 Added AI players for single mode');
    }

    rooms.set(roomId, room);
    playerRooms.set(socket.id, roomId);
    socket.join(roomId);

    console.log('✅ Room created:', roomId, 'Mode:', gameMode);

    socket.emit('roomCreated', {
      success: true,
      roomId: roomId,
      game: room,
      gameMode: gameMode
    });
  });

  socket.on('startGame', (data) => {
    console.log('📥 Start game request:', data);

    const { roomId } = data;
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'الغرفة غير موجودة' });
      return;
    }

    const playerInRoom = room.players.find(p => p.id === socket.id);
    if (!playerInRoom) {
      socket.emit('error', { message: 'لست في هذه الغرفة' });
      return;
    }

    if (room.gameStarted) {
      socket.emit('error', { message: 'اللعبة بدأت بالفعل' });
      return;
    }

    room.gameStarted = true;
    room.boneyard = distributeDominoes(room.players);

    const startingPlayer = findHighestDouble(room.players);
    room.currentPlayer = startingPlayer >= 0 ? startingPlayer : 0;

    room.board = [];
    room.gamePhase = 'playing';
    room.winner = null;

    console.log('🎮 Game started for room:', roomId);

    room.players.forEach((player, index) => {
      if (!player.isAI) {
        io.to(player.id).emit('gameStarted', {
          game: room,
          message: 'بدأت اللعبة! استمتع!',
          gameData: {
            board: room.board,
            currentPlayer: room.currentPlayer,
            playerIndex: index,
            hand: player.hand,
            players: room.players.map(p => ({
              id: p.id,
              name: p.name,
              handCount: p.handCount,
              isAI: p.isAI || false
            })),
            gamePhase: room.gamePhase,
            boneyardCount: room.boneyard.length
          }
        });
      }
    });

    if (room.gamePhase === 'playing') {
      handleAITurns(room, roomId);
    }
  });

  socket.on('playDomino', (data) => {
    console.log('📥 Play domino request:', data);

    const { roomId, dominoId, side } = data;
    const room = rooms.get(roomId);

    if (!room || !room.gameStarted) {
      socket.emit('error', { message: 'اللعبة غير متاحة' });
      return;
    }

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) {
      socket.emit('error', { message: 'لست في هذه الغرفة' });
      return;
    }

    if (room.currentPlayer !== playerIndex) {
      socket.emit('error', { message: 'ليس دورك' });
      return;
    }

    const player = room.players[playerIndex];
    const domino = player.hand.find(d => d.id === dominoId);

    if (!domino) {
      socket.emit('error', { message: 'القطعة غير موجودة' });
      return;
    }

    if (!canPlayDomino(domino, room.board)) {
      socket.emit('error', { message: 'لا يمكن لعب هذه القطعة' });
      return;
    }

    room.board = playDomino(domino, room.board, side);
    player.hand = player.hand.filter(d => d.id !== dominoId);
    player.handCount = player.hand.length;

    if (player.handCount === 0) {
      room.gamePhase = 'finished';
      room.winner = playerIndex;
    }

    room.currentPlayer = (room.currentPlayer + 1) % room.players.length;

    console.log('🎲 Domino played:', dominoId, 'by player', playerIndex);

    room.players.forEach((p, index) => {
      if (!p.isAI) {
        io.to(p.id).emit('dominoPlayed', {
          game: room,
          playedBy: playerIndex,
          domino: domino,
          side: side,
          gameData: {
            board: room.board,
            currentPlayer: room.currentPlayer,
            playerIndex: index,
            hand: p.hand,
            players: room.players.map(pl => ({
              id: pl.id,
              name: pl.name,
              handCount: pl.handCount,
              isAI: pl.isAI || false
            })),
            gamePhase: room.gamePhase,
            winner: room.winner,
            boneyardCount: room.boneyard.length
          }
        });
      }
    });

    if (room.gamePhase === 'playing') {
      handleAITurns(room, roomId);
    }
  });

  socket.on('drawFromBoneyard', (data) => {
    console.log('📥 Draw from boneyard request:', data);

    const { roomId } = data;
    const room = rooms.get(roomId);

    if (!room || !room.gameStarted) {
      socket.emit('error', { message: 'اللعبة غير متاحة' });
      return;
    }

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1 || room.currentPlayer !== playerIndex) {
      socket.emit('error', { message: 'ليس دورك' });
      return;
    }

    const player = room.players[playerIndex];

    if (room.boneyard.length === 0) {
      socket.emit('error', { message: 'المخزن فارغ' });
      return;
    }

    const drawnDomino = room.boneyard.pop();
    player.hand.push(drawnDomino);
    player.handCount = player.hand.length;

    console.log('🎲 Player drew domino:', drawnDomino.id);

    socket.emit('dominoDrawn', {
      domino: drawnDomino,
      boneyardCount: room.boneyard.length,
      gameData: {
        hand: player.hand,
        boneyardCount: room.boneyard.length
      }
    });

    if (!canPlayDomino(drawnDomino, room.board)) {
      room.currentPlayer = (room.currentPlayer + 1) % room.players.length;

      room.players.forEach((p, index) => {
        if (!p.isAI) {
          io.to(p.id).emit('turnPassed', {
            game: room,
            passedBy: playerIndex,
            gameData: {
              currentPlayer: room.currentPlayer,
              boneyardCount: room.boneyard.length,
              playerIndex: index,
              hand: p.hand
            }
          });
        }
      });

      if (room.gamePhase === 'playing') {
        handleAITurns(room, roomId);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('👋 Player disconnected:', socket.id);

    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);

        const humanPlayers = room.players.filter(p => !p.isAI);
        if (humanPlayers.length === 0) {
          rooms.delete(roomId);
          console.log('🗑️ Room deleted:', roomId);
        }
      }
      playerRooms.delete(socket.id);
    }
  });
});

function getGameHTML() {
  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🎲 لعبة الدومينو الكاملة</title>
  <script src="/socket.io/socket.io.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; min-height: 100vh; padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; text-align: center; }
    .header { margin-bottom: 30px; }
    .title { font-size: 48px; margin-bottom: 10px; text-shadow: 3px 3px 6px rgba(0,0,0,0.4); }
    .subtitle { font-size: 18px; opacity: 0.9; margin-bottom: 20px; }
    .status { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.1); padding: 8px 16px; border-radius: 20px; font-size: 14px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; }
    .status-dot.connected { background: #22c55e; }
    .game-section { background: rgba(255,255,255,0.1); border-radius: 15px; padding: 30px; margin: 20px 0; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); }
    .input-group { margin: 20px 0; }
    .input-group label { display: block; margin-bottom: 8px; font-weight: bold; }
    .input-row { display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; }
    input { padding: 12px 16px; border: none; border-radius: 8px; font-size: 16px; background: rgba(255,255,255,0.9); color: #333; min-width: 200px; }
    button { padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.3s ease; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; transform: translateY(-2px); }
    .btn-secondary { background: #6b7280; color: white; }
    .btn-secondary:hover { background: #4b5563; }
    .btn-random { background: #f59e0b; color: white; padding: 12px; min-width: auto; }
    .btn-random:hover { background: #d97706; }
    .game-modes { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .mode-btn { padding: 20px; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.2); border-radius: 12px; color: white; cursor: pointer; transition: all 0.3s ease; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .mode-btn:hover { background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.4); transform: translateY(-2px); }
    .mode-btn.active { background: rgba(59, 130, 246, 0.3); border-color: #3b82f6; box-shadow: 0 0 10px rgba(59, 130, 246, 0.3); }
    .mode-icon { font-size: 32px; }
    .mode-title { font-size: 18px; font-weight: bold; }
    .mode-desc { font-size: 14px; opacity: 0.8; }
    .log { background: rgba(0,0,0,0.3); padding: 15px; border-radius: 5px; margin: 20px 0; max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 12px; text-align: left; }

    /* Domino Game Styles */
    .domino {
      display: inline-flex;
      flex-direction: column;
      background: linear-gradient(145deg, #ffffff, #f0f0f0);
      border: 3px solid #2c3e50;
      border-radius: 12px;
      width: 60px;
      height: 120px;
      cursor: pointer;
      transition: all 0.3s ease;
      margin: 3px;
      position: relative;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }

    .domino:hover {
      transform: translateY(-8px) scale(1.05);
      box-shadow: 0 8px 20px rgba(0,0,0,0.3);
    }

    .domino.playable {
      border-color: #27ae60;
      box-shadow: 0 0 15px rgba(39, 174, 96, 0.6);
      background: linear-gradient(145deg, #e8f5e8, #d4edda);
    }

    .domino.selected {
      border-color: #3498db;
      transform: translateY(-12px) scale(1.1);
      box-shadow: 0 12px 25px rgba(52, 152, 219, 0.6);
      background: linear-gradient(145deg, #e3f2fd, #bbdefb);
    }

    .domino-half {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      border-bottom: 2px solid #34495e;
      background: inherit;
      border-radius: inherit;
    }

    .domino-half:last-child {
      border-bottom: none;
    }

    .domino-horizontal {
      flex-direction: row;
      width: 120px;
      height: 60px;
    }

    .domino-horizontal .domino-half {
      border-bottom: none;
      border-right: 2px solid #34495e;
    }

    .domino-horizontal .domino-half:last-child {
      border-right: none;
    }

    .board-domino {
      background: linear-gradient(145deg, #ecf0f1, #d5dbdb);
      border-color: #7f8c8d;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    /* Domino Dots Styles */
    .domino-dots {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, 1fr);
      gap: 2px;
      width: 100%;
      height: 100%;
      padding: 6px;
      position: relative;
    }

    .dot {
      width: 8px;
      height: 8px;
      background: #2c3e50;
      border-radius: 50%;
      box-shadow: inset 0 1px 2px rgba(0,0,0,0.3);
    }

    .domino-horizontal .dot {
      width: 6px;
      height: 6px;
    }

    /* Dot patterns for each number */
    .dots-0 { /* Empty */ }

    .dots-1 .dot:nth-child(5) { display: block; } /* Center */
    .dots-1 .dot:not(:nth-child(5)) { display: none; }

    .dots-2 .dot:nth-child(1) { display: block; } /* Top-left */
    .dots-2 .dot:nth-child(9) { display: block; } /* Bottom-right */
    .dots-2 .dot:not(:nth-child(1)):not(:nth-child(9)) { display: none; }

    .dots-3 .dot:nth-child(1) { display: block; } /* Top-left */
    .dots-3 .dot:nth-child(5) { display: block; } /* Center */
    .dots-3 .dot:nth-child(9) { display: block; } /* Bottom-right */
    .dots-3 .dot:not(:nth-child(1)):not(:nth-child(5)):not(:nth-child(9)) { display: none; }

    .dots-4 .dot:nth-child(1) { display: block; } /* Top-left */
    .dots-4 .dot:nth-child(3) { display: block; } /* Top-right */
    .dots-4 .dot:nth-child(7) { display: block; } /* Bottom-left */
    .dots-4 .dot:nth-child(9) { display: block; } /* Bottom-right */
    .dots-4 .dot:not(:nth-child(1)):not(:nth-child(3)):not(:nth-child(7)):not(:nth-child(9)) { display: none; }

    .dots-5 .dot:nth-child(1) { display: block; } /* Top-left */
    .dots-5 .dot:nth-child(3) { display: block; } /* Top-right */
    .dots-5 .dot:nth-child(5) { display: block; } /* Center */
    .dots-5 .dot:nth-child(7) { display: block; } /* Bottom-left */
    .dots-5 .dot:nth-child(9) { display: block; } /* Bottom-right */
    .dots-5 .dot:not(:nth-child(1)):not(:nth-child(3)):not(:nth-child(5)):not(:nth-child(7)):not(:nth-child(9)) { display: none; }

    .dots-6 .dot:nth-child(1) { display: block; } /* Top-left */
    .dots-6 .dot:nth-child(3) { display: block; } /* Top-right */
    .dots-6 .dot:nth-child(4) { display: block; } /* Middle-left */
    .dots-6 .dot:nth-child(6) { display: block; } /* Middle-right */
    .dots-6 .dot:nth-child(7) { display: block; } /* Bottom-left */
    .dots-6 .dot:nth-child(9) { display: block; } /* Bottom-right */
    .dots-6 .dot:not(:nth-child(1)):not(:nth-child(3)):not(:nth-child(4)):not(:nth-child(6)):not(:nth-child(7)):not(:nth-child(9)) { display: none; }

    .player-card {
      background: rgba(255,255,255,0.1);
      padding: 15px;
      border-radius: 8px;
      border: 2px solid transparent;
    }

    .player-card.current-turn {
      border-color: #22c55e;
      box-shadow: 0 0 10px rgba(34, 197, 94, 0.3);
    }

    .player-card.ai-player {
      background: rgba(255, 165, 0, 0.1);
      border-color: rgba(255, 165, 0, 0.3);
    }

    .play-position {
      padding: 15px;
      margin: 8px;
      background: rgba(39, 174, 96, 0.15);
      border: 3px dashed #27ae60;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-weight: bold;
      color: #27ae60;
      text-shadow: 0 1px 2px rgba(0,0,0,0.1);
      box-shadow: 0 2px 8px rgba(39, 174, 96, 0.2);
    }

    .play-position:hover {
      background: rgba(39, 174, 96, 0.3);
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(39, 174, 96, 0.4);
    }

    /* Additional domino effects */
    .domino::before {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      right: 2px;
      height: 20%;
      background: linear-gradient(180deg, rgba(255,255,255,0.8), transparent);
      border-radius: 8px 8px 0 0;
      pointer-events: none;
    }

    .domino.playable::after {
      content: '✨';
      position: absolute;
      top: -5px;
      right: -5px;
      font-size: 12px;
      animation: sparkle 1.5s infinite;
    }

    @keyframes sparkle {
      0%, 100% { opacity: 0.5; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1.2); }
    }

    .domino.selected::after {
      content: '🎯';
      position: absolute;
      top: -8px;
      right: -8px;
      font-size: 16px;
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.3); }
    }

    @media (max-width: 768px) {
      .title { font-size: 36px; }
      .game-modes { grid-template-columns: 1fr; }
      .input-row { flex-direction: column; }
      input { min-width: 100%; }
      .domino { width: 50px; height: 100px; }
      .domino-horizontal { width: 100px; height: 50px; }
      .dot { width: 6px; height: 6px; }
      .domino-horizontal .dot { width: 5px; height: 5px; }
      .domino-dots { padding: 4px; gap: 1px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">🎲 لعبة الدومينو</h1>
      <p class="subtitle">العب مع أصدقائك أونلاين - لعبة كاملة وتفاعلية!</p>
      <div class="status">
        <div class="status-dot" id="statusDot"></div>
        <span id="statusText">جاري الاتصال...</span>
      </div>
    </div>

    <!-- Main Menu -->
    <div id="mainMenu" class="game-section">
      <div class="input-group">
        <label>اسم اللاعب</label>
        <div class="input-row">
          <input type="text" id="playerName" placeholder="أدخل اسمك" maxlength="20">
          <button class="btn-random" onclick="generateRandomName()" title="توليد اسم عشوائي">🎲</button>
        </div>
      </div>

      <div class="input-group">
        <label>اختر نوع اللعبة</label>
        <div class="game-modes">
          <button class="mode-btn active" data-mode="SINGLE" onclick="selectGameMode('SINGLE')">
            <div class="mode-icon">🤖</div>
            <div class="mode-title">فردي</div>
            <div class="mode-desc">ضد الكمبيوتر - يبدأ فوراً</div>
          </button>
          <button class="mode-btn" data-mode="PAIR" onclick="selectGameMode('PAIR')">
            <div class="mode-icon">👥</div>
            <div class="mode-title">زوجي</div>
            <div class="mode-desc">لاعبان فقط</div>
          </button>
          <button class="mode-btn" data-mode="TEAM" onclick="selectGameMode('TEAM')">
            <div class="mode-icon">🏆</div>
            <div class="mode-title">فرق</div>
            <div class="mode-desc">4 لاعبين - فريقان</div>
          </button>
        </div>
      </div>

      <div class="input-row">
        <button class="btn-primary" onclick="createRoom()">🎯 إنشاء غرفة جديدة</button>
      </div>

      <div id="gameControls" style="display: none; margin-top: 20px;">
        <div class="input-row">
          <button class="btn-primary" onclick="startGame()" id="startGameBtn">🎮 بدء اللعبة</button>
          <button class="btn-secondary" onclick="leaveRoom()">🚪 مغادرة الغرفة</button>
        </div>
        <div id="roomInfo" style="margin: 15px 0; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px;">
          <div id="roomDetails"></div>
          <div id="playersList"></div>
        </div>
      </div>

      <div class="log" id="log"></div>
    </div>

    <!-- Game Board -->
    <div id="gameBoard" style="display: none;">
      <div class="game-section">
        <h3>🎲 لوحة اللعبة</h3>
        <div id="gameInfo" style="margin: 15px 0; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
          <div id="currentPlayerInfo"></div>
          <div id="gameStats"></div>
        </div>

        <div id="boardContainer" style="margin: 20px 0; padding: 20px; background: rgba(255,255,255,0.1); border-radius: 10px; min-height: 100px; overflow-x: auto;">
          <div id="dominoBoard" style="display: flex; align-items: center; gap: 5px; min-width: max-content;"></div>
        </div>

        <div id="playerHand" style="margin: 20px 0;">
          <h4>🎯 قطعك:</h4>
          <div id="handContainer" style="display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px; min-height: 80px;"></div>
        </div>

        <div id="gameActions" style="margin: 20px 0;">
          <button class="btn-primary" onclick="drawFromBoneyard()" id="drawBtn">🎲 سحب من المخزن</button>
          <button class="btn-secondary" onclick="leaveGame()">🚪 مغادرة اللعبة</button>
        </div>

        <div id="otherPlayers" style="margin: 20px 0;">
          <h4>👥 اللاعبون الآخرون:</h4>
          <div id="playersContainer" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 10px 0;"></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const socket = io();
    let isConnected = false;
    let selectedGameMode = 'SINGLE';
    let currentRoom = null;
    let isInRoom = false;
    let isGameStarted = false;
    let gameData = null;
    let playerIndex = -1;
    let selectedDomino = null;

    function log(message) {
      const logDiv = document.getElementById('log');
      const time = new Date().toLocaleTimeString();
      logDiv.innerHTML += time + ': ' + message + '<br>';
      logDiv.scrollTop = logDiv.scrollHeight;
    }

    function generateRandomName() {
      const adjectives = ['سريع', 'ذكي', 'قوي', 'ماهر', 'بطل', 'نجم', 'أسطورة', 'محترف'];
      const nouns = ['اللاعب', 'البطل', 'النجم', 'الماهر', 'القائد', 'الخبير', 'المحارب', 'الأسطورة'];
      const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      const randomNum = Math.floor(Math.random() * 999) + 1;
      document.getElementById('playerName').value = randomAdj + ' ' + randomNoun + ' ' + randomNum;
    }

    function selectGameMode(mode) {
      selectedGameMode = mode;
      document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelector('[data-mode="' + mode + '"]').classList.add('active');
      log('تم اختيار نوع اللعبة: ' + mode);
    }

    generateRandomName();

    socket.on('connect', () => {
      isConnected = true;
      updateStatus('متصل بالخادم', true);
      log('✅ اتصال ناجح بالخادم');
    });

    socket.on('disconnect', () => {
      isConnected = false;
      updateStatus('انقطع الاتصال', false);
      log('❌ انقطع الاتصال');
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

      log('🎯 إرسال طلب إنشاء غرفة...');
      socket.emit('createRoom', { playerName: playerName, gameMode: selectedGameMode });
    }

    function startGame() {
      if (!currentRoom) {
        alert('لست في غرفة');
        return;
      }

      log('🎮 إرسال طلب بدء اللعبة...');
      socket.emit('startGame', { roomId: currentRoom.id });
    }

    function leaveRoom() {
      if (!currentRoom) {
        alert('لست في غرفة');
        return;
      }

      log('🚪 مغادرة الغرفة...');
      hideGameControls();
      hideGameBoard();
    }

    function showGameControls() {
      document.getElementById('gameControls').style.display = 'block';
      isInRoom = true;
    }

    function hideGameControls() {
      document.getElementById('gameControls').style.display = 'none';
      currentRoom = null;
      isInRoom = false;
      isGameStarted = false;
    }

    function showGameBoard() {
      document.getElementById('gameBoard').style.display = 'block';
      document.getElementById('mainMenu').style.display = 'none';
      isGameStarted = true;
    }

    function hideGameBoard() {
      document.getElementById('gameBoard').style.display = 'none';
      document.getElementById('mainMenu').style.display = 'block';
      isGameStarted = false;
      gameData = null;
      playerIndex = -1;
      selectedDomino = null;
    }

    function updateRoomInfo(room) {
      const humanPlayers = room.players.filter(p => !p.isAI);
      const aiPlayers = room.players.filter(p => p.isAI);

      const modeNames = {
        'SINGLE': 'فردي ضد الكمبيوتر',
        'PAIR': 'زوجي (لاعبان)',
        'TEAM': 'فرق (4 لاعبين)'
      };

      document.getElementById('roomDetails').innerHTML =
        '<h4>🏠 الغرفة: ' + room.id + '</h4>' +
        '<p>📋 النوع: ' + (modeNames[room.gameMode] || room.gameMode) + '</p>' +
        '<p>👥 اللاعبون: ' + humanPlayers.length + '/' + room.maxPlayers + '</p>';

      let playersHtml = '<h5>قائمة اللاعبين:</h5><ul>';
      humanPlayers.forEach(player => {
        playersHtml += '<li>👤 ' + player.name + (player.isHost ? ' (المضيف)' : '') + '</li>';
      });
      if (aiPlayers.length > 0) {
        aiPlayers.forEach(ai => {
          playersHtml += '<li>🤖 ' + ai.name + '</li>';
        });
      }
      playersHtml += '</ul>';

      document.getElementById('playersList').innerHTML = playersHtml;

      const startBtn = document.getElementById('startGameBtn');
      if (room.gameStarted) {
        startBtn.textContent = '🎮 اللعبة بدأت';
        startBtn.disabled = true;
        startBtn.style.background = '#6b7280';
      } else if (humanPlayers.length === room.maxPlayers || room.gameMode === 'SINGLE') {
        startBtn.textContent = '🎮 بدء اللعبة';
        startBtn.disabled = false;
        startBtn.style.background = '#3b82f6';
      } else {
        startBtn.textContent = '⏳ انتظار اللاعبين (' + humanPlayers.length + '/' + room.maxPlayers + ')';
        startBtn.disabled = true;
        startBtn.style.background = '#6b7280';
      }
    }

    socket.on('roomCreated', (data) => {
      if (data.success) {
        log('✅ تم إنشاء الغرفة: ' + data.roomId);
        currentRoom = data.game;
        showGameControls();
        updateRoomInfo(data.game);

        if (data.gameMode === 'SINGLE') {
          alert('تم إنشاء اللعبة الفردية!\\nكود الغرفة: ' + data.roomId + '\\nيمكنك بدء اللعبة الآن');
        } else {
          alert('تم إنشاء الغرفة!\\nكود الغرفة: ' + data.roomId + '\\nشارك هذا الكود مع الأصدقاء');
        }
      }
    });

    socket.on('error', (data) => {
      log('❌ خطأ: ' + data.message);
      alert('خطأ: ' + data.message);
    });

    socket.on('gameStarted', (data) => {
      log('🎮 بدأت اللعبة! ' + data.message);

      if (data.gameData) {
        gameData = data.gameData;
        playerIndex = data.gameData.playerIndex;
        showGameBoard();
        updateGameDisplay(data.gameData);
      }

      alert('🎮 ' + data.message);
    });

    // Create domino HTML element with dots
    function createDominoElement(domino, isPlayable = false, isBoard = false) {
      const dominoEl = document.createElement('div');
      dominoEl.className = 'domino' + (isBoard ? ' board-domino domino-horizontal' : '');
      dominoEl.dataset.dominoId = domino.id;

      if (isPlayable) {
        dominoEl.classList.add('playable');
        dominoEl.onclick = () => selectDomino(domino);
      }

      const leftHalf = document.createElement('div');
      leftHalf.className = 'domino-half';
      leftHalf.appendChild(createDominoDots(domino.left));

      const rightHalf = document.createElement('div');
      rightHalf.className = 'domino-half';
      rightHalf.appendChild(createDominoDots(domino.right));

      dominoEl.appendChild(leftHalf);
      dominoEl.appendChild(rightHalf);

      return dominoEl;
    }

    // Create domino dots pattern
    function createDominoDots(number) {
      const dotsContainer = document.createElement('div');
      dotsContainer.className = 'domino-dots dots-' + number;

      // Create 9 dot positions (3x3 grid)
      for (let i = 1; i <= 9; i++) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        dotsContainer.appendChild(dot);
      }

      return dotsContainer;
    }

    // Select domino for playing
    function selectDomino(domino) {
      if (!gameData || gameData.currentPlayer !== playerIndex) return;

      document.querySelectorAll('.domino.selected').forEach(el => {
        el.classList.remove('selected');
      });

      selectedDomino = domino;

      const dominoEl = document.querySelector('[data-domino-id="' + domino.id + '"]');
      if (dominoEl) {
        dominoEl.classList.add('selected');
      }

      showPlayPositions(domino);
    }

    // Show where domino can be played
    function showPlayPositions(domino) {
      const board = gameData.board;
      const positions = getPlayablePositions(domino, board);

      document.querySelectorAll('.play-position').forEach(el => el.remove());

      const boardContainer = document.getElementById('dominoBoard');

      positions.forEach(position => {
        const positionEl = document.createElement('div');
        positionEl.className = 'play-position';
        positionEl.textContent = position === 'left' ? '← هنا' : position === 'right' ? 'هنا →' : 'ابدأ هنا';
        positionEl.onclick = () => playSelectedDomino(position);

        if (position === 'left') {
          boardContainer.insertBefore(positionEl, boardContainer.firstChild);
        } else if (position === 'right') {
          boardContainer.appendChild(positionEl);
        } else {
          boardContainer.appendChild(positionEl);
        }
      });
    }

    // Play selected domino
    function playSelectedDomino(side) {
      if (!selectedDomino) return;

      log('🎲 لعب القطعة: ' + selectedDomino.id + ' في الجانب: ' + side);
      socket.emit('playDomino', {
        roomId: currentRoom.id,
        dominoId: selectedDomino.id,
        side: side
      });

      selectedDomino = null;
      document.querySelectorAll('.play-position').forEach(el => el.remove());
    }

    // Get playable positions for domino
    function getPlayablePositions(domino, board) {
      const positions = [];

      if (board.length === 0) {
        positions.push('center');
        return positions;
      }

      const leftEnd = board[0].left;
      const rightEnd = board[board.length - 1].right;

      if (domino.left === leftEnd || domino.right === leftEnd) {
        positions.push('left');
      }

      if (domino.left === rightEnd || domino.right === rightEnd) {
        positions.push('right');
      }

      return positions;
    }

    // Check if domino can be played
    function canPlayDomino(domino, board) {
      if (board.length === 0) return true;

      const leftEnd = board[0].left;
      const rightEnd = board[board.length - 1].right;

      return domino.left === leftEnd || domino.right === leftEnd ||
             domino.left === rightEnd || domino.right === rightEnd;
    }

    // Update game display
    function updateGameDisplay(data) {
      gameData = data;

      const currentPlayerName = gameData.players[gameData.currentPlayer].name;
      const isMyTurn = gameData.currentPlayer === playerIndex;

      document.getElementById('currentPlayerInfo').innerHTML =
        '<h4>' + (isMyTurn ? '🎯 دورك!' : '⏳ دور: ' + currentPlayerName) + '</h4>';

      document.getElementById('gameStats').innerHTML =
        '<p>🎲 المخزن: ' + (gameData.boneyardCount || 0) + ' قطعة</p>' +
        '<p>📋 اللوحة: ' + gameData.board.length + ' قطعة</p>';

      updateBoard(gameData.board);

      if (gameData.hand) {
        updatePlayerHand(gameData.hand);
      }

      updateOtherPlayers(gameData.players);
      updateActionButtons(isMyTurn);
    }

    // Update board display
    function updateBoard(board) {
      const boardContainer = document.getElementById('dominoBoard');
      boardContainer.innerHTML = '';

      if (board.length === 0) {
        boardContainer.innerHTML = '<p style="color: #ccc; font-style: italic;">اللوحة فارغة - ابدأ بأي قطعة</p>';
        return;
      }

      board.forEach(domino => {
        const dominoEl = createDominoElement(domino, false, true);
        boardContainer.appendChild(dominoEl);
      });
    }

    // Update player hand
    function updatePlayerHand(hand) {
      const handContainer = document.getElementById('handContainer');
      handContainer.innerHTML = '';

      if (hand.length === 0) {
        handContainer.innerHTML = '<p style="color: #22c55e; font-weight: bold;">🎉 فزت! لا توجد قطع متبقية</p>';
        return;
      }

      hand.forEach(domino => {
        const isPlayable = gameData && gameData.currentPlayer === playerIndex && canPlayDomino(domino, gameData.board);
        const dominoEl = createDominoElement(domino, isPlayable);
        handContainer.appendChild(dominoEl);
      });
    }

    // Update other players display
    function updateOtherPlayers(players) {
      const playersContainer = document.getElementById('playersContainer');
      playersContainer.innerHTML = '';

      players.forEach((player, index) => {
        if (index === playerIndex) return;

        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';

        if (index === gameData.currentPlayer) {
          playerCard.classList.add('current-turn');
        }

        if (player.isAI) {
          playerCard.classList.add('ai-player');
        }

        playerCard.innerHTML =
          '<h5>' + (player.isAI ? '🤖 ' : '👤 ') + player.name + '</h5>' +
          '<p>🎲 القطع: ' + player.handCount + '</p>' +
          (index === gameData.currentPlayer ? '<p style="color: #22c55e;">🎯 دوره الآن</p>' : '');

        playersContainer.appendChild(playerCard);
      });
    }

    // Update action buttons
    function updateActionButtons(isMyTurn) {
      const drawBtn = document.getElementById('drawBtn');

      if (isMyTurn && gameData.gamePhase === 'playing') {
        drawBtn.disabled = false;
        drawBtn.style.background = '#3b82f6';
      } else {
        drawBtn.disabled = true;
        drawBtn.style.background = '#9ca3af';
      }
    }

    // Game actions
    function drawFromBoneyard() {
      if (!gameData || gameData.currentPlayer !== playerIndex) {
        alert('ليس دورك');
        return;
      }

      log('🎲 سحب من المخزن...');
      socket.emit('drawFromBoneyard', { roomId: currentRoom.id });
    }

    function leaveGame() {
      if (confirm('هل تريد مغادرة اللعبة؟')) {
        hideGameBoard();
        leaveRoom();
      }
    }

    // Socket event handlers for game
    socket.on('dominoPlayed', (data) => {
      const playerName = data.game.players[data.playedBy].name;
      log('🎲 ' + playerName + ' لعب قطعة: ' + data.domino.id);

      if (data.gameData) {
        updateGameDisplay(data.gameData);
      }

      selectedDomino = null;
      document.querySelectorAll('.domino.selected').forEach(el => {
        el.classList.remove('selected');
      });
      document.querySelectorAll('.play-position').forEach(el => el.remove());

      if (data.gameData.gamePhase === 'finished') {
        const winnerName = data.game.players[data.gameData.winner].name;
        setTimeout(() => {
          alert('🎉 انتهت اللعبة! الفائز: ' + winnerName);
        }, 1000);
      }
    });

    socket.on('dominoDrawn', (data) => {
      log('🎲 سحبت قطعة من المخزن');

      if (data.gameData && data.gameData.hand) {
        gameData.hand = data.gameData.hand;
        updatePlayerHand(gameData.hand);
      }
    });

    socket.on('turnPassed', (data) => {
      const playerName = data.game.players[data.passedBy].name;
      log('⏭️ ' + playerName + ' مرر الدور');

      if (data.gameData) {
        gameData.currentPlayer = data.gameData.currentPlayer;
        if (data.gameData.hand) {
          gameData.hand = data.gameData.hand;
        }
        updateGameDisplay(gameData);
      }
    });
  </script>
</body>
</html>
  `;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('🎮 Complete Domino Game running on port', PORT);
  console.log('🔗 Open: http://localhost:' + PORT);
});
