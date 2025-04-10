// server.js — Crashr.io (Agar.io-style game with cars)

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = 3000;
const WORLD_SIZE = 1000;

let players = {};
let pickups = [];

const badWords = ['nigger', 'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'retard'];

function filterName(name) {
  const cleaned = name.trim().toLowerCase();
  for (let word of badWords) {
    if (cleaned.includes(word)) return 'Player';
  }
  return name.slice(0, 15);
}

function randomPos() {
  return {
    x: Math.random() * WORLD_SIZE * 2 - WORLD_SIZE,
    y: Math.random() * WORLD_SIZE * 2 - WORLD_SIZE
  };
}

function createPickup() {
  return {
    id: Date.now() + Math.random(),
    ...randomPos(),
    size: 10
  };
}

function generatePickups(count) {
  for (let i = 0; i < count; i++) {
    pickups.push(createPickup());
  }
}

generatePickups(100);

function checkPickupCollisions(player) {
  const eaten = [];
  pickups = pickups.filter(pickup => {
    const dx = pickup.x - player.x;
    const dy = pickup.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < player.size / 2 + pickup.size) {
      player.size += 1;
      eaten.push(pickup);
      return false;
    }
    return true;
  });

  eaten.forEach(p => {
    setTimeout(() => {
      pickups.push(createPickup());
      io.emit('updatePickups', pickups);
    }, 15000);
  });
}

function checkPlayerCollisions() {
  const ids = Object.keys(players);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = players[ids[i]];
      const b = players[ids[j]];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < (a.size + b.size) / 2) {
        // Absorb mechanic: bigger player absorbs smaller
        if (a.size > b.size + 5) {
          a.size += Math.floor(b.size / 2);
          io.to(b.id).emit('eliminated');
          delete players[b.id];
          io.emit('update', players);
        } else if (b.size > a.size + 5) {
          b.size += Math.floor(a.size / 2);
          io.to(a.id).emit('eliminated');
          delete players[a.id];
          io.emit('update', players);
        }
      }
    }
  }
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join', (name) => {
    const playerName = filterName(name);
    players[socket.id] = {
      id: socket.id,
      name: playerName,
      x: 0,
      y: 0,
      size: 20,
      angle: 0,
      speed: 0
    };

    socket.emit('init', {
      id: socket.id,
      players,
      pickups
    });

    socket.broadcast.emit('playerJoined', players[socket.id]);
  });

  socket.on('move', (data) => {
    const player = players[socket.id];
    if (!player) return;

    const half = WORLD_SIZE;
    player.x = Math.max(-half, Math.min(half, data.x));
    player.y = Math.max(-half, Math.min(half, data.y));
    player.angle = data.angle;
    player.speed = data.speed;

    checkPickupCollisions(player);
    checkPlayerCollisions();

    io.emit('update', players);
    io.emit('updatePickups', pickups);
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
  });
});

app.use(express.static('public'));

server.listen(PORT, () => {
  console.log(`🚗 Crashr.io server running on http://localhost:${PORT}`);
});
