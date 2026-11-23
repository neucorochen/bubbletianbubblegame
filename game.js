const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("scoreEl");
const bestEl = document.getElementById("bestEl");
const dropEl = document.getElementById("dropEl");
const dropBar = document.getElementById("dropBar");
const resetBtn = document.getElementById("resetBtn");
const swapBtn = document.getElementById("swapBtn");
const musicBtn = document.getElementById("musicBtn");
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
const NEXT_X = CANNON_X + 98;
const NEXT_Y = CANNON_Y;
const SHOT_SPEED = 14.5;
const SHOTS_PER_DROP = 6;

const COLORS = [
  { main: "#ff3b7f", glow: "#ff9ec4", deep: "#b8004c" }, // малиновый
  { main: "#00b4ff", glow: "#a3ecff", deep: "#005fa3" }, // аквамарин
  { main: "#3be33b", glow: "#c2ff9e", deep: "#0f8a1e" }, // лайм
  { main: "#ffb703", glow: "#fff099", deep: "#c96a00" }, // манго
  { main: "#a663ff", glow: "#e3ccff", deep: "#581c9c" }, // виноград
  { main: "#00e5c3", glow: "#b3fff2", deep: "#008272" }  // мята
];

let grid = [];
let cellPhysics = {};
let rowOffset = 0;
let score = 0;
let bestScore = 0;
let shotsLeft = SHOTS_PER_DROP;
let currentColor = 0;
let nextColor = 1;
let swapAnim = 0;
let aimAngle = -Math.PI / 2;
let bullet = null;
let particles = [];
let fallingBubbles = [];
let gameOver = false;

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

function triggerJelly(r, c, strength = 0.28, dx = 0, dy = 0) {
  const key = `${r},${c}`;
  if (!cellPhysics[key]) {
    cellPhysics[key] = { ox: 0, oy: 0, ovx: 0, ovy: 0, wobble: 0, wv: 0 };
  }
  const p = cellPhysics[key];
  p.ox += dx;
  p.oy += dy;
  p.wv += strength;
}

function rippleNeighbors(r, c, impactVx, impactVy) {
  for (const [nr, nc] of getNeighbors(r, c)) {
    if (grid[nr][nc] !== null) {
      triggerJelly(nr, nc, 0.16, impactVx * 0.35, impactVy * 0.35);
      for (const [nnr, nnc] of getNeighbors(nr, nc)) {
        if ((nnr !== r || nnc !== c) && grid[nnr][nnc] !== null) {
          triggerJelly(nnr, nnc, 0.06, impactVx * 0.12, impactVy * 0.12);
        }
      }
    }
  }
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
  cellPhysics = {};
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
  dropBar.style.width = `${(shotsLeft / SHOTS_PER_DROP) * 100}%`;
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
  cellPhysics = {};
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

// Смена текущего и следующего шарика местами
function swapBubbles() {
  if (bullet || gameOver) return;
  const tmp = currentColor;
  currentColor = nextColor;
  nextColor = tmp;
  swapAnim = 1;
  SoundFX.playBounce();
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
  cellPhysics = {};

  for (let r = 0; r < MAX_ROWS; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== null) {
        triggerJelly(r, c, 0.14, 0, -8);
      }
    }
  }
  SoundFX.playSquelch();
}

