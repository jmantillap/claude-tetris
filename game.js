'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// ---- Skins: cada una con paleta (índice 0 = null, 1-12 = tipos), grid opcional y función de dibujo ----
// draw(c, px, py, s, color): px/py en píxeles, s = tamaño de bloque
const rectPath = (c, x, y, w, h, r) => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
};

const SKINS = {
  retro: {
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9',
      '#ffb74d', '#f06292', '#4db6ac', '#9575cd', '#a1887f', '#fff176'],
    draw(c, px, py, s, color) {
      c.fillStyle = color;
      c.fillRect(px + 1, py + 1, s - 2, s - 2);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(px + 1, py + 1, s - 2, 4);
    },
  },
  neon: {
    colors: [null, '#00f0ff', '#fff700', '#d500f9', '#39ff14', '#ff1744', '#2979ff',
      '#ff9100', '#ff4081', '#1de9b6', '#b388ff', '#ff6e40', '#ffffff'],
    grid: '#1a1a2e', // el tablero neon es siempre negro
    draw(c, px, py, s, color) {
      c.shadowColor = color;
      c.shadowBlur = s * 0.5;
      c.fillStyle = color;
      c.fillRect(px + 3, py + 3, s - 6, s - 6);
      c.shadowBlur = 0;
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = 1;
      c.strokeRect(px + 3.5, py + 3.5, s - 7, s - 7);
    },
  },
  pastel: {
    colors: [null, '#a8e6ef', '#fff1b8', '#d9b8e6', '#b9e4c0', '#f5b7b7', '#bcd9f7',
      '#fdd3a1', '#f8bbd0', '#a7dbd5', '#c5b8e8', '#d7c4bc', '#fff9c4'],
    draw(c, px, py, s, color) {
      rectPath(c, px + 1.5, py + 1.5, s - 3, s - 3, s * 0.28);
      c.fillStyle = color;
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = 1.5;
      c.stroke();
    },
  },
  pixel: {
    colors: [null, '#29b6f6', '#fdd835', '#ab47bc', '#66bb6a', '#ef5350', '#5c6bc0',
      '#ffa726', '#ec407a', '#26a69a', '#7e57c2', '#8d6e63', '#d4e157'],
    draw(c, px, py, s, color) {
      const t = Math.max(2, Math.round(s / 10)); // tamaño del "píxel"
      c.fillStyle = color;
      c.fillRect(px, py, s, s);
      // textura: damero sutil en el interior
      c.fillStyle = 'rgba(255,255,255,0.14)';
      for (let i = t; i < s - t; i += t)
        for (let j = t; j < s - t; j += t)
          if (((i + j) / t) % 2 === 0) c.fillRect(px + i, py + j, t, t);
      // bisel: luz arriba/izquierda, sombra abajo/derecha
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.fillRect(px, py, s, t);
      c.fillRect(px, py, t, s);
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(px, py + s - t, s, t);
      c.fillRect(px + s - t, py, t, s);
    },
  },
};

let skin = SKINS.retro;
let COLORS = skin.colors; // paleta de la skin activa

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
const themeToggle = document.getElementById('theme-toggle');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSel = document.getElementById('start-level');

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const recordsBox = document.getElementById('records-box');
const recordEntry = document.getElementById('record-entry');
const nameInput = document.getElementById('name-input');
const saveRecordBtn = document.getElementById('save-record-btn');
const startBody = document.getElementById('start-records');
const overBody = document.getElementById('over-records');
const startStats = document.getElementById('start-stats');
const overStats = document.getElementById('over-stats');

const skinSelect = document.getElementById('skin-select');

const THEME_KEY = 'tetris-theme';
const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const NAME_MAX = 12;
const SKIN_KEY = 'tetris-skin';
const GRID_COLORS = { dark: '#22222e', light: '#e2e2ee' };

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, rewardPending;
let combo, maxCombo;
let started = false;
let records = { top: [], bestCombo: 0, maxLines: 0 };
let entryOpen = false; // game over con puntuación que entra al top, pendiente de guardar nombre
let savedRank = -1;    // fila a resaltar tras guardar
let gridColor = GRID_COLORS.dark;
let startLevel = 1;
let ignoreRepeat = false; // tras reanudar, ignora auto-repeat de teclas aún mantenidas

function applyLevel() {
  level = startLevel + Math.floor(lines / 10);
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
}

