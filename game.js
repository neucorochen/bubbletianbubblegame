const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("scoreEl");
const bestEl = document.getElementById("bestEl");
const levelEl = document.getElementById("levelEl");
const dropEl = document.getElementById("dropEl");
const resetBtn = document.getElementById("resetBtn");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const finalScoreText = document.getElementById("finalScoreText");
const playAgainBtn = document.getElementById("playAgainBtn");

const W = canvas.width;
const H = canvas.height;
const R = 20;
const ROW_H = R * Math.sqrt(3);
const MAX_ROWS = 16;
const DANGER_ROW = 13;
const DANGER_Y = DANGER_ROW * ROW_H + R;
const CANNON_X = W / 2;
const CANNON_Y = H - 48;
const SHOT_SPEED = 14;
const SHOTS_PER_DROP = 6;

const COLORS = [
  { main: "#ff4d6d", light: "#ffb3c1", dark: "#a4133c" }, // красный
  { main: "#3a86ff", light: "#a8d0ff", dark: "#1d4e89" }, // синий
  { main: "#38b000", light: "#b7efc5", dark: "#1b5e20" }, // зелёный
  { main: "#ffbe0b", light: "#fff3b0", dark: "#b5651d" }, // жёлтый
  { main: "#9b5de5", light: "#e0c3fc", dark: "#5a189a" }, // фиолетовый
  { main: "#00bbf9", light: "#b8f2ff", dark: "#006494" }  // голубой
];

let grid = [];
let rowOffset = 0;
let score = 0;
let bestScore = 0;
let level = 1;
let shotsLeft = SHOTS_PER_DROP;
let currentColor = 0;
let nextColor = 1;
let aimAngle = -Math.PI / 2;
let bullet = null;
let particles = [];
let gameOver = false;

function isShifted(r) {
  return (r + rowOffset) % 2 !== 0;
}

function getCols(r) {
  return isShifted(r) ? 11 : 12;
}

function getCellCenter(r, c) {
  return {
    x: c * (R * 2) + R + (isShifted(r) ? R : 0),
    y: r * ROW_H + R
  };
}

function getNeighbors(r, c) {
  const shifted = isShifted(r);
  const dirs = shifted
    ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]]
    : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];

  const res = [];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < MAX_ROWS && nc >= 0 && nc < getCols(nr)) {
      res.push([nr, nc]);
    }
  }
  return res;
}

function createEmptyRow(r) {
  return Array(getCols(r)).fill(null);
}

function getActiveColors() {
  const set = new Set();
  for (let r = 0; r < MAX_ROWS; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== null) set.add(grid[r][c]);
    }
  }
  return set.size > 0 ? Array.from(set) : COLORS.map((_, i) => i);
}

function pickColor() {
  const active = getActiveColors();
  return active[Math.floor(Math.random() * active.length)];
}

function randomRowColor() {
  const poolSize = Math.min(COLORS.length, 4 + Math.floor((level - 1) / 2));
  return Math.floor(Math.random() * poolSize);
}

function fillInitialRows(count = 5) {
  grid = [];
  for (let r = 0; r < MAX_ROWS; r++) {
    const row = createEmptyRow(r);
    if (r < count) {
      for (let c = 0; c < row.length; c++) {
        row[c] = randomRowColor();
      }
    }
    grid.push(row);
  }
}

function updateHUD() {
  scoreEl.textContent = score;
  bestEl.textContent = bestScore;
  levelEl.textContent = level;
  dropEl.textContent = shotsLeft;
}

function saveState() {
  if (score > bestScore) bestScore = score;
  GameStorage.save({
    score,
    bestScore,
    level,
    shotsLeft,
    rowOffset,
    currentColor,
    nextColor,
    grid,
    gameOver
  });
}

function loadState() {
  const data = GameStorage.load();
  if (!data) return false;

  bestScore = data.bestScore || 0;
  if (data.gameOver || !Array.isArray(data.grid) || data.grid.length !== MAX_ROWS) {
    return false;
  }

  score = data.score || 0;
  level = data.level || 1;
  shotsLeft = data.shotsLeft || SHOTS_PER_DROP;
  rowOffset = data.rowOffset || 0;
  grid = data.grid;
  currentColor = data.currentColor ?? pickColor();
  nextColor = data.nextColor ?? pickColor();
  gameOver = false;
  updateHUD();
  return true;
}

