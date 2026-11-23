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

// Фруктовая мармеладная палитра (сочная, полупрозрачная, с тёплым свечением)
const COLORS = [
  { main: "#ff3366", core: "#ff99b8", rim: "#b50038", tint: "rgba(255, 190, 210, 0.75)" }, // клубничный
  { main: "#0099ff", core: "#8ee6ff", rim: "#004e9e", tint: "rgba(180, 240, 255, 0.75)" }, // голубичный
  { main: "#34d62e", core: "#c2ff85", rim: "#0f7a18", tint: "rgba(215, 255, 180, 0.75)" }, // яблочный
  { main: "#ff9900", core: "#ffe67a", rim: "#bd4f00", tint: "rgba(255, 240, 175, 0.75)" }, // апельсиновый
  { main: "#9c4dff", core: "#e0b8ff", rim: "#4d1199", tint: "rgba(232, 205, 255, 0.75)" }, // виноградный
  { main: "#00d4b0", core: "#a8fff0", rim: "#007362", tint: "rgba(195, 255, 245, 0.75)" }  // мятный
];

// --- ОПТИМИЗАЦИЯ: предрендер спрайтов (рисуем один раз при старте) ---
const SPRITE_SIZE = 96;
const bubbleSprites = [];
let ambientSprite = null;
let bgCanvas = null;

function createGummySprite(colorObj) {
  const c = document.createElement("canvas");
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const g = c.getContext("2d");
  const cx = SPRITE_SIZE / 2;
  const cy = SPRITE_SIZE / 2;
  const rad = 40;

  // 1. Мягкая цветная тень (как от полупрозрачного мармелада)
  g.save();
  g.beginPath();
  g.arc(cx, cy + 4, rad, 0, Math.PI * 2);
  g.fillStyle = colorObj.rim;
  g.globalAlpha = 0.22;
  g.fill();
  g.restore();

  // 2. Основное полупрозрачное мармеладное тело
  g.save();
  g.beginPath();
  g.arc(cx, cy, rad, 0, Math.PI * 2);
  g.clip();

  const baseGrad = g.createRadialGradient(cx, cy - rad * 0.2, rad * 0.1, cx, cy, rad);
  baseGrad.addColorStop(0, colorObj.core);
  baseGrad.addColorStop(0.55, colorObj.main);
  baseGrad.addColorStop(1, colorObj.rim);
  g.fillStyle = baseGrad;
  g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  // 3. Эффект просвечивания света снизу (subsurface scattering)
  const subGrad = g.createRadialGradient(
    cx,
    cy + rad * 0.55,
    rad * 0.05,
    cx,
    cy + rad * 0.45,
    rad * 0.78
  );
  subGrad.addColorStop(0, colorObj.tint);
  subGrad.addColorStop(0.55, colorObj.core);
  subGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  g.globalAlpha = 0.75;
  g.fillStyle = subGrad;
  g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  // 4. Мягкое внутреннее затенение сверху по краю для объёма
  g.globalAlpha = 1;
  const innerRim = g.createRadialGradient(cx, cy + rad * 0.1, rad * 0.62, cx, cy, rad);
  innerRim.addColorStop(0, "rgba(255, 255, 255, 0)");
  innerRim.addColorStop(0.85, "rgba(255, 255, 255, 0.15)");
  innerRim.addColorStop(1, "rgba(255, 255, 255, 0.55)");
  g.fillStyle = innerRim;
  g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  // 5. Глянцевый влажный верхний блик (форма фасолины)
  g.beginPath();
  g.ellipse(cx - rad * 0.05, cy - rad * 0.42, rad * 0.54, rad * 0.28, -0.1, 0, Math.PI * 2);
  const topShine = g.createLinearGradient(cx, cy - rad * 0.72, cx, cy - rad * 0.12);
  topShine.addColorStop(0, "rgba(255, 255, 255, 0.92)");
  topShine.addColorStop(0.65, "rgba(255, 255, 255, 0.25)");
  topShine.addColorStop(1, "rgba(255, 255, 255, 0)");
  g.fillStyle = topShine;
  g.fill();

  // 6. Маленькая яркая «мокрая» искра-блик
  g.beginPath();
  g.ellipse(cx - rad * 0.36, cy - rad * 0.36, rad * 0.16, rad * 0.1, -0.6, 0, Math.PI * 2);
  g.fillStyle = "rgba(255, 255, 255, 0.98)";
  g.fill();

  // 7. Тонкий нижний рефлекс
  g.beginPath();
  g.ellipse(cx + rad * 0.18, cy + rad * 0.62, rad * 0.32, rad * 0.1, -0.2, 0, Math.PI * 2);
  g.fillStyle = "rgba(255, 255, 255, 0.45)";
  g.fill();

  g.restore();

  // 8. Аккуратная стеклянная кромка
  g.beginPath();
  g.arc(cx, cy, rad - 0.5, 0, Math.PI * 2);
  g.lineWidth = 1.6;
  g.strokeStyle = "rgba(255, 255, 255, 0.52)";
  g.stroke();

  return c;
}