// ---- Records (localStorage) ----
function loadRecords() {
  try {
    const d = JSON.parse(localStorage.getItem(RECORDS_KEY));
    const top = (Array.isArray(d.top) ? d.top : [])
      .filter(r => r && Number.isFinite(r.score))
      .map(r => ({ name: String(r.name || '').slice(0, NAME_MAX), score: r.score, lines: +r.lines || 0, combo: +r.combo || 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECORDS);
    return { top, bestCombo: +d.bestCombo || 0, maxLines: +d.maxLines || 0 };
  } catch {
    return { top: [], bestCombo: 0, maxLines: 0 };
  }
}

function saveRecords() {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch { /* sin almacenamiento: se ignora */ }
}

// Posición (0-based) que ocuparía la puntuación en el top, o -1 si no entra.
function rankOf(s) {
  if (s <= 0) return -1;
  let i = records.top.findIndex(r => s > r.score);
  if (i < 0) i = records.top.length;
  return i < MAX_RECORDS ? i : -1;
}

function fillTable(tbody, list, hi) {
  tbody.replaceChildren();
  if (!list.length) {
    const td = tbody.insertRow().insertCell();
    td.colSpan = 5;
    td.textContent = 'Sin records';
    return;
  }
  list.forEach((r, i) => {
    const tr = tbody.insertRow();
    if (i === hi) tr.className = 'hl';
    [i + 1, r.name, r.score.toLocaleString(), r.lines, 'x' + r.combo].forEach(v => {
      tr.insertCell().textContent = v; // textContent: el nombre es input del usuario
    });
  });
}

function refreshRecords() {
  startStats.textContent = overStats.textContent =
    `Mejor combo: ${records.bestCombo} · Líneas máx: ${records.maxLines}`;
  fillTable(startBody, records.top, -1);
  let list = records.top, hi = savedRank;
  if (entryOpen) {
    hi = rankOf(score);
    list = records.top.slice();
    list.splice(hi, 0, { name: '???', score, lines, combo: maxCombo });
    list = list.slice(0, MAX_RECORDS);
  }
  fillTable(overBody, list, hi);
  recordEntry.hidden = !entryOpen;
}

function submitRecord() {
  const rank = rankOf(score);
  if (!entryOpen || rank < 0) return;
  const name = nameInput.value.trim().slice(0, NAME_MAX) || 'Anónimo';
  records.top.splice(rank, 0, { name, score, lines, combo: maxCombo });
  records.top = records.top.slice(0, MAX_RECORDS);
  savedRank = rank;
  entryOpen = false;
  saveRecords();
  refreshRecords();
}

function resetRecords() {
  if (!confirm('¿Borrar todos los records?')) return;
  records = { top: [], bestCombo: 0, maxLines: 0 };
  savedRank = -1;
  saveRecords();
  refreshRecords();
}

function refreshGrid() {
  const isLight = document.body.classList.contains('light');
  gridColor = skin.grid || (isLight ? GRID_COLORS.light : GRID_COLORS.dark);
}

function applyTheme(theme) {
  const isLight = theme === 'light';
  document.body.classList.toggle('light', isLight);
  themeToggle.checked = isLight;
  refreshGrid();
  localStorage.setItem(THEME_KEY, theme);
  if (current) { draw(); drawNext(); }
}

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');
}

function applySkin(id) {
  if (!Object.hasOwn(SKINS, id)) id = 'retro';
  skin = SKINS[id];
  COLORS = skin.colors;
  for (const k in SKINS) document.body.classList.toggle('skin-' + k, k === id);
  skinSelect.value = id;
  refreshGrid();
  localStorage.setItem(SKIN_KEY, id);
  if (current) { draw(); drawNext(); } // repinta también en pausa / game over
}

function initSkin() {
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
  combo = cleared ? combo + 1 : 0;
  maxCombo = Math.max(maxCombo, combo);
  if (cleared) {
    lines += cleared;
    if (cleared === 4) rewardPending = true;
    score += (LINE_SCORES[cleared] || 0) * level;
    applyLevel();
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
  skin.draw(context, x * size, y * size, size, COLORS[colorIndex]);
  context.globalAlpha = 1;
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
  records.bestCombo = Math.max(records.bestCombo, maxCombo);
  records.maxLines = Math.max(records.maxLines, lines);
  entryOpen = rankOf(score) >= 0;
  savedRank = -1;
  nameInput.value = '';
  saveRecords();
  refreshRecords();
  recordsBox.hidden = false;
  overlay.classList.remove('hidden');
  if (entryOpen) nameInput.focus();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  pauseMenu.classList.toggle('hidden', !paused);
  if (!paused) {
    document.activeElement.blur(); // evita que Space reactive el botón enfocado
    ignoreRepeat = true;
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseControls.classList.add('hidden');
    controlsBtn.setAttribute('aria-expanded', 'false');
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
  startLevel = Number(startLevelSel.value); // el select solo aplica a partidas nuevas
  board = createBoard();
  score = 0;
  lines = 0;
  applyLevel();
  paused = false;
  gameOver = false;
  dropAccum = 0;
  rewardPending = false;
  combo = 0;
  maxCombo = 0;
  entryOpen = false;
  savedRank = -1;
  recordsBox.hidden = true;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  document.activeElement.blur();
  ignoreRepeat = true;
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!started || e.target instanceof HTMLInputElement) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    // Esc dentro del select solo cierra su desplegable
    if (!e.repeat && !(e.code === 'Escape' && e.target === startLevelSel)) togglePause();
    return;
  }
  if (paused || gameOver) return;
  if (!e.repeat) ignoreRepeat = false;
  else if (ignoreRepeat) return;
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

restartBtn.addEventListener('click', () => { submitRecord(); init(); }); // no perder un record sin guardar
resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => {
  const hidden = pauseControls.classList.toggle('hidden');
  controlsBtn.setAttribute('aria-expanded', String(!hidden));
});
themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked ? 'light' : 'dark');
});

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // evita que las flechas/teclas sigan cambiando el select
});

playBtn.addEventListener('click', () => {
  started = true;
  startScreen.classList.add('hidden');
  init();
});
saveRecordBtn.addEventListener('click', submitRecord);
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitRecord(); });
document.querySelectorAll('.reset-records-btn').forEach(b => b.addEventListener('click', resetRecords));

records = loadRecords();
refreshRecords();
initTheme();
initSkin();
