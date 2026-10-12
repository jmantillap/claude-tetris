'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Cada skin: paleta 1-indexada (como PIECES), función de dibujo de un bloque y color de grilla opcional.
const SKINS = {
  retro: {
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#90caf9', // J - pale blue
      '#ffb74d', // L - orange
      '#f06292', // + (plus)   - pink
      '#4db6ac', // U          - teal
      '#9575cd', // Y          - violet
      '#a1887f', // 3x3 hueca  - brown
      '#fff176', // single 1x1 - pale yellow
    ],
    draw: drawRetro,
  },
  neon: {
    colors: [
      null,
      '#00f0ff', '#ffee00', '#bf00ff', '#39ff14', '#ff073a', '#1f6bff',
      '#ff9100', '#ff2bd6', '#00ffb3', '#a259ff', '#ff6e40', '#f5ff3d',
    ],
    draw: drawNeon,
    grid: '#1a1a24',
  },
  pastel: {
    colors: [
      null,
      '#a8e6ef', '#fff1b8', '#d9b8e6', '#bfe8c2', '#f5b8b8', '#bcd8f5',
      '#ffd9b0', '#f8bcd0', '#b5e3dc', '#cfc2ee', '#cdbdb4', '#fff9c4',
    ],
    draw: drawPastel,
  },
  pixel: {
    colors: [
      null,
      '#29b6f6', '#fdd835', '#ab47bc', '#66bb6a', '#ef5350', '#5c6bc0',
      '#fb8c00', '#ec407a', '#26a69a', '#7e57c2', '#8d6e63', '#d4e157',
    ],
    draw: drawPixel,
  },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[0,8,0],[8,8,8],[0,8,0]],                  // + (plus)
  [[9,0,9],[9,9,9],[0,0,0]],                  // U
  [[0,10,0,0],[10,10,10,10],[0,0,0,0],[0,0,0,0]], // Y
  [[11,11,11],[11,0,11],[11,11,11]],          // 3x3 hueca
  [[12]],                                      // single 1x1
];

const STANDARD_TYPES = [1, 2, 3, 4, 5, 6, 7];
const SPECIAL_TYPES = [8, 9, 10, 11]; // pentominós + 3x3 hueca (el 12 no entra al azar)
const SPECIAL_CHANCE = 0.15;
const SINGLE_TYPE = 12;

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const resumeBtn = document.getElementById('resume-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsList = document.getElementById('controls-list');
const startLevelSel = document.getElementById('start-level');
const themeToggle = document.getElementById('theme-toggle');

const skinSelect = document.getElementById('skin-select');

const THEME_KEY = 'tetris-theme';
const SKIN_KEY = 'tetris-skin';
const GRID_COLORS = { dark: '#22222e', light: '#e2e2ee' };

let startLevel = 1;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, rewardPending;
let gridColor = GRID_COLORS.dark;
let skin = SKINS.retro;

function applyTheme(theme) {
  const isLight = theme === 'light';
  document.body.classList.toggle('light', isLight);
  themeToggle.checked = isLight;
  updateGridColor();
  localStorage.setItem(THEME_KEY, theme);
}

function updateGridColor() {
  gridColor = skin.grid || (document.body.classList.contains('light') ? GRID_COLORS.light : GRID_COLORS.dark);
}

function applySkin(name) {
  if (!SKINS[name]) name = 'retro';
  skin = SKINS[name];
  document.body.classList.remove('skin-retro', 'skin-neon', 'skin-pastel', 'skin-pixel');
  document.body.classList.add('skin-' + name);
  skinSelect.value = name;
  updateGridColor();
  localStorage.setItem(SKIN_KEY, name);
  if (current) { draw(); drawNext(); } // repinta aunque esté en pausa/game over
}

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');
  applySkin(localStorage.getItem(SKIN_KEY));
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  const pool = Math.random() < SPECIAL_CHANCE ? SPECIAL_TYPES : STANDARD_TYPES;
  return makePiece(pool[Math.floor(Math.random() * pool.length)]);
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function setLevel(l) {
  level = l;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    if (cleared === 4) rewardPending = true;
    score += (LINE_SCORES[cleared] || 0) * level;
    setLevel(startLevel + Math.floor(lines / 10));
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  if (rewardPending) {
    next = makePiece(SINGLE_TYPE);
    rewardPending = false;
  } else {
    next = randomPiece();
  }
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  skin.draw(context, x * size, y * size, size, skin.colors[colorIndex]);
  context.globalAlpha = 1;
}

function drawRetro(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawNeon(context, px, py, size, color) {
  context.shadowColor = color;
  context.shadowBlur = 12;
  context.fillStyle = color + '40'; // alfa hex sobre color #rrggbb
  context.fillRect(px + 3, py + 3, size - 6, size - 6);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
  context.shadowBlur = 0;
}

function drawPastel(context, px, py, size, color) {
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(px + 1, py + 1, size - 2, size - 2, size * 0.3);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.beginPath();
  context.roundRect(px + 5, py + 4, size * 0.4, 4, 2);
  context.fill();
}

function drawPixel(context, px, py, size, color) {
  const u = (size - 2) / 6; // rejilla 6x6 de "píxeles"
  const x0 = px + 1, y0 = py + 1;
  context.fillStyle = color;
  context.fillRect(x0, y0, size - 2, size - 2);
  context.fillStyle = 'rgba(0,0,0,0.14)'; // damero
  for (let i = 1; i < 5; i++)
    for (let j = 1; j < 5; j++)
      if ((i + j) % 2) context.fillRect(x0 + i * u, y0 + j * u, u, u);
  context.fillStyle = 'rgba(255,255,255,0.4)'; // luz arriba/izquierda
  context.fillRect(x0, y0, size - 2, u);
  context.fillRect(x0, y0, u, size - 2);
  context.fillStyle = 'rgba(0,0,0,0.35)'; // sombra abajo/derecha
  context.fillRect(x0, y0 + 5 * u, size - 2, u);
  context.fillRect(x0 + 5 * u, y0, u, size - 2);
}
function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  draw();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.add('over');
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    document.activeElement.blur(); // evita que Space/Enter activen un botón del menú al jugar
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    controlsList.classList.add('hidden');
    overlay.classList.remove('hidden', 'over');
    resumeBtn.focus();
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  startLevel = +startLevelSel.value;
  setLevel(startLevel);
  paused = false;
  gameOver = false;
  dropAccum = 0;
  rewardPending = false;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  overlay.classList.remove('over');
  document.activeElement.blur();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (!e.repeat) togglePause();
    return;
  }
  // menú abierto o partida terminada: ninguna tecla llega al juego
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', togglePause);
controlsBtn.addEventListener('click', () => controlsList.classList.toggle('hidden'));
themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked ? 'light' : 'dark');
});

skinSelect.addEventListener('change', () => applySkin(skinSelect.value));

initTheme();
init();