function startNewGame() {
  score = 0;
  level = 1;
  rowOffset = 0;
  shotsLeft = SHOTS_PER_DROP;
  bullet = null;
  particles = [];
  gameOver = false;
  gameOverOverlay.classList.remove("show");
  fillInitialRows(5);
  currentColor = pickColor();
  nextColor = pickColor();
  updateHUD();
  saveState();
}

function spawnParticles(x, y, colorIdx) {
  const col = COLORS[colorIdx].main;
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1.5 + Math.random() * 3.5;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: 3 + Math.random() * 4,
      color: col,
      life: 1
    });
  }
}

function addNewRowAtTop() {
  rowOffset = 1 - rowOffset;
  const newRow = Array(getCols(0)).fill(null).map(() => randomRowColor());
  grid.unshift(newRow);
  grid.pop();
}

function checkGameOver() {
  for (let r = DANGER_ROW; r < MAX_ROWS; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== null) {
        gameOver = true;
        if (score > bestScore) bestScore = score;
        finalScoreText.textContent = `Очки: ${score} | Рекорд: ${bestScore}`;
        gameOverOverlay.classList.add("show");
        updateHUD();
        saveState();
        return true;
      }
    }
  }
  return false;
}

function checkBoardCleared() {
  for (let r = 0; r < MAX_ROWS; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== null) return false;
    }
  }
  score += 500;
  level += 1;
  shotsLeft = SHOTS_PER_DROP;
  fillInitialRows(Math.min(7, 4 + Math.floor(level / 2)));
  return true;
}

function snapBullet() {
  let bestCell = null;
  let bestDist = Infinity;

  for (let r = 0; r < MAX_ROWS; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== null) continue;
      const hasNeighbor = r === 0 || getNeighbors(r, c).some(([nr, nc]) => grid[nr][nc] !== null);
      if (!hasNeighbor) continue;

      const center = getCellCenter(r, c);
      const dist = Math.hypot(bullet.x - center.x, bullet.y - center.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestCell = [r, c];
      }
    }
  }

  if (!bestCell) {
    bullet = null;
    return;
  }

  const [r, c] = bestCell;
  const color = bullet.color;
  grid[r][c] = color;
  bullet = null;

  // Поиск группы одного цвета (BFS)
  const visited = new Set([`${r},${c}`]);
  const cluster = [[r, c]];
  const queue = [[r, c]];

  while (queue.length > 0) {
    const [cr, cc] = queue.shift();
    for (const [nr, nc] of getNeighbors(cr, cc)) {
      const key = `${nr},${nc}`;
      if (!visited.has(key) && grid[nr][nc] === color) {
        visited.add(key);
        cluster.push([nr, nc]);
        queue.push([nr, nc]);
      }
    }
  }

  if (cluster.length >= 3) {
    for (const [cr, cc] of cluster) {
      const pos = getCellCenter(cr, cc);
      spawnParticles(pos.x, pos.y, grid[cr][cc]);
      grid[cr][cc] = null;
    }
    score += cluster.length * 10;

    // Поиск «висящих» шаров
    const anchored = new Set();
    const aQueue = [];
    for (let col = 0; col < grid[0].length; col++) {
      if (grid[0][col] !== null) {
        anchored.add(`0,${col}`);
        aQueue.push([0, col]);
      }
    }

    while (aQueue.length > 0) {
      const [ar, ac] = aQueue.shift();
      for (const [nr, nc] of getNeighbors(ar, ac)) {
        const key = `${nr},${nc}`;
        if (!anchored.has(key) && grid[nr][nc] !== null) {
          anchored.add(key);
          aQueue.push([nr, nc]);
        }
      }
    }

    let dropped = 0;
    for (let rr = 0; rr < MAX_ROWS; rr++) {
      for (let cc = 0; cc < grid[rr].length; cc++) {
        if (grid[rr][cc] !== null && !anchored.has(`${rr},${cc}`)) {
          const pos = getCellCenter(rr, cc);
          spawnParticles(pos.x, pos.y, grid[rr][cc]);
          grid[rr][cc] = null;
          dropped++;
        }
      }
    }
    score += dropped * 20;
  } else {
    shotsLeft--;
    if (shotsLeft <= 0) {
      addNewRowAtTop();
      shotsLeft = SHOTS_PER_DROP;
    }
  }

  if (score > bestScore) bestScore = score;
  checkBoardCleared();

  const active = getActiveColors();
  if (!active.includes(currentColor)) currentColor = pickColor();
  if (!active.includes(nextColor)) nextColor = pickColor();

  updateHUD();
  if (!checkGameOver()) {
    saveState();
  }
}

