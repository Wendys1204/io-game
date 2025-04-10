// game.js — Crashr.io Client Script

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const socket = io();
let playerId = null;
let players = {};
let pickups = [];
let eliminated = false;

const WORLD_SIZE = 1000;

const nameInput = document.getElementById('nameInput');
const messageBox = document.createElement('div');
messageBox.style.position = 'absolute';
messageBox.style.top = '50%';
messageBox.style.left = '50%';
messageBox.style.transform = 'translate(-50%, -50%)';
messageBox.style.fontSize = '32px';
messageBox.style.color = 'white';
messageBox.style.zIndex = 20;
messageBox.style.textAlign = 'center';
messageBox.style.display = 'none';
messageBox.innerHTML = 'You were eliminated!<br>Refresh to play again.';
document.body.appendChild(messageBox);

nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const name = nameInput.value.trim();
    if (name) {
      socket.emit('join', name);
    }
  }
});

socket.on('init', (data) => {
  playerId = data.id;
  players = data.players;
  pickups = data.pickups;
  nameInput.style.display = 'none';
  canvas.style.display = 'block';
});

socket.on('update', (data) => {
  players = data;
});

socket.on('updatePickups', (data) => {
  pickups = data;
});

socket.on('playerJoined', (player) => {
  players[player.id] = player;
});

socket.on('playerLeft', (id) => {
  delete players[id];
});

socket.on('eliminated', () => {
  eliminated = true;
  messageBox.style.display = 'block';
});

function drawPlayer(p) {
  if (!p) return;
  ctx.save();
  ctx.translate(
    canvas.width / 2 + (p.x - players[playerId].x),
    canvas.height / 2 + (p.y - players[playerId].y)
  );
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
  ctx.beginPath();
  ctx.arc(
    canvas.width / 2 + (p.x - players[playerId].x),
    canvas.height / 2 + (p.y - players[playerId].y),
    p.size, 0, 2 * Math.PI
  );
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
    ctx.fillRect(
      xOffset + (p.x + mapW / 2) * scale,
      yOffset + (p.y + mapH / 2) * scale,
      2, 2
    );
  });

  Object.values(players).forEach(p => {
    ctx.fillStyle = p.id === playerId ? 'lime' : 'white';
    ctx.fillRect(
      xOffset + (p.x + mapW / 2) * scale,
      yOffset + (p.y + mapH / 2) * scale,
      3, 3
    );
  });
}

function update() {
  if (eliminated || !players[playerId]) return;

  const speed = 4;
  if (keys['ArrowUp'] || keys['w']) players[playerId].y -= speed;
  if (keys['ArrowDown'] || keys['s']) players[playerId].y += speed;
  if (keys['ArrowLeft'] || keys['a']) players[playerId].x -= speed;
  if (keys['ArrowRight'] || keys['d']) players[playerId].x += speed;

  socket.emit('move', players[playerId]);
}

function render() {
  if (eliminated || !players[playerId]) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawWorldBorder();
  pickups.forEach(drawPickup);
  Object.values(players).forEach(drawPlayer);
  drawMinimap();
}

const keys = {};
window.addEventListener('keydown', (e) => keys[e.key] = true);
window.addEventListener('keyup', (e) => keys[e.key] = false);

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}
gameLoop();
