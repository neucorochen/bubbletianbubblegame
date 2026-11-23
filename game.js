const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("scoreEl");
const bestEl = document.getElementById("bestEl");
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

// Сочные желейные цвета в палитре Frutiger Aero
const COLORS = [
  { main: "#ff3b7f", glow: "#ff9ec4", deep: "#b8004c" }, // малиновый
  { main: "#00b4ff", glow: "#a3ecff", deep: "#005fa3" }, // аквамарин
  { main: "#3be33b", glow: "#c2ff9e", deep: "#0f8a1e" }, // лайм
  { main: "#ffb703", glow: "#fff099", deep: "#c96a00" }, // манго
  { main: "#a663ff", glow: "#e3ccff", deep: "#581c9c" }, // виноград
  { main: "#00e5c3", glow: "#b3fff2", deep: "#008272" }  // мята
];

let grid = [];
let rowOffset = 0;
let score = 0;
let bestScore = 0;
let shotsLeft = SHOTS_PER_DROP;
let currentColor = 0;
let nextColor = 1;
let aimAngle = -Math.PI / 2;
let bullet = null;
let particles = [];
let fallingBubbles = [];
let gameOver = false;

// Фоновые парящие пузырьки внутри поля
const ambientBubbles = Array.from({ length: 14 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  r: 8 + Math.random() * 18,
  speed: 0.25 + Math.random() * 0.45,
  drift: Math.random() * Math.PI * 2
}));

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
  return Math.floor(Math.random() * COLORS.length);
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
  dropEl.textContent = shotsLeft;
}