function update() {
  if (bullet) {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;

    if (bullet.x - R <= 0) {
      bullet.x = R;
      bullet.vx *= -1;
    } else if (bullet.x + R >= W) {
      bullet.x = W - R;
      bullet.vx *= -1;
    }

    let collided = bullet.y - R <= 0;
    if (!collided) {
      outer: for (let r = 0; r < MAX_ROWS; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c] === null) continue;
          const center = getCellCenter(r, c);
          if (Math.hypot(bullet.x - center.x, bullet.y - center.y) < R * 1.82) {
            collided = true;
            break outer;
          }
        }
      }
    }

    if (collided) snapBullet();
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life -= 0.03;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawBubble(x, y, colorIdx, radius = R) {
  const c = COLORS[colorIdx];
  const grad = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.35,
    radius * 0.1,
    x,
    y,
    radius
  );
  grad.addColorStop(0, c.light);
  grad.addColorStop(0.45, c.main);
  grad.addColorStop(1, c.dark);

  ctx.beginPath();
  ctx.arc(x, y, radius - 1, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(
    x - radius * 0.3,
    y - radius * 0.32,
    radius * 0.28,
    radius * 0.16,
    -Math.PI / 4,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.fill();
}

function drawAimLine() {
  if (bullet || gameOver) return;
  let x = CANNON_X;
  let y = CANNON_Y;
  let vx = Math.cos(aimAngle);
  let vy = Math.sin(aimAngle);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(x, y);

  for (let i = 0; i < 420; i += 6) {
    x += vx * 6;
    y += vy * 6;
    if (x - R <= 0 || x + R >= W) {
      vx *= -1;
      x = Math.max(R, Math.min(W - R, x));
    }
    ctx.lineTo(x, y);
    if (y <= R) break;
  }
  ctx.stroke();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 77, 109, 0.55)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, DANGER_Y);
  ctx.lineTo(W, DANGER_Y);
  ctx.stroke();
  ctx.restore();

  for (let r = 0; r < MAX_ROWS; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== null) {
        const pos = getCellCenter(r, c);
        drawBubble(pos.x, pos.y, grid[r][c]);
      }
    }
  }

  drawAimLine();

  ctx.save();
  ctx.translate(CANNON_X, CANNON_Y);
  ctx.rotate(aimAngle + Math.PI / 2);
  ctx.fillStyle = "#d9e8ff";
  ctx.fillRect(-12, -38, 24, 38);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(CANNON_X, CANNON_Y, 26, 0, Math.PI * 2);
  ctx.fillStyle = "#264673";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#8ecae6";
  ctx.stroke();

  if (!bullet) {
    drawBubble(CANNON_X, CANNON_Y, currentColor, R - 2);
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "12px Segoe UI";
  ctx.fillText("След.:", CANNON_X + 46, CANNON_Y + 4);
  drawBubble(CANNON_X + 96, CANNON_Y, nextColor, 14);

  if (bullet) {
    drawBubble(bullet.x, bullet.y, bullet.color);
  }

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function setAimFromPointer(e) {
  const rect = canvas.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * W;
  const py = ((e.clientY - rect.top) / rect.height) * H;
  let angle = Math.atan2(py - CANNON_Y, px - CANNON_X);
  if (angle > -0.15) angle = -0.15;
  if (angle < -Math.PI + 0.15) angle = -Math.PI + 0.15;
  aimAngle = angle;
}

function shoot() {
  if (bullet || gameOver) return;
  bullet = {
    x: CANNON_X,
    y: CANNON_Y,
    vx: Math.cos(aimAngle) * SHOT_SPEED,
    vy: Math.sin(aimAngle) * SHOT_SPEED,
    color: currentColor
  };
  currentColor = nextColor;
  nextColor = pickColor();
}

canvas.addEventListener("pointermove", setAimFromPointer);
canvas.addEventListener("pointerdown", (e) => {
  setAimFromPointer(e);
  shoot();
});

resetBtn.addEventListener("click", startNewGame);
playAgainBtn.addEventListener("click", startNewGame);

if (!loadState()) {
  startNewGame();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