function checkGameOver() {
  for (let r = DANGER_ROW; r < MAX_ROWS; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== null) {
        gameOver = true;
        if (score > bestScore) bestScore = score;
        finalScoreText.textContent = `очки: ${score} • рекорд: ${bestScore}`;
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
  const targetCenter = getCellCenter(r, c);
  const dx = bullet.x - targetCenter.x;
  const dy = bullet.y - targetCenter.y;
  const ivx = bullet.vx;
  const ivy = bullet.vy;
  const color = bullet.color;

  grid[r][c] = color;
  bullet = null;

  triggerJelly(r, c, 0.34, dx, dy);
  rippleNeighbors(r, c, ivx, ivy);

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
    cluster.forEach(([cr, cc], idx) => {
      const pos = getCellCenter(cr, cc);
      spawnParticles(pos.x, pos.y, grid[cr][cc]);
      grid[cr][cc] = null;
      delete cellPhysics[`${cr},${cc}`];
      SoundFX.playPop(idx);
    });
    score += cluster.length * 10;

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
          fallingBubbles.push({
            x: pos.x,
            y: pos.y,
            vx: (Math.random() - 0.5) * 3.4,
            vy: -2.4 - Math.random() * 2.2,
            color: grid[rr][cc],
            alpha: 1,
            scale: 1,
            wobblePhase: Math.random() * Math.PI * 2
          });
          grid[rr][cc] = null;
          delete cellPhysics[`${rr},${cc}`];
          dropped++;
        }
      }
    }

    if (dropped > 0) {
      score += dropped * 20;
      SoundFX.playDrop();
    }
  } else {
    SoundFX.playSquelch();
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
  if (swapAnim > 0) swapAnim = Math.max(0, swapAnim - 0.12);

  for (const b of ambientBubbles) {
    b.y -= b.speed;
    b.drift += 0.015;
    b.x += Math.sin(b.drift) * 0.25;
    if (b.y + b.r < 0) {
      b.y = H + b.r;
      b.x = Math.random() * W;
    }
  }

  for (const key in cellPhysics) {
    const p = cellPhysics[key];
    p.ovx += -p.ox * 0.24;
    p.ovy += -p.oy * 0.24;
    p.ovx *= 0.72;
    p.ovy *= 0.72;
    p.ox += p.ovx;
    p.oy += p.ovy;

    p.wv += -p.wobble * 0.28;
    p.wv *= 0.8;
    p.wobble += p.wv;

    if (
      Math.abs(p.ox) < 0.05 &&
      Math.abs(p.oy) < 0.05 &&
      Math.abs(p.ovx) < 0.05 &&
      Math.abs(p.ovy) < 0.05 &&
      Math.abs(p.wobble) < 0.002 &&
      Math.abs(p.wv) < 0.002
    ) {
      delete cellPhysics[key];
    }
  }

  if (bullet) {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;

    bullet.wv += -bullet.wobble * 0.3;
    bullet.wv *= 0.78;
    bullet.wobble += bullet.wv;

    if (bullet.x - R <= 0) {
      bullet.x = R;
      bullet.vx *= -1;
      bullet.wv += 0.32;
      SoundFX.playBounce();
    } else if (bullet.x + R >= W) {
      bullet.x = W - R;
      bullet.vx *= -1;
      bullet.wv += 0.32;
      SoundFX.playBounce();
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

  for (let i = fallingBubbles.length - 1; i >= 0; i--) {
    const fb = fallingBubbles[i];
    fb.x += fb.vx;
    fb.y += fb.vy;
    fb.vy += 0.42;
    fb.alpha -= 0.016;
    fb.scale = Math.max(0.5, fb.scale - 0.005);
    fb.wobblePhase += 0.25;

    if (fb.alpha <= 0 || fb.y - R > H + 40) {
      fallingBubbles.splice(i, 1);
    }
  }

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
  bgGrad.addColorStop(0, "#d9f3ff");
  bgGrad.addColorStop(0.6, "#ebf9ff");
  bgGrad.addColorStop(1, "#d3f5ec");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const sun = ctx.createRadialGradient(W * 0.22, 0, 10, W * 0.22, 0, 260);
  sun.addColorStop(0, "rgba(255, 255, 255, 0.85)");
  sun.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);

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
    g.addColorStop(0, "rgba(255, 255, 255, 0.7)");
    g.addColorStop(0.7, "rgba(255, 255, 255, 0.14)");
    g.addColorStop(1, "rgba(120, 215, 255, 0.28)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.stroke();
    ctx.restore();
  }
}

function drawJellyBubble(x, y, colorIdx, radius = R, alpha = 1, sx = 1, sy = 1, rot = 0) {
  const c = COLORS[colorIdx];
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(x, y);
  if (rot !== 0) ctx.rotate(rot);
  ctx.scale(sx, sy);

  ctx.beginPath();
  ctx.arc(0, 2, radius - 1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 65, 110, 0.16)";
  ctx.fill();

  const bodyGrad = ctx.createRadialGradient(
    -radius * 0.25,
    -radius * 0.3,
    radius * 0.15,
    0,
    0,
    radius
  );
  bodyGrad.addColorStop(0, c.glow);
  bodyGrad.addColorStop(0.55, c.main);
  bodyGrad.addColorStop(1, c.deep);

  ctx.beginPath();
  ctx.arc(0, 0, radius - 1.2, 0, Math.PI * 2);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  const bounceGrad = ctx.createRadialGradient(
    radius * 0.2,
    radius * 0.45,
    1,
    radius * 0.2,
    radius * 0.45,
    radius * 0.7
  );
  bounceGrad.addColorStop(0, "rgba(255, 255, 255, 0.65)");
  bounceGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.beginPath();
  ctx.arc(0, 0, radius - 1.5, 0, Math.PI * 2);
  ctx.fillStyle = bounceGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, -radius * 0.38, radius * 0.56, radius * 0.32, 0, 0, Math.PI * 2);
  const shineGrad = ctx.createLinearGradient(0, -radius * 0.72, 0, 0);
  shineGrad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  shineGrad.addColorStop(1, "rgba(255, 255, 255, 0.05)");
  ctx.fillStyle = shineGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(-radius * 0.34, -radius * 0.34, radius * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, radius - 1.2, 0, Math.PI * 2);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.stroke();

  ctx.restore();
}