function saveState() {
  if (score > bestScore) bestScore = score;
  GameStorage.save({
    score,
    bestScore,
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
  rowOffset = 0;
  shotsLeft = SHOTS_PER_DROP;
  bullet = null;
  particles = [];
  fallingBubbles = [];
  gameOver = false;
  gameOverOverlay.classList.remove("show");
  fillInitialRows(5);
  currentColor = pickColor();
  nextColor = pickColor();
  updateHUD();
  saveState();
}

function spawnParticles(x, y, colorIdx) {
  const col = COLORS[colorIdx];
  for (let i = 0; i < 9; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1.6 + Math.random() * 3.8;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: 3 + Math.random() * 4.5,
      color: i % 2 === 0 ? col.main : col.glow,
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
        finalScoreText.textContent = `Очки: ${score} • Рекорд: ${bestScore}`;
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
  // Бесконечная игра без уровней: очистил поле — получил бонус и новые ряды
  score += 500;
  shotsLeft = SHOTS_PER_DROP;
  fillInitialRows(5);
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

  // Поиск группы одного цвета
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

    // Поиск оторвавшихся шаров (любых цветов), которые не держатся за верх
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
          // Отправляем шар в красивое падение вниз с плавным исчезновением
          fallingBubbles.push({
            x: pos.x,
            y: pos.y,
            vx: (Math.random() - 0.5) * 3.2,
            vy: -2.2 - Math.random() * 2.2,
            color: grid[rr][cc],
            alpha: 1,
            scale: 1
          });
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
  // Движение фоновых пузырьков
  for (const b of ambientBubbles) {
    b.y -= b.speed;
    b.drift += 0.015;
    b.x += Math.sin(b.drift) * 0.25;
    if (b.y + b.r < 0) {
      b.y = H + b.r;
      b.x = Math.random() * W;
    }
  }

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

  // Анимация падающих оторвавшихся шариков
  for (let i = fallingBubbles.length - 1; i >= 0; i--) {
    const fb = fallingBubbles[i];
    fb.x += fb.vx;
    fb.y += fb.vy;
    fb.vy += 0.42; // гравитация
    fb.alpha -= 0.016;
    fb.scale = Math.max(0.5, fb.scale - 0.005);

    if (fb.alpha <= 0 || fb.y - R > H + 40) {
      fallingBubbles.splice(i, 1);
    }
  }

  // Частицы лопанья
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life -= 0.032;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawCanvasBackground() {
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "rgba(215, 247, 255, 0.72)");
  bgGrad.addColorStop(0.65, "rgba(180, 240, 255, 0.45)");
  bgGrad.addColorStop(1, "rgba(155, 245, 195, 0.58)");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Мягкое солнечное сияние сверху
  const sun = ctx.createRadialGradient(W * 0.25, 0, 10, W * 0.25, 0, 260);
  sun.addColorStop(0, "rgba(255, 255, 255, 0.75)");
  sun.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);

  // Парящие мыльные пузырьки
  for (const b of ambientBubbles) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(
      b.x - b.r * 0.3,
      b.y - b.r * 0.3,
      1,
      b.x,
      b.y,
      b.r
    );
    g.addColorStop(0, "rgba(255, 255, 255, 0.65)");
    g.addColorStop(0.7, "rgba(255, 255, 255, 0.12)");
    g.addColorStop(1, "rgba(140, 230, 255, 0.28)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.stroke();
    ctx.restore();
  }
}

// Желейный глянцевый шарик
function drawJellyBubble(x, y, colorIdx, radius = R, alpha = 1) {
  const c = COLORS[colorIdx];
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);

  // Мягкая тень под шариком
  ctx.beginPath();
  ctx.arc(x, y + 2, radius - 1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 65, 110, 0.16)";
  ctx.fill();

  // Основное полупрозрачное желейное тело
  const bodyGrad = ctx.createRadialGradient(
    x - radius * 0.25,
    y - radius * 0.3,
    radius * 0.15,
    x,
    y,
    radius
  );
  bodyGrad.addColorStop(0, c.glow);
  bodyGrad.addColorStop(0.55, c.main);
  bodyGrad.addColorStop(1, c.deep);

  ctx.beginPath();
  ctx.arc(x, y, radius - 1.2, 0, Math.PI * 2);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Внутреннее нижнее свечение (эффект просвечивающего желе)
  const bounceGrad = ctx.createRadialGradient(
    x + radius * 0.2,
    y + radius * 0.45,
    1,
    x + radius * 0.2,
    y + radius * 0.45,
    radius * 0.7
  );
  bounceGrad.addColorStop(0, "rgba(255, 255, 255, 0.65)");
  bounceGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.beginPath();
  ctx.arc(x, y, radius - 1.5, 0, Math.PI * 2);
  ctx.fillStyle = bounceGrad;
  ctx.fill();

  // Крупный глянцевый верхний блик (Aqua / Jelly shine)
  ctx.beginPath();
  ctx.ellipse(
    x,
    y - radius * 0.38,
    radius * 0.56,
    radius * 0.32,
    0,
    0,
    Math.PI * 2
  );
  const shineGrad = ctx.createLinearGradient(x, y - radius * 0.72, x, y);
  shineGrad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  shineGrad.addColorStop(1, "rgba(255, 255, 255, 0.05)");
  ctx.fillStyle = shineGrad;
  ctx.fill();

  // Маленькая яркая точка-блик
  ctx.beginPath();
  ctx.arc(x - radius * 0.34, y - radius * 0.34, radius * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fill();

  // Стеклянная каёмка
  ctx.beginPath();
  ctx.arc(x, y, radius - 1.2, 0, Math.PI * 2);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.stroke();

  ctx.restore();
}

function drawAimLine() {
  if (bullet || gameOver) return;
  let x = CANNON_X;
  let y = CANNON_Y;
  let vx = Math.cos(aimAngle);
  let vy = Math.sin(aimAngle);

  ctx.save();
  ctx.strokeStyle = "rgba(0, 120, 190, 0.55)";
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 8]);
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

function drawCannon() {
  // Ствол в глянцевом серебристо-голубом стиле
  ctx.save();
  ctx.translate(CANNON_X, CANNON_Y);
  ctx.rotate(aimAngle + Math.PI / 2);
  const barrelGrad = ctx.createLinearGradient(-13, 0, 13, 0);
  barrelGrad.addColorStop(0, "#7cd4ff");
  barrelGrad.addColorStop(0.5, "#ffffff");
  barrelGrad.addColorStop(1, "#4aa8e0");
  ctx.fillStyle = barrelGrad;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-12, -40, 24, 40, 8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Основание пушки
  const baseGrad = ctx.createRadialGradient(
    CANNON_X - 8,
    CANNON_Y - 10,
    4,
    CANNON_X,
    CANNON_Y,
    28
  );
  baseGrad.addColorStop(0, "#ffffff");
  baseGrad.addColorStop(0.5, "#7be3ff");
  baseGrad.addColorStop(1, "#0088cc");

  ctx.beginPath();
  ctx.arc(CANNON_X, CANNON_Y, 27, 0, Math.PI * 2);
  ctx.fillStyle = baseGrad;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.stroke();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawCanvasBackground();

  // Линия границы
  ctx.save();
  ctx.strokeStyle = "rgba(255, 70, 120, 0.45)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, DANGER_Y);
  ctx.lineTo(W, DANGER_Y);
  ctx.stroke();
  ctx.restore();

  // Сетка шаров
  for (let r = 0; r < MAX_ROWS; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== null) {
        const pos = getCellCenter(r, c);
        drawJellyBubble(pos.x, pos.y, grid[r][c]);
      }
    }
  }

  // Падающие оторвавшиеся шарики
  for (const fb of fallingBubbles) {
    drawJellyBubble(fb.x, fb.y, fb.color, R * fb.scale, fb.alpha);
  }

  drawAimLine();
  drawCannon();

  // Текущий и следующий шарики
  if (!bullet) {
    drawJellyBubble(CANNON_X, CANNON_Y, currentColor, R - 2);
  }
  ctx.fillStyle = "#0b4f75";
  ctx.font = "600 12px Segoe UI";
  ctx.fillText("След.:", CANNON_X + 46, CANNON_Y + 4);
  drawJellyBubble(CANNON_X + 98, CANNON_Y, nextColor, 14);

  if (bullet) {
    drawJellyBubble(bullet.x, bullet.y, bullet.color);
  }

  // Частицы лопанья
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  }
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
