// game.js — Client with auto-respawn and animated elimination box

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const socket = io();
let playerId = null;
let players = {};
let smoothPlayers = {};
let pickups = [];
let eliminated = false;
let lastPlayerName = '';

const WORLD_SIZE = 1000;

const nameInput = document.getElementById('nameInput');
const messageBox = document.createElement('div');
messageBox.style.position = 'absolute';
messageBox.style.top = '50%';
messageBox.style.left = '50%';
messageBox.style.transform = 'translate(-50%, -50%) scale(0.8)';
messageBox.style.opacity = '0';
messageBox.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
messageBox.style.fontSize = '32px';
messageBox.style.color = 'white';
messageBox.style.zIndex = 20;
messageBox.style.textAlign = 'center';
messageBox.style.background = 'rgba(0, 0, 0, 0.7)';
messageBox.style.padding = '20px';
messageBox.style.borderRadius = '10px';
messageBox.style.display = 'none';

const messageText = document.createElement('div');
messageText.innerHTML = 'You were eliminated!';

const respawnButton = document.createElement('button');
respawnButton.textContent = 'Respawn';
respawnButton.style.marginTop = '20px';
respawnButton.style.fontSize = '20px';
respawnButton.style.padding = '10px 20px';
respawnButton.style.cursor = 'pointer';
respawnButton.onclick = () => {
  if (lastPlayerName) {
    socket.emit('join', lastPlayerName);
    eliminated = false;
    messageBox.style.display = 'none';
    players = {};
    smoothPlayers = {};
  }
};

messageBox.appendChild(messageText);
messageBox.appendChild(respawnButton);
document.body.appendChild(messageBox);

nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const name = nameInput.value.trim();
    if (name) {
      lastPlayerName = name;
      socket.emit('join', name);
    }
  }
});

socket.on('init', (data) => {
  playerId = data.id;
  players = data.players;
  pickups = data.pickups;
  Object.keys(players).forEach(id => {
    if (id !== playerId) {
      smoothPlayers[id] = { ...players[id] };
    }
  });
  nameInput.style.display = 'none';
  canvas.style.display = 'block';
});

socket.on('update', (data) => {
  players = data;
  Object.keys(players).forEach(id => {
    if (id !== playerId) {
      if (!smoothPlayers[id]) {
        smoothPlayers[id] = { ...players[id] };
      }
    }
  });
});

socket.on('updatePickups', (data) => {
  pickups = data;
});

socket.on('playerJoined', (player) => {
  players[player.id] = player;
  if (player.id !== playerId) {
    smoothPlayers[player.id] = { ...player };
  }
});

socket.on('playerLeft', (id) => {
  delete players[id];
  delete smoothPlayers[id];
});

socket.on('eliminated', () => {
  eliminated = true;
  messageBox.style.display = 'block';
  setTimeout(() => {
    messageBox.style.opacity = '1';
    messageBox.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
});

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function drawPlayer(p) {
  const me = players[playerId];
  if (!me) return;
  const dx = p.x - me.x;
  const dy = p.y - me.y;

  ctx.save();
  ctx.translate(canvas.width / 2 + dx, canvas.height / 2 + dy);
  ctx.rotate(p.angle);
  ctx.fillStyle = p.id === playerId ? 'lime' : 'white';
  ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
  ctx.fillStyle = 'white';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(p.name || 'Player', 0, -p.size);
  ctx.restore();
}

function drawPickup(p) {
  const me = players[playerId];
  if (!me) return;
  const dx = p.x - me.x;
  const dy = p.y - me.y;
  ctx.beginPath();
  ctx.arc(canvas.width / 2 + dx, canvas.height / 2 + dy, p.size, 0, 2 * Math.PI);
  ctx.fillStyle = 'yellow';
  ctx.fill();
}

function drawWorldBorder() {
  const me = players[playerId];
  if (!me) return;
  const topLeftX = canvas.width / 2 - (me.x + WORLD_SIZE);
  const topLeftY = canvas.height / 2 - (me.y + WORLD_SIZE);
  const size = WORLD_SIZE * 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 4;
  ctx.strokeRect(topLeftX, topLeftY, size, size);
}

function drawMinimap() {
  const scale = 0.05;
  const mapW = 2000, mapH = 2000;
  const miniW = mapW * scale;
  const miniH = mapH * scale;
  const xOffset = canvas.width - miniW - 10;
  const yOffset = 10;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(xOffset, yOffset, miniW, miniH);

  pickups.forEach(p => {
    ctx.fillStyle = 'yellow';
    ctx.fillRect(xOffset + (p.x + mapW / 2) * scale, yOffset + (p.y + mapH / 2) * scale, 2, 2);
  });

  Object.values(players).forEach(p => {
    ctx.fillStyle = p.id === playerId ? 'lime' : 'white';
    ctx.fillRect(xOffset + (p.x + mapW / 2) * scale, yOffset + (p.y + mapH / 2) * scale, 3, 3);
  });
}

const keys = {};
window.addEventListener('keydown', (e) => keys[e.key] = true);
window.addEventListener('keyup', (e) => keys[e.key] = false);

let lastMoveEmit = 0;
const MOVE_INTERVAL = 1000 / 30;

function update() {
  if (eliminated || !players[playerId]) return;

  const speed = 4;
  if (keys['ArrowUp'] || keys['w']) players[playerId].y -= speed;
  if (keys['ArrowDown'] || keys['s']) players[playerId].y += speed;
  if (keys['ArrowLeft'] || keys['a']) players[playerId].x -= speed;
  if (keys['ArrowRight'] || keys['d']) players[playerId].x += speed;

  const now = Date.now();
  if (now - lastMoveEmit > MOVE_INTERVAL) {
    socket.emit('move', players[playerId]);
    lastMoveEmit = now;
  }

  for (let id in smoothPlayers) {
    if (!players[id]) continue;
    smoothPlayers[id].x = lerp(smoothPlayers[id].x, players[id].x, 0.35);
    smoothPlayers[id].y = lerp(smoothPlayers[id].y, players[id].y, 0.35);
    smoothPlayers[id].angle = lerp(smoothPlayers[id].angle, players[id].angle, 0.35);
    smoothPlayers[id].size = lerp(smoothPlayers[id].size, players[id].size, 0.35);
  }
}

function render() {
  if (eliminated || !players[playerId]) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawWorldBorder();
  pickups.forEach(drawPickup);
  drawPlayer(players[playerId]);
  Object.values(smoothPlayers).forEach(drawPlayer);
  drawMinimap();
}

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}
gameLoop();