function initCachedSprites() {
  for (let i = 0; i < COLORS.length; i++) {
    bubbleSprites.push(createGummySprite(COLORS[i]));
  }

  // Спрайт фонового мыльного пузырька
  ambientSprite = document.createElement("canvas");
  ambientSprite.width = 64;
  ambientSprite.height = 64;
  const ag = ambientSprite.getContext("2d");
  const grad = ag.createRadialGradient(22, 22, 2, 32, 32, 28);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.75)");
  grad.addColorStop(0.7, "rgba(255, 255, 255, 0.12)");
  grad.addColorStop(1, "rgba(120, 215, 255, 0.32)");
  ag.beginPath();
  ag.arc(32, 32, 28, 0, Math.PI * 2);
  ag.fillStyle = grad;
  ag.fill();
  ag.lineWidth = 1.5;
  ag.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ag.stroke();

  // Предрендер статичного фона игрового поля
  bgCanvas = document.createElement("canvas");
  bgCanvas.width = W;
  bgCanvas.height = H;
  const bg = bgCanvas.getContext("2d");
  const bgGrad = bg.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "#d9f3ff");
  bgGrad.addColorStop(0.6, "#ebf9ff");
  bgGrad.addColorStop(1, "#d3f5ec");
  bg.fillStyle = bgGrad;
  bg.fillRect(0, 0, W, H);

  const sun = bg.createRadialGradient(W * 0.22, 0, 10, W * 0.22, 0, 260);
  sun.addColorStop(0, "rgba(255, 255, 255, 0.85)");
  sun.addColorStop(1, "rgba(255, 255, 255, 0)");
  bg.fillStyle = sun;
  bg.fillRect(0, 0, W, H);
}

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
let isRefilling = false;