// Точная траектория полёта с отскоками от стен и точкой попадания
function drawAimLine() {
  if (bullet || gameOver) return;

  let x = CANNON_X;
  let y = CANNON_Y;
  let vx = Math.cos(aimAngle);
  let vy = Math.sin(aimAngle);
  const step = 4;

  const points = [{ x, y }];
  const bounces = [];

  for (let i = 0; i < 360; i++) {
    x += vx * step;
    y += vy * step;

    if (x - R <= 0) {
      x = R;
      vx *= -1;
      points.push({ x, y });
      bounces.push({ x, y });
    } else if (x + R >= W) {
      x = W - R;
      vx *= -1;
      points.push({ x, y });
      bounces.push({ x, y });
    }

    let hit = y - R <= 0;
    if (!hit) {
      outer: for (let r = 0; r < MAX_ROWS; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c] === null) continue;
          const center = getCellCenter(r, c);
          if (Math.hypot(x - center.x, y - center.y) < R * 1.82) {
            hit = true;
            break outer;
          }
        }
      }
    }

    if (hit) {
      points.push({ x, y });
      break;
    }
  }

  const col = COLORS[currentColor].main;

  ctx.save();
  // Белая обводка пунктира для чёткости
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([7, 9]);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  points.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
  ctx.stroke();

  // Цветная линия траектории
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  points.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
  ctx.stroke();
  ctx.setLineDash([]);

  // Точки отскока от стен
  for (const b of bounces) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = col;
    ctx.stroke();
  }

  // Призрачный контур шарика в конечной точке попадания
  const end = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(end.x, end.y, R - 2, 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.globalAlpha = 0.2;
  ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 2;
  ctx.strokeStyle = col;
  ctx.stroke();
  ctx.restore();
}

function drawCannon() {
  ctx.save();
  ctx.translate(CANNON_X, CANNON_Y);
  ctx.rotate(aimAngle + Math.PI / 2);
  const barrelGrad = ctx.createLinearGradient(-13, 0, 13, 0);
  barrelGrad.addColorStop(0, "#7cd4ff");
  barrelGrad.addColorStop(0.5, "#ffffff");
  barrelGrad.addColorStop(1, "#4aa8e0");
  ctx.fillStyle = barrelGrad;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-12, -40, 24, 40, 8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

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

  ctx.save();
  ctx.strokeStyle = "rgba(255, 70, 120, 0.45)";
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
        const p = cellPhysics[`${r},${c}`];
        const ox = p ? p.ox : 0;
        const oy = p ? p.oy : 0;
        const w = p ? p.wobble : 0;
        drawJellyBubble(pos.x + ox, pos.y + oy, grid[r][c], R, 1, 1 + w, 1 - w, 0);
      }
    }
  }

  for (const fb of fallingBubbles) {
    const w = Math.sin(fb.wobblePhase) * 0.1;
    drawJellyBubble(fb.x, fb.y, fb.color, R * fb.scale, fb.alpha, 1 + w, 1 - w, 0);
  }

  drawAimLine();
  drawCannon();

  // Текущий шарик в пушке (с лёгким пружинным эффектом при смене)
  if (!bullet) {
    const s = 1 + Math.sin(swapAnim * Math.PI) * 0.16;
    drawJellyBubble(CANNON_X, CANNON_Y, currentColor, R - 2, 1, s, 2 - s, 0);
  }

  // Следующий шарик (кликабельный для смены)
  ctx.save();
  ctx.beginPath();
  ctx.arc(NEXT_X, NEXT_Y, 21, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#8bc8e8";
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#0b3a63";
  ctx.font = "italic 700 12px Segoe UI";
  ctx.fillText("след. ⇄", CANNON_X + 34, CANNON_Y + 4);
  drawJellyBubble(NEXT_X, NEXT_Y, nextColor, 14);

  if (bullet) {
    const moveAngle = Math.atan2(bullet.vy, bullet.vx);
    const sx = 1.09 + bullet.wobble;
    const sy = 0.91 - bullet.wobble;
    drawJellyBubble(bullet.x, bullet.y, bullet.color, R, 1, sx, sy, moveAngle);
  }

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

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * W,
    y: ((e.clientY - rect.top) / rect.height) * H
  };
}

function setAimFromPointer(e) {
  const { x, y } = getCanvasCoords(e);
  let angle = Math.atan2(y - CANNON_Y, x - CANNON_X);
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
    color: currentColor,
    wobble: 0,
    wv: 0.18
  };
  currentColor = nextColor;
  nextColor = pickColor();
  SoundFX.playShoot();
}

canvas.addEventListener("pointermove", setAimFromPointer);

canvas.addEventListener("pointerdown", (e) => {
  if (e.button === 2) {
    swapBubbles();
    return;
  }
  const { x, y } = getCanvasCoords(e);
  // Клик по кружку со следующим шариком меняет шарики местами вместо выстрела
  if (Math.hypot(x - NEXT_X, y - NEXT_Y) <= 24) {
    swapBubbles();
    return;
  }
  setAimFromPointer(e);
  shoot();
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    swapBubbles();
  }
});

swapBtn.addEventListener("click", swapBubbles);
resetBtn.addEventListener("click", startNewGame);
playAgainBtn.addEventListener("click", startNewGame);

musicBtn.addEventListener("click", async () => {
  const isOn = await BgMusic.toggle();
  musicBtn.textContent = isOn ? "🎵 музыка: вкл" : "🎵 музыка: выкл";
  musicBtn.classList.toggle("is-on", isOn);
});

if (!loadState()) {
  startNewGame();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