const ambientBubbles = Array.from({ length: 10 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  r: 10 + Math.random() * 16,
  speed: 0.25 + Math.random() * 0.4,
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

// Плавное заполнение поля сверху вниз
function fillInitialRows(count = 5, animate = true) {
  grid = [];
  cellPhysics = {};
  for (let r = 0; r < MAX_ROWS; r++) {
    const row = createEmptyRow(r);
    if (r < count) {
      for (let c = 0; c < row.length; c++) {
        row[c] = randomRowColor();
        if (animate) {
          // Стартуют выше экрана с небольшой задержкой по рядам и столбцам
          const startOffsetY = -(count * ROW_H + 55) - (count - r) * 18 - c * 4;
          cellPhysics[`${r},${c}`] = {
            ox: 0,
            oy: startOffsetY,
            ovx: 0,
            ovy: 0,
            wobble: 0,
            wv: 0.12,
            slidingIn: true
          };
        }
      }
    }
    grid.push(row);
  }
  if (animate) {
    isRefilling = true;
    SoundFX.playSquelch();
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
  fillInitialRows(5, true);
  currentColor = pickColor();
  nextColor = pickColor();
  updateHUD();
  saveState();
}

function swapBubbles() {
  if (bullet || gameOver || isRefilling) return;
  const tmp = currentColor;
  currentColor = nextColor;
  nextColor = tmp;
  swapAnim = 1;
  SoundFX.playBounce();
  saveState();
}

function spawnParticles(x, y, colorIdx) {
  const col = COLORS[colorIdx];
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1.6 + Math.random() * 3.6;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: 3 + Math.random() * 4,
      color: i % 2 === 0 ? col.main : col.core,
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
        triggerJelly(r, c, 0.14, 0, -ROW_H * 0.75);
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
  fillInitialRows(5, true);
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

  let anySliding = false;
  for (const key in cellPhysics) {
    const p = cellPhysics[key];

    if (p.slidingIn) {
      // Плавное скольжение сверху при заполнении поля
      p.oy *= 0.84;
      if (Math.abs(p.oy) < 1.5) {
        p.oy = 0;
        p.slidingIn = false;
        p.wv += 0.16; // мягкий желейный отскок при приземлении
      } else {
        anySliding = true;
      }
    } else {
      p.ovx += -p.ox * 0.24;
      p.ovy += -p.oy * 0.24;
      p.ovx *= 0.72;
      p.ovy *= 0.72;
      p.ox += p.ovx;
      p.oy += p.ovy;
    }

    p.wv += -p.wobble * 0.28;
    p.wv *= 0.8;
    p.wobble += p.wv;

    if (
      !p.slidingIn &&
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
  isRefilling = anySliding;

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

// Быстрая отрисовка мармеладного шарика из кэша
function drawGummyBubble(x, y, colorIdx, radius = R, alpha = 1, sx = 1, sy = 1, rot = 0) {
  const sprite = bubbleSprites[colorIdx];
  if (!sprite) return;
  const drawSize = radius * 2.4;

  ctx.save();
  if (alpha < 1) ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(x, y);
  if (rot !== 0) ctx.rotate(rot);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  ctx.drawImage(sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
  ctx.restore();
}

function drawAimLine() {
  if (bullet || gameOver || isRefilling) return;

  let x = CANNON_X;
  let y = CANNON_Y;
  let vx = Math.cos(aimAngle);
  let vy = Math.sin(aimAngle);
  const step = 5;

  const points = [{ x, y }];
  const bounces = [];

  for (let i = 0; i < 280; i++) {
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
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([7, 9]);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  points.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
  ctx.stroke();

  ctx.strokeStyle = col;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  points.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
  ctx.stroke();
  ctx.setLineDash([]);

  for (const b of bounces) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = col;
    ctx.stroke();
  }

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
  ctx.drawImage(bgCanvas, 0, 0);

  for (const b of ambientBubbles) {
    ctx.drawImage(ambientSprite, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }

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
        drawGummyBubble(pos.x + ox, pos.y + oy, grid[r][c], R, 1, 1 + w, 1 - w, 0);
      }
    }
  }

  for (const fb of fallingBubbles) {
    const w = Math.sin(fb.wobblePhase) * 0.1;
    drawGummyBubble(fb.x, fb.y, fb.color, R * fb.scale, fb.alpha, 1 + w, 1 - w, 0);
  }

  drawAimLine();
  drawCannon();

  if (!bullet) {
    const s = 1 + Math.sin(swapAnim * Math.PI) * 0.16;
    drawGummyBubble(CANNON_X, CANNON_Y, currentColor, R - 2, 1, s, 2 - s, 0);
  }

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
  ctx.font = "800 13px 'Nunito', sans-serif";
  ctx.fillText("след. ⇄", CANNON_X + 34, CANNON_Y + 4);
  drawGummyBubble(NEXT_X, NEXT_Y, nextColor, 14);

  if (bullet) {
    const moveAngle = Math.atan2(bullet.vy, bullet.vx);
    const sx = 1.09 + bullet.wobble;
    const sy = 0.91 - bullet.wobble;
    drawGummyBubble(bullet.x, bullet.y, bullet.color, R, 1, sx, sy, moveAngle);
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
  if (bullet || gameOver || isRefilling) return;
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

// Глобальное прицеливание и стрельба (даже если курсор вне поля, кроме зоны кнопок)
window.addEventListener("pointermove", setAimFromPointer);

window.addEventListener("pointerdown", (e) => {
  // Игнорируем клики по любым кнопкам и окну проигрыша
  if (e.target.closest("button, .overlay-card")) return;

  if (e.button === 2) {
    swapBubbles();
    return;
  }

  const { x, y } = getCanvasCoords(e);
  if (Math.hypot(x - NEXT_X, y - NEXT_Y) <= 24) {
    swapBubbles();
    return;
  }

  setAimFromPointer(e);
  shoot();
});

window.addEventListener("contextmenu", (e) => {
  if (!e.target.closest("button")) e.preventDefault();
});

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

initCachedSprites();
if (!loadState()) {
  startNewGame();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
